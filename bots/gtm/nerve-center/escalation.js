/**
 * Escalation - Blocker detection, reminder scheduling, and escalation tiers
 *
 * Escalation tiers for tasks:
 *   Tier 1: 3 days before due - Gentle reminder (DM)
 *   Tier 2: On due date - Firm reminder (workstream channel)
 *   Tier 3: 1 day overdue - Warning
 *   Tier 4: 3+ days overdue - Escalation to #operations
 *
 * For milestones:
 *   1 week behind: Warning
 *   2+ weeks behind: Escalation with impact analysis
 */

import humanTasks from './human-tasks.js';

let logger = () => {};
const pendingReminders = [];
const escalationLog = [];

/**
 * Initialize escalation system.
 */
export function init(log) {
  logger = log || (() => {});
  logger('info', 'Escalation system initialized');
}

/**
 * Check if a task needs escalation based on overdue days.
 */
export function checkTaskEscalation(task, daysOverdue) {
  const lastTier = humanTasks.getLastReminderTier(task.id);

  let nextTier = 0;
  if (daysOverdue >= 3 && lastTier < 4) nextTier = 4;
  else if (daysOverdue >= 1 && lastTier < 3) nextTier = 3;
  else if (daysOverdue >= 0 && lastTier < 2) nextTier = 2;

  if (nextTier > lastTier) {
    queueReminder(task, nextTier);
  }
}

/**
 * Check if a milestone needs escalation.
 */
export function checkMilestoneEscalation(ms) {
  if (ms.weeksBehind >= 2) {
    addEscalation({
      type: 'milestone',
      severity: 'critical',
      milestoneId: ms.id,
      milestoneTitle: ms.title,
      wsId: ms.wsId,
      wsName: ms.wsName,
      weeksBehind: ms.weeksBehind,
      message: `Milestone "${ms.title}" is ${ms.weeksBehind} weeks behind schedule`,
      timestamp: new Date().toISOString(),
    });
  } else if (ms.weeksBehind >= 1) {
    addEscalation({
      type: 'milestone',
      severity: 'warning',
      milestoneId: ms.id,
      milestoneTitle: ms.title,
      wsId: ms.wsId,
      wsName: ms.wsName,
      weeksBehind: ms.weeksBehind,
      message: `Milestone "${ms.title}" is ${ms.weeksBehind} week(s) behind`,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Queue a reminder for a task.
 */
export function queueReminder(task, tier) {
  const reminder = {
    taskId: task.id,
    taskTitle: task.title,
    assignee: task.assignee,
    tier,
    dueDate: task.dueDate,
    message: buildReminderMessage(task, tier),
    queuedAt: new Date().toISOString(),
    delivered: false,
  };

  pendingReminders.push(reminder);
  humanTasks.recordReminder(task.id, tier);

  logger('info', 'Reminder queued', {
    taskId: task.id,
    tier,
    assignee: task.assignee,
  });

  return reminder;
}

/**
 * Build a reminder message based on tier.
 */
function buildReminderMessage(task, tier) {
  const dueStr = task.dueDate ? task.dueDate.slice(0, 10) : 'no date set';

  switch (tier) {
    case 1:
      return `:bell: **Heads up:** Task "${task.title}" is due ${dueStr}. Assignee: ${task.assignee}`;
    case 2:
      return `:warning: **Due today:** Task "${task.title}" is due today (${dueStr}). Assignee: ${task.assignee}`;
    case 3:
      return `:exclamation: **Overdue:** Task "${task.title}" was due ${dueStr} and is now overdue. Assignee: ${task.assignee}`;
    case 4:
      return `:rotating_light: **ESCALATION:** Task "${task.title}" is 3+ days overdue (due ${dueStr}). Assignee: ${task.assignee}. This is blocking program progress.`;
    default:
      return `:clipboard: Task "${task.title}" reminder (tier ${tier}).`;
  }
}

/**
 * Record a manual escalation.
 */
export function manualEscalation(wsId, message) {
  addEscalation({
    type: 'manual',
    severity: 'high',
    wsId,
    message,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Add to escalation log.
 */
function addEscalation(entry) {
  escalationLog.push(entry);

  // Keep log bounded
  if (escalationLog.length > 200) {
    escalationLog.splice(0, escalationLog.length - 200);
  }

  logger('warn', 'Escalation recorded', {
    type: entry.type,
    severity: entry.severity,
    message: entry.message,
  });
}

/**
 * Get pending reminders (undelivered).
 */
export function getPendingReminders() {
  return pendingReminders.filter(r => !r.delivered);
}

/**
 * Mark a reminder as delivered.
 */
export function markDelivered(taskId) {
  for (const r of pendingReminders) {
    if (r.taskId === taskId && !r.delivered) {
      r.delivered = true;
      r.deliveredAt = new Date().toISOString();
    }
  }
}

/**
 * Get recent escalations.
 */
export function getRecentEscalations(limit = 10) {
  return escalationLog.slice(-limit);
}

/**
 * Get escalation summary for reporting.
 */
export function getEscalationSummary() {
  const recent = escalationLog.filter(e => {
    const age = Date.now() - new Date(e.timestamp).getTime();
    return age < 7 * 24 * 60 * 60 * 1000; // Last 7 days
  });

  return {
    total: recent.length,
    critical: recent.filter(e => e.severity === 'critical').length,
    warnings: recent.filter(e => e.severity === 'warning').length,
    manual: recent.filter(e => e.type === 'manual').length,
    items: recent.slice(-5),
  };
}

export default {
  init,
  checkTaskEscalation,
  checkMilestoneEscalation,
  queueReminder,
  manualEscalation,
  getPendingReminders,
  markDelivered,
  getRecentEscalations,
  getEscalationSummary,
};
