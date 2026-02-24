// Shared file handling utilities
// Extracted from Spark:1973-1984

import { log } from './logger.js';

/**
 * Download a file from Mattermost by file ID.
 *
 * @param {object} config - Config with config.mattermost.url and config.mattermost.botToken
 * @param {string} fileId - The Mattermost file ID to download
 * @returns {Promise<Buffer|null>} File contents as Buffer, or null on failure
 */
export async function downloadFile(config, fileId) {
  try {
    const response = await fetch(`${config.mattermost.url}/api/v4/files/${fileId}`, {
      headers: { 'Authorization': `Bearer ${config.mattermost.botToken}` }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    log('error', 'Failed to download file', { fileId, error: error.message });
    return null;
  }
}

/**
 * Add a reaction to a Mattermost post.
 *
 * @param {Function} mmApiFn - The mmApi function for API calls
 * @param {string} botUserId - The bot's user ID
 * @param {string} postId - The post ID to react to
 * @param {string} emojiName - The emoji name (without colons)
 * @returns {Promise<boolean>} True if successful
 */
export async function addReaction(mmApiFn, botUserId, postId, emojiName) {
  try {
    await mmApiFn('/reactions', 'POST', {
      user_id: botUserId,
      post_id: postId,
      emoji_name: emojiName
    });
    return true;
  } catch (error) {
    log('error', 'Failed to add reaction', { postId, emojiName, error: error.message });
    return false;
  }
}

export default { downloadFile, addReaction };
