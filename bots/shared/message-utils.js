// Shared message utilities
// Extracted from Spark:216-280

import { log } from './logger.js';

/**
 * Post content with optional splitting (summary as main post, full content in thread).
 *
 * @param {Function} mmApiFn - The mmApi function for raw API calls
 * @param {Function} postMessageFn - The postMessage function for simple posting
 * @param {Function} generateSummaryFn - Async function(content, maxChars) that returns a summary string
 * @param {string} channelId - Channel to post to
 * @param {string} content - Full content to post
 * @param {string|null} rootId - Thread root ID (optional)
 * @param {string} commandType - Command type name (e.g. 'research', 'brainstorm')
 * @param {object} splitConfig - Splitting config: { enabled, splitCommands, summaryMaxChars }
 * @returns {Promise<object|void>} The summary post result, or void if not split
 */
export async function postWithSplitting(mmApiFn, postMessageFn, generateSummaryFn, channelId, content, rootId, commandType, splitConfig = {}) {
  const { enabled = false, splitCommands = [], summaryMaxChars = 500 } = splitConfig;
  const shouldSplit = enabled && splitCommands.includes(commandType);

  if (!shouldSplit) {
    return postMessageFn(channelId, content, rootId);
  }

  try {
    // 1. Generate summary first
    const summary = await generateSummaryFn(content, summaryMaxChars);

    // 2. Post summary as main message
    const summaryMessage = `${summary}\n\n:thread: **Full ${commandType} in thread** ↓`;
    const summaryBody = {
      channel_id: channelId,
      message: summaryMessage
    };
    if (rootId) summaryBody.root_id = rootId;

    const summaryResult = await mmApiFn('/posts', 'POST', summaryBody);
    log('info', 'Posted summary', { channelId, summaryLength: summary.length, commandType });

    // 3. Post full content as thread reply under the summary
    const fullContentBody = {
      channel_id: channelId,
      message: `## Full ${commandType.charAt(0).toUpperCase() + commandType.slice(1)}\n\n${content}`,
      root_id: summaryResult.id
    };

    await mmApiFn('/posts', 'POST', fullContentBody);
    log('info', 'Posted full content in thread', {
      channelId,
      messageLength: content.length,
      threadRoot: summaryResult.id
    });

    return summaryResult;
  } catch (error) {
    log('error', 'Failed to post with splitting, falling back to normal post', {
      error: error.message
    });
    // Fallback to normal posting if splitting fails
    return postMessageFn(channelId, content, rootId);
  }
}

/**
 * Add a first-time command hint to a response if this is a new channel interaction.
 *
 * @param {string} botName - Bot name for the hint (e.g. 'spark', 'scout')
 * @param {Set} introducedChannels - Set of channel IDs already introduced
 * @param {string} channelId - Current channel ID
 * @param {string} response - The response text to possibly append a hint to
 * @returns {string} Response with optional hint appended
 */
export function maybeAddHint(botName, introducedChannels, channelId, response) {
  if (!introducedChannels.has(channelId)) {
    introducedChannels.add(channelId);
    return response + `\n\n---\n_Tip: Type \`!${botName}\` to see all my commands_`;
  }
  return response;
}

export default { postWithSplitting, maybeAddHint };
