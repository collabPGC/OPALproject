/**
 * LLM Helper
 *
 * High-level interface for LLM operations using the model router.
 * Provides task-specific methods that automatically select the best model.
 *
 * Usage:
 *   import llm from '../shared/llm.js';
 *   await llm.init(logger);
 *
 *   // Task-based routing
 *   const result = await llm.research(messages, { system });
 *   const result = await llm.summarize(messages, { system });
 *   const result = await llm.code(messages, { system });
 *
 *   // Direct model access (backward compatible)
 *   const result = await llm.complete(model, messages, options);
 */

import router from './model-router.js';

let initialized = false;
let logger = console;

/**
 * Initialize the LLM helper
 */
export async function init(customLogger = console) {
  if (initialized) return true;
  logger = customLogger;

  try {
    await router.init(logger);
    initialized = true;
    return true;
  } catch (error) {
    logger.log?.('error', 'LLM init failed', { error: error.message }) ||
      console.error('[LLM] Init failed:', error.message);
    throw error;
  }
}

/**
 * Extract text from response content
 */
function extractText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('');
  }
  return '';
}

/**
 * Research task - uses premium reasoning models
 */
export async function research(messages, options = {}) {
  const response = await router.complete('research', messages, options);
  return {
    text: extractText(response.content),
    model: response.selectedModel,
    provider: response.selectedProvider,
    usage: response.usage,
    raw: response
  };
}

/**
 * Code generation/analysis - uses code-optimized models
 */
export async function code(messages, options = {}) {
  const response = await router.complete('code', messages, options);
  return {
    text: extractText(response.content),
    model: response.selectedModel,
    provider: response.selectedProvider,
    usage: response.usage,
    raw: response
  };
}

/**
 * Summarization - uses fast, cost-effective models
 */
export async function summarize(messages, options = {}) {
  const response = await router.complete('summary', messages, {
    ...options,
    costTier: options.costTier || 'budget'
  });
  return {
    text: extractText(response.content),
    model: response.selectedModel,
    provider: response.selectedProvider,
    usage: response.usage,
    raw: response
  };
}

/**
 * Translation - uses translation-optimized models
 */
export async function translate(messages, options = {}) {
  const response = await router.complete('translation', messages, options);
  return {
    text: extractText(response.content),
    model: response.selectedModel,
    provider: response.selectedProvider,
    usage: response.usage,
    raw: response
  };
}

/**
 * Vision tasks - uses vision-capable models
 */
export async function vision(messages, options = {}) {
  const response = await router.complete('vision', messages, {
    ...options,
    requiredCapabilities: ['vision']
  });
  return {
    text: extractText(response.content),
    model: response.selectedModel,
    provider: response.selectedProvider,
    usage: response.usage,
    raw: response
  };
}

/**
 * Math/reasoning tasks - uses reasoning-optimized models
 */
export async function math(messages, options = {}) {
  const response = await router.complete('math', messages, options);
  return {
    text: extractText(response.content),
    model: response.selectedModel,
    provider: response.selectedProvider,
    usage: response.usage,
    raw: response
  };
}

/**
 * General purpose - balanced model selection
 */
export async function general(messages, options = {}) {
  const response = await router.complete('general', messages, options);
  return {
    text: extractText(response.content),
    model: response.selectedModel,
    provider: response.selectedProvider,
    usage: response.usage,
    raw: response
  };
}

/**
 * Long context tasks - uses models with large context windows
 */
export async function longContext(messages, options = {}) {
  const response = await router.complete('long-context', messages, options);
  return {
    text: extractText(response.content),
    model: response.selectedModel,
    provider: response.selectedProvider,
    usage: response.usage,
    raw: response
  };
}

/**
 * Direct model completion (backward compatible with anthropic.messages.create)
 */
export async function complete(model, messages, options = {}) {
  const response = await router.completeDirect(model, messages, options);
  return {
    content: response.content,
    stop_reason: response.stopReason,
    usage: {
      input_tokens: response.usage?.inputTokens,
      output_tokens: response.usage?.outputTokens
    },
    model: response.model,
    provider: response.provider
  };
}

/**
 * Get router status
 */
export function getStatus() {
  return router.getStatus();
}

export default {
  init,
  research,
  code,
  summarize,
  translate,
  vision,
  math,
  general,
  longContext,
  complete,
  getStatus
};
