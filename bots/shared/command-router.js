/**
 * Command Router - Routes commands to modular skill/workflow system
 *
 * Acts as a bridge between legacy bot index.js files and the new
 * modular architecture (skills, workflows, personas).
 *
 * The router:
 * 1. Parses incoming commands (! prefix)
 * 2. Finds matching skills by trigger
 * 3. Executes skill with persona context
 * 4. Optionally runs workflows
 * 5. Applies Ralph mode iteration when needed
 */

import * as skillLoader from './skill-loader.js';
import * as workflowEngine from './workflow-engine.js';
import * as personaManager from './persona-manager.js';
import * as ralph from './ralph-mode.js';
import * as documentGenerator from './document-generator.js';
import llm from './llm.js';

// Command pattern: !command args...
const COMMAND_PATTERN = /^!(\w+)\s*(.*)/;

// Special workflow triggers (run full workflow, not single skill)
const WORKFLOW_TRIGGERS = {
  'deep-research': 'deep-research',
  'ultra': 'deep-research',
  'comprehensive': 'comprehensive-report',
  'report': 'comprehensive-report',
  'creative': 'creative-brainstorm',
  'dialectic': 'dialectic-debate',
  'debate': 'dialectic-debate',
  'review': 'internal-review',
  'team': 'team-deliberation',
  'deliberate': 'team-deliberation',
  'council': 'team-deliberation'
};

// Import crew system for dialectic
import * as crew from './crew/index.js';

/**
 * Parse command from message text
 */
export function parseCommand(message) {
  const match = message.trim().match(COMMAND_PATTERN);
  if (!match) return null;

  const [, command, argsStr] = match;
  const args = argsStr.trim().split(/\s+/).filter(Boolean);

  return {
    command: command.toLowerCase(),
    args,
    rawArgs: argsStr.trim()
  };
}

/**
 * Route command to appropriate skill/workflow
 */
export async function routeCommand(command, context, options = {}) {
  const {
    botName = 'scout',
    channelContext = '',
    semanticContext = '',
    depth = 'standard',
    logFn = console.log
  } = options;

  logFn(`[Router] Routing command: ${command.command}`);

  // Check if this is a workflow trigger
  const workflowName = WORKFLOW_TRIGGERS[command.command];
  if (workflowName) {
    return await executeWorkflow(workflowName, command, context, options);
  }

  // Check if this is a document generation request
  if (command.command === 'document' || command.command === 'doc') {
    return await generateDocument(command, context, options);
  }

  // Find matching skill
  const skill = skillLoader.findSkillByTrigger(command.command);
  if (!skill) {
    // Return null to let legacy handler deal with it
    logFn(`[Router] No skill found for: ${command.command}`);
    return null;
  }

  logFn(`[Router] Found skill: ${skill.name}`);

  return await executeSkill(skill, command, context, options);
}

/**
 * Execute a skill with context
 */
