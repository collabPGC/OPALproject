/**
 * Crew Orchestration System
 *
 * CrewAI-inspired multi-agent orchestration with role-based agents,
 * dialectic cooperation, and stage-based pipelines.
 *
 * Borrows patterns from visual-essay-generator skills.
 */

import router from '../model-router.js';

// Agent role definitions
const AGENT_ROLES = {
  // Research & Analysis Crew
  researcher: {
    role: 'Senior Research Analyst',
    goal: 'Gather comprehensive information and identify key insights',
    backstory: 'Expert at synthesizing complex information from multiple sources into actionable intelligence. Known for thoroughness and attention to detail.',
    capabilities: ['web_search', 'document_analysis', 'data_synthesis'],
    taskType: 'research'
  },

  analyst: {
    role: 'Strategic Analyst',
    goal: 'Analyze data and generate hypotheses with supporting evidence',
    backstory: 'McKinsey-trained strategist who excels at MECE frameworks, hypothesis-driven analysis, and identifying non-obvious patterns.',
    capabilities: ['hypothesis_generation', 'framework_application', 'competitive_analysis'],
    taskType: 'research'
  },

  critic: {
    role: 'Devil\'s Advocate',
    goal: 'Challenge assumptions and identify weaknesses in arguments',
    backstory: 'Skilled at stress-testing ideas, finding logical flaws, and ensuring robust conclusions. Constructively adversarial.',
    capabilities: ['critical_analysis', 'risk_identification', 'assumption_testing'],
    taskType: 'research'
  },

  synthesizer: {
    role: 'Synthesis Editor',
    goal: 'Combine multiple perspectives into coherent, actionable output',
    backstory: 'Expert at distilling complex debates into clear recommendations. Creates unity from diverse viewpoints.',
    capabilities: ['synthesis', 'summarization', 'recommendation_generation'],
    taskType: 'summary'
  },

  // Creative Crew
  ideator: {
    role: 'Creative Director',
    goal: 'Generate innovative ideas and novel approaches',
    backstory: 'Design thinking practitioner who combines divergent thinking with practical constraints. Embraces "yes, and" philosophy.',
    capabilities: ['brainstorming', 'ideation', 'concept_development'],
    taskType: 'brainstorm'
  },

  architect: {
    role: 'Information Architect',
    goal: 'Structure content into clear, logical frameworks',
    backstory: 'Expert at organizing complex information into navigable structures. Creates blueprints that guide execution.',
    capabilities: ['structuring', 'framework_design', 'blueprint_generation'],
    taskType: 'research'
  },

  // Quality Crew
  validator: {
    role: 'Quality Assurance Lead',
    goal: 'Ensure output meets requirements and is factually accurate',
    backstory: 'Meticulous reviewer who catches errors others miss. Ensures deliverables are production-ready.',
    capabilities: ['fact_checking', 'quality_validation', 'consistency_checking'],
    taskType: 'summary'
  },

  // Domain Experts
  pm_expert: {
    role: 'Senior Project Manager',
    goal: 'Provide PM best practices and methodology guidance',
    backstory: 'PMP-certified expert in agile and waterfall methodologies. Specializes in risk management and stakeholder alignment.',
    capabilities: ['project_planning', 'risk_assessment', 'methodology_selection'],
    taskType: 'research'
  },

  tech_expert: {
    role: 'Technical Architect',
    goal: 'Provide technical analysis and implementation guidance',
    backstory: 'Full-stack architect with experience across cloud, AI/ML, and enterprise systems. Balances innovation with pragmatism.',
    capabilities: ['technical_analysis', 'architecture_design', 'implementation_planning'],
    taskType: 'code'
  }
};

