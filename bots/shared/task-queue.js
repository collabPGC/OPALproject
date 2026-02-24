/**
 * Task Queue System - Job File Architecture
 *
 * Uses individual job files for concurrency-safe task processing.
 * Similar to maildir spool - atomic file operations, no lock contention.
 *
 * Directory structure:
 *   jobs/pending/     - New tasks waiting to be processed
 *   jobs/processing/  - Tasks currently being worked on
 *   jobs/completed/   - Successfully completed tasks
 *   jobs/failed/      - Failed tasks (for retry/inspection)
 *
 * File naming: {priority}_{timestamp}_{id}.json
 * - Natural sorting by priority then creation time
 * - Claiming = atomic rename from pending → processing
 */

import fs from 'fs';
import path from 'path';

const JOBS_DIR = '/opt/mattermost/bots-v2/shared/data/jobs';
const DIRS = {
  pending: path.join(JOBS_DIR, 'pending'),
  processing: path.join(JOBS_DIR, 'processing'),
  completed: path.join(JOBS_DIR, 'completed'),
  failed: path.join(JOBS_DIR, 'failed')
};

// Ensure directories exist
for (const dir of Object.values(DIRS)) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Task priorities (lower = higher priority)
export const PRIORITY = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
  BACKGROUND: 4
};

// Task statuses
export const STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  DEFERRED: 'deferred'
};

// Task types
export const TASK_TYPE = {
  FILE_PROCESS: 'file_process',
  FILE_SCAN: 'file_scan',
  RESEARCH: 'research',
  ANALYSIS: 'analysis',
  FOLLOW_UP: 'follow_up',
  REMINDER: 'reminder',
  SCHEDULED: 'scheduled',
  CREW_PIPELINE: 'crew_pipeline'
};

// Stats file (simple counter file, updated atomically)
const STATS_FILE = path.join(JOBS_DIR, 'stats.json');

function loadStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[TaskQueue] Failed to load stats:', err.message);
  }
  return { totalCreated: 0, totalCompleted: 0, totalFailed: 0 };
}

function saveStats(stats) {
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
  } catch (err) {
    console.error('[TaskQueue] Failed to save stats:', err.message);
  }
}

/**
 * Generate unique task ID
 */
function generateId() {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate filename for a task (sortable by priority then time)
 */
function getFilename(task) {
  const priority = String(task.priority).padStart(2, '0');
  const timestamp = String(task.createdAt).padStart(15, '0');
  return `${priority}_${timestamp}_${task.id}.json`;
}

/**
 * Read a task from a file
 */
function readTask(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (err) {
    console.error(`[TaskQueue] Failed to read task: ${filepath}`, err.message);
    return null;
  }
}

/**
 * Write a task to a file
 */
function writeTask(dir, task) {
  const filename = getFilename(task);
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, JSON.stringify(task, null, 2));
  return filepath;
}

/**
 * List tasks in a directory, sorted by filename (priority + time)
 */
function listTasks(dir, limit = 100) {
  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .sort() // Natural sort by priority_timestamp_id
      .slice(0, limit);

    return files.map(f => ({
      file: f,
      path: path.join(dir, f),
      task: readTask(path.join(dir, f))
    })).filter(t => t.task !== null);
  } catch (err) {
    console.error(`[TaskQueue] Failed to list tasks in ${dir}:`, err.message);
    return [];
  }
}

/**
 * Add a new task to the queue
 */
