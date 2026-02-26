/**
 * Nerve Center Commands - Parses and routes !atlas commands
 *
 * Commands:
 *   !atlas status          - Cross-workstream summary
 *   !atlas ws <n>          - Detailed workstream status
 *   !atlas milestone <id> done [notes] - Mark milestone complete
 *   !atlas task assign <user> <desc> [due] - Create human task
 *   !atlas task list [user]  - List open tasks
 *   !atlas task done <id>    - Complete a task
 *   !atlas blockers         - Show all blockers
 *   !atlas health           - Domain health scores
 *   !atlas weekly           - Generate weekly report
 *   !atlas escalate <wsId> <msg> - Manual escalation
 */

import programState from './program-state.js';
import humanTasks from './human-tasks.js';
import reporting from './reporting.js';
import escalation from './escalation.js';
import agentProducer from './agent-producer.js';

// Atlas command regex
export const ATLAS_COMMAND_REGEX = /^!(?:atlas|onc|ops-center)\s*/i;

/**
 * Check if a message is an Atlas command.
 */
export function isAtlasCommand(text) {
  return ATLAS_COMMAND_REGEX.test(text?.trim());
}

/**
 * Parse and route an Atlas command.
 * Returns { handler, args } or null if not recognized.
 */
export function parseCommand(text) {
  const stripped = text.replace(ATLAS_COMMAND_REGEX, '').trim();
  const parts = stripped.split(/\s+/);
  const cmd = parts[0]?.toLowerCase();

  if (!cmd || cmd === 'status') {
    return { handler: 'status', args: {} };
  }

  if (cmd === 'ws' || cmd === 'workstream') {
    return { handler: 'workstream', args: { wsId: parts[1] || null } };
  }

  if (cmd === 'milestone' || cmd === 'ms') {
    const msId = parts[1];
    const action = parts[2]?.toLowerCase();
    const notes = parts.slice(3).join(' ');
    return { handler: 'milestone', args: { msId, action, notes } };
  }

  if (cmd === 'task') {
    return parseTaskCommand(parts.slice(1));
  }

  if (cmd === 'blockers' || cmd === 'blocked') {
    return { handler: 'blockers', args: {} };
  }

  if (cmd === 'health') {
    return { handler: 'health', args: {} };
  }

  if (cmd === 'weekly' || cmd === 'report') {
    return { handler: 'weekly', args: {} };
  }

  if (cmd === 'escalate') {
    const wsId = parts[1];
    const msg = parts.slice(2).join(' ');
    return { handler: 'escalate', args: { wsId, message: msg } };
  }

  if (cmd === 'produce' || cmd === 'generate') {
    return { handler: 'produce', args: { msId: parts[1] || null } };
  }

  if (cmd === 'production-status' || cmd === 'production' || cmd === 'prodstatus') {
    return { handler: 'production-status', args: {} };
  }

  return { handler: 'unknown', args: { input: stripped } };
}

function parseTaskCommand(parts) {
  const action = parts[0]?.toLowerCase();

  if (action === 'assign' || action === 'create' || action === 'add') {
    const assignee = parts[1];
    // Find quoted description or take remaining text
    const rest = parts.slice(2).join(' ');
    const quoteMatch = rest.match(/^"([^"]+)"\s*(.*)?$/);
    let description, dueDate;
    if (quoteMatch) {
      description = quoteMatch[1];
      dueDate = quoteMatch[2]?.trim() || null;
    } else {
      // Look for date-like pattern at end
      const dateMatch = rest.match(/^(.+?)\s+(\d{4}-\d{2}-\d{2})$/);
      if (dateMatch) {
        description = dateMatch[1];
        dueDate = dateMatch[2];
      } else {
        description = rest;
        dueDate = null;
      }
    }
    return { handler: 'task-assign', args: { assignee, description, dueDate } };
  }

  if (action === 'list' || action === 'ls' || !action) {
    return { handler: 'task-list', args: { user: parts[1] || null } };
  }

  if (action === 'done' || action === 'complete') {
    return { handler: 'task-done', args: { taskId: parts[1] } };
  }

  if (action === 'update') {
    const taskId = parts[1];
    const status = parts[2];
    const notes = parts.slice(3).join(' ');
    return { handler: 'task-update', args: { taskId, status, notes } };
  }

  return { handler: 'task-list', args: {} };
}

