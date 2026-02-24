/**
 * Enhanced Search Module
 *
 * Unified API for advanced search with:
 * - Hybrid search (semantic + BM25 keyword matching)
 * - LLM-based reranking for complex relevance judgments
 *
 * Usage:
 *   import search from './search/index.js';
 *   const results = await search.query('what did hubert say about the API?', {
 *     hybrid: true,
 *     rerank: true,
 *     limit: 5
 *   });
 */

import hybrid from './hybrid.js';
import reranker from './reranker.js';
import { docStore, convStore } from '../stores/index.js';

let initialized = false;
let logger = console;

/**
 * Initialize the search module
 */
export async function init(customLogger = console) {
  if (initialized) return true;

  logger = customLogger;

  // Stores are initialized via memory.js, just verify they're ready
  await Promise.all([
    docStore.init(logger),
    convStore.init(logger)
  ]);

  initialized = true;
  logger.log?.('info', 'Enhanced search initialized') ||
    console.log('[Search] Enhanced search ready');

  return true;
}

/**
 * Main search function with configurable pipeline
 *
 * @param {string} query - Search query
 * @param {Object} options
 * @param {boolean} options.hybrid - Use hybrid search (default: true)
 * @param {boolean} options.rerank - Use LLM reranking (default: auto based on result count)
 * @param {boolean} options.includeDocs - Search documents (default: true)
 * @param {boolean} options.includeConvs - Search conversations (default: true)
 * @param {number} options.limit - Results per category (default: 5)
 * @param {string} options.channelId - Filter by channel
 * @param {string} options.userId - Filter by user
 * @param {string} options.fileName - Filter by document name
 */
export async function query(queryText, options = {}) {
  if (!initialized) await init();

  const {
    hybrid: useHybrid = true,
    rerank: useRerank = 'auto',  // true, false, or 'auto'
    includeDocs = true,
    includeConvs = true,
    limit = 5,
    channelId,
    userId,
    fileName
  } = options;

  const startTime = Date.now();
  let results;

  // Stage 1: Hybrid or standard search
  if (useHybrid) {
    results = await hybrid.search(queryText, {
      includeDocs,
      includeConvs,
      limit: limit * 3,  // Get more candidates for reranking
      channelId,
      userId,
      fileName
    });
  } else {
    // Standard vector-only search
    results = { documents: [], conversations: [] };

    if (includeDocs) {
      results.documents = await docStore.search(queryText, {
        channelId,
        fileName,
        limit: limit * 2,
        minScore: 0.1
      });
    }

    if (includeConvs) {
      results.conversations = await convStore.search(queryText, {
        channelId,
        userId,
        limit: limit * 2,
        minScore: 0.1
      });
    }
  }

  // Stage 2: Reranking
  const shouldRerank = useRerank === true ||
    (useRerank === 'auto' && (
      results.documents.length > limit ||
      results.conversations.length > limit
    ));

  if (shouldRerank) {
    results = await reranker.rerankAll(queryText, results, limit, { logger });
  } else {
    // Just slice to limit
    results.documents = results.documents.slice(0, limit);
    results.conversations = results.conversations.slice(0, limit);
  }

  const elapsed = Date.now() - startTime;

  logger.log?.('debug', 'Search complete', {
    query: queryText.slice(0, 50),
    docs: results.documents.length,
    convs: results.conversations.length,
    hybrid: useHybrid,
    reranked: shouldRerank,
    elapsed
  });

  return {
    ...results,
    meta: {
      query: queryText,
      hybrid: useHybrid,
      reranked: shouldRerank,
      elapsed
    }
  };
}

/**
 * Search documents only (convenience method)
 */
export async function searchDocuments(queryText, options = {}) {
  const results = await query(queryText, {
    ...options,
    includeDocs: true,
    includeConvs: false
  });
  return results.documents;
}

/**
 * Search conversations only (convenience method)
 */
export async function searchConversations(queryText, options = {}) {
  const results = await query(queryText, {
    ...options,
    includeDocs: false,
    includeConvs: true
  });
  return results.conversations;
}

/**
 * Quick search - hybrid only, no reranking (fastest)
 */
export async function quick(queryText, options = {}) {
  return query(queryText, {
    ...options,
    hybrid: true,
    rerank: false
  });
}

/**
 * Deep search - full pipeline with reranking (most accurate)
 */
export async function deep(queryText, options = {}) {
  return query(queryText, {
    ...options,
    hybrid: true,
    rerank: true,
    limit: options.limit || 10
  });
}

/**
 * Format results for AI context
 */
export function formatForContext(results, options = {}) {
  const { maxDocs = 3, maxConvs = 5 } = options;
  let context = '';

  // Document context
  if (results.documents?.length > 0) {
    context += '## Relevant Documents\n\n';
    for (const doc of results.documents.slice(0, maxDocs)) {
      const source = doc.section ? `${doc.fileName} > ${doc.section}` : doc.fileName;
      const page = doc.pageNumber > 0 ? ` (p.${doc.pageNumber})` : '';
      const score = doc.rerankScore !== undefined
        ? `[rerank:${doc.rerankScore}]`
        : `[${((doc.hybridScore || doc.score) * 100).toFixed(0)}%]`;
      context += `**${source}${page}** ${score}\n`;
      context += `${doc.text}\n\n`;
    }
  }

  // Conversation context
  if (results.conversations?.length > 0) {
    context += '## Related Conversations\n\n';
    for (const conv of results.conversations.slice(0, maxConvs)) {
      const date = new Date(conv.timestamp).toLocaleDateString();
      const channel = conv.channelName || conv.channelId;
      const score = conv.rerankScore !== undefined
        ? `[rerank:${conv.rerankScore}]`
        : `[${((conv.hybridScore || conv.score) * 100).toFixed(0)}%]`;
      context += `**${conv.userName}** in #${channel} (${date}) ${score}\n`;
      context += `> ${conv.text}\n\n`;
    }
  }

  return context || null;
}

/**
 * Get context for AI (combines search + formatting)
 */
export async function getContext(queryText, options = {}) {
  const results = await query(queryText, options);
  return formatForContext(results, options);
}

export default {
  init,
  query,
  searchDocuments,
  searchConversations,
  quick,
  deep,
  formatForContext,
  getContext,
  // Expose sub-modules for advanced use
  hybrid,
  reranker
};
