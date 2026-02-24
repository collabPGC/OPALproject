/**
 * OpenAI Provider Adapter
 *
 * Wraps the OpenAI SDK to provide a unified interface for the model router.
 */

let client = null;
let config = null;

export async function init(providerConfig) {
  config = providerConfig;
  // Dynamic import for optional dependency
  const OpenAI = (await import('openai')).default;
  client = new OpenAI({
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
 * @param {Object} options - Additional options
 */
export async function complete(model, messages, options = {}) {
  if (!client) throw new Error('OpenAI provider not initialized');

  const {
    maxTokens = 4096,
    temperature = 0.7,
    system,
    tools,
    toolChoice
  } = options;

  // Convert Anthropic-style messages to OpenAI format
  const openaiMessages = [];

  if (system) {
    openaiMessages.push({ role: 'system', content: system });
  }

  for (const msg of messages) {
    openaiMessages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: typeof msg.content === 'string' ? msg.content : msg.content.map(c => {
        if (c.type === 'text') return { type: 'text', text: c.text };
        if (c.type === 'image') return { type: 'image_url', image_url: { url: c.source?.data } };
        return c;
      })
    });
  }

  const requestParams = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: openaiMessages
  };

  // Convert Anthropic tools to OpenAI format
  if (tools && tools.length > 0) {
    requestParams.tools = tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema
      }
    }));
  }

  if (toolChoice) {
    if (toolChoice.type === 'any') {
      requestParams.tool_choice = 'required';
    } else if (toolChoice.type === 'tool') {
      requestParams.tool_choice = { type: 'function', function: { name: toolChoice.name } };
    } else {
      requestParams.tool_choice = toolChoice.type;
    }
  }

  const response = await client.chat.completions.create(requestParams);
  const choice = response.choices[0];

  // Convert response to Anthropic format
  const content = [];

  if (choice.message.content) {
    content.push({ type: 'text', text: choice.message.content });
  }

  if (choice.message.tool_calls) {
    for (const tc of choice.message.tool_calls) {
      content.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments)
      });
    }
  }

  return {
    provider: 'openai',
    model,
    content,
    stopReason: choice.finish_reason === 'tool_calls' ? 'tool_use' : choice.finish_reason,
    usage: {
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens
    },
    raw: response
  };
}

/**
 * Stream a chat request
 */
export async function* stream(model, messages, options = {}) {
  if (!client) throw new Error('OpenAI provider not initialized');

  const {
    maxTokens = 4096,
    temperature = 0.7,
    system
  } = options;

  const openaiMessages = [];
  if (system) {
    openaiMessages.push({ role: 'system', content: system });
  }

  for (const msg of messages) {
    openaiMessages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: typeof msg.content === 'string' ? msg.content : msg.content[0]?.text || ''
    });
  }

  const stream = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: openaiMessages,
    stream: true
  });

  let totalTokens = { input: 0, output: 0 };

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    if (delta?.content) {
      yield {
        type: 'text',
        text: delta.content
      };
    }
    if (chunk.usage) {
      totalTokens.input = chunk.usage.prompt_tokens;
      totalTokens.output = chunk.usage.completion_tokens;
    }
  }

  yield {
    type: 'done',
    usage: {
      inputTokens: totalTokens.input,
      outputTokens: totalTokens.output
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