// Pipeline stage definitions (borrowed from visual-essay skill pattern)
const PIPELINE_STAGES = {
  research: [
    { stage: 1, agent: 'researcher', action: 'gather', description: 'Gather information and context' },
    { stage: 2, agent: 'analyst', action: 'analyze', description: 'Generate hypotheses and analysis' },
    { stage: 2.5, agent: 'critic', action: 'challenge', description: 'Challenge assumptions (Proof Gate)' },
    { stage: 3, agent: 'synthesizer', action: 'synthesize', description: 'Synthesize into recommendations' }
  ],

  brainstorm: [
    { stage: 1, agent: 'ideator', action: 'diverge', description: 'Generate diverse ideas' },
    { stage: 2, agent: 'critic', action: 'evaluate', description: 'Evaluate and challenge ideas' },
    { stage: 3, agent: 'architect', action: 'structure', description: 'Structure viable ideas' },
    { stage: 4, agent: 'synthesizer', action: 'converge', description: 'Converge to recommendations' }
  ],

  analysis: [
    { stage: 1, agent: 'researcher', action: 'context', description: 'Gather context and data' },
    { stage: 2, agent: 'analyst', action: 'framework', description: 'Apply analytical framework' },
    { stage: 2.5, agent: 'validator', action: 'validate', description: 'Validate analysis (Proof Gate)' },
    { stage: 3, agent: 'synthesizer', action: 'recommend', description: 'Generate recommendations' }
  ],

  dialectic: [
    { stage: 1, agent: 'analyst', action: 'thesis', description: 'Present initial thesis' },
    { stage: 2, agent: 'critic', action: 'antithesis', description: 'Present counter-arguments' },
    { stage: 3, agent: 'synthesizer', action: 'synthesis', description: 'Synthesize into higher truth' },
    { stage: 4, agent: 'validator', action: 'validate', description: 'Validate synthesis' }
  ]
};

/**
 * Execute a single agent task
 */
async function executeAgent(agentId, task, context, options = {}) {
  const agent = AGENT_ROLES[agentId];
  if (!agent) throw new Error(`Unknown agent: ${agentId}`);

  const systemPrompt = `You are a ${agent.role}.

GOAL: ${agent.goal}

BACKSTORY: ${agent.backstory}

CAPABILITIES: ${agent.capabilities.join(', ')}

OUTPUT FORMAT:
- Be specific and actionable
- Support claims with evidence
- Use structured formatting (headers, bullets, tables)
- End with clear "KEY FINDINGS" or "RECOMMENDATIONS" section`;

  const result = await router.complete(agent.taskType, [
    { role: 'user', content: task }
  ], {
    system: systemPrompt,
    maxTokens: options.maxTokens || 2048,
    ...options
  });

  return {
    agent: agentId,
    role: agent.role,
    output: extractText(result.content),
    model: result.selectedModel,
    provider: result.selectedProvider
  };
}

/**
 * Run a full pipeline with multiple agents
 */
async function runPipeline(pipelineType, initialTask, context = '', options = {}) {
  const pipeline = PIPELINE_STAGES[pipelineType];
  if (!pipeline) throw new Error(`Unknown pipeline: ${pipelineType}`);

  const log = options.log || console.log;
  const results = [];
  let accumulatedContext = context;

  log(`\n${'='.repeat(60)}`);
  log(`CREW PIPELINE: ${pipelineType.toUpperCase()}`);
  log(`${'='.repeat(60)}\n`);

  for (const stage of pipeline) {
    log(`\n--- Stage ${stage.stage}: ${stage.description} ---`);
    log(`Agent: ${AGENT_ROLES[stage.agent].role}`);

    // Build stage-specific task
    let stageTask = '';
    switch (stage.action) {
      case 'gather':
        stageTask = `TASK: ${initialTask}\n\nGather comprehensive information and context. Identify key facts, stakeholders, and considerations.`;
        break;
      case 'analyze':
        stageTask = `PREVIOUS RESEARCH:\n${accumulatedContext}\n\nTASK: Analyze this information. Generate hypotheses, identify patterns, apply relevant frameworks (MECE, Porter's, etc.).`;
        break;
      case 'challenge':
        stageTask = `ANALYSIS TO REVIEW:\n${accumulatedContext}\n\nTASK (PROOF GATE): Challenge this analysis. What assumptions are untested? What risks are overlooked? What alternative interpretations exist?`;
        break;
      case 'synthesize':
        stageTask = `ALL INPUTS:\n${accumulatedContext}\n\nTASK: Synthesize into clear, actionable recommendations. Balance competing perspectives. Prioritize by impact.`;
        break;
      case 'diverge':
        stageTask = `TASK: ${initialTask}\n\nBrainstorm widely. Generate 10+ diverse ideas without self-censoring. Include bold/unconventional approaches.`;
        break;
      case 'evaluate':
        stageTask = `IDEAS TO EVALUATE:\n${accumulatedContext}\n\nTASK: Critically evaluate each idea. Score on feasibility, impact, and novelty. Identify fatal flaws.`;
        break;
      case 'structure':
        stageTask = `EVALUATED IDEAS:\n${accumulatedContext}\n\nTASK: Structure the viable ideas into a coherent framework. Group by theme. Define implementation paths.`;
        break;
      case 'converge':
        stageTask = `STRUCTURED IDEAS:\n${accumulatedContext}\n\nTASK: Converge to top 3-5 recommendations with rationale and next steps.`;
        break;
      case 'thesis':
        stageTask = `TASK: ${initialTask}\n\nPresent a strong initial thesis with supporting arguments.`;
        break;
      case 'antithesis':
        stageTask = `THESIS:\n${accumulatedContext}\n\nTASK: Present the strongest counter-arguments. What's wrong with this thesis? What's being overlooked?`;
        break;
      case 'validate':
        stageTask = `OUTPUT TO VALIDATE:\n${accumulatedContext}\n\nTASK (PROOF GATE): Validate for accuracy, completeness, and actionability. Flag any issues.`;
        break;
      default:
        stageTask = `CONTEXT:\n${accumulatedContext}\n\nTASK: ${initialTask}`;
    }

    const result = await executeAgent(stage.agent, stageTask, context, options);
    results.push({ stage: stage.stage, ...result });

    // Accumulate context for next stage
    accumulatedContext += `\n\n### ${AGENT_ROLES[stage.agent].role} (Stage ${stage.stage}):\n${result.output}`;

    log(`✓ Completed (${result.provider}/${result.model})`);
  }

  log(`\n${'='.repeat(60)}`);
  log(`PIPELINE COMPLETE: ${results.length} stages executed`);
  log(`${'='.repeat(60)}\n`);

  return {
    pipeline: pipelineType,
    stages: results,
    finalOutput: results[results.length - 1]?.output,
    fullContext: accumulatedContext
  };
}

