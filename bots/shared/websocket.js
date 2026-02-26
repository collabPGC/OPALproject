// Shared WebSocket connection manager
import WebSocket from 'ws';
import { log } from './logger.js';

export function createWebSocketManager(config, onMessage) {
  const state = {
    ws: null,
    botUserId: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 10,
    reconnectDelay: 5000
  };

  // Dedup: track recently seen post IDs to prevent duplicate processing
  const recentPostIds = new Set();
  const DEDUP_MAX_SIZE = 500;

  function dedup(postId) {
    if (recentPostIds.has(postId)) return false; // already seen
    recentPostIds.add(postId);
    if (recentPostIds.size > DEDUP_MAX_SIZE) {
      // Evict oldest entries (Set iterates in insertion order)
      const iter = recentPostIds.values();
      for (let i = 0; i < 100; i++) iter.next();
      const toKeep = [];
      for (const v of recentPostIds) toKeep.push(v);
      recentPostIds.clear();
      for (const v of toKeep.slice(100)) recentPostIds.add(v);
    }
    return true; // first time seeing this post
  }

  async function connect() {
    try {
      // Get bot user ID first
      const meResponse = await fetch(`${config.mattermost.url}/api/v4/users/me`, {
        headers: { 'Authorization': `Bearer ${config.mattermost.botToken}` }
      });
      const me = await meResponse.json();
      state.botUserId = me.id;
      log('info', 'Bot authenticated', { userId: state.botUserId, username: me.username });

      // Connect WebSocket
      const wsUrl = `${config.mattermost.wsUrl}/api/v4/websocket`;
      state.ws = new WebSocket(wsUrl);

      state.ws.on('open', () => {
        log('info', 'WebSocket connected');
        state.reconnectAttempts = 0;

        // Authenticate
        state.ws.send(JSON.stringify({
          seq: 1,
          action: 'authentication_challenge',
          data: { token: config.mattermost.botToken }
        }));
      });

      state.ws.on('message', (data) => {
        try {
          const event = JSON.parse(data.toString());
          // Dedup posted events by post ID
          if (event.event === 'posted' && event.data?.post) {
            try {
              const post = JSON.parse(event.data.post);
              if (post.id && !dedup(post.id)) {
                return; // duplicate post event, skip
              }
            } catch (_) { /* parse failed, let handler deal with it */ }
          }
          onMessage(event, state.botUserId);
        } catch (e) {
          log('error', 'Failed to parse WebSocket message', { error: e.message });
        }
      });

      state.ws.on('close', () => {
        log('warn', 'WebSocket closed');
        scheduleReconnect();
      });

      state.ws.on('error', (error) => {
        log('error', 'WebSocket error', { error: error.message });
      });

    } catch (error) {
      log('error', 'Failed to connect', { error: error.message });
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    if (state.reconnectAttempts < state.maxReconnectAttempts) {
      state.reconnectAttempts++;
      const delay = state.reconnectDelay * state.reconnectAttempts;
      log('info', 'Scheduling reconnect', { attempt: state.reconnectAttempts, delay });
      setTimeout(connect, delay);
    } else {
      log('error', 'Max reconnect attempts reached');
    }
  }

  function getBotUserId() {
    return state.botUserId;
  }

  function isConnected() {
    return state.ws && state.ws.readyState === WebSocket.OPEN;
  }

  return {
    connect,
    getBotUserId,
    isConnected
  };
}

export default { createWebSocketManager };
