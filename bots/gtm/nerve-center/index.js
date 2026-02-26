/**
 * Operations Nerve Center ("Atlas") - Entry point
 *
 * Self-actuating program management system. Runs autonomously on cron:
 *   - Daily 8:30 AM: Post milestone reminders + deliver escalations
 *   - Daily 9:00 AM: Include program status in advisory board digest
 *   - Daily 9:15 AM: Agent-first production — trigger personas to produce deliverables
 *   - Weekly Monday 8:45 AM: Post comprehensive weekly report
 *   - Hourly: Check deadlines, auto-promote milestones, queue escalations
 *
 * Also responds to !atlas commands for on-demand queries.
 */

import cron from 'node-cron';
import * as mm from 'bots-shared/mattermost.js';
import institutionalMemory from 'bots-shared/institutional-memory';
import programState from './program-state.js';
import humanTasks from './human-tasks.js';
import tracker from './tracker.js';
import escalation from './escalation.js';
import reporting from './reporting.js';
import commands from './commands.js';
import agentProducer from './agent-producer.js';
import coaching from './coaching.js';

let logger = () => {};
let cronJobs = [];
let opsChannelId = null; // Channel where Atlas posts automated updates

/**
 * Initialize the Operations Nerve Center.
 */
export function init(config = {}, log) {
  logger = log || (() => {});

  // The channel where Atlas posts automated updates (reminders, escalations, weekly reports)
  // Falls back to the digest channel from GTM config if not explicitly set
  opsChannelId = config.channelId || null;

  // Load persistent state
  programState.loadState();
  humanTasks.loadTasks();

  // Init subsystems
  escalation.init(log);
  reporting.init(log);
  agentProducer.init(log, opsChannelId);
  coaching.init(log, opsChannelId, config.botUserId || null);

  // Init tracker (periodic checks — internal only, no posting)
  tracker.init(log, {
    checkIntervalMs: config.checkIntervalMs || 60 * 60 * 1000, // 1 hour
  });

  // Schedule self-actuating cron jobs
  scheduleCronJobs(config);

  const wsCount = programState.getAllWorkstreams().length;
  const taskCount = humanTasks.getOpenTasks().length;
  logger('info', 'Nerve Center initialized', { workstreams: wsCount, openTasks: taskCount });
}

/**
 * Set the operations channel (called from main index.js after config is fully resolved).
 */
export function setOpsChannel(channelId) {
  opsChannelId = channelId;
  agentProducer.setOpsChannel(channelId);
  coaching.setOpsChannel(channelId);
  logger('info', 'Nerve Center ops channel set', { channelId });
}

/**
 * Shut down cron jobs and tracker.
 */
export function shutdown() {
  for (const job of cronJobs) {
    job.stop();
  }
  cronJobs = [];
  tracker.stop();
  logger('info', 'Nerve Center shut down');
}

/**
 * Schedule self-actuating cron jobs.
 * These run WITHOUT human initiation.
 */
function scheduleCronJobs(config) {
  const tz = config.timezone || 'America/New_York';

  // ── Daily 8:30 AM (weekdays): Milestone check + deliver reminders/escalations ──
  cronJobs.push(cron.schedule('30 8 * * 1-5', async () => {
    logger('info', '[CRON] Daily morning check starting');
    try {
      // 1. Run tracker checks (detects overdue, queues escalations)
      tracker.runChecks();

      // 2. Deliver all pending reminders and escalations to Mattermost
      await deliverPendingMessages();

      // 3. Post morning status summary if there's anything noteworthy
      await postMorningSummary();
    } catch (err) {
      logger('error', '[CRON] Daily morning check failed', { error: err.message });
    }
  }, { timezone: tz }));

  // ── Daily 9:15 AM (weekdays): Autonomous agent production ──
  cronJobs.push(cron.schedule('15 9 * * 1-5', async () => {
    logger('info', '[CRON] Agent production cycle starting');
    try {
      const produced = await agentProducer.runProductionCycle();
      if (produced > 0) {
        logger('info', '[CRON] Agent production complete', { produced });
      }
    } catch (err) {
      logger('error', '[CRON] Agent production failed', { error: err.message });
    }
  }, { timezone: tz }));

  // ── Weekly Monday 8:45 AM: Comprehensive weekly report ──
  cronJobs.push(cron.schedule('45 8 * * 1', async () => {
    logger('info', '[CRON] Weekly report generating');
    try {
      const report = reporting.generateWeeklyReport();
      if (opsChannelId && report) {
        await mm.postMessage(opsChannelId, report);
        logger('info', '[CRON] Weekly report posted');

        // Emit to institutional memory
        await emitEvent('HEALTH_UPDATE', 'operations',
          `Weekly Operations Report - ${new Date().toISOString().slice(0, 10)}`,
          report.slice(0, 2000)
        );
      } else {
        logger('warn', '[CRON] Weekly report: no ops channel configured');
      }
    } catch (err) {
      logger('error', '[CRON] Weekly report failed', { error: err.message });
    }
  }, { timezone: tz }));

  // ── Every 4 hours: Deliver any queued reminders that accumulated ──
  cronJobs.push(cron.schedule('0 */4 * * *', async () => {
    try {
      await deliverPendingMessages();
    } catch (err) {
      logger('error', '[CRON] Reminder delivery failed', { error: err.message });
    }
  }, { timezone: tz }));

  // ── Daily 2:00 PM (weekdays): LLM-powered coaching DMs ──
  cronJobs.push(cron.schedule('0 14 * * 1-5', async () => {
    logger('info', '[CRON] Coaching cycle starting');
    try {
      const sent = await coaching.runCoachingCycle();
      if (sent > 0) {
        logger('info', '[CRON] Coaching DMs sent', { sent });
      }
    } catch (err) {
      logger('error', '[CRON] Coaching cycle failed', { error: err.message });
    }
  }, { timezone: tz }));

  logger('info', 'Nerve Center cron jobs scheduled', {
    timezone: tz,
    jobs: ['daily-8:30am', 'agent-production-9:15am', 'coaching-2pm', 'weekly-monday-8:45am', 'reminders-every-4h'],
  });
}

