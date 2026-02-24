/**
 * Provider Registry
 *
 * Factory for initializing and accessing LLM providers.
 */

import * as anthropic from './anthropic.js';
import * as openai from './openai.js';
import * as google from './google.js';
import * as glm from './glm.js';

const providers = {
  anthropic,
  openai,
  google,
  glm
};

let initialized = false;
let config = null;

/**
 * Initialize all providers from config
 * @param {Object} modelsConfig - The full models.json config
 */
export async function init(modelsConfig, logger = console) {
  if (initialized) return;

  config = modelsConfig;

  for (const [name, providerConfig] of Object.entries(config.providers)) {
    if (providerConfig.enabled && providerConfig.apiKey) {
      try {
        await providers[name].init(providerConfig);
        logger.log?.('info', `Provider initialized: ${name}`) ||
          console.log(`[Providers] Initialized: ${name}`);
      } catch (error) {
        logger.log?.('error', `Failed to init provider: ${name}`, { error: error.message }) ||
          console.error(`[Providers] Failed to init ${name}:`, error.message);
      }
    }
  }

  initialized = true;
}

/**
 * Get a provider by name
 */
export function getProvider(name) {
  return providers[name];
}

/**
 * Get all enabled providers
 */
export function getEnabledProviders() {
  return Object.entries(providers)
    .filter(([name, provider]) => provider.isEnabled())
    .map(([name]) => name);
}

/**
 * Find which provider owns a model
 */
export function findProviderForModel(modelId) {
  for (const [name, provider] of Object.entries(providers)) {
    if (provider.isEnabled() && provider.hasModel(modelId)) {
      return name;
    }
  }
  return null;
}

/**
 * Get model info across all providers
 */
export function getModelInfo(modelId) {
  for (const [providerName, providerConfig] of Object.entries(config?.providers || {})) {
    if (providerConfig.models?.[modelId]) {
      return {
        provider: providerName,
        ...providerConfig.models[modelId]
      };
    }
  }
  return null;
}

/**
 * List all available models from enabled providers
 */
export function listAvailableModels() {
  const models = [];

  for (const [providerName, provider] of Object.entries(providers)) {
    if (provider.isEnabled()) {
      const providerModels = provider.getModels();
      for (const [modelId, modelInfo] of Object.entries(providerModels)) {
        models.push({
          id: modelId,
          provider: providerName,
          ...modelInfo
        });
      }
    }
  }

  return models;
}

export default {
  init,
  getProvider,
  getEnabledProviders,
  findProviderForModel,
  getModelInfo,
  listAvailableModels
};