/**
 * Run a dialectic debate between agents
 */
async function runDialectic(topic, rounds = 2, options = {}) {
  const log = options.log || console.log;

  log(`\n${'='.repeat(60)}`);
  log(`DIALECTIC DEBATE: ${topic}`);
  log(`${'='.repeat(60)}\n`);

  let thesis = '';
  let antithesis = '';
  let synthesis = '';

  for (let round = 1; round <= rounds; round++) {
    log(`\n--- Round ${round} ---\n`);

    // Thesis (Analyst)
    const thesisTask = round === 1
      ? `Present a thesis on: ${topic}`
      : `Refine your thesis considering the previous synthesis:\n${synthesis}\n\nOriginal topic: ${topic}`;

    const thesisResult = await executeAgent('analyst', thesisTask, '', options);
    thesis = thesisResult.output;
    log(`THESIS (${thesisResult.role}):\n${thesis.substring(0, 300)}...\n`);

    // Antithesis (Critic)
    const antithesisTask = `Challenge this thesis:\n${thesis}\n\nPresent counter-arguments, alternative perspectives, and potential flaws.`;
    const antithesisResult = await executeAgent('critic', antithesisTask, '', options);
    antithesis = antithesisResult.output;
    log(`ANTITHESIS (${antithesisResult.role}):\n${antithesis.substring(0, 300)}...\n`);

    // Synthesis (Synthesizer)
    const synthesisTask = `THESIS:\n${thesis}\n\nANTITHESIS:\n${antithesis}\n\nSynthesize these perspectives into a higher truth that incorporates valid points from both sides.`;
    const synthesisResult = await executeAgent('synthesizer', synthesisTask, '', options);
    synthesis = synthesisResult.output;
    log(`SYNTHESIS (${synthesisResult.role}):\n${synthesis.substring(0, 300)}...\n`);
  }

  // Final validation
  const validationResult = await executeAgent('validator', `Validate this synthesis:\n${synthesis}`, '', options);

  return {
    topic,
    rounds,
    finalThesis: thesis,
    finalAntithesis: antithesis,
    finalSynthesis: synthesis,
    validation: validationResult.output
  };
}

/**
 * Run a full team deliberation with multiple agents
 * All team members contribute their perspective, respond to each other,
 * and synthesize into consensus
 */