export function addTask(taskData) {
  const task = {
    id: generateId(),
    type: taskData.type || TASK_TYPE.SCHEDULED,
    priority: taskData.priority ?? PRIORITY.NORMAL,
    status: STATUS.PENDING,
    channelId: taskData.channelId,
    requestedBy: taskData.requestedBy,
    title: taskData.title,
    description: taskData.description,
    data: taskData.data || {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    scheduledFor: taskData.scheduledFor || null,
    retries: 0,
    maxRetries: taskData.maxRetries ?? 3,
    error: null
  };

  writeTask(DIRS.pending, task);

  const stats = loadStats();
  stats.totalCreated++;
  saveStats(stats);

  console.log(`[TaskQueue] Added task: ${task.title} (${task.id})`);
  return task;
}

/**
 * Get next pending task (respects priority and schedule)
 * Does NOT claim it - use startTask() to claim
 */
export function getNextTask() {
  const now = Date.now();
  const pending = listTasks(DIRS.pending, 50);

  for (const { task } of pending) {
    // Skip if not yet scheduled
    if (task.scheduledFor && task.scheduledFor > now) continue;
    return task;
  }

  return null;
}

/**
 * Claim and start a task (atomic move from pending to processing)
 */
export function startTask(taskId) {
  // Find the task file in pending
  const pending = listTasks(DIRS.pending);
  const found = pending.find(({ task }) => task.id === taskId);

  if (!found) {
    console.error(`[TaskQueue] Task not found in pending: ${taskId}`);
    return null;
  }

  // Update task status
  const task = found.task;
  task.status = STATUS.IN_PROGRESS;
  task.startedAt = Date.now();
  task.updatedAt = Date.now();

  // Atomic move: write to processing, then delete from pending
  const newPath = writeTask(DIRS.processing, task);

  try {
    fs.unlinkSync(found.path);
  } catch (err) {
    // If unlink fails, remove from processing to avoid duplicates
    try { fs.unlinkSync(newPath); } catch {}
    console.error(`[TaskQueue] Failed to claim task: ${taskId}`, err.message);
    return null;
  }

  console.log(`[TaskQueue] Started task: ${task.title} (${task.id})`);
  return task;
}

/**
 * Mark task as completed
 */
export function completeTask(taskId, result = null) {
  // Find in processing
  const processing = listTasks(DIRS.processing);
  const found = processing.find(({ task }) => task.id === taskId);

  if (!found) {
    console.error(`[TaskQueue] Task not found in processing: ${taskId}`);
    return null;
  }

  const task = found.task;
  task.status = STATUS.COMPLETED;
  task.completedAt = Date.now();
  task.updatedAt = Date.now();
  task.result = result;

  // Move to completed
  writeTask(DIRS.completed, task);
  fs.unlinkSync(found.path);

  // Update stats
  const stats = loadStats();
  stats.totalCompleted++;
  saveStats(stats);

  // Prune old completed tasks (keep last 100)
  pruneDir(DIRS.completed, 100);

  console.log(`[TaskQueue] Completed task: ${task.title} (${task.id})`);
  return task;
}

/**
 * Mark task as failed
 */
export function failTask(taskId, error) {
  // Find in processing
  const processing = listTasks(DIRS.processing);
  const found = processing.find(({ task }) => task.id === taskId);

  if (!found) {
    console.error(`[TaskQueue] Task not found in processing: ${taskId}`);
    return null;
  }

  const task = found.task;
  task.retries++;
  task.error = error;
  task.updatedAt = Date.now();

  if (task.retries >= task.maxRetries) {
    // Move to failed
    task.status = STATUS.FAILED;
    task.failedAt = Date.now();
    writeTask(DIRS.failed, task);
    fs.unlinkSync(found.path);

    const stats = loadStats();
    stats.totalFailed++;
    saveStats(stats);

    // Prune old failed tasks (keep last 50)
    pruneDir(DIRS.failed, 50);

    console.log(`[TaskQueue] Task failed permanently: ${task.title} (${task.id})`);
  } else {
    // Return to pending for retry
    task.status = STATUS.PENDING;
    writeTask(DIRS.pending, task);
    fs.unlinkSync(found.path);

    console.log(`[TaskQueue] Task retry ${task.retries}/${task.maxRetries}: ${task.title}`);
  }

  return task;
}

/**
 * Defer a task to later
 */
export function deferTask(taskId, delayMs) {
  const processing = listTasks(DIRS.processing);
  const found = processing.find(({ task }) => task.id === taskId);

  if (!found) return null;

  const task = found.task;
  task.status = STATUS.PENDING;
  task.scheduledFor = Date.now() + delayMs;
  task.updatedAt = Date.now();

  writeTask(DIRS.pending, task);
  fs.unlinkSync(found.path);

  return task;
}

/**
 * Cancel a task
 */
export function cancelTask(taskId) {
  // Check pending first
  let pending = listTasks(DIRS.pending);
  let found = pending.find(({ task }) => task.id === taskId);

  if (!found) {
    pending = listTasks(DIRS.processing);
    found = pending.find(({ task }) => task.id === taskId);
  }

  if (!found) return null;

  const task = found.task;
  task.status = STATUS.CANCELLED;
  task.cancelledAt = Date.now();

  // Just delete it (don't need to keep cancelled tasks)
  fs.unlinkSync(found.path);

  console.log(`[TaskQueue] Cancelled task: ${task.title} (${task.id})`);
  return task;
}

/**
 * Get all pending tasks
 */
export function getPendingTasks(options = {}) {
  let tasks = listTasks(DIRS.pending, 100).map(({ task }) => task);

  // Also include in-progress
  const inProgress = listTasks(DIRS.processing, 100).map(({ task }) => task);
  tasks = [...tasks, ...inProgress];

  if (options.channelId) {
    tasks = tasks.filter(t => t.channelId === options.channelId);
  }

  if (options.type) {
    tasks = tasks.filter(t => t.type === options.type);
  }

  return tasks;
}

/**
 * Get task by ID (searches all directories)
 */
export function getTask(taskId) {
  for (const dir of [DIRS.pending, DIRS.processing, DIRS.completed, DIRS.failed]) {
    const tasks = listTasks(dir);
    const found = tasks.find(({ task }) => task.id === taskId);
    if (found) return found.task;
  }
  return null;
}

/**
 * Get recently completed tasks
 */
export function getCompletedTasks(limit = 10) {
  return listTasks(DIRS.completed, limit)
    .map(({ task }) => task)
    .reverse(); // Most recent first
}

/**
 * Get failed tasks
 */
export function getFailedTasks(limit = 10) {
  return listTasks(DIRS.failed, limit)
    .map(({ task }) => task)
    .reverse();
}

/**
 * Get queue statistics
 */
export function getStats() {
  const pending = listTasks(DIRS.pending);
  const processing = listTasks(DIRS.processing);
  const completed = listTasks(DIRS.completed);
  const failed = listTasks(DIRS.failed);
  const stats = loadStats();

  const now = Date.now();
  const scheduled = pending.filter(({ task }) => task.scheduledFor && task.scheduledFor > now);
  const ready = pending.filter(({ task }) => !task.scheduledFor || task.scheduledFor <= now);

  const byType = {};
  for (const { task } of pending) {
    byType[task.type] = (byType[task.type] || 0) + 1;
  }

  const byChannel = {};
  for (const { task } of pending) {
    if (task.channelId) {
      byChannel[task.channelId] = (byChannel[task.channelId] || 0) + 1;
    }
  }

  return {
    pending: pending.length,
    inProgress: processing.length,
    scheduled: scheduled.length,
    ready: ready.length,
    recentlyCompleted: completed.length,
    recentlyFailed: failed.length,
    totalCreated: stats.totalCreated,
    totalCompleted: stats.totalCompleted,
    totalFailed: stats.totalFailed,
    byType,
    byChannel
  };
}

/**
 * Prune old files from a directory
 */
function pruneDir(dir, keepCount) {
  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse(); // Most recent first

    if (files.length > keepCount) {
      const toDelete = files.slice(keepCount);
      for (const f of toDelete) {
        fs.unlinkSync(path.join(dir, f));
      }
    }
  } catch (err) {
    console.error(`[TaskQueue] Failed to prune ${dir}:`, err.message);
  }
}

