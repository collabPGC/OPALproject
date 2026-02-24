/**
 * Conversation Store - Vector storage for chat message history
 *
 * Uses LanceDB for semantic search across conversations.
 * Storage: /mnt/volume_nyc3_01/vectordb/conversations/
 */

import * as lancedb from '@lancedb/lancedb';
import embedder from './embedder.js';

// Configuration
const DB_PATH = '/mnt/volume_nyc3_01/vectordb/conversations';
const TABLE_NAME = 'messages';

// Singleton
let db = null;
let initialized = false;

/**
 * Initialize the conversation store
 */
export async function init(logger = console) {
  if (initialized) return true;

  await embedder.init(logger);

  db = await lancedb.connect(DB_PATH);
  logger.log?.('info', 'ConvStore connected', { path: DB_PATH }) ||
    console.log(`[ConvStore] Connected: ${DB_PATH}`);

  initialized = true;
  return true;
}

/**
 * Ensure table exists with correct schema
 */
async function ensureTable() {
  const tables = await db.tableNames();

  if (!tables.includes(TABLE_NAME)) {
    const dim = embedder.getDimension();
    const initialData = [{
      id: '__init__',
      vector: new Array(dim).fill(0),
      text: '',
      channelId: '',
      channelName: '',
      userId: '',
      userName: '',
      messageId: '',
      timestamp: 0,
      createdAt: Date.now()
    }];

    await db.createTable(TABLE_NAME, initialData);
    const table = await db.openTable(TABLE_NAME);
    await table.delete('id = "__init__"');
  }

  return db.openTable(TABLE_NAME);
}

/**
 * Add a single message
 * @param {Object} message
 * @param {string} message.text - Message content
 * @param {string} message.channelId - Channel ID
 * @param {string} message.channelName - Channel display name
 * @param {string} message.userId - User ID
 * @param {string} message.userName - User display name
 * @param {string} message.messageId - Mattermost message ID
 * @param {number} message.timestamp - Message timestamp
 */
export async function addMessage(message, logger = console) {
  if (!initialized) await init(logger);

  const table = await ensureTable();
  const embedding = await embedder.embed(message.text);

  const record = {
    id: `msg_${message.messageId}`,
    vector: embedding,
    text: message.text,
    channelId: message.channelId,
    channelName: message.channelName || '',
    userId: message.userId,
    userName: message.userName || '',
    messageId: message.messageId,
    timestamp: message.timestamp || Date.now(),
    createdAt: Date.now()
  };

  await table.add([record]);
  return { indexed: 1, messageId: message.messageId };
}

/**
 * Add multiple messages in batch
 */
export async function addMessages(messages, logger = console) {
  if (!initialized) await init(logger);
  if (messages.length === 0) return { indexed: 0 };

  const table = await ensureTable();

  logger.log?.('info', 'Indexing messages', { count: messages.length }) ||
    console.log(`[ConvStore] Indexing ${messages.length} messages`);

  const texts = messages.map(m => m.text);
  const embeddings = await embedder.embedBatch(texts);

  const records = messages.map((msg, i) => ({
    id: `msg_${msg.messageId}`,
    vector: embeddings[i],
    text: msg.text,
    channelId: msg.channelId,
    channelName: msg.channelName || '',
    userId: msg.userId,
    userName: msg.userName || '',
    messageId: msg.messageId,
    timestamp: msg.timestamp || Date.now(),
    createdAt: Date.now()
  }));

  await table.add(records);
  return { indexed: records.length };
}

/**
 * Semantic search across conversations
 * @param {string} query - Search query
 * @param {Object} options - channelId, userId, limit, minScore
 */
export async function search(query, options = {}) {
  if (!initialized) await init();

  const { channelId, userId, limit = 10, minScore = 0.1 } = options;

  const table = await ensureTable();
  const queryVector = await embedder.embed(query);

  let searchQuery = table.vectorSearch(queryVector).distanceType('cosine').limit(limit * 2);

  if (channelId) {
    searchQuery = searchQuery.where(`channelId = '${channelId}'`);
  }
  if (userId) {
    searchQuery = searchQuery.where(`userId = '${userId}'`);
  }

  const results = await searchQuery.toArray();

  return results
    .filter(r => r._distance !== undefined && (1 - r._distance) >= minScore)
    .slice(0, limit)
    .map(r => ({
      text: r.text,
      channelId: r.channelId,
      channelName: r.channelName,
      userId: r.userId,
      userName: r.userName,
      messageId: r.messageId,
      timestamp: r.timestamp,
      score: 1 - r._distance
    }));
}

/**
 * Format search results for AI context
 */
export async function searchForContext(query, options = {}) {
  const results = await search(query, options);
  if (results.length === 0) return null;

  let context = '## Related Conversations\n\n';
  for (const r of results) {
    const date = new Date(r.timestamp).toLocaleDateString();
    const channel = r.channelName || r.channelId;
    context += `**${r.userName}** in #${channel} (${date}) [${(r.score * 100).toFixed(0)}%]\n`;
    context += `> ${r.text}\n\n`;
  }
  return context;
}

/**
 * Check if message is already indexed
 */
export async function isIndexed(messageId) {
  if (!initialized) await init();
  const table = await ensureTable();
  const results = await table.query().where(`id = 'msg_${messageId}'`).toArray();
  return results.length > 0;
}

/**
 * Delete all messages for a channel
 */
export async function deleteChannel(channelId) {
  if (!initialized) await init();
  const table = await ensureTable();
  await table.delete(`channelId = '${channelId}'`);
  return { deleted: true, channelId };
}

/**
 * Get statistics
 */
export async function getStats(channelId = null) {
  if (!initialized) await init();

  const table = await ensureTable();
  const results = await table.query().toArray();
  const filtered = channelId ? results.filter(r => r.channelId === channelId) : results;

  const byChannel = {};
  const byUser = {};

  for (const r of filtered) {
    const ch = r.channelName || r.channelId;
    const user = r.userName || r.userId;
    byChannel[ch] = (byChannel[ch] || 0) + 1;
    byUser[user] = (byUser[user] || 0) + 1;
  }

  return {
    totalMessages: filtered.length,
    channels: Object.keys(byChannel).length,
    users: Object.keys(byUser).length,
    byChannel,
    byUser
  };
}

export default {
  init,
  addMessage,
  addMessages,
  search,
  searchForContext,
  isIndexed,
  deleteChannel,
  getStats
};
