// Shared AI response utility with tool support
// Extracted from Spark:1681-1868 and Scout:3051-3220

import { log } from './logger.js';

/**
 * Get AI response from Anthropic with fetch_url tool support.
 *
 * @param {object} anthropicClient - Anthropic SDK client instance
 * @param {string} model - Model ID to use (e.g. 'claude-sonnet-4-20250514')
 * @param {object[]} messages - Conversation messages array [{ role, content }]
 * @param {string} systemPrompt - Full system prompt (persona + context)
 * @param {string} additionalContext - Additional context to append to system prompt (optional)
 * @param {Function} fetchWebPageFn - Async function(url) that fetches and returns web page content
 * @param {object} options - Additional options
 * @param {number} options.maxTokens - Max tokens for response (default: 2048)
 * @param {object[]} options.extraTools - Additional tools beyond fetch_url
 * @param {Function} options.toolHandler - Custom handler for extra tools: async (name, input) => string
 * @returns {Promise<string>} The AI text response
 */
export async function getAIResponse(anthropicClient, model, messages, systemPrompt, additionalContext = '', fetchWebPageFn = null, options = {}) {
  const {
    maxTokens = 2048,
    extraTools = [],
    toolHandler = null
  } = options;

  const tools = [
    {
      name: 'fetch_url',
      description: 'REQUIRED: You MUST use this tool whenever a user provides a URL (http/https) and asks for analysis, summary, or details about it. Do not refuse or say you cannot access URLs. Use this tool to read the website content.',
      input_schema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The full URL to fetch.' }
        },
        required: ['url']
      }
    },
    ...extraTools
  ];

  try {
    let fullSystemPrompt = systemPrompt;

    if (additionalContext) {
      fullSystemPrompt += `\n\n## CONTEXT & MEMORY\n${additionalContext}`;
    }

    // Force tool awareness
    fullSystemPrompt += `\n\n## TOOLS & CAPABILITIES\nYou have a tool named 'fetch_url' which allows you to read website content. You MUST use this tool if the user provides a URL and wants information about it. Do not say you cannot browse the internet - you CAN fetch URLs.`;

    let currentMessages = messages.map(m => ({ role: m.role, content: m.content }));

    // Initial API call
    let response = await anthropicClient.messages.create({
      model: model,
      max_tokens: maxTokens,
      system: fullSystemPrompt,
      messages: currentMessages,
      tools: tools
    });

    // Tool loop - handle multi-turn tool use
    while (response.stop_reason === 'tool_use') {
      const toolBlocks = response.content.filter(c => c.type === 'tool_use');
      if (toolBlocks.length === 0) break;

      // Add assistant's tool use request
      currentMessages.push({ role: 'assistant', content: response.content });

      // Process all tool_use blocks and collect results
      const toolResults = [];
      for (const toolBlock of toolBlocks) {
        const { name, input, id } = toolBlock;
        let toolResult = '';

        if (name === 'fetch_url' && fetchWebPageFn) {
          log('info', `Tool execution: fetch_url(${input.url})`);
          toolResult = await fetchWebPageFn(input.url);
        } else if (toolHandler) {
          log('info', `Tool execution: ${name}`, { input });
          toolResult = await toolHandler(name, input);
        } else {
          toolResult = `Tool "${name}" is not available.`;
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: id,
          content: toolResult
        });
      }

      // Add all tool results in a single user message
      currentMessages.push({
        role: 'user',
        content: toolResults
      });

      // Re-prompt LLM
      response = await anthropicClient.messages.create({
        model: model,
        max_tokens: maxTokens,
        system: fullSystemPrompt,
        messages: currentMessages,
        tools: tools
      });
    }

    return response.content.find(c => c.type === 'text')?.text || '';

  } catch (error) {
    log('error', 'AI response error', { error: error.message });
    return 'I encountered an error processing that request.';
  }
}

export default { getAIResponse };