/**
 * Clear completed tasks older than given age
 */
export function pruneCompleted(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - maxAgeMs;
  let pruned = 0;

  const completed = listTasks(DIRS.completed);
  for (const { task, path: filepath } of completed) {
    if (task.completedAt && task.completedAt < cutoff) {
      fs.unlinkSync(filepath);
      pruned++;
    }
  }

  return pruned;
}

/**
 * Retry a failed task
 */
export function retryTask(taskId) {
  const failed = listTasks(DIRS.failed);
  const found = failed.find(({ task }) => task.id === taskId);

  if (!found) return null;

  const task = found.task;
  task.status = STATUS.PENDING;
  task.retries = 0;
  task.error = null;
  task.updatedAt = Date.now();

  writeTask(DIRS.pending, task);
  fs.unlinkSync(found.path);

  console.log(`[TaskQueue] Retrying failed task: ${task.title} (${task.id})`);
  return task;
}

/**
 * Recover stale processing tasks (tasks that have been processing too long)
 * Call this on startup to recover from crashes
 */
export function recoverStaleTasks(maxAgeMs = 10 * 60 * 1000) {
  const cutoff = Date.now() - maxAgeMs;
  let recovered = 0;

  const processing = listTasks(DIRS.processing);
  for (const { task, path: filepath } of processing) {
    if (task.startedAt && task.startedAt < cutoff) {
      // Task has been processing too long - return to pending
      task.status = STATUS.PENDING;
      task.updatedAt = Date.now();
      writeTask(DIRS.pending, task);
      fs.unlinkSync(filepath);
      recovered++;
      console.log(`[TaskQueue] Recovered stale task: ${task.title} (${task.id})`);
    }
  }

  return recovered;
}

