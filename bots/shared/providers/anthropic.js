/**
 * Anthropic Provider Adapter
 *
 * Wraps the Anthropic SDK to provide a unified interface for the model router.
 */

import Anthropic from '@anthropic-ai/sdk';

let client = null;
let config = null;

export async function init(providerConfig) {
  config = providerConfig;
  client = new Anthropic({
    apiKey: config.apiKey
  });
  return true;
}

export function isEnabled() {
  return config?.enabled && config?.apiKey;
}

export function getModels() {
  return config?.models || {};
}

export function hasModel(modelId) {
  return modelId in (config?.models || {});
}

/**
 * Complete a chat request
 * @param {string} model - Model ID
 * @param {Array} messages - Array of {role, content} messages
 * @param {Object} options - Additional options (maxTokens, temperature, tools, etc.)
 */
export async function complete(model, messages, options = {}) {
  if (!client) throw new Error('Anthropic provider not initialized');

  const {
    maxTokens = 4096,
    temperature = 0.7,
    system,
    tools,
    toolChoice
  } = options;

  const requestParams = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages
  };

  if (system) {
    requestParams.system = system;
  }

  if (tools && tools.length > 0) {
    requestParams.tools = tools;
  }

  if (toolChoice) {
    requestParams.tool_choice = toolChoice;
  }

  const response = await client.messages.create(requestParams);

  return {
    provider: 'anthropic',
    model,
    content: response.content,
    stopReason: response.stop_reason,
    usage: {
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens
    },
    raw: response
  };
}

/**
 * Stream a chat request
 */
export async function* stream(model, messages, options = {}) {
  if (!client) throw new Error('Anthropic provider not initialized');

  const {
    maxTokens = 4096,
    temperature = 0.7,
    system
  } = options;

  const requestParams = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages,
    stream: true
  };

  if (system) {
    requestParams.system = system;
  }

  const stream = await client.messages.stream(requestParams);

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.text) {
      yield {
        type: 'text',
        text: event.delta.text
      };
    }
  }

  const finalMessage = await stream.finalMessage();
  yield {
    type: 'done',
    usage: {
      inputTokens: finalMessage.usage?.input_tokens,
      outputTokens: finalMessage.usage?.output_tokens
    }
  };
}

export default {
  init,
  isEnabled,
  getModels,
  hasModel,
  complete,
  stream
};
