// Scout command parsing, config handlers, and command switch dispatch
// The massive command switch is here - delegates to specialized handlers

import { getChannelPrefs, savePreferences } from '../utils/state.js';
import { getCheerMessage } from '../utils/responses.js';

// Parse dashboard command arguments
export function parseDashboardArgs(argsString) {
  const defaults = { days: 7, label: 'Weekly' };
  if (!argsString) return defaults;

  const args = argsString.toLowerCase().split(/\s+/);
  const result = { ...defaults };

  for (const arg of args) {
    if (arg.match(/^\d+d?$/)) {
      result.days = parseInt(arg);
      if (result.days === 14) result.label = 'Bi-Weekly';
      else if (result.days === 30) result.label = 'Monthly';
      else result.label = `${result.days}-Day`;
    } else if (arg === 'weekly') {
      result.days = 7;
      result.label = 'Weekly';
    } else if (arg === 'biweekly') {
      result.days = 14;
      result.label = 'Bi-Weekly';
    } else if (arg === 'monthly') {
      result.days = 30;
      result.label = 'Monthly';
    }
  }

  return result;
}

// Parse command from message text
export function parseCommand(message) {
  const commands = {
    research: /!research\s+(.+)/i,
    brainstorm: /!brainstorm\s+(.+)/i,
    github: /!github\s+(\S+)/i,
    summary: /!summary(?:\s+(\d+))?/i,
    backlog: /!backlog(?:\s+(\d+))?/i,
    update: /!update\s+(\S+)/i,
    issue: /!issue\s+(\S+)\s+"([^"]+)"\s+"([^"]+)"/i,
    config: /^!config$/i,
    setfreq: /^!setfreq\s+(quiet|normal|active)$/i,
    setdepth: /^!setdepth\s+(quick|standard|deep)$/i,
    focus: /^!focus\s+(.+)/i,
    remind: /^!remind\s+(.+)/i,
    feedback: /^!feedback\s+(.+)/i,
    askme: /^!askme$/i,
    prefs: /^!prefs$/i,
    remindme: /^!remindme\s+(\d+\s*(?:m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days))\s+(.+)/i,
    discuss: /^!discuss\s+(.+)/i,
    engage: /^!engage\s+(.+)/i,
    cheer: /^!cheer\s+(.+)/i,
    pin: /^!pin$/i,
    help: /^!scout\s*help$/i,
    scout: /^!scout$/i,
    scoutmenu: /^!scout\s+(research|dashboard|jira|github|queues|settings|engage)$/i,
    save: /^!save\s+(.+)/i,
    savelast: /^!savelast\s+(.+)/i,
    story: /^!story\s+(.+)/i,
    bug: /^!bug\s+(.+)/i,
    task: /^!task\s+(.+)/i,
    jira: /^!jira\s+(.+)/i,
    dashboard: /^!dashboard(?:\s+(.+))?$/i,
    researchqueue: /^!research-queue(?:\s+(all))?$/i,
    followupqueue: /^!followup-queue(?:\s+(all))?$/i,
    docs: /^!docs(?:\s+(stats|list|search)\s*(.*))?$/i,
    memory: /^!memory(?:\s+(stats|search|graph)\s*(.*))?$/i,
    files: /!files(?:\s+(scan|stats))?(?:\s|$)/i,
    analyze: /!analyze(?:\s+(.+))?/i,
    tasks: /!tasks(?:\s+(.*))?/i,
    crew: /!crew(?:\s+(.*))?/i
  };

  for (const [cmd, pattern] of Object.entries(commands)) {
    const match = message.match(pattern);
    if (match) {
      return { command: cmd, args: match.slice(1) };
    }
  }
  return null;
}

// Configuration display
export function showConfig(channelId) {
  const prefs = getChannelPrefs(channelId);
  return `**Scout Configuration for this channel:**

**Check-in Frequency:** ${prefs.checkInFrequency}
**Research Depth:** ${prefs.researchDepth}
**Proactive Level:** ${prefs.proactiveLevel}

**Focus Topics:** ${prefs.focusTopics.length > 0 ? prefs.focusTopics.join(', ') : 'None set'}
**Reminder Topics:** ${prefs.reminderTopics.length > 0 ? prefs.reminderTopics.join(', ') : 'None set'}

**Commands to customize:**
- \`!setfreq quiet|normal|active\` - How often I check in
- \`!setdepth quick|standard|deep\` - Research thoroughness
- \`!focus [topic]\` - Add a topic I should prioritize
- \`!remind [topic]\` - Add a topic for me to revisit later
- \`!feedback [message]\` - Tell me what to do better
- \`!askme\` - I'll ask what you'd like me to improve`;
}

// Preferences display
export function showPrefs(channelId) {
  const prefs = getChannelPrefs(channelId);
  return `**Your Scout Preferences:**

| Setting | Value |
|---------|-------|
| Check-ins | ${prefs.checkInFrequency} |
| Research | ${prefs.researchDepth} |
| Proactive | ${prefs.proactiveLevel} |
| Focus Topics | ${prefs.focusTopics.length} |
| Reminders | ${prefs.reminderTopics.length} |
| Feedback Given | ${prefs.feedback.length} |`;
}

// Ask user for preference updates
export function askForPreferences(channelId) {
  return `**I'd love to work better for you!**

A few questions:
1. **How often would you like me to check in?** (quiet / normal / active)
2. **What topics should I focus on more?** Any areas you want me to prioritize?
3. **Anything I should look at again or revisit?** Topics worth re-researching?
4. **What could I do better?** Any feedback on my responses?
5. **How thorough should my research be?** (quick / standard / deep)

Just reply with any of these:
- \`!setfreq active\` - I'll check in more often
- \`!focus product strategy\` - I'll prioritize this topic
- \`!remind competitor analysis\` - I'll revisit this later
- \`!feedback be more concise\` - I'll improve
- \`!setdepth deep\` - I'll do more thorough research

What would you like to adjust?`;
}