/**
 * Deliver all pending reminders and escalations to Mattermost.
 * This is the actual posting mechanism that makes the system self-actuating.
 */
async function deliverPendingMessages() {
  if (!opsChannelId) return;

  const pending = escalation.getPendingReminders();
  if (pending.length === 0) return;

  logger('info', 'Delivering pending messages', { count: pending.length });

  for (const reminder of pending) {
    try {
      // Build the Atlas-branded message
      const message = `**Atlas** :compass:\n\n${reminder.message}`;
      await mm.postMessage(opsChannelId, message);

      // Mark as delivered
      escalation.markDelivered(reminder.taskId);

      // Emit to institutional memory
      const eventType = reminder.tier >= 3 ? 'ESCALATION' : 'HUMAN_TASK';
      await emitEvent(eventType, 'operations',
        `Task reminder (tier ${reminder.tier}): ${reminder.taskTitle}`,
        reminder.message
      );

      logger('info', 'Reminder delivered', {
        taskId: reminder.taskId,
        tier: reminder.tier,
        assignee: reminder.assignee,
      });
    } catch (err) {
      logger('error', 'Failed to deliver reminder', {
        taskId: reminder.taskId,
        error: err.message,
      });
    }
  }
}

/**
 * Post morning status summary if there are noteworthy items.
 * Only posts if there are overdue items or upcoming deadlines.
 */
async function postMorningSummary() {
  if (!opsChannelId) return;

  const overdueMilestones = programState.getOverdueMilestones();
  const overdueTasks = humanTasks.getOverdueTasks();
  const dueSoonTasks = humanTasks.getTasksDueSoon(3);
  const dueSoonMs = programState.getMilestonesDueSoon(7);

  // Only post if there's something worth flagging
  const hasNews = overdueMilestones.length > 0 ||
                  overdueTasks.length > 0 ||
                  dueSoonTasks.length > 0 ||
                  dueSoonMs.length > 0;

  if (!hasNews) return;

  const lines = ['**Atlas** :compass: **Morning Briefing**', ''];

  if (overdueMilestones.length > 0) {
    lines.push(`:red_circle: **${overdueMilestones.length} overdue milestone(s):**`);
    for (const ms of overdueMilestones.slice(0, 3)) {
      lines.push(`- ${ms.id}: ${ms.title} *(${ms.weeksBehind}w behind, owner: ${ms.owner || '?'})*`);
    }
    lines.push('');
  }

  if (overdueTasks.length > 0) {
    lines.push(`:red_circle: **${overdueTasks.length} overdue task(s):**`);
    for (const t of overdueTasks.slice(0, 3)) {
      lines.push(`- ${t.title} *(${t.assignee}, due ${t.dueDate?.slice(0, 10)})*`);
    }
    lines.push('');
  }

  if (dueSoonMs.length > 0) {
    lines.push(`:yellow_circle: **Milestones coming up:**`);
    for (const ms of dueSoonMs.slice(0, 3)) {
      lines.push(`- ${ms.id}: ${ms.title} *(Week ${ms.week}, owner: ${ms.owner || '?'})*`);
    }
    lines.push('');
  }

  if (dueSoonTasks.length > 0) {
    lines.push(`:yellow_circle: **Tasks due within 3 days:**`);
    for (const t of dueSoonTasks.slice(0, 3)) {
      lines.push(`- ${t.title} *(${t.assignee}, due ${t.dueDate?.slice(0, 10)})*`);
    }
    lines.push('');
  }

  lines.push('*Use `!atlas status` for full program view*');

  await mm.postMessage(opsChannelId, lines.join('\n'));
  logger('info', '[CRON] Morning briefing posted', {
    overdueMilestones: overdueMilestones.length,
    overdueTasks: overdueTasks.length,
  });
}

/**
 * Emit an event to institutional memory.
 */
async function emitEvent(type, domain, title, content) {
  try {
    await institutionalMemory.emit({
      agent: 'atlas',
      type,
      domain,
      title: title.slice(0, 120),
      content: content.slice(0, 2000),
      tags: ['atlas', 'nerve-center', 'program-management'],
    });
  } catch (err) {
    logger('error', 'Failed to emit event', { error: err.message });
  }
}

// ── Public API ──

export function isAtlasCommand(text) {
  return commands.isAtlasCommand(text);
}

export async function handleAtlasCommand(text, channelId, postId, userId, ctx) {
  return commands.handleCommand(text, channelId, postId, userId, ctx);
}

export function getDigestSection() {
  return reporting.generateDigestSection();
}

export function getProgramHealth() {
  return programState.getProgramHealth();
}

export function getProductionStatus() {
  return agentProducer.getProductionStatus();
}

export async function produceForMilestone(msId) {
  return agentProducer.produceForMilestoneById(msId);
}

export default {
  init,
  setOpsChannel,
  shutdown,
  isAtlasCommand,
  handleAtlasCommand,
  getDigestSection,
  getProgramHealth,
  getProductionStatus,
  produceForMilestone,
};