async function executeSkill(skill, command, context, options) {
  const {
    botName = 'scout',
    channelContext = '',
    semanticContext = '',
    depth = 'standard',
    logFn = console.log
  } = options;

  const topic = command.rawArgs || command.args.join(' ');

  // Check if QA is enabled for this skill - run crew pipeline by default
  const qa = skill.qualityAssurance || {};
  if (qa.enabled && qa.autoApply) {
    logFn(`[Router] QA enabled for ${skill.name} - using team review pipeline`);

    // Use crew pipeline for automatic quality assurance
    const pipelineType = skill.name === 'brainstorm' ? 'brainstorm' : 'research';

    try {
      const pipelineResult = await crew.runPipeline(pipelineType, topic, channelContext + '\n' + semanticContext, {
        log: logFn,
        maxTokens: skill.maxTokens || 65536
      });

      return {
        text: pipelineResult.finalOutput,
        iterations: pipelineResult.stages.length,
        confidence: 0.9,
        extended: true,
        qaApplied: true
      };
    } catch (error) {
      logFn(`[Router] QA pipeline failed, falling back to standard: ${error.message}`);
      // Fall through to standard execution
    }
  }

  // Get persona for this bot
  const persona = personaManager.getBotPersona(botName);

  // Detect domain from content for adaptive expertise
  const domain = personaManager.detectDomain(channelContext + '\n' + semanticContext + '\n' + topic);
  const domainPersona = personaManager.getDomainPersona(domain);

  logFn(`[Router] Executing skill: ${skill.name}, domain: ${domain}`);

  // Build the prompt
  const promptContext = {
    topic,
    context: channelContext,
    semantic_context: semanticContext,
    domain,
    domain_expertise: domainPersona ? domainPersona.expertise : '',
    depth
  };

  const prompt = skillLoader.buildPrompt(skill, promptContext);

  // Build system prompt from persona
  const systemPrompt = personaManager.buildSystemPrompt(botName, domain);

  // Determine if Ralph mode should be used
  const useRalph = skill.ralphMode === 'always' ||
    (skill.ralphMode === 'auto' && (depth === 'deep' || topic.length > 200));

  let result;

  if (useRalph) {
    logFn(`[Router] Using Ralph iterative mode for: ${skill.name}`);

    const doAnalysis = async (analyseTopic, analyseContext, ralphPrompt) => {
      const messages = [
        { role: 'user', content: prompt + (ralphPrompt ? `\n\n## Self-Critique Guidance\n${ralphPrompt}` : '') }
      ];

      const response = await llm.complete(skill.model === 'auto' ? 'research' : skill.model, messages, {
        system: systemPrompt,
        maxTokens: skill.maxTokens || 65536,
        temperature: skill.temperature || 0.7
      });

      return response.text;
    };

    const ralphResult = await ralph.iterativeAnalysis(
      doAnalysis,
      topic,
      channelContext + '\n' + semanticContext,
      depth,
      logFn
    );

    result = {
      text: ralphResult.output,
      iterations: ralphResult.iterations,
      confidence: ralphResult.confidence,
      extended: ralphResult.extended
    };
  } else {
    const messages = [
      { role: 'user', content: prompt }
    ];

    const response = await llm.complete(skill.model === 'auto' ? 'research' : skill.model, messages, {
      system: systemPrompt,
      maxTokens: skill.maxTokens || 65536,
      temperature: skill.temperature || 0.7
    });

    result = {
      text: response.text,
      iterations: 1,
      confidence: 0.8,
      extended: false
    };
  }

  logFn(`[Router] Skill complete: ${skill.name}, ${result.text.length} chars`);

  return result;
}

/**
 * Execute a workflow
 */
async function executeWorkflow(workflowName, command, context, options) {
  const {
    botName = 'scout',
    channelContext = '',
    semanticContext = '',
    depth = 'standard',
    logFn = console.log
  } = options;

  logFn(`[Router] Executing workflow: ${workflowName}`);

  const topic = command.rawArgs || command.args.join(' ');

  // Use crew system for dialectic workflows
  if (workflowName === 'dialectic-debate') {
    logFn(`[Router] Using crew dialectic system`);
    try {
      const dialecticResult = await crew.runDialectic(topic, 2, {
        log: logFn,
        maxTokens: 65536
      });

      const output = `## Dialectic Analysis: ${topic}

### Final Thesis
${dialecticResult.finalThesis}

### Final Antithesis (Counter-Arguments)
${dialecticResult.finalAntithesis}

### Synthesis
${dialecticResult.finalSynthesis}

### Validation
${dialecticResult.validation}`;

      return {
        text: output,
        iterations: dialecticResult.rounds,
        confidence: 0.85,
        extended: true,
        workflow: workflowName
      };
    } catch (error) {
      logFn(`[Router] Dialectic failed: ${error.message}`);
      throw error;
    }
  }

  // Use crew pipeline for internal-review
  if (workflowName === 'internal-review') {
    logFn(`[Router] Using crew research pipeline with review`);
    try {
      const pipelineResult = await crew.runPipeline('research', topic, channelContext, {
        log: logFn,
        maxTokens: 65536
      });

      return {
        text: pipelineResult.finalOutput,
        iterations: pipelineResult.stages.length,
        confidence: 0.8,
        extended: true,
        workflow: workflowName
      };
    } catch (error) {
      logFn(`[Router] Pipeline failed: ${error.message}`);
      throw error;
    }
  }

  // Use crew team deliberation for full team discussion
  if (workflowName === 'team-deliberation') {
    logFn(`[Router] Using crew team deliberation system`);
    try {
      const deliberationResult = await crew.runTeamDeliberation(topic, {
        log: logFn,
        maxTokens: 65536,
        agents: ['researcher', 'analyst', 'critic', 'ideator', 'pm_expert', 'tech_expert']
      });

      // Format output with all perspectives
      const perspectivesFormatted = Object.entries(deliberationResult.perspectives)
        .map(([id, text]) => `### ${crew.AGENT_ROLES[id]?.role || id}\n${text}`)
        .join('\n\n');

      const responsesFormatted = Object.entries(deliberationResult.responses)
        .map(([id, text]) => `### ${crew.AGENT_ROLES[id]?.role || id}\n${text}`)
        .join('\n\n');

      const output = `## Team Deliberation: ${topic}

### Round 1: Initial Perspectives
${perspectivesFormatted}

---

### Round 2: Cross-Response
${responsesFormatted}

---

### Quality Assessment
${deliberationResult.validation}

---

### Final Synthesis
${deliberationResult.synthesis}`;

      return {
        text: output,
        iterations: deliberationResult.agents * 2 + 2, // perspectives + responses + validation + synthesis
        confidence: 0.9,
        extended: true,
        workflow: workflowName
      };
    } catch (error) {
      logFn(`[Router] Team deliberation failed: ${error.message}`);
      throw error;
    }
  }

  // Standard workflow execution
  const initialContext = {
    topic,
    context: channelContext,
    semantic_context: semanticContext,
    bot: botName,
    depth
  };

  try {
    const result = await workflowEngine.executeWithRalph(
      workflowName,
      initialContext,
      depth,
      logFn
    );

    return {
      text: result.output,
      iterations: result.iterations,
      confidence: result.confidence,
      extended: result.extended,
      workflow: workflowName
    };
  } catch (error) {
    logFn(`[Router] Workflow failed: ${error.message}`);
    throw error;
  }
}

