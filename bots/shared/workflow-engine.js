/**
 * Workflow Engine - Executes multi-step workflows
 *
 * Workflows are YAML-defined pipelines that:
 * - Chain multiple skills together
 * - Pass output from one step to next
 * - Support conditional branching
 * - Enable parallel execution
 * - Integrate Ralph mode iteration
 *
 * Workflow structure:
 * name: research-deep
 * description: Deep research with iteration
 * steps:
 *   - skill: research
 *     input: {{topic}}
 *     output: initial_research
 *   - skill: critique
 *     input: {{initial_research}}
 *     output: critique
 *   - skill: synthesize
 *     inputs: [initial_research, critique]
 *     output: final
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as skillLoader from './skill-loader.js';
import * as ralph from './ralph-mode.js';
import llm from './llm.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOWS_DIR = path.join(__dirname, 'workflows');

// Workflow cache
const workflowCache = new Map();

/**
 * Parse simple YAML workflow definition
 */
function parseWorkflowYaml(content) {
  const lines = content.split('\n');
  const workflow = {
    name: '',
    description: '',
    version: '1.0',
    steps: [],
    ralphMode: 'auto',
    maxIterations: 3
  };

  let currentStep = null;
  let inSteps = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = line.length - line.trimStart().length;

    // Top-level properties
    if (indent === 0 && trimmed.includes(':')) {
      const [key, ...valueParts] = trimmed.split(':');
      const value = valueParts.join(':').trim();

      if (key === 'steps') {
        inSteps = true;
        continue;
      }

      inSteps = false;
      if (value) {
        workflow[key] = value === 'true' ? true : value === 'false' ? false : value;
      }
    }
    // Step definitions
    else if (inSteps && trimmed.startsWith('- ')) {
      // New step
      if (currentStep) workflow.steps.push(currentStep);
      currentStep = {};

      const firstProp = trimmed.substring(2);
      if (firstProp.includes(':')) {
        const [k, v] = firstProp.split(':').map(s => s.trim());
        currentStep[k] = v;
      }
    }
    // Step properties
    else if (inSteps && currentStep && indent >= 4) {
      const [key, ...valueParts] = trimmed.split(':');
      let value = valueParts.join(':').trim();

      // Parse arrays
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(v => v.trim());
      }

      currentStep[key.trim()] = value;
    }
  }

  if (currentStep) workflow.steps.push(currentStep);

  return workflow;
}

/**
 * Load workflow from file
 */