// Handle the massive command switch - delegates to specialized handlers
export async function handleCommand(cmd, post, ctx) {
  const {
    config, state, log, postMessage, postWithSplitting, mmApi,
    memory, semanticMemory, fetchChannelHistory, emitToInstitutionalMemory,
    webSearch, getAIResponse, setReminder, commandRouter, dashboard,
    taskQueue, fileIndex, pdfUtils, crew
  } = ctx;

  const channelId = post.channel_id;
  const channelState = state.channels.get(channelId);
  let response = null;
  const replyTo = post.root_id || post.id;

  log('debug', 'Command parsed, computing replyTo', {
    command: cmd.command,
    postId: post.id,
    rootId: post.root_id,
    replyTo,
    channelId
  });

  // Try modular router first (skills, workflows, documents)
  if (commandRouter.isRouterCommand(cmd.command)) {
    try {
      log('info', 'Using modular router for command', { command: cmd.command });
      await postMessage(channelId, `Processing \`!${cmd.command}\`...`, replyTo);

      const routerPrefs = getChannelPrefs(channelId);
      const routerDepthMap = { quick: 20, standard: 50, deep: 100 };
      const routerHistoryLimit = routerDepthMap[routerPrefs.researchDepth] || 50;
      const routerHistory = await fetchChannelHistory(channelId, routerHistoryLimit);
      const routerChannelContext = routerHistory
        .filter(m => m.content && m.content.trim())
        .map(m => `[${m.username}]: ${m.content}`)
        .join('\n');

      let routerSemanticContext = '';
      try {
        const memCtx = await semanticMemory.getContext(cmd.args.join(' ') || cmd.command, {
          maxDocs: 20,
          maxConvs: 20,
          includeGraph: true
        });
        if (memCtx) routerSemanticContext = memCtx;
      } catch (err) {
        log('warn', 'Semantic memory for router failed', { error: err.message });
      }

      const routerResult = await commandRouter.routeCommand(cmd, {}, {
        botName: 'scout',
        channelContext: routerChannelContext,
        semanticContext: routerSemanticContext,
        depth: routerPrefs.researchDepth || 'standard',
        logFn: (msg) => log('info', msg)
      });

      if (routerResult) {
        await postWithSplitting(channelId, routerResult.text, replyTo, cmd.command);
        emitToInstitutionalMemory(cmd.command, cmd.args?.join(' '), routerResult.text, channelId, post.id);
        return; // Command handled by router
      }
    } catch (routerErr) {
      log('error', 'Router failed, falling through to legacy', { error: routerErr.message });
    }
  }

  // Legacy command handling (backward compatibility)
  switch (cmd.command) {
    case 'research': {
      await postMessage(channelId, "\u{1F52C} Conducting research analysis... This may take a moment.", replyTo);
      const researchPrefs = getChannelPrefs(channelId);
      const researchDepthMap = { quick: 20, standard: 50, deep: 100 };
      const researchHistoryLimit = researchDepthMap[researchPrefs.researchDepth] || 50;
      const researchHistory = await fetchChannelHistory(channelId, researchHistoryLimit);
      const researchContext = researchHistory
        .filter(m => m.content && m.content.trim())
        .map(m => `[${m.username}]: ${m.content}`)
        .join('\n');

      let semanticContext = '';
      try {
        const memoryContext = await semanticMemory.getContext(cmd.args[0], {
          maxDocs: 20, maxConvs: 20, includeGraph: true
        });
        if (memoryContext) {
          semanticContext = memoryContext;
          log('info', 'Added semantic memory context', { channelId, query: cmd.args[0] });
        }
      } catch (err) {
        log('warn', 'Semantic memory search failed, continuing without', { error: err.message });
      }

      const fullContext = semanticContext
        ? `${semanticContext}\n\n## Recent Channel Discussion\n${researchContext}`
        : researchContext;

      log('info', 'Research using channel history + semantic memory', {
        channelId, messages: researchHistory.length,
        hasSemanticContext: !!semanticContext, depth: researchPrefs.researchDepth
      });

      const { performResearch } = await import('./research.js');
      const researchResult = await performResearch(cmd.args[0], fullContext, ctx);
      await postWithSplitting(channelId, researchResult, replyTo, 'research');
      emitToInstitutionalMemory('research', cmd.args[0], researchResult, channelId, post.id);
      break;
    }

    case 'brainstorm': {
      await postMessage(channelId, "\u{1F4A1} Brainstorming with probabilistic analysis...", replyTo);
      const brainstormPrefs = getChannelPrefs(channelId);
      const brainstormDepthMap = { quick: 20, standard: 50, deep: 100 };
      const brainstormHistoryLimit = brainstormDepthMap[brainstormPrefs.researchDepth] || 50;
      const brainstormHistory = await fetchChannelHistory(channelId, brainstormHistoryLimit);
      const brainstormChannelContext = brainstormHistory
        .filter(m => m.content && m.content.trim())
        .map(m => `[${m.username}]: ${m.content}`)
        .join('\n');

      let brainstormSemanticContext = '';
      try {
        const memContext = await semanticMemory.getContext(cmd.args[0], {
          maxDocs: 20, maxConvs: 20, includeGraph: true
        });
        if (memContext) {
          brainstormSemanticContext = memContext;
          log('info', 'Added semantic memory to brainstorm', { query: cmd.args[0] });
        }
      } catch (err) {
        log('warn', 'Semantic memory for brainstorm failed', { error: err.message });
      }

      const brainstormFullContext = brainstormSemanticContext
        ? `${brainstormSemanticContext}\n\n## Recent Discussion\n${brainstormChannelContext}`
        : brainstormChannelContext;

      log('info', 'Brainstorm using channel history + semantic memory', {
        channelId, messages: brainstormHistory.length,
        hasSemanticContext: !!brainstormSemanticContext
      });

      const { brainstormWithProbabilities } = await import('./research.js');
      const brainstormResult = await brainstormWithProbabilities(cmd.args[0], brainstormFullContext, ctx);
      await postWithSplitting(channelId, brainstormResult, replyTo, 'brainstorm');
      emitToInstitutionalMemory('brainstorm', cmd.args[0], brainstormResult, channelId, post.id);
      break;
    }

    case 'crew': {
      const { handleCrewCommand } = await import('./crew.js');
      response = await handleCrewCommand(cmd, post, ctx);
      break;
    }

    case 'github': {
      const { getRecentCommits, getOpenPRs, getOpenIssues } = await import('./github.js');
      const repo = cmd.args[0];
      const commits = getRecentCommits(repo, 5, ctx);
      const prs = getOpenPRs(repo, ctx);
      const issues = getOpenIssues(repo, ctx);
      response = `## GitHub Update: ${repo}\n\n### Recent Commits\n${commits || 'None found'}\n\n### Open PRs\n${prs || 'None'}\n\n### Open Issues\n${issues || 'None'}`;
      break;
    }

    case 'summary': {
      const { summarizeChannel } = await import('./summary.js');
      const hours = cmd.args[0] ? parseInt(cmd.args[0]) : 24;
      response = await summarizeChannel(channelId, hours, false, ctx);
      emitToInstitutionalMemory('summary', `Channel summary (${hours}h)`, response, channelId, post.id);
      break;
    }

    case 'files': {
      const filesSubCmd = (cmd.args[0] || 'list').toLowerCase();

      if (filesSubCmd === 'scan') {
        await postMessage(channelId, "\u{1F4C2} Scanning channel for files...", replyTo);
        const scanResult = await fileIndex.scanChannelFiles(channelId, mmApi, { log });
        response = `\u{1F4C2} **File Scan Complete**\n\n- Posts scanned: ${scanResult.scanned}\n- New files indexed: ${scanResult.added}\n\nUse \`!files\` to see all indexed files.`;
      } else if (filesSubCmd === 'stats') {
        const stats = fileIndex.getStats();
        response = `\u{1F4CA} **File Index Statistics**\n\n- Total files: ${stats.totalFiles}\n- Processed: ${stats.processedFiles}\n- Unprocessed: ${stats.unprocessedFiles}\n- Channels with files: ${stats.channelCount}\n\n**By Type:**\n${Object.entries(stats.byType).map(([t, c]) => `- ${t}: ${c}`).join('\n')}`;
      } else {
        const channelFiles = fileIndex.getChannelFiles(channelId);
        if (channelFiles.length === 0) {
          response = `\u{1F4C2} No files indexed for this channel yet.\n\nUse \`!files scan\` to scan for files, or upload a new file.`;
        } else {
          const fileList = channelFiles.slice(0, 15).map(f => {
            const processed = fileIndex.isProcessed(f.id) ? '\u2713' : '\u25CB';
            const size = (f.size / 1024).toFixed(1) + 'KB';
            return `${processed} **${f.name}** (${size}) - \`${f.id.substring(0, 8)}\``;
          }).join('\n');
          response = `\u{1F4C2} **Channel Files** (${channelFiles.length} total)\n\n${fileList}\n\n_\u2713 = processed, \u25CB = not processed_\n\nUse \`!analyze [filename or id]\` to process a file.`;
        }
      }
      break;
    }

    case 'tasks': {
      const tasksSubCmd = (cmd.args[0] || 'list').toLowerCase().split(/\s+/)[0];
      const tasksArg = (cmd.args[0] || '').replace(/^\S+\s*/, '');

      switch (tasksSubCmd) {
        case 'list':
        case 'pending': {
          const pending = taskQueue.getPendingTasks({ channelId });
          const allPending = taskQueue.getPendingTasks();

          if (pending.length === 0 && allPending.length === 0) {
            response = `\u{1F4CB} **No pending tasks**\n\nI'm all caught up! Use commands like \`!research\`, \`!crew\`, or \`!remindme\` to add work.`;
          } else {
            let taskList = '';
            if (pending.length > 0) {
              taskList += `**This Channel (${pending.length}):**\n`;
              taskList += pending.slice(0, 10).map(t => {
                const status = t.status === 'in_progress' ? '\u{1F504}' : '\u23F3';
                const scheduled = t.scheduledFor ? ` (scheduled: ${new Date(t.scheduledFor).toLocaleString()})` : '';
                return `${status} \`${t.id.substring(0, 8)}\` ${t.title}${scheduled}`;
              }).join('\n');
              if (pending.length > 10) taskList += `\n_...and ${pending.length - 10} more_`;
            }
            if (allPending.length > pending.length) {
              const otherCount = allPending.length - pending.length;
              taskList += `\n\n**Other Channels:** ${otherCount} tasks`;
            }
            const stats = taskQueue.getStats();
            response = `\u{1F4CB} **Task Queue**\n\n${taskList}\n\n**Stats:** ${stats.pending} pending, ${stats.totalCompleted} completed, ${stats.totalFailed} failed\n\nCommands: \`!tasks done [id]\`, \`!tasks cancel [id]\`, \`!tasks retry [id]\``;
          }
          break;
        }
        case 'all': {
          const all = taskQueue.getPendingTasks();
          if (all.length === 0) {
            response = `\u{1F4CB} No pending tasks across any channel.`;
          } else {
            const taskList = all.slice(0, 15).map(t => {
              const status = t.status === 'in_progress' ? '\u{1F504}' : '\u23F3';
              return `${status} \`${t.id.substring(0, 8)}\` [${t.type}] ${t.title}`;
            }).join('\n');
            response = `\u{1F4CB} **All Pending Tasks (${all.length})**\n\n${taskList}${all.length > 15 ? `\n_...and ${all.length - 15} more_` : ''}`;
          }
          break;
        }
        case 'done':
        case 'complete': {
          if (!tasksArg) { response = `Usage: \`!tasks done [task_id]\``; break; }
          const task = taskQueue.getPendingTasks().find(t => t.id.startsWith(tasksArg));
          if (task) {
            taskQueue.completeTask(task.id, { manuallyCompleted: true });
            response = `\u2705 Marked task as done: **${task.title}**`;
          } else {
            response = `\u274C Task not found: ${tasksArg}`;
          }
          break;
        }
        case 'cancel': {
          if (!tasksArg) { response = `Usage: \`!tasks cancel [task_id]\``; break; }
          const task = taskQueue.getPendingTasks().find(t => t.id.startsWith(tasksArg));
          if (task) {
            taskQueue.cancelTask(task.id);
            response = `\u{1F6AB} Cancelled task: **${task.title}**`;
          } else {
            response = `\u274C Task not found: ${tasksArg}`;
          }
          break;
        }
        case 'retry': {
          if (!tasksArg) { response = `Usage: \`!tasks retry [task_id]\``; break; }
          const failed = taskQueue.getFailedTasks(50);
          const task = failed.find(t => t.id.startsWith(tasksArg));
          if (task) {
            taskQueue.retryTask(task.id);
            response = `\u{1F504} Retrying task: **${task.title}**`;
          } else {
            response = `\u274C Failed task not found: ${tasksArg}`;
          }
          break;
        }
        case 'failed': {
          const failed = taskQueue.getFailedTasks(10);
          if (failed.length === 0) {
            response = `\u2705 No failed tasks!`;
          } else {
            const failedList = failed.map(t =>
              `\u274C \`${t.id.substring(0, 8)}\` ${t.title}\n   Error: ${t.error || 'Unknown'}`
            ).join('\n');
            response = `\u{1F4CB} **Failed Tasks**\n\n${failedList}\n\nUse \`!tasks retry [id]\` to retry.`;
          }
          break;
        }
        case 'stats': {
          const stats = taskQueue.getStats();
          response = `\u{1F4CA} **Task Queue Stats**\n\n` +
            `- Pending: ${stats.pending}\n` +
            `- In Progress: ${stats.inProgress}\n` +
            `- Scheduled: ${stats.scheduled}\n` +
            `- Ready: ${stats.ready}\n\n` +
            `**Totals:**\n` +
            `- Created: ${stats.totalCreated}\n` +
            `- Completed: ${stats.totalCompleted}\n` +
            `- Failed: ${stats.totalFailed}\n\n` +
            `**By Type:**\n${Object.entries(stats.byType).map(([t, c]) => `- ${t}: ${c}`).join('\n') || 'None'}`;
          break;
        }
        case 'add': {
          if (!tasksArg) {
            response = `Usage: \`!tasks add [description]\`\n\nExample: \`!tasks add Follow up on LYNA pricing discussion\``;
            break;
          }
          const task = taskQueue.TaskFactory.followUp(tasksArg, channelId, post.user_id);
          response = `\u{1F4CC} Added follow-up task: **${tasksArg}**\n\nTask ID: \`${task.id.substring(0, 8)}\``;
          break;
        }
        default:
          response = `\u{1F4CB} **Task Commands**\n\n` +
            `| Command | Description |\n` +
            `|---------|-------------|\n` +
            `| \`!tasks\` | List pending tasks in this channel |\n` +
            `| \`!tasks all\` | List all pending tasks |\n` +
            `| \`!tasks add [desc]\` | Add a follow-up task |\n` +
            `| \`!tasks done [id]\` | Mark task as complete |\n` +
            `| \`!tasks cancel [id]\` | Cancel a task |\n` +
            `| \`!tasks failed\` | Show failed tasks |\n` +
            `| \`!tasks retry [id]\` | Retry a failed task |\n` +
            `| \`!tasks stats\` | Show queue statistics |`;
      }
      break;
    }

    case 'analyze': {
      const { downloadFile } = await import('./files.js');
      const fileQuery = cmd.args.join(' ');
      if (!fileQuery) {
        response = `Usage: \`!analyze [filename or file_id]\`\n\nExamples:\n- \`!analyze budget.xlsx\`\n- \`!analyze s8b51sog\``;
        break;
      }

      await postMessage(channelId, `\u{1F4C4} Searching for file: **${fileQuery}**...`, replyTo);

      let targetFile = fileIndex.getFile(fileQuery);
      if (!targetFile) {
        const matches = fileIndex.searchFiles(fileQuery, channelId);
        if (matches.length === 0) {
          await fileIndex.scanChannelFiles(channelId, mmApi, { log });
          const retryMatches = fileIndex.searchFiles(fileQuery, channelId);
          if (retryMatches.length > 0) targetFile = retryMatches[0];
        } else {
          targetFile = matches[0];
        }
      }

      if (!targetFile) {
        response = `\u274C Could not find file matching: **${fileQuery}**\n\nTry \`!files scan\` to index files, then \`!files\` to see available files.`;
        break;
      }

      const alreadyProcessed = fileIndex.isProcessed(targetFile.id);
      if (alreadyProcessed) {
        await postMessage(channelId, `\u{1F4C4} File **${targetFile.name}** was already processed. Re-analyzing...`, replyTo);
      } else {
        await postMessage(channelId, `\u{1F4C4} Processing: **${targetFile.name}**...`, replyTo);
      }

      try {
        const fileBuffer = await downloadFile(targetFile.id, ctx);
        if (!fileBuffer) {
          response = `\u274C Failed to download file: ${targetFile.name}`;
          break;
        }

        const processResult = await fileIndex.processFile(targetFile, fileBuffer, { log });

        if (processResult.success) {
          const chState = state.channels.get(channelId);
          if (chState) {
            chState.messages.push({
              role: 'system',
              content: `[${processResult.type.toUpperCase()}: ${processResult.name}]\n${processResult.context.substring(0, 50000)}`,
              timestamp: Date.now()
            });
          }

          if (!alreadyProcessed) {
            const indexContent = {
              text: processResult.context,
              chunks: [{ text: processResult.context, pageNum: 1, heading: processResult.name }]
            };
            pdfUtils.indexDocument(indexContent, processResult.name, channelId, log)
              .catch(err => log('warn', 'Vector indexing failed', { error: err.message }));
          }

          let summaryLines = [];
          if (processResult.type === 'spreadsheet') {
            summaryLines = [
              `- **Sheets**: ${processResult.summary.sheets}`,
              `- **Rows**: ${processResult.summary.rows}`,
              `- **Formulas**: ${processResult.summary.formulas}`,
              processResult.summary.hasComplexFormulas ? `- **Complex formulas**: Yes` : null
            ].filter(Boolean);
          } else if (processResult.type === 'pdf' || processResult.type === 'document') {
            summaryLines = [
              `- **Pages**: ${processResult.summary.pages}`,
              `- **Chunks**: ${processResult.summary.chunks}`
            ];
          }

          const analysisContent = processResult.context.substring(0, 10000);
          const analysisMsg = `## \u{1F4C4} File Analysis: ${processResult.name}\n\n**Summary:**\n${summaryLines.join('\n')}\n\n---\n\n${analysisContent}${processResult.context.length > 10000 ? '\n\n_... content truncated. Full file is now in memory for questions._' : ''}`;
          await postWithSplitting(channelId, analysisMsg, replyTo, 'file-analysis');
        } else {
          response = `\u274C Failed to process file: ${processResult.error}`;
        }
      } catch (err) {
        log('error', 'File analysis failed', { file: targetFile.name, error: err.message });
        response = `\u274C Error processing file: ${err.message}`;
      }
      break;
    }

    case 'backlog': {
      await postMessage(channelId, "\u{1F4CB} Analyzing discussion and creating backlog items...", replyTo);
      const { summarizeChannel } = await import('./summary.js');
      const backlogHours = cmd.args[0] ? parseInt(cmd.args[0]) : 24;
      response = await summarizeChannel(channelId, backlogHours, true, ctx);
      break;
    }

    case 'update': {
      await postMessage(channelId, "\u{1F4E6} Generating product update...", replyTo);
      const { generateProductUpdate } = await import('./summary.js');
      response = await generateProductUpdate(cmd.args[0], ctx);
      break;
    }

    case 'issue': {
      const { createGitHubIssue } = await import('./github.js');
      const issueResult = createGitHubIssue(cmd.args[0], cmd.args[1], cmd.args[2], ctx);
      response = issueResult ? `\u2705 Issue created: ${issueResult}` : "\u274C Failed to create issue";
      break;
    }

    case 'config':
      response = showConfig(channelId);
      break;

    case 'prefs':
      response = showPrefs(channelId);
      break;

    case 'askme':
      response = askForPreferences(channelId);
      break;

    case 'setfreq': {
      const freq = cmd.args[0].toLowerCase();
      const prefsFreq = getChannelPrefs(channelId);
      prefsFreq.checkInFrequency = freq;
      savePreferences(log);
      response = `\u2705 Check-in frequency set to **${freq}**. ${freq === 'quiet' ? "I'll be less chatty." : freq === 'active' ? "I'll check in more often!" : "I'll check in at a normal pace."}`;
      break;
    }

    case 'setdepth': {
      const depth = cmd.args[0].toLowerCase();
      const prefsDepth = getChannelPrefs(channelId);
      prefsDepth.researchDepth = depth;
      savePreferences(log);
      response = `\u2705 Research depth set to **${depth}**. ${depth === 'quick' ? "I'll give faster, shorter answers." : depth === 'deep' ? "I'll provide thorough, comprehensive research." : "I'll balance speed and depth."}`;
      break;
    }

    case 'focus': {
      const focusTopic = cmd.args[0];
      const prefsFocus = getChannelPrefs(channelId);
      if (!prefsFocus.focusTopics.includes(focusTopic)) {
        prefsFocus.focusTopics.push(focusTopic);
        savePreferences(log);
        response = `\u2705 Added **"${focusTopic}"** to focus topics. I'll prioritize this in research and discussions.\n\nCurrent focus: ${prefsFocus.focusTopics.join(', ')}`;
      } else {
        response = `"${focusTopic}" is already in your focus topics.`;
      }
      break;
    }

    case 'remind': {
      const remindTopic = cmd.args[0];
      const prefsRemind = getChannelPrefs(channelId);
      prefsRemind.reminderTopics.push({
        topic: remindTopic,
        addedAt: Date.now(),
        nextReminder: Date.now() + (7 * 24 * 60 * 60 * 1000)
      });
      savePreferences(log);
      response = `\u2705 I'll remind you about **"${remindTopic}"** in about a week. I'll bring it up when relevant or during check-ins.`;
      break;
    }

    case 'feedback': {
      const feedbackMsg = cmd.args[0];
      const prefsFeedback = getChannelPrefs(channelId);
      prefsFeedback.feedback.push({ message: feedbackMsg, timestamp: Date.now() });
      savePreferences(log);
      response = `Thank you for the feedback! I've noted: **"${feedbackMsg}"**\n\nI'll work on improving. Your feedback helps me serve you better!`;
      break;
    }

    case 'remindme': {
      const timeArg = cmd.args[0];
      const reminderMsg = cmd.args[1];
      response = await setReminder(channelId, post.user_id, timeArg, reminderMsg);
      break;
    }

    case 'discuss': {
      const { startDiscussion } = await import('./discussion.js');
      const discussTopic = cmd.args[0];
      await postMessage(channelId, "\u{1F4AC} Starting a discussion thread...", replyTo);
      response = await startDiscussion(channelId, discussTopic, ctx);
      break;
    }

    case 'engage': {
      const { engageTopic } = await import('./discussion.js');
      const engageTopicStr = cmd.args[0];
      const contextMsgs = channelState.messages.slice(-5).map(m => m.content).join('\n');
      response = await engageTopic(channelId, engageTopicStr, contextMsgs, ctx);
      break;
    }

    case 'cheer': {
      const { addReaction } = await import('./files.js');
      const cheerTarget = cmd.args[0];
      await addReaction(post.id, 'tada', ctx);
      response = `\u{1F389} **Shoutout to ${cheerTarget}!**\n\n${getCheerMessage()}`;
      break;
    }

    case 'pin': {
      const { pinMessage } = await import('./discussion.js');
      if (post.root_id) {
        const pinned = await pinMessage(post.root_id, ctx);
        response = pinned ? "\u{1F4CC} Message pinned!" : "Couldn't pin that message.";
      } else {
        response = "Reply to a message with `!pin` to pin it.";
      }
      break;
    }

    case 'savelast': {
      const { saveToGitHub, getLastBotResponse } = await import('./github.js');
      const docName = cmd.args[0];
      const lastResponse = getLastBotResponse(channelState.messages);

      if (!lastResponse) {
        response = "I don't have a recent response to save. Run a `!research` or `!brainstorm` first, then use `!savelast [name]`.";
      } else {
        await postMessage(channelId, "\u{1F4C4} Saving to GitHub...", replyTo);
        const result = await saveToGitHub(docName, lastResponse, `docs: Add ${docName} from Scout research`, ctx);

        if (result.success) {
          response = `\u2705 **Saved to GitHub!**\n\n\u{1F4C1} File: \`${result.filepath}\`\n\u{1F517} [View on GitHub](https://github.com/hwillGIT/playbook-templates/blob/main/${result.filepath})`;
        } else {
          response = `\u274C Failed to save: ${result.error}`;
        }
      }
      break;
    }

    case 'save': {
      const { saveToGitHub } = await import('./github.js');
      const saveArgs = cmd.args[0];
      const nameMatch = saveArgs.match(/^"([^"]+)"\s+(.+)$/s);

      if (!nameMatch) {
        response = `**Usage:** \`!save "filename" [content]\`\n\nOr use \`!savelast [filename]\` to save my last research/brainstorm output.`;
      } else {
        const fileName = nameMatch[1];
        const content = nameMatch[2];

        await postMessage(channelId, "\u{1F4C4} Saving to GitHub...", replyTo);
        const saveResult = await saveToGitHub(fileName, content, `docs: Add ${fileName}`, ctx);

        if (saveResult.success) {
          response = `\u2705 **Saved to GitHub!**\n\n\u{1F4C1} File: \`${saveResult.filepath}\`\n\u{1F517} [View on GitHub](https://github.com/hwillGIT/playbook-templates/blob/main/${saveResult.filepath})`;
        } else {
          response = `\u274C Failed to save: ${saveResult.error}`;
        }
      }
      break;
    }

    case 'scout':
      response = `## \u{1F50D} Scout - Command Menu

Type \`!scout [category]\` to see commands, or use directly:

| Category | Command | What it does |
|----------|---------|--------------|
| \u{1F4CA} **dashboard** | \`!scout dashboard\` | PM dashboards & project status |
| \u{1F52C} **research** | \`!scout research\` | Deep analysis & brainstorming |
| \u{1F4CB} **jira** | \`!scout jira\` | Create stories, bugs, tasks |
| \u{1F419} **github** | \`!scout github\` | Commits, PRs, save docs |
| \u{1F4C5} **queues** | \`!scout queues\` | Research & follow-up tracking |
| \u{1F4AC} **engage** | \`!scout engage\` | Discussions, cheers, polls |
| \u2699\uFE0F **settings** | \`!scout settings\` | Configure Scout behavior |

**Quick Actions:**
\u2022 \`!dashboard\` - Generate PM dashboard now
\u2022 \`!research-queue all\` - See all research items
\u2022 \`!summary\` - Summarize this channel

_Or just @scout with any question!_`;
      break;

    case 'scoutmenu': {
      const menuCategory = cmd.args[0]?.toLowerCase();
      switch (menuCategory) {
        case 'dashboard':
          response = `## \u{1F4CA} Dashboard Commands\n\n| Command | Description |\n|---------|-------------|\n| \`!dashboard\` | Weekly PM dashboard (all projects) |\n| \`!dashboard 14d\` | Last 14 days |\n| \`!dashboard monthly\` | Last 30 days |\n| \`!research-queue\` | Research items (this channel) |\n| \`!research-queue all\` | Research items (all projects) |\n| \`!followup-queue\` | Follow-ups (this channel) |\n| \`!followup-queue all\` | Follow-ups (all projects) |\n\n_Dashboard auto-posts Mon 9am & Fri 4pm to #pm-dashboard_`;
          break;
        case 'research':
          response = `## \u{1F52C} Research & Analysis Commands\n\n| Command | Description |\n|---------|-------------|\n| \`!research [topic]\` | Deep probabilistic analysis |\n| \`!brainstorm [topic]\` | Creative ideas with success odds |\n| \`!summary\` | Channel digest (last 24h) |\n| \`!summary 48\` | Channel digest (last 48h) |\n\n**Example:**\n\`!research best practices for user onboarding in SaaS\``;
          break;
        case 'jira':
          response = `## \u{1F4CB} Jira Commands\n\n| Command | Description |\n|---------|-------------|\n| \`!story [description]\` | Create User Story with acceptance criteria |\n| \`!bug [description]\` | Create Bug with steps to reproduce |\n| \`!task [description]\` | Create Task |\n| \`!jira [description]\` | Auto-detect type and create |\n| \`!backlog [hours]\` | Summarize channel & create issues |\n\n**Examples:**\n\`!story As a user, I want to export data to CSV\`\n\`!bug Login button not working on mobile Safari\``;
          break;
        case 'github':
          response = `## \u{1F419} GitHub Commands\n\n| Command | Description |\n|---------|-------------|\n| \`!github [repo]\` | Show commits, PRs, issues |\n| \`!update [repo]\` | Generate product update summary |\n| \`!issue [repo] "title" "body"\` | Create GitHub issue |\n| \`!savelast [filename]\` | Save last research to GitHub |\n| \`!save "filename" [content]\` | Save custom content |\n\n**Example:**\n\`!github opal-app\``;
          break;
        case 'queues':
          response = `## \u{1F4C5} Queue Commands\n\n**Research Queue** (items needing investigation):\n| Command | Description |\n|---------|-------------|\n| \`!research-queue\` | This channel's research items |\n| \`!research-queue all\` | All projects' research items |\n\n**Follow-up Queue** (items awaiting response):\n| Command | Description |\n|---------|-------------|\n| \`!followup-queue\` | This channel's follow-ups |\n| \`!followup-queue all\` | All projects' follow-ups |\n\n_Items are auto-detected from conversations_`;
          break;
        case 'engage':
          response = `## \u{1F4AC} Engagement Commands\n\n| Command | Description |\n|---------|-------------|\n| \`!discuss [topic]\` | Start a discussion thread |\n| \`!engage [topic]\` | Add insight to conversation |\n| \`!cheer [person/team]\` | Celebrate someone! \u{1F389} |\n| \`!pin\` | Pin a message (reply to it) |\n| \`!remindme [time] [msg]\` | Set reminder (30m, 2h, 1d) |\n\n**Example:**\n\`!remindme 2h check on build status\``;
          break;
        case 'settings':
          response = `## \u2699\uFE0F Settings Commands\n\n| Command | Description |\n|---------|-------------|\n| \`!config\` | View current settings |\n| \`!setfreq quiet\` | Less frequent check-ins |\n| \`!setfreq normal\` | Normal check-ins |\n| \`!setfreq active\` | More frequent check-ins |\n| \`!setdepth quick\` | Faster, shorter research |\n| \`!setdepth standard\` | Balanced research |\n| \`!setdepth deep\` | Thorough research |\n| \`!focus [topic]\` | Add priority topic |\n| \`!feedback [msg]\` | Send feedback to improve Scout |`;
          break;
        default:
          response = `Unknown category. Try: \`!scout dashboard\`, \`!scout research\`, \`!scout jira\`, \`!scout github\`, \`!scout queues\`, \`!scout engage\`, or \`!scout settings\``;
      }
      break;
    }

    case 'help':
      response = `## \u{1F50D} Scout Commands

**Research & Analysis:**
\u2022 \`!research [topic]\` - Deep probabilistic analysis
\u2022 \`!brainstorm [topic]\` - Creative ideas with success odds
\u2022 \`!crew [research|brainstorm|dialectic|analysis] [topic]\` - Multi-agent pipelines
\u2022 \`!summary [hours]\` - Channel activity digest (default: 24h)
\u2022 \`!backlog [hours]\` - Summarize & auto-create Jira issues from action items

**Files & Documents:**
\u2022 \`!files\` - List indexed files in channel
\u2022 \`!files scan\` - Scan channel for files to index
\u2022 \`!analyze [filename]\` - Process and analyze a file (XLS, PDF, DOCX)

**Task Queue:**
\u2022 \`!tasks\` - View pending tasks
\u2022 \`!tasks add [desc]\` - Add a follow-up task
\u2022 \`!tasks done [id]\` - Mark task complete

**GitHub:**
\u2022 \`!github [repo]\` - Commits, PRs, issues
\u2022 \`!update [repo]\` - Product update summary
\u2022 \`!issue [repo] "title" "body"\` - Create GitHub issue
\u2022 \`!savelast [filename]\` - Save last research/brainstorm to GitHub
\u2022 \`!save "filename" [content]\` - Save custom content to GitHub

**Jira Backlog:**
\u2022 \`!story [description]\` - Create a User Story with acceptance criteria
\u2022 \`!bug [description]\` - Create a Bug with steps to reproduce
\u2022 \`!task [description]\` - Create a Task
\u2022 \`!backlog [description]\` - Auto-detect type and create issue

**Engagement:**
\u2022 \`!discuss [topic]\` - Start a discussion thread
\u2022 \`!engage [topic]\` - Add an insight to the conversation
\u2022 \`!cheer [person/team]\` - Celebrate someone!
\u2022 \`!pin\` - Pin a message (reply to the message)

**Reminders:**
\u2022 \`!remindme [time] [message]\` - Set a reminder (e.g., 30m, 2h, 1d)

**Dashboard & Queues:**
\u2022 \`!dashboard\` - Weekly PM dashboard (all projects)
\u2022 \`!dashboard 14d\` - Last 14 days
\u2022 \`!research-queue\` - View research items needing investigation
\u2022 \`!research-queue all\` - Research items across all projects
\u2022 \`!followup-queue\` - View pending follow-up items
\u2022 \`!followup-queue all\` - Follow-ups across all projects

**Settings:**
\u2022 \`!config\` - View settings
\u2022 \`!setfreq quiet|normal|active\` - Check-in frequency
\u2022 \`!setdepth quick|standard|deep\` - Research depth
\u2022 \`!focus [topic]\` - Add a priority topic
\u2022 \`!feedback [message]\` - Help me improve

_Or just @scout me with any question!_`;
      break;

    // ===== JIRA COMMANDS =====

    case 'story': {
      if (!config.jira?.enabled) {
        response = "\u274C Jira integration is not configured. Ask your admin to set up Jira in config.json.";
      } else {
        const { generateJiraIssue, createJiraStory } = await import('./jira.js');
        const storyRequest = cmd.args[0];
        await postMessage(channelId, "\u{1F4DD} Creating Jira Story...", replyTo);

        const storyData = await generateJiraIssue(storyRequest, 'Story', ctx);
        if (storyData) {
          const result = await createJiraStory(storyData.summary, storyData.description, storyData.acceptanceCriteria || '', ctx);
          if (result.success) {
            response = `\u2705 **Story Created!**\n\n\u{1F4CB} **${result.key}**: ${storyData.summary}\n\u{1F517} [View in Jira](${result.url})\n\n**Acceptance Criteria:**\n${storyData.acceptanceCriteria || '_None specified_'}`;
          } else {
            response = `\u274C Failed to create story: ${result.error}`;
          }
        } else {
          response = "\u274C Couldn't process that request. Try: `!story As a user, I want to...`";
        }
      }
      break;
    }

    case 'bug': {
      if (!config.jira?.enabled) {
        response = "\u274C Jira integration is not configured. Ask your admin to set up Jira in config.json.";
      } else {
        const { generateJiraIssue, createJiraBug } = await import('./jira.js');
        const bugRequest = cmd.args[0];
        await postMessage(channelId, "\u{1F41B} Creating Jira Bug...", replyTo);

        const bugData = await generateJiraIssue(bugRequest, 'Bug', ctx);
        if (bugData) {
          const result = await createJiraBug(bugData.summary, bugData.description, bugData.stepsToReproduce || '', ctx);
          if (result.success) {
            response = `\u2705 **Bug Created!**\n\n\u{1F41B} **${result.key}**: ${bugData.summary}\n\u{1F517} [View in Jira](${result.url})\n\n**Steps to Reproduce:**\n${bugData.stepsToReproduce || '_Please add steps to reproduce_'}`;
          } else {
            response = `\u274C Failed to create bug: ${result.error}`;
          }
        } else {
          response = "\u274C Couldn't process that request. Try: `!bug Login button doesn't work on mobile`";
        }
      }
      break;
    }

    case 'task': {
      if (!config.jira?.enabled) {
        response = "\u274C Jira integration is not configured. Ask your admin to set up Jira in config.json.";
      } else {
        const { generateJiraIssue, createJiraTask } = await import('./jira.js');
        const taskRequest = cmd.args[0];
        await postMessage(channelId, "\u{1F4CC} Creating Jira Task...", replyTo);

        const taskData = await generateJiraIssue(taskRequest, 'Task', ctx);
        if (taskData) {
          const result = await createJiraTask(taskData.summary, taskData.description, ctx);
          if (result.success) {
            response = `\u2705 **Task Created!**\n\n\u{1F4CC} **${result.key}**: ${taskData.summary}\n\u{1F517} [View in Jira](${result.url})`;
          } else {
            response = `\u274C Failed to create task: ${result.error}`;
          }
        } else {
          response = "\u274C Couldn't process that request. Try: `!task Update dependencies to latest versions`";
        }
      }
      break;
    }

    case 'jira':
    case 'backlog': {
      if (cmd.command === 'backlog' && cmd.args[0] && /^\d+$/.test(cmd.args[0])) {
        // backlog with hours - handled above in the 'backlog' case via summarizeChannel
        // This branch handles !backlog [text] for creating issues
      }
      if (!config.jira?.enabled) {
        response = "\u274C Jira integration is not configured. Ask your admin to set up Jira in config.json.";
      } else {
        const { generateJiraIssue, createJiraStory, createJiraBug, createJiraTask } = await import('./jira.js');
        const backlogRequest = cmd.args[0];
        await postMessage(channelId, "\u{1F4CB} Creating backlog item...", replyTo);

        const lowerReq = backlogRequest.toLowerCase();
        let issueType = 'Task';
        if (lowerReq.includes('as a ') || lowerReq.includes('user story') || lowerReq.includes('feature')) {
          issueType = 'Story';
        } else if (lowerReq.includes('bug') || lowerReq.includes('broken') || lowerReq.includes('fix') || lowerReq.includes('error') || lowerReq.includes('issue')) {
          issueType = 'Bug';
        }

        const backlogData = await generateJiraIssue(backlogRequest, issueType, ctx);
        if (backlogData) {
          let result;
          if (issueType === 'Story') {
            result = await createJiraStory(backlogData.summary, backlogData.description, backlogData.acceptanceCriteria || '', ctx);
          } else if (issueType === 'Bug') {
            result = await createJiraBug(backlogData.summary, backlogData.description, backlogData.stepsToReproduce || '', ctx);
          } else {
            result = await createJiraTask(backlogData.summary, backlogData.description, ctx);
          }

          if (result.success) {
            const typeEmoji = { Story: '\u{1F4CB}', Bug: '\u{1F41B}', Task: '\u{1F4CC}' };
            response = `\u2705 **${issueType} Created!**\n\n${typeEmoji[issueType]} **${result.key}**: ${backlogData.summary}\n\u{1F517} [View in Jira](${result.url})`;
          } else {
            response = `\u274C Failed to create ${issueType.toLowerCase()}: ${result.error}`;
          }
        } else {
          response = "\u274C Couldn't process that request. Try describing what you need in plain language.";
        }
      }
      break;
    }

    // ===== DASHBOARD COMMAND =====
    case 'dashboard': {
      await postMessage(channelId, ":chart_with_upwards_trend: Generating PM Dashboard... This may take a moment.", replyTo);
      try {
        const dashArgs = parseDashboardArgs(cmd.args[0]);
        const dashboardData = await dashboard.generateDashboard(dashArgs.days, dashArgs.label);

        await postMessage(channelId, dashboardData.formatted_text, replyTo);

        if (dashboardData.charts) {
          let chartMsg = '**Dashboard Charts:**\n\n';
          if (dashboardData.charts.flow_velocity) {
            chartMsg += `[Flow Velocity Chart](${dashboardData.charts.flow_velocity})\n`;
          }
          if (dashboardData.charts.activity_trend) {
            chartMsg += `[Activity Trend Chart](${dashboardData.charts.activity_trend})\n`;
          }
          if (dashboardData.charts.task_distribution) {
            chartMsg += `[Task Distribution Chart](${dashboardData.charts.task_distribution})\n`;
          }
          await postMessage(channelId, chartMsg, replyTo);
        }

        response = null; // Already posted
      } catch (err) {
        console.error('[DASHBOARD] Error generating dashboard:', err);
        response = `:x: Failed to generate dashboard: ${err.message}`;
      }
      break;
    }

    // ===== RESEARCH & FOLLOW-UP QUEUE COMMANDS =====
    case 'researchqueue': {
      const showAllResearch = cmd.args[0] === 'all';
      if (showAllResearch) {
        const allChannelIds = memory.getAllChannelIds();
        const channelNames = config.capture?.channelNames || {};
        let allItems = [];

        for (const chId of allChannelIds) {
          const queue = memory.getResearchQueue(chId, 'open');
          const chName = channelNames[chId] || chId.substring(0, 8);
          for (const item of queue) {
            allItems.push({ ...item, channel: chName, age_days: Math.round((Date.now() - (item.created_at || 0)) / (24 * 60 * 60 * 1000)) });
          }
        }

        if (allItems.length === 0) {
          response = "\u{1F52C} **Research Queue (All Projects)**\n\n_No research items pending across any project._";
        } else {
          allItems.sort((a, b) => (a.priority === 'high' ? -1 : 1));
          let msg = `\u{1F52C} **Research Queue (All Projects)** - ${allItems.length} item(s)\n\n`;
          for (const item of allItems.slice(0, 15)) {
            const priorityIcon = item.priority === 'high' ? '\u{1F534}' : item.priority === 'medium' ? '\u{1F7E1}' : '\u{1F7E2}';
            msg += `${priorityIcon} **[${item.channel}]** ${item.title}\n`;
            if (item.description && item.description !== item.title) {
              msg += `   _${item.description.substring(0, 80)}${item.description.length > 80 ? '...' : ''}_\n`;
            }
            msg += `   Age: ${item.age_days}d | Status: ${item.status}\n\n`;
          }
          if (allItems.length > 15) msg += `_...and ${allItems.length - 15} more items_`;
          response = msg;
        }
      } else {
        const queue = memory.getResearchQueue(channelId, 'open');
        if (queue.length === 0) {
          response = "\u{1F52C} **Research Queue (This Channel)**\n\n_No research items pending for this channel._\n\nUse `!research-queue all` to see items across all projects.";
        } else {
          let msg = `\u{1F52C} **Research Queue (This Channel)** - ${queue.length} item(s)\n\n`;
          for (const item of queue) {
            const age = Math.round((Date.now() - (item.created_at || 0)) / (24 * 60 * 60 * 1000));
            const priorityIcon = item.priority === 'high' ? '\u{1F534}' : item.priority === 'medium' ? '\u{1F7E1}' : '\u{1F7E2}';
            msg += `${priorityIcon} **${item.title}**\n`;
            if (item.description && item.description !== item.title) {
              msg += `   _${item.description.substring(0, 100)}${item.description.length > 100 ? '...' : ''}_\n`;
            }
            msg += `   Age: ${age}d | Priority: ${item.priority} | Status: ${item.status}\n\n`;
          }
          msg += `\n_Use \`!research-queue all\` to see items across all projects._`;
          response = msg;
        }
      }
      break;
    }

    case 'followupqueue': {
      const showAllFollowups = cmd.args[0] === 'all';
      if (showAllFollowups) {
        const allChannelIds = memory.getAllChannelIds();
        const channelNames = config.capture?.channelNames || {};
        let allItems = [];

        for (const chId of allChannelIds) {
          const queue = memory.getFollowUpQueue(chId, 'pending');
          const chName = channelNames[chId] || chId.substring(0, 8);
          for (const item of queue) {
            allItems.push({ ...item, channel: chName, age_days: Math.round((Date.now() - (item.created_at || 0)) / (24 * 60 * 60 * 1000)) });
          }
        }

        if (allItems.length === 0) {
          response = "\u{1F4C5} **Follow-up Queue (All Projects)**\n\n_No follow-up items pending across any project._";
        } else {
          let msg = `\u{1F4C5} **Follow-up Queue (All Projects)** - ${allItems.length} item(s)\n\n`;
          for (const item of allItems.slice(0, 15)) {
            msg += `\u2022 **[${item.channel}]** ${item.title}\n`;
            if (item.due_context) msg += `   \u23F0 ${item.due_context}\n`;
            msg += `   Age: ${item.age_days}d | Status: ${item.status}\n\n`;
          }
          if (allItems.length > 15) msg += `_...and ${allItems.length - 15} more items_`;
          response = msg;
        }
      } else {
        const queue = memory.getFollowUpQueue(channelId, 'pending');
        if (queue.length === 0) {
          response = "\u{1F4C5} **Follow-up Queue (This Channel)**\n\n_No follow-up items pending for this channel._\n\nUse `!followup-queue all` to see items across all projects.";
        } else {
          let msg = `\u{1F4C5} **Follow-up Queue (This Channel)** - ${queue.length} item(s)\n\n`;
          for (const item of queue) {
            const age = Math.round((Date.now() - (item.created_at || 0)) / (24 * 60 * 60 * 1000));
            msg += `\u2022 **${item.title}**\n`;
            if (item.due_context) msg += `   \u23F0 ${item.due_context}\n`;
            msg += `   Age: ${age}d | Status: ${item.status}\n\n`;
          }
          msg += `\n_Use \`!followup-queue all\` to see items across all projects._`;
          response = msg;
        }
      }
      break;
    }

    // ===== DOCUMENT INDEX COMMANDS =====
    case 'docs': {
      const docsSubCmd = (cmd.args[0] || 'stats').toLowerCase();
      const docsArg = cmd.args[1] || '';

      if (docsSubCmd === 'stats') {
        const stats = await pdfUtils.getVectorStats(channelId);
        if (!stats) {
          response = "\u{1F4DA} **Document Index**\n\n_Vector store not available._";
        } else if (stats.totalChunks === 0) {
          response = "\u{1F4DA} **Document Index**\n\n_No documents indexed yet._\n\nUpload PDFs or DOCX files to enable semantic search.";
        } else {
          let msg = `\u{1F4DA} **Document Index Stats**\n\n`;
          msg += `\u2022 **Total chunks indexed:** ${stats.totalChunks}\n`;
          msg += `\u2022 **Documents:** ${stats.documents}\n\n`;
          if (Object.keys(stats.byFile).length > 0) {
            msg += `**By Document:**\n`;
            for (const [file, count] of Object.entries(stats.byFile)) {
              msg += `\u2022 ${file}: ${count} chunks\n`;
            }
          }
          msg += `\n_Use \`!docs search [query]\` to find relevant content._`;
          response = msg;
        }
      } else if (docsSubCmd === 'list') {
        const vectorStore = await import('../../shared/vectorstore.js');
        const docs = await vectorStore.listDocuments(channelId);
        if (!docs || docs.length === 0) {
          response = "\u{1F4DA} **Indexed Documents (This Channel)**\n\n_No documents indexed._";
        } else {
          let msg = `\u{1F4DA} **Indexed Documents (This Channel)** - ${docs.length} document(s)\n\n`;
          for (const doc of docs) {
            const date = new Date(doc.createdAt).toLocaleDateString();
            msg += `\u2022 **${doc.fileName}** - ${doc.chunks} chunks (${date})\n`;
          }
          response = msg;
        }
      } else if (docsSubCmd === 'search' && docsArg) {
        const results = await pdfUtils.searchDocuments(docsArg, { channelId, limit: 5 });
        if (!results || results.length === 0) {
          response = `\u{1F50D} **Document Search:** "${docsArg}"\n\n_No matching content found._`;
        } else {
          let msg = `\u{1F50D} **Document Search:** "${docsArg}"\n\n`;
          for (const r of results) {
            const source = r.section ? `${r.fileName} > ${r.section}` : r.fileName;
            const score = (r.score * 100).toFixed(0);
            msg += `**[${score}%] ${source}**\n`;
            msg += `> ${r.text.substring(0, 300)}${r.text.length > 300 ? '...' : ''}\n\n`;
          }
          response = msg;
        }
      } else {
        response = `\u{1F4DA} **Document Index Commands**\n\n\u2022 \`!docs\` or \`!docs stats\` - Show index statistics\n\u2022 \`!docs list\` - List indexed documents\n\u2022 \`!docs search [query]\` - Search document content`;
      }
      break;
    }

    // ===== SEMANTIC MEMORY COMMANDS =====
    case 'memory': {
      const memSubCmd = (cmd.args[0] || 'stats').toLowerCase();
      const memArg = cmd.args[1] || '';

      if (memSubCmd === 'stats') {
        try {
          const stats = await semanticMemory.getStats();
          let msg = `\u{1F9E0} **Semantic Memory Stats**\n\n`;
          msg += `**Documents:**\n`;
          msg += `\u2022 Files: ${stats.documents.files}\n`;
          msg += `\u2022 Chunks: ${stats.documents.chunks}\n\n`;
          msg += `**Conversations:**\n`;
          msg += `\u2022 Messages: ${stats.conversations.messages}\n`;
          msg += `\u2022 Channels: ${stats.conversations.channels}\n`;
          msg += `\u2022 Users: ${stats.conversations.users}\n\n`;
          msg += `**Knowledge Graph:**\n`;
          msg += `\u2022 Nodes: ${stats.graph.nodes}\n`;
          msg += `\u2022 Edges: ${stats.graph.edges}\n`;
          if (stats.graph.byType) {
            msg += `\u2022 Types: ${Object.entries(stats.graph.byType).map(([k,v]) => `${k}(${v})`).join(', ')}\n`;
          }
          response = msg;
        } catch (err) {
          response = `\u{1F9E0} **Semantic Memory**\n\n_Error getting stats: ${err.message}_`;
        }
      } else if (memSubCmd === 'search' && memArg) {
        try {
          const results = await semanticMemory.search(memArg, { limit: 5 });
          let msg = `\u{1F50D} **Memory Search:** "${memArg}"\n\n`;

          if (results.conversations.length > 0) {
            msg += `**Conversations:**\n`;
            for (const r of results.conversations.slice(0, 3)) {
              const date = new Date(r.timestamp).toLocaleDateString();
              const score = (r.score * 100).toFixed(0);
              msg += `\u2022 [${score}%] **${r.userName}** in #${r.channelName} (${date})\n`;
              msg += `  > ${r.text.substring(0, 150)}${r.text.length > 150 ? '...' : ''}\n`;
            }
          }

          if (results.documents.length > 0) {
            msg += `\n**Documents:**\n`;
            for (const r of results.documents.slice(0, 3)) {
              const score = (r.score * 100).toFixed(0);
              msg += `\u2022 [${score}%] **${r.fileName}**\n`;
              msg += `  > ${r.text.substring(0, 150)}${r.text.length > 150 ? '...' : ''}\n`;
            }
          }

          if (results.conversations.length === 0 && results.documents.length === 0) {
            msg += `_No matching content found._`;
          }
          response = msg;
        } catch (err) {
          response = `\u{1F50D} **Memory Search**\n\n_Error: ${err.message}_`;
        }
      } else if (memSubCmd === 'graph' && memArg) {
        try {
          const personContext = await semanticMemory.getPersonContext(memArg);
          let msg = `\u{1F578}\uFE0F **Knowledge Graph:** ${memArg}\n\n`;
          if (personContext.topics.length > 0) {
            msg += `**Topics mentioned:** ${personContext.topics.slice(0, 10).join(', ')}\n`;
          }
          if (personContext.decisions.length > 0) {
            msg += `**Decisions:** ${personContext.decisions.length}\n`;
          }
          if (personContext.mentions.length > 0) {
            msg += `**Mentions:** ${personContext.mentions.length}\n`;
          }
          if (personContext.topics.length === 0 && personContext.decisions.length === 0) {
            msg += `_No graph data found for "${memArg}"._`;
          }
          response = msg;
        } catch (err) {
          response = `\u{1F578}\uFE0F **Knowledge Graph**\n\n_Error: ${err.message}_`;
        }
      } else {
        response = `\u{1F9E0} **Semantic Memory Commands**\n\n\u2022 \`!memory\` or \`!memory stats\` - Show memory statistics\n\u2022 \`!memory search [query]\` - Search conversations & documents\n\u2022 \`!memory graph [userId]\` - Show knowledge graph for a user`;
      }
      break;
    }
  }

  return response;
}