// ── Command Handlers ──

export async function handleCommand(text, channelId, postId, userId, ctx) {
  const parsed = parseCommand(text);
  if (!parsed) return null;

  const { handler, args } = parsed;
  const { postMessage, log } = ctx;

  try {
    switch (handler) {
      case 'status':
        return await handleStatus(channelId, postId, postMessage);

      case 'workstream':
        return await handleWorkstream(args, channelId, postId, postMessage);

      case 'milestone':
        return await handleMilestone(args, channelId, postId, postMessage, log);

      case 'task-assign':
        return await handleTaskAssign(args, channelId, postId, userId, postMessage);

      case 'task-list':
        return await handleTaskList(args, channelId, postId, postMessage);

      case 'task-done':
        return await handleTaskDone(args, channelId, postId, postMessage);

      case 'task-update':
        return await handleTaskUpdate(args, channelId, postId, postMessage);

      case 'blockers':
        return await handleBlockers(channelId, postId, postMessage);

      case 'health':
        return await handleHealth(channelId, postId, postMessage);

      case 'weekly':
        return await handleWeekly(channelId, postId, postMessage);

      case 'escalate':
        return await handleEscalate(args, channelId, postId, postMessage, log);

      case 'produce':
        return await handleProduce(args, channelId, postId, postMessage, log);

      case 'production-status':
        return await handleProductionStatus(channelId, postId, postMessage);

      default:
        await postMessage(channelId, `**Atlas** :compass:\n\nUnknown command. Available commands:\n- \`!atlas status\` - Program overview\n- \`!atlas ws <1-7>\` - Workstream detail\n- \`!atlas milestone <id> done\` - Complete milestone\n- \`!atlas task assign/list/done\` - Human task management\n- \`!atlas blockers\` - Show blockers\n- \`!atlas health\` - Domain health\n- \`!atlas weekly\` - Weekly report\n- \`!atlas escalate <ws> <msg>\` - Escalate issue\n- \`!atlas produce <milestone-id>\` - Trigger agent to produce deliverable\n- \`!atlas production-status\` - Show agent production status`, postId);
    }
  } catch (err) {
    ctx.log('error', 'Atlas command failed', { handler, error: err.message });
    await postMessage(channelId, `**Atlas** :warning: Error: ${err.message}`, postId);
  }
}

// ── Individual Handlers ──

async function handleStatus(channelId, postId, postMessage) {
  const health = programState.getProgramHealth();
  const overdue = programState.getOverdueMilestones();
  const openTasks = humanTasks.getOpenTasks();

  const lines = [
    '**Atlas** :compass: **Gap Closure Program Status**',
    '',
    `**Overall:** ${health.overall.completedMilestones}/${health.overall.totalMilestones} milestones complete (${health.overall.progress}%)`,
    '',
  ];

  // Workstream summary table
  lines.push('| WS | Name | Progress | Health |');
  lines.push('|---|---|---|---|');
  for (const ws of health.workstreams) {
    const icon = ws.health === 'green' ? ':green_circle:' :
                 ws.health === 'yellow' ? ':yellow_circle:' : ':red_circle:';
    const bar = makeProgressBar(ws.progress);
    lines.push(`| ${ws.wsId} | ${ws.name} | ${bar} ${ws.progress}% | ${icon} |`);
  }
  lines.push('');

  if (overdue.length > 0) {
    lines.push(`:warning: **Overdue (${overdue.length}):**`);
    for (const ms of overdue.slice(0, 5)) {
      lines.push(`- ${ms.id}: ${ms.title} (${ms.weeksBehind}w behind)`);
    }
    lines.push('');
  }

  if (openTasks.length > 0) {
    lines.push(`:clipboard: **Open Human Tasks:** ${openTasks.length}`);
  }

  await postMessage(channelId, lines.join('\n'), postId);
}

