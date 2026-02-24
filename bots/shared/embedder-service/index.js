/**
 * Shared Embedder Service
 *
 * Single process, event-loop ordered, race-free architecture.
 * Node.js event loop provides natural FIFO ordering.
 * Single writer to audit log eliminates file races.
 *
 * Health monitoring:
 * - Systemd watchdog integration (notifies every 30s)
 * - Auto-restart on hang via WatchdogSec
 */

import http from 'http';
import fs from 'fs';
import { pipeline } from '@xenova/transformers';

const PORT = 3377;
const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
const MAX_TEXT_LENGTH = 8000;
const EVENT_LOG = '/mnt/volume_nyc3_01/embedder-events/events.jsonl';
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB, then rotate

let embedder = null;
let ready = false;
let requestCount = 0;

// Ensure event directory exists
const eventDir = '/mnt/volume_nyc3_01/embedder-events';
if (!fs.existsSync(eventDir)) {
  fs.mkdirSync(eventDir, { recursive: true });
}

/**
 * Append event to audit log (single writer - no races)
 * Auto-rotates when log exceeds MAX_LOG_SIZE
 */
function logEvent(event) {
  const entry = {
    ts: Date.now(),
    seq: ++requestCount,
    ...event
  };

  // Rotate log if too large
  try {
    if (fs.existsSync(EVENT_LOG)) {
      const stats = fs.statSync(EVENT_LOG);
      if (stats.size > MAX_LOG_SIZE) {
        const rotatedPath = `${EVENT_LOG}.${Date.now()}`;
        fs.renameSync(EVENT_LOG, rotatedPath);
        console.log(`[Embedder] Rotated log to ${rotatedPath}`);
      }
    }
  } catch (err) {
    console.error('[Embedder] Log rotation error:', err.message);
  }

  fs.appendFileSync(EVENT_LOG, JSON.stringify(entry) + '\n');
  return entry;
}

/**
 * Initialize the embedding model
 */
async function init() {
  logEvent({ type: 'init_started', model: EMBEDDING_MODEL });

  console.log(`[Embedder] Loading model: ${EMBEDDING_MODEL}`);
  const startTime = Date.now();

  embedder = await pipeline('feature-extraction', EMBEDDING_MODEL, {
    quantized: true
  });

  const loadTimeMs = Date.now() - startTime;
  ready = true;

  logEvent({ type: 'init_completed', model: EMBEDDING_MODEL, loadTimeMs });
  console.log(`[Embedder] Model ready in ${loadTimeMs}ms`);
}

/**
 * Generate embedding for text
 */
async function embed(text) {
  const truncated = text.length > MAX_TEXT_LENGTH
    ? text.substring(0, MAX_TEXT_LENGTH)
    : text;

  const output = await embedder(truncated, {
    pooling: 'mean',
    normalize: true
  });

  return Array.from(output.data);
}

/**
 * Handle HTTP requests
 */
async function handleRequest(req, res) {
  const startTime = Date.now();

  // Health check (used by systemd, clients, monitoring)
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: ready ? 'ready' : 'loading',
      model: EMBEDDING_MODEL,
      requestCount,
      uptime: process.uptime()
    }));
    return;
  }

  // Event log (recent entries - for debugging)
  if (req.method === 'GET' && req.url === '/events') {
    let events = [];
    if (fs.existsSync(EVENT_LOG)) {
      const lines = fs.readFileSync(EVENT_LOG, 'utf8').trim().split('\n');
      events = lines.slice(-50).map(l => JSON.parse(l)).reverse();
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ events }));
    return;
  }

  // Embed endpoint
  if (req.method === 'POST' && req.url === '/embed') {
    if (!ready) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Model not ready' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const source = data.source || 'unknown';

        // Log request
        logEvent({ type: 'embed_request', source, textLength: data.text?.length || 0 });

        // Single text
        if (data.text) {
          const embedding = await embed(data.text);
          const elapsed = Date.now() - startTime;

          logEvent({ type: 'embed_result', source, elapsed, success: true });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ embedding }));
          return;
        }

        // Batch texts
        if (data.texts && Array.isArray(data.texts)) {
          const embeddings = [];
          for (const text of data.texts) {
            embeddings.push(await embed(text));
          }
          const elapsed = Date.now() - startTime;

          logEvent({ type: 'embed_result', source, elapsed, count: data.texts.length, success: true });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ embeddings }));
          return;
        }

        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing text or texts field' }));

      } catch (err) {
        logEvent({ type: 'embed_error', error: err.message });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

/**
 * Notify systemd watchdog (keeps service alive)
 */
async function notifyWatchdog() {
  // sd_notify protocol: write to $NOTIFY_SOCKET
  const notifySocket = process.env.NOTIFY_SOCKET;
  if (notifySocket && ready) {
    try {
      const dgram = await import('dgram');
      const client = dgram.createSocket('unix_dgram');
      client.send('WATCHDOG=1', notifySocket, () => client.close());
    } catch {
      // Ignore - watchdog is optional
    }
  }
}

/**
 * Start server
 */
async function main() {
  console.log('[Embedder] Starting service...');

  await init();

  const server = http.createServer(handleRequest);

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[Embedder] Listening on http://127.0.0.1:${PORT}`);
    logEvent({ type: 'server_started', port: PORT });

    // Notify systemd we're ready
    if (process.env.NOTIFY_SOCKET) {
      import('dgram').then(dgram => {
        const client = dgram.createSocket('unix_dgram');
        client.send('READY=1', process.env.NOTIFY_SOCKET, () => client.close());
      }).catch(() => {});
    }
  });

  // Watchdog heartbeat every 30s
  setInterval(notifyWatchdog, 30000);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logEvent({ type: 'shutdown' });
    console.log('[Embedder] Shutting down...');
    server.close(() => process.exit(0));
  });
}

main().catch(err => {
  console.error('[Embedder] Fatal:', err);
  process.exit(1);
});
