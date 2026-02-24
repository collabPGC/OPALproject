/**
 * Task Processor - Worker Thread Architecture
 *
 * Main thread manages queue, spawns workers for parallel execution.
 * Workers import their own dependencies (see task-worker.js).
 *
 * Usage:
 *   import taskProcessor from '../shared/task-processor.js';
 *   taskProcessor.start({ postMessage, log, maxWorkers: 4 });
 */

import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import * as taskQueue from './task-queue.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_FILE = path.join(__dirname, 'task-worker.js');

// Which task types can be handled by workers
const WORKER_TYPES = new Set([
  'research',
  'follow_up',
  'reminder',
  'analysis'
]);

// Custom handlers registered by bots (run on main thread)
const customHandlers = new Map();

// Active workers
const activeWorkers = new Map(); // taskId -> Worker

// Processor state
let running = false;
let intervalId = null;
let context = {};
let maxWorkers = 4;

/**
 * Register a custom handler (runs on main thread, not worker)
 * Use for handlers that need bot-specific resources
 */
export function register(taskType, handler) {
  customHandlers.set(taskType, handler);
  console.log(`[TaskProcessor] Registered custom handler for: ${taskType}`);
}

/**
 * Unregister a handler
 */
export function unregister(taskType) {
  customHandlers.delete(taskType);
}

/**
 * Get all handleable task types
 */
export function getRegisteredTypes() {
  return [...WORKER_TYPES, ...customHandlers.keys()];
}

/**
 * Check if a task type can be handled
 */
export function hasHandler(taskType) {
  return WORKER_TYPES.has(taskType) || customHandlers.has(taskType);
}

/**
 * Execute task in worker thread
 */
function executeInWorker(task) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_FILE, {
      workerData: { task }
    });

    activeWorkers.set(task.id, worker);

    const timeout = setTimeout(() => {
      worker.terminate();
      activeWorkers.delete(task.id);
      reject(new Error('Task timeout (5 min)'));
    }, 5 * 60 * 1000);

    worker.on('message', async (msg) => {
      switch (msg.type) {
        case 'complete':
          clearTimeout(timeout);
          activeWorkers.delete(task.id);
          resolve(msg.result);
          break;

        case 'error':
          clearTimeout(timeout);
          activeWorkers.delete(task.id);
          reject(new Error(msg.error));
          break;

        case 'postMessage':
          if (context.postMessage) {
            try {
              await context.postMessage(msg.channelId, msg.message, msg.threadId);
            } catch (err) {
              context.log?.('warn', 'Worker postMessage failed', { error: err.message });
            }
          }
          break;

        case 'log':
          context.log?.(msg.level, `[Worker] ${msg.msg}`, msg.data);
          break;
      }
    });

    worker.on('error', (err) => {
      clearTimeout(timeout);
      activeWorkers.delete(task.id);
      reject(err);
    });

    worker.on('exit', (code) => {
      if (code !== 0 && activeWorkers.has(task.id)) {
        clearTimeout(timeout);
        activeWorkers.delete(task.id);
        reject(new Error(`Worker exited with code ${code}`));
      }
    });
  });
}

/**
 * Execute custom handler on main thread
 */
async function executeCustom(task) {
  const handler = customHandlers.get(task.type);
  if (!handler) {
    throw new Error(`No custom handler for: ${task.type}`);
  }
  return await handler(task, context);
}

/**
 * Process a single task
 */
async function processTask(task) {
  const useWorker = WORKER_TYPES.has(task.type);

  context.log?.('info', 'Processing task', {
    id: task.id,
    type: task.type,
    title: task.title,
    mode: useWorker ? 'worker' : 'main'
  });

  taskQueue.startTask(task.id);

  try {
    let result;

    if (useWorker) {
      result = await executeInWorker(task);
    } else if (customHandlers.has(task.type)) {
      result = await executeCustom(task);
    } else {
      throw new Error(`No handler for task type: ${task.type}`);
    }

    if (result.success) {
      taskQueue.completeTask(task.id, result.result || {});
      context.log?.('info', 'Task completed', { id: task.id, title: task.title });
    } else {
      throw new Error(result.error || 'Handler returned failure');
    }
  } catch (err) {
    context.log?.('error', 'Task failed', { taskId: task.id, error: err.message });
    taskQueue.failTask(task.id, err.message);

    if (task.channelId && context.postMessage) {
      try {
        await context.postMessage(
          task.channelId,
          `❌ Task failed: ${task.title}\n\nError: ${err.message}`
        );
      } catch (e) {
        context.log?.('warn', 'Failed to post error message', { error: e.message });
      }
    }
  }
}

/**
 * Process available tasks (up to maxWorkers in parallel)
 */
async function processAvailable() {
  const available = maxWorkers - activeWorkers.size;
  if (available <= 0) return;

  // Get pending tasks we can handle
  const allHandleable = new Set([...WORKER_TYPES, ...customHandlers.keys()]);
  const pending = taskQueue.getPendingTasks()
    .filter(t => t.status === 'pending' && allHandleable.has(t.type))
    .slice(0, available);

  if (pending.length === 0) return;

  context.log?.('debug', `Processing ${pending.length} tasks`, {
    activeWorkers: activeWorkers.size
  });

  // Process in parallel
  const promises = pending.map(task => processTask(task));
  await Promise.allSettled(promises);
}

/**
 * Start the processor
 */
export function start(ctx = {}) {
  if (running) {
    console.log('[TaskProcessor] Already running');
    return;
  }

  context = {
    postMessage: ctx.postMessage,
    log: ctx.log || console.log,
    ...ctx
  };

  maxWorkers = ctx.maxWorkers || 4;
  const interval = ctx.interval || 10000;

  // Recover stale tasks
  const recovered = taskQueue.recoverStaleTasks();
  if (recovered > 0) {
    context.log('info', `Recovered ${recovered} stale tasks`);
  }

  intervalId = setInterval(processAvailable, interval);
  running = true;

  context.log('info', 'Task processor started', {
    maxWorkers,
    interval,
    workerTypes: [...WORKER_TYPES],
    customTypes: [...customHandlers.keys()]
  });

  // Process immediately if pending
  const stats = taskQueue.getStats();
  if (stats.pending > 0) {
    context.log('info', 'Found pending tasks', { pending: stats.pending });
    processAvailable();
  }
}

/**
 * Stop the processor
 */
export function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  for (const [taskId, worker] of activeWorkers) {
    worker.terminate();
    context.log?.('warn', 'Terminated worker', { taskId });
  }
  activeWorkers.clear();

  running = false;
  console.log('[TaskProcessor] Stopped');
}

/**
 * Trigger immediate processing
 */
export function trigger() {
  if (!running) return;
  processAvailable();
}

/**
 * Get status
 */
export function getStatus() {
  return {
    running,
    maxWorkers,
    activeWorkers: activeWorkers.size,
    activeTasks: Array.from(activeWorkers.keys()),
    workerTypes: [...WORKER_TYPES],
    customHandlers: [...customHandlers.keys()],
    queueStats: taskQueue.getStats()
  };
}

export { taskQueue };

export default {
  register,
  unregister,
  getRegisteredTypes,
  hasHandler,
  start,
  stop,
  trigger,
  isRunning: () => running,
  getStatus,
  taskQueue
};
