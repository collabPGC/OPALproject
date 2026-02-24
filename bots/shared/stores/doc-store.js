/**
 * Document Store - Vector storage for PDF/DOCX document chunks
 *
 * Uses LanceDB for efficient vector similarity search.
 * Storage: /mnt/volume_nyc3_01/vectordb/documents/
 */

import * as lancedb from '@lancedb/lancedb';
import embedder from './embedder.js';

// Configuration
const DB_PATH = '/mnt/volume_nyc3_01/vectordb/documents';
const TABLE_NAME = 'documents';

// Singleton
let db = null;
let initialized = false;

/**
 * Initialize the document store
 */
export async function init(logger = console) {
  if (initialized) return true;

  await embedder.init(logger);

  db = await lancedb.connect(DB_PATH);
  logger.log?.('info', 'DocStore connected', { path: DB_PATH }) ||
    console.log(`[DocStore] Connected: ${DB_PATH}`);

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
      fileName: '',
      chunkIndex: 0,
      channelId: '',
      pageNumber: 0,
      section: '',
      createdAt: Date.now()
    }];

    await db.createTable(TABLE_NAME, initialData);
    const table = await db.openTable(TABLE_NAME);
    await table.delete('id = "__init__"');
  }

  return db.openTable(TABLE_NAME);
}

/**
 * Add document chunks to the store
 * @param {Object} options
 * @param {string} options.fileName - Document file name
 * @param {string} options.channelId - Source channel
 * @param {Array} options.chunks - Array of {text, pageNumber?, section?}
 */
export async function addDocument({ fileName, channelId, chunks }, logger = console) {
  if (!initialized) await init(logger);

  const table = await ensureTable();
  const timestamp = Date.now();
  const baseId = `${channelId}_${fileName}_${timestamp}`;

  logger.log?.('info', 'Indexing document', { fileName, chunks: chunks.length }) ||
    console.log(`[DocStore] Indexing ${chunks.length} chunks: ${fileName}`);

  const texts = chunks.map(c => c.text);
  const embeddings = await embedder.embedBatch(texts);

  const records = chunks.map((chunk, i) => ({
    id: `${baseId}_${i}`,
    vector: embeddings[i],
    text: chunk.text,
    fileName,
    chunkIndex: i,
    channelId,
    pageNumber: chunk.pageNumber || 0,
    section: chunk.section || '',
    createdAt: timestamp
  }));

  await table.add(records);

  logger.log?.('info', 'Document indexed', { fileName, chunks: records.length }) ||
    console.log(`[DocStore] Indexed: ${fileName}`);

  return { indexed: records.length, fileName };
}

/**
 * Search for relevant document chunks
 * @param {string} query - Search query
 * @param {Object} options - channelId, fileName, limit, minScore
 */
export async function search(query, options = {}) {
  if (!initialized) await init();

  const { channelId, fileName, limit = 5, minScore = 0.1 } = options;

  const table = await ensureTable();
  const queryVector = await embedder.embed(query);

  let searchQuery = table.vectorSearch(queryVector).distanceType('cosine').limit(limit * 2);

  if (channelId) {
    searchQuery = searchQuery.where(`channelId = '${channelId}'`);
  }
  if (fileName) {
    searchQuery = searchQuery.where(`fileName = '${fileName}'`);
  }

  const results = await searchQuery.toArray();

  return results
    .filter(r => r._distance !== undefined && (1 - r._distance) >= minScore)
    .slice(0, limit)
    .map(r => ({
      text: r.text,
      fileName: r.fileName,
      section: r.section,
      pageNumber: r.pageNumber,
      score: 1 - r._distance,
      chunkIndex: r.chunkIndex
    }));
}

/**
 * Format search results for AI context
 */
export async function searchForContext(query, options = {}) {
  const results = await search(query, options);
  if (results.length === 0) return null;

  let context = '## Relevant Documents\n\n';
  for (const r of results) {
    const source = r.section ? `${r.fileName} > ${r.section}` : r.fileName;
    const page = r.pageNumber > 0 ? ` (p.${r.pageNumber})` : '';
    context += `**${source}${page}** [${(r.score * 100).toFixed(0)}%]\n`;
    context += `${r.text}\n\n`;
  }
  return context;
}

/**
 * Delete document by name and channel
 */
export async function deleteDocument(fileName, channelId) {
  if (!initialized) await init();
  const table = await ensureTable();
  await table.delete(`fileName = '${fileName}' AND channelId = '${channelId}'`);
  return { deleted: true, fileName };
}

/**
 * Delete all documents for a channel
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

  const byFile = {};
  for (const r of filtered) {
    byFile[r.fileName] = (byFile[r.fileName] || 0) + 1;
  }

  return {
    totalChunks: filtered.length,
    documents: Object.keys(byFile).length,
    byFile
  };
}

/**
 * List indexed documents
 */
export async function listDocuments(channelId = null) {
  if (!initialized) await init();

  const table = await ensureTable();
  const results = await table.query().select(['fileName', 'channelId', 'createdAt']).toArray();

  const filtered = channelId ? results.filter(r => r.channelId === channelId) : results;

  const docs = {};
  for (const r of filtered) {
    const key = `${r.channelId}:${r.fileName}`;
    if (!docs[key]) {
      docs[key] = { fileName: r.fileName, channelId: r.channelId, createdAt: r.createdAt, chunks: 0 };
    }
    docs[key].chunks++;
  }

  return Object.values(docs);
}

export default {
  init,
  addDocument,
  search,
  searchForContext,
  deleteDocument,
  deleteChannel,
  getStats,
  listDocuments
};