async function handleWorkstream(args, channelId, postId, postMessage) {
  const wsId = args.wsId;
  if (!wsId) {
    await postMessage(channelId, '**Atlas:** Usage: `!atlas ws <1-7>` (e.g., `!atlas ws 1` for Regulatory Posture)', postId);
    return;
  }

  const ws = programState.getWorkstream(wsId);
  if (!ws) {
    await postMessage(channelId, `**Atlas:** Workstream "${wsId}" not found.`, postId);
    return;
  }

  const status = programState.getWorkstreamStatus(wsId);

  const lines = [
    `**Atlas** :compass: **WS${wsId}: ${ws.name}**`,
    `*Tier ${ws.tier} | Weeks ${ws.startWeek}-${ws.endWeek} | Domains: ${ws.domains.join(', ')}*`,
    '',
    `**Progress:** ${status.completed}/${status.total} milestones (${status.progress}%)`,
    '',
    '| # | Milestone | Week | Owner | Status |',
    '|---|---|---|---|---|',
  ];

  for (const ms of ws.milestones) {
    const icon = ms.status === 'completed' ? ':white_check_mark:' :
                 ms.status === 'in_progress' ? ':hourglass:' :
                 ms.status === 'blocked' ? ':no_entry:' : ':radio_button:';
    lines.push(`| ${ms.id} | ${ms.title} | W${ms.week} | ${ms.owner || '-'} | ${icon} ${ms.status} |`);
  }

  await postMessage(channelId, lines.join('\n'), postId);
}

async function handleMilestone(args, channelId, postId, postMessage, log) {
  const { msId, action, notes } = args;

  if (!msId) {
    await postMessage(channelId, '**Atlas:** Usage: `!atlas milestone <id> done [notes]`', postId);
    return;
  }

  if (action === 'done' || action === 'complete') {
    const ms = programState.completeMilestone(msId, notes);
    if (!ms) {
      await postMessage(channelId, `**Atlas:** Milestone "${msId}" not found.`, postId);
      return;
    }

    // Check if this unblocks downstream milestones
    const deps = programState.getDependencies(msId);
    const unblocked = [];
    for (const dep of deps.blocks) {
      const check = programState.checkUnblocked(dep.to);
      if (check.unblocked) {
        unblocked.push(dep.to);
      }
    }

    const lines = [
      `:white_check_mark: **Atlas:** Milestone **${ms.title}** completed!`,
      `*WS: ${ms.wsName} | Week ${ms.week}*`,
    ];

    if (notes) lines.push(`*Notes: ${notes}*`);
    if (unblocked.length > 0) {
      lines.push('');
      lines.push(`:unlock: **Unblocked downstream:** ${unblocked.join(', ')}`);
    }

    await postMessage(channelId, lines.join('\n'), postId);
    return;
  }

  if (action === 'block') {
    const ms = programState.blockMilestone(msId, notes);
    if (!ms) {
      await postMessage(channelId, `**Atlas:** Milestone "${msId}" not found.`, postId);
      return;
    }
    await postMessage(channelId, `:no_entry: **Atlas:** Milestone **${ms.title}** blocked. ${notes ? `Reason: ${notes}` : ''}`, postId);
    return;
  }

  // Default: show milestone details
  const ms = programState.getMilestone(msId);
  if (!ms) {
    await postMessage(channelId, `**Atlas:** Milestone "${msId}" not found.`, postId);
    return;
  }

  const deps = programState.getDependencies(msId);
  const lines = [
    `**Atlas** :compass: **Milestone ${ms.id}**`,
    `**Title:** ${ms.title}`,
    `**WS:** ${ms.wsName} | **Week:** ${ms.week} | **Owner:** ${ms.owner || 'Unassigned'}`,
    `**Status:** ${ms.status}`,
    `**Agents:** ${ms.agents.join(', ') || 'None'}`,
  ];

  if (deps.blockedBy.length > 0) {
    lines.push(`**Blocked by:** ${deps.blockedBy.map(d => d.from).join(', ')}`);
  }
  if (deps.blocks.length > 0) {
    lines.push(`**Blocks:** ${deps.blocks.map(d => d.to).join(', ')}`);
  }

  await postMessage(channelId, lines.join('\n'), postId);
}

