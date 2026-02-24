/**
 * Hybrid Search - Combines semantic vector search with BM25 keyword search
 *
 * Uses Reciprocal Rank Fusion (RRF) to merge results from both approaches.
 * This catches exact term matches that embeddings miss (names, acronyms, codes).
 */

import { docStore, convStore } from '../stores/index.js';

// BM25 parameters
const K1 = 1.2;  // Term frequency saturation
const B = 0.75;  // Length normalization

/**
 * Tokenize text for BM25
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

/**
 * Calculate BM25 score for a document against a query
 * @param {string[]} queryTokens
 * @param {string[]} docTokens
 * @param {number} avgDocLength - Average document length in corpus
 * @param {Object} idf - Inverse document frequency map
 */
function bm25Score(queryTokens, docTokens, avgDocLength, idf) {
  const docLength = docTokens.length;
  const termFreq = {};

  for (const token of docTokens) {
    termFreq[token] = (termFreq[token] || 0) + 1;
  }

  let score = 0;
  for (const term of queryTokens) {
    if (!termFreq[term]) continue;

    const tf = termFreq[term];
    const termIdf = idf[term] || 0;

    // BM25 formula
    const numerator = tf * (K1 + 1);
    const denominator = tf + K1 * (1 - B + B * (docLength / avgDocLength));
    score += termIdf * (numerator / denominator);
  }

  return score;
}

/**
 * Calculate IDF for terms across a corpus
 * @param {string[][]} corpus - Array of tokenized documents
 * @param {string[]} queryTokens
 */
function calculateIdf(corpus, queryTokens) {
  const N = corpus.length;
  const idf = {};

  for (const term of queryTokens) {
    // Count documents containing this term
    const df = corpus.filter(doc => doc.includes(term)).length;
    // IDF with smoothing
    idf[term] = df > 0 ? Math.log((N - df + 0.5) / (df + 0.5) + 1) : 0;
  }

  return idf;
}

/**
 * Reciprocal Rank Fusion - merges ranked lists
 * @param {Array[]} rankedLists - Array of ranked result lists
 * @param {number} k - RRF constant (default 60)
 */
function reciprocalRankFusion(rankedLists, k = 60) {
  const scores = new Map();
  const items = new Map();

  for (const list of rankedLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const item = list[rank];
      const id = item.id || item.messageId || `${item.fileName}_${item.chunkIndex}`;

      // RRF score: 1 / (k + rank)
      const rrfScore = 1 / (k + rank + 1);
      scores.set(id, (scores.get(id) || 0) + rrfScore);

      // Store the full item (use first occurrence)
      if (!items.has(id)) {
        items.set(id, item);
      }
    }
  }

  // Sort by combined RRF score
  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => ({
      ...items.get(id),
      rrfScore: score
    }));
}

/**
 * Perform BM25 keyword search on a set of documents
 * @param {string} query
 * @param {Array} documents - Array of {text, ...metadata}
 * @param {number} limit
 */
function bm25Search(query, documents, limit = 20) {
  if (documents.length === 0) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  // Tokenize all documents
  const corpus = documents.map(doc => tokenize(doc.text));

  // Calculate average document length
  const avgDocLength = corpus.reduce((sum, doc) => sum + doc.length, 0) / corpus.length;

  // Calculate IDF
  const idf = calculateIdf(corpus, queryTokens);

  // Score each document
  const scored = documents.map((doc, i) => ({
    ...doc,
    bm25Score: bm25Score(queryTokens, corpus[i], avgDocLength, idf)
  }));

  // Filter and sort
  return scored
    .filter(doc => doc.bm25Score > 0)
    .sort((a, b) => b.bm25Score - a.bm25Score)
    .slice(0, limit);
}

/**
 * Hybrid search for documents
 * @param {string} query
 * @param {Object} options
 */
export async function searchDocuments(query, options = {}) {
  const {
    channelId,
    fileName,
    limit = 10,
    vectorWeight = 0.7,
    keywordWeight = 0.3,
    candidateMultiplier = 3
  } = options;

  const candidateLimit = limit * candidateMultiplier;

  // 1. Vector search (semantic)
  const vectorResults = await docStore.search(query, {
    channelId,
    fileName,
    limit: candidateLimit,
    minScore: 0.05  // Lower threshold to get more candidates
  });

  // 2. If we have vector results, run BM25 on the same corpus
  // For efficiency, we use vector results as our BM25 corpus
  // (In production, you might want a separate keyword index)
  let keywordResults = [];
  if (vectorResults.length > 0) {
    keywordResults = bm25Search(query, vectorResults, candidateLimit);
  }

  // 3. If we have both, use RRF to merge
  if (vectorResults.length > 0 && keywordResults.length > 0) {
    const fused = reciprocalRankFusion([vectorResults, keywordResults]);
    return fused.slice(0, limit).map(r => ({
      ...r,
      hybridScore: r.rrfScore,
      searchType: 'hybrid'
    }));
  }

  // 4. Fallback to vector-only
  return vectorResults.slice(0, limit).map(r => ({
    ...r,
    hybridScore: r.score,
    searchType: 'vector'
  }));
}

/**
 * Hybrid search for conversations
 * @param {string} query
 * @param {Object} options
 */
export async function searchConversations(query, options = {}) {
  const {
    channelId,
    userId,
    limit = 10,
    candidateMultiplier = 3
  } = options;

  const candidateLimit = limit * candidateMultiplier;

  // 1. Vector search (semantic)
  const vectorResults = await convStore.search(query, {
    channelId,
    userId,
    limit: candidateLimit,
    minScore: 0.05
  });

  // 2. BM25 on vector results
  let keywordResults = [];
  if (vectorResults.length > 0) {
    keywordResults = bm25Search(query, vectorResults, candidateLimit);
  }

  // 3. RRF fusion
  if (vectorResults.length > 0 && keywordResults.length > 0) {
    const fused = reciprocalRankFusion([vectorResults, keywordResults]);
    return fused.slice(0, limit).map(r => ({
      ...r,
      hybridScore: r.rrfScore,
      searchType: 'hybrid'
    }));
  }

  return vectorResults.slice(0, limit).map(r => ({
    ...r,
    hybridScore: r.score,
    searchType: 'vector'
  }));
}

/**
 * Unified hybrid search across documents and conversations
 * @param {string} query
 * @param {Object} options
 */
export async function search(query, options = {}) {
  const {
    includeDocs = true,
    includeConvs = true,
    limit = 10,
    ...restOptions
  } = options;

  const results = { documents: [], conversations: [] };

  const promises = [];

  if (includeDocs) {
    promises.push(
      searchDocuments(query, { ...restOptions, limit })
        .then(docs => { results.documents = docs; })
    );
  }

  if (includeConvs) {
    promises.push(
      searchConversations(query, { ...restOptions, limit })
        .then(convs => { results.conversations = convs; })
    );
  }

  await Promise.all(promises);

  return results;
}

export default {
  search,
  searchDocuments,
  searchConversations,
  bm25Search,
  reciprocalRankFusion
};
