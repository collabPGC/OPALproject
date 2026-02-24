/**
 * Google Gemini Provider Adapter
 *
 * Uses Google's Generative AI SDK for Gemini models.
 */

let client = null;
let config = null;

export async function init(providerConfig) {
  config = providerConfig;
  // Dynamic import for optional dependency
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  client = new GoogleGenerativeAI(config.apiKey);
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
  if (!client) throw new Error('Google provider not initialized');

  const {
    maxTokens = 4096,
    temperature = 0.7,
    system,
    tools
  } = options;

  const genModel = client.getGenerativeModel({
    model,
    systemInstruction: system,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature
    }
  });

  // Convert messages to Gemini format
  const history = [];
  let lastUserContent = '';

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const content = typeof msg.content === 'string'
      ? msg.content
      : msg.content.map(c => c.text || '').join('');

    if (i === messages.length - 1 && msg.role === 'user') {
      lastUserContent = content;
    } else {
      history.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: content }]
      });
    }
  }

  // Set up tools if provided
  let toolConfig = null;
  if (tools && tools.length > 0) {
    toolConfig = {
      functionDeclarations: tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.input_schema
      }))
    };
  }

  const chat = genModel.startChat({
    history,
    tools: toolConfig ? [{ functionDeclarations: toolConfig.functionDeclarations }] : undefined
  });

  const result = await chat.sendMessage(lastUserContent);
  const response = result.response;

  // Convert response to Anthropic format
  const content = [];
  const candidate = response.candidates?.[0];

  if (candidate?.content?.parts) {
    for (const part of candidate.content.parts) {
      if (part.text) {
        content.push({ type: 'text', text: part.text });
      }
      if (part.functionCall) {
        content.push({
          type: 'tool_use',
          id: `tool_${Date.now()}`,
          name: part.functionCall.name,
          input: part.functionCall.args
        });
      }
    }
  }

  return {
    provider: 'google',
    model,
    content,
    stopReason: candidate?.finishReason === 'STOP' ? 'end_turn' : candidate?.finishReason,
    usage: {
      inputTokens: response.usageMetadata?.promptTokenCount,
      outputTokens: response.usageMetadata?.candidatesTokenCount
    },
    raw: response
  };
}

/**
 * Stream a chat request
 */
export async function* stream(model, messages, options = {}) {
  if (!client) throw new Error('Google provider not initialized');

  const {
    maxTokens = 4096,
    temperature = 0.7,
    system
  } = options;

  const genModel = client.getGenerativeModel({
    model,
    systemInstruction: system,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature
    }
  });

  const history = [];
  let lastUserContent = '';

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const content = typeof msg.content === 'string'
      ? msg.content
      : msg.content.map(c => c.text || '').join('');

    if (i === messages.length - 1 && msg.role === 'user') {
      lastUserContent = content;
    } else {
      history.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: content }]
      });
    }
  }

  const chat = genModel.startChat({ history });
  const result = await chat.sendMessageStream(lastUserContent);

  let usage = { input: 0, output: 0 };

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      yield {
        type: 'text',
        text
      };
    }
    if (chunk.usageMetadata) {
      usage.input = chunk.usageMetadata.promptTokenCount;
      usage.output = chunk.usageMetadata.candidatesTokenCount;
    }
  }

  yield {
    type: 'done',
    usage: {
      inputTokens: usage.input,
      outputTokens: usage.output
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