async function handleTaskAssign(args, channelId, postId, userId, postMessage) {
  const { assignee, description, dueDate } = args;

  if (!assignee || !description) {
    await postMessage(channelId, '**Atlas:** Usage: `!atlas task assign <user> <description> [YYYY-MM-DD]`', postId);
    return;
  }

  const task = humanTasks.addTask({
    title: description,
    assignee,
    dueDate: dueDate || null,
    createdBy: 'atlas',
    priority: 'medium',
  });

  await postMessage(channelId,
    `:clipboard: **Atlas:** Task created for **${assignee}**\n` +
    `**ID:** \`${task.id}\` | **Due:** ${dueDate || 'No deadline'}\n` +
    `**Task:** ${description}`,
    postId
  );
}

async function handleTaskList(args, channelId, postId, postMessage) {
  const { user } = args;
  const tasks = user ? humanTasks.getTasksByAssignee(user) : humanTasks.getOpenTasks();

  if (tasks.length === 0) {
    await postMessage(channelId, `**Atlas:** No open tasks${user ? ` for ${user}` : ''}.`, postId);
    return;
  }

  const lines = [
    `**Atlas** :clipboard: **Open Tasks${user ? ` for ${user}` : ''}** (${tasks.length})`,
    '',
    '| ID | Task | Assignee | Due | Priority | Status |',
    '|---|---|---|---|---|---|',
  ];

  for (const t of tasks) {
    const dueStr = t.dueDate ? t.dueDate.slice(0, 10) : '-';
    const prioIcon = t.priority === 'high' ? ':red_circle:' :
                     t.priority === 'medium' ? ':orange_circle:' : ':yellow_circle:';
    lines.push(`| ${t.id} | ${t.title.slice(0, 50)} | ${t.assignee} | ${dueStr} | ${prioIcon} | ${t.status} |`);
  }

  await postMessage(channelId, lines.join('\n'), postId);
}

async function handleTaskDone(args, channelId, postId, postMessage) {
  const { taskId } = args;

  if (!taskId) {
    await postMessage(channelId, '**Atlas:** Usage: `!atlas task done <task-id>`', postId);
    return;
  }

  const task = humanTasks.completeTask(taskId);
  if (!task) {
    await postMessage(channelId, `**Atlas:** Task "${taskId}" not found.`, postId);
    return;
  }

  await postMessage(channelId,
    `:white_check_mark: **Atlas:** Task completed: **${task.title}**`,
    postId
  );
}

async function handleTaskUpdate(args, channelId, postId, postMessage) {
  const { taskId, status, notes } = args;

  if (!taskId || !status) {
    await postMessage(channelId, '**Atlas:** Usage: `!atlas task update <id> <status> [notes]`', postId);
    return;
  }

  const task = humanTasks.updateTask(taskId, { status, notes });
  if (!task) {
    await postMessage(channelId, `**Atlas:** Task "${taskId}" not found.`, postId);
    return;
  }

  await postMessage(channelId,
    `:pencil2: **Atlas:** Task **${task.title}** updated to **${status}**`,
    postId
  );
}

async function handleBlockers(channelId, postId, postMessage) {
  const blockers = programState.getAllBlockers();

  if (blockers.length === 0) {
    await postMessage(channelId, '**Atlas** :compass: No blockers! All clear.', postId);
    return;
  }

  const lines = [
    `**Atlas** :compass: **Blockers** (${blockers.length})`,
    '',
  ];

  for (const b of blockers) {
    if (b.type === 'dependency') {
      lines.push(`:link: **Dependency:** ${b.upstream.title} (${b.upstream.id}) blocks ${b.downstream.title} (${b.downstream.id})`);
    } else {
      lines.push(`:no_entry: **${b.wsName}:** ${b.milestoneTitle} (${b.milestoneId})${b.reason ? ` - ${b.reason}` : ''}`);
    }
  }

  await postMessage(channelId, lines.join('\n'), postId);
}

async function handleHealth(channelId, postId, postMessage) {
  const health = programState.getProgramHealth();

  const lines = [
    '**Atlas** :compass: **Domain Health Dashboard**',
    '',
    '| Domain | Milestones | Progress | Health |',
    '|---|---|---|---|',
  ];

  for (const ws of health.workstreams) {
    const icon = ws.health === 'green' ? ':green_circle:' :
                 ws.health === 'yellow' ? ':yellow_circle:' : ':red_circle:';
    lines.push(`| ${ws.name} | ${ws.completed}/${ws.total} | ${ws.progress}% | ${icon} |`);
  }

  lines.push('');
  lines.push(`**Overall Program:** ${health.overall.progress}% complete`);
  if (health.overall.overdueMilestones > 0) {
    lines.push(`:warning: ${health.overall.overdueMilestones} overdue milestones`);
  }
  if (health.overall.blockedMilestones > 0) {
    lines.push(`:no_entry: ${health.overall.blockedMilestones} blocked milestones`);
  }

  await postMessage(channelId, lines.join('\n'), postId);
}

