// Shared Mattermost API module
import { log } from './logger.js';

let config = null;

export function init(cfg) {
  config = cfg;
}

// Mattermost API helper
export async function mmApi(endpoint, method = 'GET', body = null) {
  const url = `${config.mattermost.url}/api/v4${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${config.mattermost.botToken}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error ${response.status}: ${error}`);
  }
  return response.json();
}

// Post message to channel
export async function postMessage(channelId, message, rootId = null) {
  const body = {
    channel_id: channelId,
    message: message
  };
  if (rootId) body.root_id = rootId;

  try {
    await mmApi('/posts', 'POST', body);
    log('info', 'Posted message', { channelId, messageLength: message.length });
  } catch (error) {
    log('error', 'Failed to post message', { channelId, error: error.message });
  }
}

// Add reaction to a post
export async function addReaction(postId, emojiName) {
  try {
    const me = await mmApi('/users/me');
    await mmApi('/reactions', 'POST', {
      user_id: me.id,
      post_id: postId,
      emoji_name: emojiName
    });
  } catch (error) {
    log('error', 'Failed to add reaction', { postId, emojiName, error: error.message });
  }
}

// Fetch channel history from Mattermost API
export async function fetchChannelHistory(channelId, limit = 100) {
  try {
    const data = await mmApi(`/channels/${channelId}/posts?per_page=${limit}`);
    if (!data.posts || !data.order) {
      return [];
    }

    // Sort posts by timestamp (oldest first for conversation flow)
    const posts = data.order.map(id => data.posts[id]).reverse();

    // Get user info for each unique user
    const userIds = [...new Set(posts.map(p => p.user_id))];
    const userMap = {};

    for (const userId of userIds) {
      try {
        const user = await mmApi(`/users/${userId}`);
        userMap[userId] = user.username || user.nickname || 'Unknown';
      } catch (e) {
        userMap[userId] = 'Unknown';
      }
    }

    // Format messages with usernames
    return posts.map(p => ({
      username: userMap[p.user_id] || 'Unknown',
      content: p.message,
      timestamp: p.create_at,
      userId: p.user_id
    }));
  } catch (error) {
    log('error', 'Failed to fetch channel history', { channelId, error: error.message });
    return [];
  }
}

// Get user by ID
export async function getUser(userId) {
  try {
    return await mmApi(`/users/${userId}`);
  } catch (error) {
    log('error', 'Failed to get user', { userId, error: error.message });
    return null;
  }
}

// Get current bot user ID
export async function getBotUserId() {
  try {
    const me = await mmApi('/users/me');
    return me.id;
  } catch (error) {
    log('error', 'Failed to get bot user ID', { error: error.message });
    return null;
  }
}

// Search for a channel by name
export async function searchChannel(channelName) {
  try {
    // First try to get channel by name (team:channel format or just channel name)
    const teams = await mmApi('/teams');
    for (const team of teams) {
      try {
        const channel = await mmApi(`/teams/${team.id}/channels/name/${channelName}`);
        if (channel && channel.id) {
          return { id: channel.id, name: channel.name, displayName: channel.display_name };
        }
      } catch {
        // Channel not found in this team, continue
      }
    }
    return null;
  } catch (error) {
    log('error', 'Failed to search channel', { channelName, error: error.message });
    return null;
  }
}

export default {
  init,
  mmApi,
  postMessage,
  addReaction,
  fetchChannelHistory,
  getUser,
  getBotUserId,
  searchChannel
};
