/**
 * Unified Memory Module
 *
 * Combines vector search (semantic) + graph (relationships) for AI context.
 * Single interface for indexing and querying conversation memory.
 */

import { docStore, convStore, graphStore, ENTITY } from './stores/index.js';

let initialized = false;

/**
 * Initialize all memory stores
 */
export async function init(logger = console) {
  if (initialized) return true;

  // Initialize stores in parallel
  await Promise.all([
    docStore.init(logger),
    convStore.init(logger),
    graphStore.init(logger)
  ]);

  initialized = true;
  logger.log?.('info', 'Memory system ready') ||
    console.log('[Memory] All stores initialized');

  return true;
}

/**
 * Index a message into vector + graph stores
 * @param {Object} message - Message to index
 */
export async function indexMessage(message, logger = console) {
  if (!initialized) await init(logger);

  // Skip short or bot messages
  if (!message.text || message.text.length < 10) {
    return { indexed: false, reason: 'too_short' };
  }
  if (message.userId?.includes('bot') || message.userName?.toLowerCase().includes('bot')) {
    return { indexed: false, reason: 'bot_message' };
  }

  // Index in both stores
  const [vectorResult, graphResult] = await Promise.all([
    convStore.addMessage(message, logger),
    Promise.resolve(graphStore.extractAndStore(message, logger))
  ]);

  return {
    indexed: true,
    vector: vectorResult,
    graph: graphResult
  };
}

/**
 * Batch index multiple messages
 */
export async function indexMessages(messages, logger = console) {
  if (!initialized) await init(logger);

  // Filter valid messages
  const valid = messages.filter(m =>
    m.text &&
    m.text.length >= 10 &&
    !m.userId?.includes('bot') &&
    !m.userName?.toLowerCase().includes('bot')
  );

  if (valid.length === 0) return { indexed: 0 };

  // Vector store batch
  const vectorResult = await convStore.addMessages(valid, logger);

  // Graph store extraction
  let graphCount = 0;
  for (const msg of valid) {
    const result = graphStore.extractAndStore(msg, logger);
    graphCount += result.extracted;
  }

  // Force save graph after batch
  await graphStore.forceSave();

  return {
    indexed: valid.length,
    skipped: messages.length - valid.length,
    vectorCount: vectorResult.indexed,
    graphEdges: graphCount
  };
}

/**
 * Semantic search across documents and conversations
 */
export async function search(query, options = {}) {
  if (!initialized) await init();

  const { includeDocs = true, includeConvs = true, limit = 10 } = options;

  const results = { documents: [], conversations: [] };

  if (includeDocs) {
    results.documents = await docStore.search(query, { ...options, limit });
  }
  if (includeConvs) {
    results.conversations = await convStore.search(query, { ...options, limit });
  }

  return results;
}

/**
 * Get full context for AI (combines vector + graph)
 */
export async function getContext(query, options = {}) {
  if (!initialized) await init();

  const { maxDocs = 3, maxConvs = 5, includeGraph = true } = options;
  let context = '';

  // Semantic search
  const results = await search(query, { limit: Math.max(maxDocs, maxConvs) });

  // Document context
  if (results.documents.length > 0) {
    context += '## Relevant Documents\n\n';
    for (const doc of results.documents.slice(0, maxDocs)) {
      const source = doc.section ? `${doc.fileName} > ${doc.section}` : doc.fileName;
      const page = doc.pageNumber > 0 ? ` (p.${doc.pageNumber})` : '';
      context += `**${source}${page}** [${(doc.score * 100).toFixed(0)}%]\n`;
      context += `${doc.text}\n\n`;
    }
  }

  // Conversation context
  if (results.conversations.length > 0) {
    context += '## Related Conversations\n\n';
    for (const conv of results.conversations.slice(0, maxConvs)) {
      const date = new Date(conv.timestamp).toLocaleDateString();
      const channel = conv.channelName || conv.channelId;
      context += `**${conv.userName}** in #${channel} (${date}) [${(conv.score * 100).toFixed(0)}%]\n`;
      context += `> ${conv.text}\n\n`;
    }
  }

  // Graph context (topic connections)
  if (includeGraph) {
    const topics = query.match(/(?:#\w+|\b[A-Z][A-Z0-9_]{2,}\b)/g) || [];

    for (const topic of topics.slice(0, 2)) {
      const topicId = `${ENTITY.TOPIC}${topic.replace('#', '').toLowerCase()}`;
      const rels = graphStore.getRelationships(topicId);

      if (rels.incoming.length > 0 || rels.outgoing.length > 0) {
        context += `## Connections: ${topic}\n\n`;
        for (const r of [...rels.incoming, ...rels.outgoing].slice(0, 5)) {
          const from = r.source || topicId;
          const to = r.target || topicId;
          context += `- ${from.split(':')[1]} → ${r.relation} → ${to.split(':')[1]}\n`;
        }
        context += '\n';
      }
    }
  }

  return context || null;
}

/**
 * Get what a person has discussed
 */
export async function getPersonContext(userId) {
  if (!initialized) await init();

  const topics = graphStore.getPersonTopics(userId);
  const rels = graphStore.getRelationships(`${ENTITY.PERSON}${userId}`);

  return {
    topics,
    decisions: rels.outgoing.filter(r => r.relation === 'decided'),
    mentions: rels.outgoing.filter(r => r.relation === 'mentioned')
  };
}

/**
 * Get what's been discussed in a channel
 */
export async function getChannelContext(channelId) {
  if (!initialized) await init();

  const topics = graphStore.getChannelTopics(channelId);
  const convStats = await convStore.getStats(channelId);

  return {
    topics: [...new Set(topics)],
    messageCount: convStats.totalMessages,
    participants: Object.keys(convStats.byUser)
  };
}

/**
 * Find connection between two entities
 */
export function findConnection(entity1, entity2, maxDepth = 3) {
  const path = graphStore.findPath(entity1, entity2, maxDepth);
  if (!path) return null;

  return {
    connected: true,
    path: path.map(p => `${p.from} → ${p.relation} → ${p.to}`),
    hops: path.length
  };
}

/**
 * Get memory statistics
 */
export async function getStats() {
  if (!initialized) await init();

  const [docStats, convStats, graphStats] = await Promise.all([
    docStore.getStats(),
    convStore.getStats(),
    Promise.resolve(graphStore.getStats())
  ]);

  return {
    documents: {
      files: docStats.documents,
      chunks: docStats.totalChunks
    },
    conversations: {
      messages: convStats.totalMessages,
      channels: convStats.channels,
      users: convStats.users
    },
    graph: {
      nodes: graphStats.nodes,
      edges: graphStats.edges,
      byType: graphStats.byType,
      byRelation: graphStats.byRelation
    }
  };
}

// Direct access to individual stores
export { docStore, convStore, graphStore };

export default {
  init,
  indexMessage,
  indexMessages,
  search,
  getContext,
  getPersonContext,
  getChannelContext,
  findConnection,
  getStats,
  // Direct store access
  docs: docStore,
  convs: convStore,
  graph: graphStore
};