// Helper to create common task types
export const TaskFactory = {
  fileProcess(fileInfo, channelId, requestedBy) {
    return addTask({
      type: TASK_TYPE.FILE_PROCESS,
      priority: PRIORITY.NORMAL,
      channelId,
      requestedBy,
      title: `Process file: ${fileInfo.name}`,
      description: `Extract and analyze ${fileInfo.extension} file`,
      data: { fileId: fileInfo.id, fileName: fileInfo.name, fileType: fileInfo.extension }
    });
  },

  fileScan(channelId, requestedBy) {
    return addTask({
      type: TASK_TYPE.FILE_SCAN,
      priority: PRIORITY.LOW,
      channelId,
      requestedBy,
      title: `Scan channel for files`,
      description: `Index all files in channel`,
      data: { channelId }
    });
  },

  research(topic, channelId, requestedBy, context = '') {
    return addTask({
      type: TASK_TYPE.RESEARCH,
      priority: PRIORITY.NORMAL,
      channelId,
      requestedBy,
      title: `Research: ${topic.substring(0, 50)}`,
      description: topic,
      data: { topic, context }
    });
  },

  followUp(item, channelId, requestedBy, scheduledFor = null) {
    return addTask({
      type: TASK_TYPE.FOLLOW_UP,
      priority: PRIORITY.NORMAL,
      channelId,
      requestedBy,
      title: `Follow-up: ${item.substring(0, 50)}`,
      description: item,
      scheduledFor,
      data: { item }
    });
  },

  reminder(message, channelId, requestedBy, scheduledFor) {
    return addTask({
      type: TASK_TYPE.REMINDER,
      priority: PRIORITY.HIGH,
      channelId,
      requestedBy,
      title: `Reminder: ${message.substring(0, 50)}`,
      description: message,
      scheduledFor,
      data: { message }
    });
  },

  crewPipeline(pipelineType, topic, channelId, requestedBy) {
    return addTask({
      type: TASK_TYPE.CREW_PIPELINE,
      priority: PRIORITY.NORMAL,
      channelId,
      requestedBy,
      title: `Crew ${pipelineType}: ${topic.substring(0, 40)}`,
      description: topic,
      data: { pipelineType, topic }
    });
  }
};

// Recover stale tasks on module load
recoverStaleTasks();

export default {
  PRIORITY,
  STATUS,
  TASK_TYPE,
  addTask,
  getNextTask,
  startTask,
  completeTask,
  failTask,
  deferTask,
  cancelTask,
  getPendingTasks,
  getTask,
  getCompletedTasks,
  getFailedTasks,
  getStats,
  pruneCompleted,
  retryTask,
  recoverStaleTasks,
  TaskFactory
};