async function runTeamDeliberation(topic, options = {}) {
  const log = options.log || console.log;
  const agents = options.agents || ['researcher', 'analyst', 'critic', 'ideator', 'pm_expert', 'tech_expert'];

  log(`\n${'='.repeat(60)}`);
  log(`TEAM DELIBERATION: ${topic}`);
  log(`${'='.repeat(60)}\n`);
  log(`Team: ${agents.map(a => AGENT_ROLES[a]?.role || a).join(', ')}\n`);

  const perspectives = {};
  const responses = {};

  // Round 1: Initial perspectives from each team member
  log(`\n--- ROUND 1: Initial Perspectives ---\n`);
  for (const agentId of agents) {
    const agent = AGENT_ROLES[agentId];
    if (!agent) continue;

    log(`${agent.role} presenting...`);
    const result = await executeAgent(agentId,
      `TOPIC: ${topic}

Provide your initial perspective on this topic from your unique viewpoint as a ${agent.role}.

Consider:
- What are the key factors from your expertise?
- What opportunities do you see?
- What concerns do you have?
- What questions need answering?

Be specific and substantive.`,
      '', options);

    perspectives[agentId] = result.output;
    log(`✓ ${agent.role} complete\n`);
  }

  // Build perspective summary for round 2
  const perspectiveSummary = Object.entries(perspectives)
    .map(([id, text]) => `### ${AGENT_ROLES[id]?.role || id}\n${text}`)
    .join('\n\n');

  // Round 2: Cross-response - each member responds to others
  log(`\n--- ROUND 2: Cross-Response ---\n`);
  for (const agentId of agents) {
    const agent = AGENT_ROLES[agentId];
    if (!agent) continue;

    log(`${agent.role} responding to colleagues...`);
    const result = await executeAgent(agentId,
      `TOPIC: ${topic}

YOUR COLLEAGUES' PERSPECTIVES:
${perspectiveSummary}

As the ${agent.role}, respond to your colleagues:
1. What do you AGREE with? (cite specific points)
2. What do you DISAGREE with? (explain why)
3. What's MISSING from the discussion?
4. How would you RECONCILE conflicting viewpoints?

Be direct and substantive.`,
      '', options);

    responses[agentId] = result.output;
    log(`✓ ${agent.role} complete\n`);
  }

  // Build response summary
  const responseSummary = Object.entries(responses)
    .map(([id, text]) => `### ${AGENT_ROLES[id]?.role || id} Response\n${text}`)
    .join('\n\n');

  // Round 3: Validator quality check
  log(`\n--- ROUND 3: Quality Assessment ---\n`);
  const validationResult = await executeAgent('validator',
    `TOPIC: ${topic}

TEAM DELIBERATION:

## Initial Perspectives
${perspectiveSummary}

## Cross-Responses
${responseSummary}

As Quality Assurance Lead, assess this deliberation:
1. Are all key perspectives represented?
2. Were important objections addressed?
3. What gaps remain in the analysis?
4. Is the team ready for synthesis, or is another round needed?

Provide quality assessment.`,
    '', options);
  log(`✓ Validator complete\n`);

  // Round 4: Final synthesis
  log(`\n--- ROUND 4: Final Synthesis ---\n`);
  const synthesisResult = await executeAgent('synthesizer',
    `TOPIC: ${topic}

FULL TEAM DELIBERATION:

## Initial Perspectives
${perspectiveSummary}

## Cross-Responses
${responseSummary}

## Quality Assessment
${validationResult.output}

As Synthesis Editor, create the final integrated output:

1. **CONSENSUS POINTS**: What does the team agree on?
2. **PRODUCTIVE TENSIONS**: Where do perspectives differ, and why?
3. **KEY INSIGHTS**: What emerged from the deliberation?
4. **INTEGRATED RECOMMENDATIONS**: What should be done?
5. **DISSENTING VIEWS**: What minority opinions deserve noting?
6. **NEXT STEPS**: Clear actionable next steps

Create a comprehensive synthesis that honors all perspectives while providing clear direction.`,
    '', options);
  log(`✓ Synthesis complete\n`);

  log(`${'='.repeat(60)}`);
  log(`DELIBERATION COMPLETE`);
  log(`${'='.repeat(60)}\n`);

  return {
    topic,
    perspectives,
    responses,
    validation: validationResult.output,
    synthesis: synthesisResult.output,
    agents: agents.length
  };
}

/**
 * Helper to extract text from LLM response
 */
function extractText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');
  }
  return '';
}

// Export
export {
  AGENT_ROLES,
  PIPELINE_STAGES,
  executeAgent,
  runPipeline,
  runDialectic,
  runTeamDeliberation
};

export default {
  AGENT_ROLES,
  PIPELINE_STAGES,
  executeAgent,
  runPipeline,
  runDialectic,
  runTeamDeliberation
};