async function handleWeekly(channelId, postId, postMessage) {
  const report = reporting.generateWeeklyReport();
  await postMessage(channelId, report, postId);
}

async function handleEscalate(args, channelId, postId, postMessage, log) {
  const { wsId, message } = args;

  if (!wsId || !message) {
    await postMessage(channelId, '**Atlas:** Usage: `!atlas escalate <ws-id> <message>`', postId);
    return;
  }

  escalation.manualEscalation(wsId, message);
  await postMessage(channelId,
    `:rotating_light: **Atlas:** Escalation recorded for WS${wsId}: ${message}`,
    postId
  );
}

async function handleProduce(args, channelId, postId, postMessage, log) {
  const { msId } = args;

  if (!msId) {
    // Run full production cycle
    await postMessage(channelId, '**Atlas** :factory: Running production cycle for all ready milestones...', postId);
    const produced = await agentProducer.runProductionCycle();
    await postMessage(channelId, `**Atlas** :factory: Production cycle complete. ${produced} deliverables produced.`, postId);
    return;
  }

  // Produce for specific milestone
  await postMessage(channelId, `**Atlas** :factory: Producing deliverable for milestone ${msId}...`, postId);
  const result = await agentProducer.produceForMilestoneById(msId);

  if (result.success) {
    await postMessage(channelId,
      `:white_check_mark: **Atlas:** Deliverables produced for ${msId}: ${result.deliverables.join(', ')}`,
      postId
    );
  } else {
    await postMessage(channelId,
      `:warning: **Atlas:** Production failed for ${msId}: ${result.error}`,
      postId
    );
  }
}

async function handleProductionStatus(channelId, postId, postMessage) {
  const status = agentProducer.getProductionStatus();

  const lines = [
    '**Atlas** :compass: :factory: **Agent Production Status**',
    '',
  ];

  if (status.agentReady.length > 0) {
    lines.push(`:green_circle: **Ready for production** (${status.agentReady.length}):`);
    for (const ms of status.agentReady) {
      lines.push(`- ${ms.id}: ${ms.title} → ${ms.agents.join(', ')}`);
    }
    lines.push('');
  }

  if (status.produced.length > 0) {
    lines.push(`:white_check_mark: **Already produced** (${status.produced.length}):`);
    for (const ms of status.produced) {
      lines.push(`- ${ms.id}: ${ms.title} (${ms.deliverables.join(', ')})`);
    }
    lines.push('');
  }

  if (status.pending.length > 0) {
    lines.push(`:hourglass: **Pending (not yet in_progress)** (${status.pending.length}):`);
    for (const ms of status.pending.slice(0, 10)) {
      lines.push(`- ${ms.id}: ${ms.title} → ${ms.agents.join(', ')}`);
    }
    if (status.pending.length > 10) {
      lines.push(`  ...and ${status.pending.length - 10} more`);
    }
    lines.push('');
  }

  if (status.humanOnly.length > 0) {
    lines.push(`:person_standing: **Human-only** (${status.humanOnly.length}):`);
    for (const ms of status.humanOnly) {
      lines.push(`- ${ms.id}: ${ms.title} (${ms.owner})`);
    }
    lines.push('');
  }

  lines.push('*Use `!atlas produce <id>` to trigger production for a specific milestone*');
  lines.push('*Agent production runs automatically daily at 9:15 AM ET*');

  await postMessage(channelId, lines.join('\n'), postId);
}

// ── Helpers ──

function makeProgressBar(pct) {
  const filled = Math.round(pct / 10);
  const empty = 10 - filled;
  return '[' + '='.repeat(filled) + '-'.repeat(empty) + ']';
}

export default {
  ATLAS_COMMAND_REGEX,
  isAtlasCommand,
  parseCommand,
  handleCommand,
};
