/**
 * Embedder Client
 *
 * Connects to shared embedder service via HTTP.
 * No local model loading - saves ~80MB RAM per bot.
 * Service guarantees ordering via Node.js event loop.
 */

const SERVICE_URL = 'http://127.0.0.1:3377';
const EMBEDDING_DIM = 384;
const MAX_RETRIES = 30;
const RETRY_DELAY_MS = 1000;

let initialized = false;
let serviceName = 'unknown';

/**
 * Wait for embedder service to be ready
 */
export async function init(logger = console, source = 'unknown') {
  if (initialized) return true;
  serviceName = source;

  logger.log?.('info', '[Embedder] Connecting to service...') ||
    console.log('[Embedder] Connecting to service...');

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const res = await fetch(`${SERVICE_URL}/health`);
      const data = await res.json();

      if (data.status === 'ready') {
        initialized = true;
        logger.log?.('info', '[Embedder] Connected', { model: data.model }) ||
          console.log(`[Embedder] Connected: ${data.model}`);
        return true;
      }
    } catch {
      // Service not up yet
    }

    if (i < MAX_RETRIES - 1) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    }
  }

  throw new Error('Embedder service unavailable after 30s');
}

/**
 * Generate embedding for text
 * @param {string} text
 * @returns {Promise<number[]>} 384-dim vector
 */
export async function embed(text) {
  if (!initialized) await init();

  const res = await fetch(`${SERVICE_URL}/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, source: serviceName })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error);
  }

  const data = await res.json();
  return data.embedding;
}

/**
 * Embed multiple texts
 * @param {string[]} texts
 * @param {number} batchSize
 * @returns {Promise<number[][]>}
 */
export async function embedBatch(texts, batchSize = 20) {
  if (!initialized) await init();

  const results = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const res = await fetch(`${SERVICE_URL}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: batch, source: serviceName })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }

    const data = await res.json();
    results.push(...data.embeddings);
  }

  return results;
}

/**
 * Get embedding dimension
 */
export function getDimension() {
  return EMBEDDING_DIM;
}

/**
 * Check if connected
 */
export function isReady() {
  return initialized;
}

export default {
  init,
  embed,
  embedBatch,
  getDimension,
  isReady
};