function loadWorkflow(name) {
  if (workflowCache.has(name)) {
    return workflowCache.get(name);
  }

  const yamlPath = path.join(WORKFLOWS_DIR, `${name}.yaml`);
  const ymlPath = path.join(WORKFLOWS_DIR, `${name}.yml`);

  let filePath = null;
  if (fs.existsSync(yamlPath)) filePath = yamlPath;
  else if (fs.existsSync(ymlPath)) filePath = ymlPath;

  if (!filePath) {
    throw new Error(`Workflow not found: ${name}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const workflow = parseWorkflowYaml(content);
  workflow.name = name;

  workflowCache.set(name, workflow);
  return workflow;
}

/**
 * Execute a single step
 */
async function executeStep(step, context, logFn) {
  const { skill: skillName, input, inputs, output, condition } = step;

  // Check condition if present
  if (condition) {
    const conditionMet = evaluateCondition(condition, context);
    if (!conditionMet) {
      logFn(`[Workflow] Skipping step (condition not met): ${skillName}`);
      return context;
    }
  }

  // Get the skill
  const skill = skillLoader.getSkill(skillName);
  if (!skill) {
    throw new Error(`Skill not found: ${skillName}`);
  }

  // Build input from context
  let stepInput = '';
  if (input) {
    stepInput = substituteVariables(input, context);
  } else if (inputs && Array.isArray(inputs)) {
    stepInput = inputs.map(i => context[i] || '').join('\n\n---\n\n');
  }

  // Build the prompt
  const prompt = skillLoader.buildPrompt(skill, {
    ...context,
    input: stepInput,
    topic: context.topic || stepInput
  });

  logFn(`[Workflow] Executing step: ${skillName}`);

  // Execute via LLM
  const result = await llm.complete(skill.model === 'auto' ? 'research' : skill.model, [{
    role: 'user',
    content: prompt
  }], {
    maxTokens: skill.maxTokens || 4096,
    temperature: skill.temperature || 0.7
  });

  // Store output in context
  if (output) {
    context[output] = result.text;
  }
  context._lastOutput = result.text;

  return context;
}

/**
 * Substitute {{variables}} in string
 */
function substituteVariables(template, context) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return context[key] !== undefined ? context[key] : match;
  });
}

/**
 * Evaluate simple condition
 */
function evaluateCondition(condition, context) {
  // Simple conditions: "confidence < 0.7" or "hasGaps == true"
  const match = condition.match(/(\w+)\s*(==|!=|<|>|<=|>=)\s*(.+)/);
  if (!match) return true;

  const [, varName, operator, valueStr] = match;
  const contextValue = context[varName];
  let compareValue = valueStr.trim();

  // Parse compare value
  if (compareValue === 'true') compareValue = true;
  else if (compareValue === 'false') compareValue = false;
  else if (!isNaN(compareValue)) compareValue = Number(compareValue);

  switch (operator) {
    case '==': return contextValue == compareValue;
    case '!=': return contextValue != compareValue;
    case '<': return contextValue < compareValue;
    case '>': return contextValue > compareValue;
    case '<=': return contextValue <= compareValue;
    case '>=': return contextValue >= compareValue;
    default: return true;
  }
}

/**
 * Execute a complete workflow
 */
export async function execute(workflowName, initialContext = {}, logFn = console.log) {
  const workflow = loadWorkflow(workflowName);

  logFn(`[Workflow] Starting: ${workflow.name} (${workflow.steps.length} steps)`);

  let context = {
    ...initialContext,
    _workflow: workflow.name,
    _startTime: Date.now()
  };

  // Execute steps sequentially
  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    logFn(`[Workflow] Step ${i + 1}/${workflow.steps.length}: ${step.skill}`);

    try {
      context = await executeStep(step, context, logFn);
    } catch (error) {
      logFn(`[Workflow] Step failed: ${error.message}`);
      context._error = error.message;
      break;
    }
  }

  context._endTime = Date.now();
  context._duration = context._endTime - context._startTime;

  logFn(`[Workflow] Completed in ${context._duration}ms`);

  return context;
}

/**
 * Execute workflow with Ralph mode iteration
 */
export async function executeWithRalph(workflowName, initialContext = {}, depth = 'standard', logFn = console.log) {
  const workflow = loadWorkflow(workflowName);

  // Wrap workflow execution for Ralph iteration
  const workflowFn = async (topic, context, ralphPrompt) => {
    const result = await execute(workflowName, {
      ...initialContext,
      topic,
      context,
      ralphContext: ralphPrompt
    }, logFn);

    return result._lastOutput || '';
  };

  // Use Ralph for iterative execution
  const ralphResult = await ralph.iterativeAnalysis(
    workflowFn,
    initialContext.topic || '',
    JSON.stringify(initialContext),
    depth,
    logFn
  );

  return {
    output: ralphResult.output,
    iterations: ralphResult.iterations,
    confidence: ralphResult.confidence,
    extended: ralphResult.extended,
    workflow: workflowName
  };
}

/**
 * List available workflows
 */
export function listWorkflows() {
  if (!fs.existsSync(WORKFLOWS_DIR)) {
    return [];
  }

  return fs.readdirSync(WORKFLOWS_DIR)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
    .map(f => {
      const name = f.replace(/\.ya?ml$/, '');
      try {
        const workflow = loadWorkflow(name);
        return {
          name,
          description: workflow.description,
          steps: workflow.steps.length
        };
      } catch {
        return { name, error: 'Failed to load' };
      }
    });
}

/**
 * Reload workflow cache
 */
export function reloadWorkflows() {
  workflowCache.clear();
  return listWorkflows();
}

/**
 * Create a simple sequential workflow programmatically
 */
export function createSequentialWorkflow(name, skillNames, options = {}) {
  const workflow = {
    name,
    description: options.description || `Sequential workflow: ${skillNames.join(' -> ')}`,
    version: '1.0',
    steps: skillNames.map((skill, i) => ({
      skill,
      input: i === 0 ? '{{topic}}' : '{{_lastOutput}}',
      output: `step${i + 1}_output`
    })),
    ralphMode: options.ralphMode || 'auto',
    maxIterations: options.maxIterations || 3
  };

  workflowCache.set(name, workflow);
  return workflow;
}

export default {
  execute,
  executeWithRalph,
  listWorkflows,
  reloadWorkflows,
  createSequentialWorkflow,
  loadWorkflow,
  WORKFLOWS_DIR
};
