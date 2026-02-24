/**
 * Model Router
 *
 * Intelligently routes LLM requests to the best available model
 * based on task type, cost tier, and capabilities.
 *
 * Usage:
 *   import router from './model-router.js';
 *   await router.init();
 *   const response = await router.complete('research', messages, { system });
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import providers from './providers/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'config', 'models.json');

let config = null;
let initialized = false;
let logger = console;

/**
 * Initialize the router and all providers
 */
export async function init(customLogger = console) {
  if (initialized) return true;

  logger = customLogger;

  // Load config
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to load models config: ${error.message}`);
  }

  // Initialize providers
  await providers.init(config, logger);

  initialized = true;
  logger.log?.('info', 'Model router initialized') ||
    console.log('[ModelRouter] Initialized');

  return true;
}

/**
 * Select the best model for a task
 * @param {string} taskType - Task type (research, code, summary, etc.)
 * @param {Object} options - { costTier, requiredCapabilities, preferredProvider }
 * @returns {{ provider: string, model: string, info: Object }}
 */
export function selectModel(taskType, options = {}) {
  if (!config) throw new Error('Router not initialized');

  const {
    costTier,
    requiredCapabilities = [],
    preferredProvider
  } = options;

  // Get routing config for task type
  const routing = config.routing[taskType] || config.routing.general;
  const preferred = routing.preferred || [];
  const routingCaps = routing.requiredCapabilities || [];

  // Combine required capabilities
  const allRequiredCaps = [...new Set([...routingCaps, ...requiredCapabilities])];

  // Get enabled providers
  const enabledProviders = providers.getEnabledProviders();

  // Score and filter models
  const candidates = [];

  for (const modelId of preferred) {
    const modelInfo = providers.getModelInfo(modelId);

    if (!modelInfo) continue;
    if (!enabledProviders.includes(modelInfo.provider)) continue;

    // Check cost tier
    if (costTier && modelInfo.tier !== costTier) continue;

    // Check capabilities
    const modelCaps = modelInfo.capabilities || [];
    const hasAllCaps = allRequiredCaps.every(cap => modelCaps.includes(cap));
    if (!hasAllCaps) continue;

    // Prefer the specified provider
    const providerBonus = (preferredProvider === modelInfo.provider) ? 10 : 0;

    // Score by position in preferred list (earlier = better)
    const positionScore = preferred.length - preferred.indexOf(modelId);

    candidates.push({
      modelId,
      provider: modelInfo.provider,
      info: modelInfo,
      score: positionScore + providerBonus
    });
  }

  if (candidates.length === 0) {
    // Fallback to first available model from any enabled provider
    const available = providers.listAvailableModels();
    if (available.length === 0) {
      throw new Error(`No models available for task: ${taskType}`);
    }

    const fallback = available[0];
    return {
      provider: fallback.provider,
      model: fallback.id,
      info: fallback
    };
  }

  // Sort by score and return best
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  return {
    provider: best.provider,
    model: best.modelId,
    info: best.info
  };
}

/**
 * Complete a chat request with automatic model selection
 * @param {string} taskType - Task type for routing
 * @param {Array} messages - Messages in Anthropic format
 * @param {Object} options - { system, maxTokens, temperature, tools, costTier, ... }
 */
export async function complete(taskType, messages, options = {}) {
  if (!initialized) await init();

  const { costTier, requiredCapabilities, preferredProvider, ...requestOptions } = options;

  // Select model
  const selection = selectModel(taskType, { costTier, requiredCapabilities, preferredProvider });

  logger.log?.('debug', 'Model selected', {
    task: taskType,
    provider: selection.provider,
    model: selection.model
  });

  // Get provider and make request
  const provider = providers.getProvider(selection.provider);
  if (!provider) {
    throw new Error(`Provider not available: ${selection.provider}`);
  }

  try {
    const response = await provider.complete(selection.model, messages, requestOptions);
    return {
      ...response,
      routedFrom: taskType,
      selectedModel: selection.model,
      selectedProvider: selection.provider
    };
  } catch (error) {
    // If fallback is enabled, try next best model
    if (config.defaults.fallbackEnabled) {
      logger.log?.('warn', 'Primary model failed, trying fallback', {
        error: error.message,
        failedModel: selection.model
      });

      return attemptFallback(taskType, messages, requestOptions, selection.model);
    }

    throw error;
  }
}

/**
 * Attempt fallback to next available model
 */
async function attemptFallback(taskType, messages, options, excludeModel) {
  const routing = config.routing[taskType] || config.routing.general;
  const enabledProviders = providers.getEnabledProviders();

  for (const modelId of routing.preferred) {
    if (modelId === excludeModel) continue;

    const modelInfo = providers.getModelInfo(modelId);
    if (!modelInfo || !enabledProviders.includes(modelInfo.provider)) continue;

    const provider = providers.getProvider(modelInfo.provider);
    if (!provider) continue;

    try {
      logger.log?.('info', 'Trying fallback model', { model: modelId });
      const response = await provider.complete(modelId, messages, options);
      return {
        ...response,
        routedFrom: taskType,
        selectedModel: modelId,
        selectedProvider: modelInfo.provider,
        wasFallback: true
      };
    } catch (error) {
      logger.log?.('warn', 'Fallback model failed', { model: modelId, error: error.message });
      continue;
    }
  }

  throw new Error(`All models failed for task: ${taskType}`);
}

/**
 * Stream a chat request with automatic model selection
 */
export async function* stream(taskType, messages, options = {}) {
  if (!initialized) await init();

  const { costTier, requiredCapabilities, preferredProvider, ...requestOptions } = options;

  const selection = selectModel(taskType, { costTier, requiredCapabilities, preferredProvider });
  const provider = providers.getProvider(selection.provider);

  if (!provider) {
    throw new Error(`Provider not available: ${selection.provider}`);
  }

  yield {
    type: 'meta',
    provider: selection.provider,
    model: selection.model
  };

  for await (const chunk of provider.stream(selection.model, messages, requestOptions)) {
    yield chunk;
  }
}

/**
 * Direct completion with a specific model (bypass routing)
 */
export async function completeDirect(modelId, messages, options = {}) {
  if (!initialized) await init();

  const providerName = providers.findProviderForModel(modelId);
  if (!providerName) {
    throw new Error(`Model not found or provider not enabled: ${modelId}`);
  }

  const provider = providers.getProvider(providerName);
  return provider.complete(modelId, messages, options);
}

/**
 * Get router status and available models
 */
export function getStatus() {
  return {
    initialized,
    enabledProviders: providers.getEnabledProviders(),
    availableModels: providers.listAvailableModels(),
    routing: config?.routing || {}
  };
}

/**
 * Get config (for debugging)
 */
export function getConfig() {
  return config;
}

export default {
  init,
  selectModel,
  complete,
  stream,
  completeDirect,
  getStatus,
  getConfig
};