/**
 * Generate a long-form document
 */
async function generateDocument(command, context, options) {
  const {
    botName = 'scout',
    channelContext = '',
    semanticContext = '',
    logFn = console.log
  } = options;

  const topic = command.rawArgs || command.args.join(' ');

  logFn(`[Router] Generating document for: ${topic}`);

  // Parse document type from args
  const docType = command.args[0] || 'analysis';
  const docTopic = command.args.slice(1).join(' ') || topic;

  // Generate outline first
  const doc = await documentGenerator.generateOutline(docTopic, docType, {
    pages: '50-150',  // Capable of long docs, not forced to be long
    wordCount: '25000-75000',
    audience: 'Executive and technical stakeholders',
    purpose: 'Comprehensive analysis and recommendations'
  }, logFn);

  logFn(`[Router] Document outline created: ${doc.sections.length} sections`);

  // Generate document section by section
  const completedDoc = await documentGenerator.generateDocument(doc, {
    onSectionComplete: (result, doc) => {
      logFn(`[Router] Section complete: ${result.title} (${result.wordCount} words)`);
    }
  }, logFn);

  // Compile to markdown
  const content = documentGenerator.compileDocument(completedDoc, {
    includeToc: true,
    includeMetadata: true
  });

  return {
    text: content,
    document: completedDoc,
    wordCount: completedDoc.getTotalWordCount(),
    sections: completedDoc.sections.length
  };
}

/**
 * Get available commands from skills
 */
export function getAvailableCommands() {
  const skills = skillLoader.loadAllSkills();
  const commands = {};

  for (const [name, skill] of skills) {
    for (const trigger of skill.triggers || [name]) {
      commands[trigger] = {
        skill: name,
        description: skill.description,
        version: skill.version
      };
    }
  }

  // Add workflow triggers
  for (const [trigger, workflow] of Object.entries(WORKFLOW_TRIGGERS)) {
    commands[trigger] = {
      workflow,
      description: `Run ${workflow} workflow`
    };
  }

  // Add document generation
  commands['document'] = {
    description: 'Generate long-form document (100+ pages capable)'
  };
  commands['doc'] = commands['document'];

  return commands;
}

/**
 * Check if a command is handled by the router
 */
export function isRouterCommand(command) {
  const skill = skillLoader.findSkillByTrigger(command);
  if (skill) return true;

  if (WORKFLOW_TRIGGERS[command]) return true;

  if (command === 'document' || command === 'doc') return true;

  return false;
}

export default {
  parseCommand,
  routeCommand,
  getAvailableCommands,
  isRouterCommand
};
