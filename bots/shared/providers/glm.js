/**
 * GLM (Zhipu AI) Provider Adapter
 *
 * Uses OpenAI-compatible API for GLM models.
 */

let config = null;

export async function init(providerConfig) {
  config = providerConfig;
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
  if (!config?.apiKey) throw new Error('GLM provider not initialized');

  const {
    maxTokens = 4096,
    temperature = 0.7,
    system,
    tools
  } = options;

  const baseUrl = config.baseUrl || 'https://open.bigmodel.cn/api/paas/v4';

  // Build messages in OpenAI format
  const glmMessages = [];

  if (system) {
    glmMessages.push({ role: 'system', content: system });
  }

  for (const msg of messages) {
    glmMessages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: typeof msg.content === 'string'
        ? msg.content
        : msg.content.map(c => c.text || '').join('')
    });
  }

  const requestBody = {
    model,
    messages: glmMessages,
    max_tokens: maxTokens,
    temperature
  };

  // Convert tools to OpenAI format
  if (tools && tools.length > 0) {
    requestBody.tools = tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema
      }
    }));
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'HTTP-Referer': 'https://opal.partnergroupconsulting.com',
      'X-Title': 'Opal Mattermost Bots'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GLM API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  // Convert response to Anthropic format
  const content = [];

  if (choice?.message?.content) {
    content.push({ type: 'text', text: choice.message.content });
  }

  if (choice?.message?.tool_calls) {
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
    provider: 'glm',
    model,
    content,
    stopReason: choice?.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn',
    usage: {
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens
    },
    raw: data
  };
}

/**
 * Stream a chat request
 */
export async function* stream(model, messages, options = {}) {
  if (!config?.apiKey) throw new Error('GLM provider not initialized');

  const {
    maxTokens = 4096,
    temperature = 0.7,
    system
  } = options;

  const baseUrl = config.baseUrl || 'https://open.bigmodel.cn/api/paas/v4';

  const glmMessages = [];
  if (system) {
    glmMessages.push({ role: 'system', content: system });
  }

  for (const msg of messages) {
    glmMessages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: typeof msg.content === 'string'
        ? msg.content
        : msg.content.map(c => c.text || '').join('')
    });
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'HTTP-Referer': 'https://opal.partnergroupconsulting.com',
      'X-Title': 'Opal Mattermost Bots'
    },
    body: JSON.stringify({
      model,
      messages: glmMessages,
      max_tokens: maxTokens,
      temperature,
      stream: true
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GLM API error: ${response.status} - ${error}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let usage = { input: 0, output: 0 };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;

          if (delta?.content) {
            yield {
              type: 'text',
              text: delta.content
            };
          }

          if (parsed.usage) {
            usage.input = parsed.usage.prompt_tokens;
            usage.output = parsed.usage.completion_tokens;
          }
        } catch (e) {
          // Skip malformed JSON
        }
      }
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
