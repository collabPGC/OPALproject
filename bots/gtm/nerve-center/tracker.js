/**
 * Tracker - Deadline checking, health recalculation, and automated monitoring
 *
 * Runs periodic checks on milestones and tasks, updates health scores,
 * and triggers escalation when items are overdue or approaching due dates.
 */

import programState from './program-state.js';
import humanTasks from './human-tasks.js';
import escalation from './escalation.js';

let logger = () => {};
let checkInterval = null;

/**
 * Initialize the tracker with periodic checks.
 */
export function init(log, options = {}) {
  logger = log || (() => {});
  const intervalMs = options.checkIntervalMs || 60 * 60 * 1000; // Default: hourly

  // Run initial check
  runChecks();

  // Schedule periodic checks
  checkInterval = setInterval(() => {
    runChecks();
  }, intervalMs);

  logger('info', 'Tracker initialized', { intervalMs });
}

/**
 * Stop periodic checks.
 */
export function stop() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

/**
 * Run all checks.
 */
export function runChecks() {
  try {
    checkOverdueMilestones();
    checkOverdueTasks();
    checkUpcomingDeadlines();
    recalculateHealth();
  } catch (err) {
    logger('error', 'Tracker check failed', { error: err.message });
  }
}

/**
 * Check for overdue milestones and trigger escalation.
 */
function checkOverdueMilestones() {
  const overdue = programState.getOverdueMilestones();

  for (const ms of overdue) {
    if (ms.weeksBehind >= 1) {
      escalation.checkMilestoneEscalation(ms);
    }
  }

  if (overdue.length > 0) {
    logger('info', 'Overdue milestones detected', { count: overdue.length });
  }
}

/**
 * Check for overdue human tasks and trigger escalation.
 */
function checkOverdueTasks() {
  const overdue = humanTasks.getOverdueTasks();

  for (const task of overdue) {
    const daysOverdue = getDaysOverdue(task.dueDate);
    escalation.checkTaskEscalation(task, daysOverdue);
  }
}

/**
 * Check for upcoming deadlines and queue gentle reminders.
 */
function checkUpcomingDeadlines() {
  // Milestones due within 1 week
  const upcomingMs = programState.getMilestonesDueSoon(7);
  for (const ms of upcomingMs) {
    if (ms.status === 'pending') {
      // Auto-transition to in_progress when within 1 week
      programState.updateMilestone(ms.id, { status: 'in_progress' });
      logger('info', 'Milestone auto-promoted to in_progress', { id: ms.id, title: ms.title });
    }
  }

  // Tasks due within 3 days
  const upcomingTasks = humanTasks.getTasksDueSoon(3);
  for (const task of upcomingTasks) {
    const lastTier = humanTasks.getLastReminderTier(task.id);
    if (lastTier < 1) {
      escalation.queueReminder(task, 1); // Gentle reminder
    }
  }
}

/**
 * Recalculate health scores based on current program state.
 */
function recalculateHealth() {
  const health = programState.getProgramHealth();

  // Log health changes for institutional memory
  for (const ws of health.workstreams) {
    if (ws.health === 'red') {
      logger('warn', 'Workstream health RED', {
        wsId: ws.wsId,
        name: ws.name,
        overdue: ws.overdue,
        blocked: ws.blocked,
      });
    }
  }
}

/**
 * Get a full program dashboard snapshot.
 */
export function getDashboard() {
  const health = programState.getProgramHealth();
  const overdueMilestones = programState.getOverdueMilestones();
  const blockers = programState.getAllBlockers();
  const taskSummary = humanTasks.getTaskSummary();
  const overdueTasks = humanTasks.getOverdueTasks();
  const upcomingTasks = humanTasks.getTasksDueSoon(7);

  return {
    program: health,
    overdueMilestones,
    blockers,
    tasks: {
      ...taskSummary,
      overdueTasks,
      upcomingTasks,
    },
    timestamp: new Date().toISOString(),
  };
}

// ── Helpers ──

function getDaysOverdue(dueDate) {
  if (!dueDate) return 0;
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = now - due;
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
}

export default {
  init,
  stop,
  runChecks,
  getDashboard,
};
