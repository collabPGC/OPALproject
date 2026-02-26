/**
 * Human Tasks - CRUD + persistence for real-world human actions
 *
 * Tracks tasks that agents cannot execute: meetings, signatures,
 * outreach, procurement, etc. Integrates with escalation system.
 */

import fs from 'fs';
import { randomUUID } from 'crypto';

const TASKS_FILE = '/mnt/volume_nyc3_01/institutional-memory/human-tasks.json';

const VALID_STATUSES = ['pending', 'in_progress', 'completed', 'blocked', 'deferred'];
const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'];

let tasks = [];

// ── Persistence ──

export function loadTasks() {
  try {
    if (fs.existsSync(TASKS_FILE)) {
      tasks = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
    } else {
      tasks = [];
      saveTasks();
    }
  } catch (err) {
    console.error('[human-tasks] Failed to load:', err.message);
    tasks = [];
  }
  return tasks;
}

export function saveTasks() {
  try {
    const dir = '/mnt/volume_nyc3_01/institutional-memory';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
  } catch (err) {
    console.error('[human-tasks] Failed to save:', err.message);
  }
}

// ── CRUD ──

export function addTask(task) {
  loadTasks();

  const newTask = {
    id: `ht_${randomUUID().slice(0, 8)}`,
    title: task.title,
    description: task.description || '',
    assignee: task.assignee,
    wsId: task.wsId || null,
    msId: task.msId || null,
    priority: VALID_PRIORITIES.includes(task.priority) ? task.priority : 'medium',
    status: 'pending',
    dueDate: task.dueDate || null,
    createdBy: task.createdBy || 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    blockedBy: task.blockedBy || [],
    reminders: [],
    notes: [],
  };

  tasks.push(newTask);
  saveTasks();
  return newTask;
}

export function getTask(taskId) {
  loadTasks();
  return tasks.find(t => t.id === taskId) || null;
}

export function updateTask(taskId, updates) {
  loadTasks();
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return null;

  if (updates.status && !VALID_STATUSES.includes(updates.status)) {
    return null;
  }

  tasks[idx] = {
    ...tasks[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveTasks();
  return tasks[idx];
}

export function completeTask(taskId, notes = '') {
  const task = updateTask(taskId, {
    status: 'completed',
    completedAt: new Date().toISOString(),
  });
  if (task && notes) {
    addNote(taskId, notes, 'system');
  }
  return task;
}

export function addNote(taskId, note, author = 'system') {
  loadTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return null;

  task.notes.push({
    text: note,
    author,
    timestamp: new Date().toISOString(),
  });
  task.updatedAt = new Date().toISOString();

  saveTasks();
  return task;
}

export function recordReminder(taskId, tier) {
  loadTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return null;

  task.reminders.push({
    tier,
    sentAt: new Date().toISOString(),
  });

  saveTasks();
  return task;
}

// ── Queries ──

export function getOpenTasks() {
  loadTasks();
  return tasks.filter(t => t.status !== 'completed' && t.status !== 'deferred');
}

export function getTasksByAssignee(assignee) {
  loadTasks();
  const lower = assignee.toLowerCase();
  return tasks.filter(t =>
    t.assignee.toLowerCase().includes(lower) &&
    t.status !== 'completed' && t.status !== 'deferred'
  );
}

export function getTasksByWorkstream(wsId) {
  loadTasks();
  return tasks.filter(t => t.wsId === wsId && t.status !== 'completed');
}

export function getTasksByMilestone(msId) {
  loadTasks();
  return tasks.filter(t => t.msId === msId);
}

export function getOverdueTasks() {
  loadTasks();
  const now = new Date().toISOString();
  return tasks.filter(t =>
    t.status !== 'completed' &&
    t.status !== 'deferred' &&
    t.dueDate && t.dueDate < now
  );
}

export function getTasksDueSoon(withinDays = 3) {
  loadTasks();
  const now = new Date();
  const cutoff = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000).toISOString();
  return tasks.filter(t =>
    t.status !== 'completed' &&
    t.status !== 'deferred' &&
    t.dueDate && t.dueDate <= cutoff && t.dueDate >= now.toISOString()
  );
}

export function getTaskSummary() {
  loadTasks();
  const open = tasks.filter(t => t.status !== 'completed' && t.status !== 'deferred');
  const overdue = getOverdueTasks();
  const byAssignee = {};

  for (const t of open) {
    if (!byAssignee[t.assignee]) byAssignee[t.assignee] = 0;
    byAssignee[t.assignee]++;
  }

  return {
    total: tasks.length,
    open: open.length,
    overdue: overdue.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
    byAssignee,
  };
}

export function getLastReminderTier(taskId) {
  const task = getTask(taskId);
  if (!task || task.reminders.length === 0) return 0;
  return task.reminders[task.reminders.length - 1].tier;
}

export function resetTasks() {
  tasks = [];
  saveTasks();
}

export default {
  loadTasks,
  saveTasks,
  addTask,
  getTask,
  updateTask,
  completeTask,
  addNote,
  recordReminder,
  getOpenTasks,
  getTasksByAssignee,
  getTasksByWorkstream,
  getTasksByMilestone,
  getOverdueTasks,
  getTasksDueSoon,
  getTaskSummary,
  getLastReminderTier,
  resetTasks,
};
