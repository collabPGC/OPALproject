// Command parsing and legacy command switch for Spark bot

import { brainstormSCAMPER, brainstormSixHats, brainstormHMW } from './brainstorm.js';
import { startStandup, endStandup } from './standup.js';
import { startRetro } from './retro.js';
import { generateIcebreaker, celebrateWin, generateTutorial, planFollowUp, getSparkCheerMessage } from './engagement.js';
import { handleJiraRequest, generateJiraIssue, createJiraStory, createJiraBug, createJiraTask } from './jira.js';
import { onboardRepository, refreshAllRepos, getGithubContext, generateRepoSummary, generateCodebaseContext } from './github.js';
import { addReaction } from './files.js';
import { getChannelPrefs, savePreferences } from '../utils/state.js';
import { getSparkCheerMessage as getCheerMsg } from '../utils/responses.js';

// Parse command from message text
export function parseCommand(message) {
  const commands = {
    standup: /^!standup\s*(start|end)?$/i,
    scamper: /^!scamper\s+(.+)/i,
    sixhats: /^!sixhats\s+(.+)/i,
    hmw: /^!hmw\s+(.+)/i,
    retro: /^!retro\s*(standard|starfish|sailboat)?$/i,
    icebreaker: /^!icebreaker$/i,
    celebrate: /^!celebrate\s+(.+)/i,
    tutorial: /^!tutorial\s+(.+)/i,
    help: /^!spark\s*help$/i,
    config: /^!config$/i,
    setengagement: /^!setengagement\s+(low|medium|high)$/i,
    setretro: /^!setretro\s+(standard|starfish|sailboat)$/i,
    setbrainstorm: /^!setbrainstorm\s+(scamper|sixhats|hmw|mixed)$/i,
    feedback: /^!feedback\s+(.+)/i,
    askme: /^!askme$/i,
    remindme: /^!remindme\s+(\d+\s*(?:m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days))\s+(.+)/i,
    teamremind: /^!teamremind\s+(\d+\s*(?:m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days))\s+(.+)/i,
    followup: /^!followup\s+(.+)/i,
    cheer: /^!cheer\s+(.+)/i,
    pin: /^!pin$/i,
    // Jira
    story: /^!story\s+(.+)/i,
    bug: /^!bug\s+(.+)/i,
    task: /^!task\s+(.+)/i,
    jira: /^!jira\s+(.+)/i,
    backlog: /^!backlog\s+(.+)/i,
    // GitHub onboarding
    onboard: /^!onboard\s+(.+)/i,
    repos: /^!repos$/i,
    refresh: /^!refresh$/i,
    codebase: /^!codebase$/i,
    pr: /^!pr\s*(\d+)?/i,
    issues: /^!issues\s*(.*)/i,
    // Semantic memory
    memory: /^!memory(?:\s+(stats|search|graph)\s*(.*))?$/i
  };

  for (const [cmd, pattern] of Object.entries(commands)) {
    const match = message.match(pattern);
    if (match) {
      return { command: cmd, args: match.slice(1) };
    }
  }
  return null;
}

// Show config
function showConfig(channelId) {
  const prefs = getChannelPrefs(channelId);
  return `**Spark Configuration for this channel:**

**Engagement Level:** ${prefs.engagementLevel}
**Default Retro Format:** ${prefs.retroFormat}
**Brainstorm Style:** ${prefs.brainstormStyle}
**Icebreakers:** ${prefs.icebreakersEnabled ? 'Enabled' : 'Disabled'}
**Celebrations:** ${prefs.celebrationsEnabled ? 'Enabled' : 'Disabled'}

**Commands to customize:**
- \`!setengagement low|medium|high\` - How actively I engage
- \`!setretro standard|starfish|sailboat\` - Default retro format
- \`!setbrainstorm scamper|sixhats|hmw|mixed\` - Preferred brainstorm style
- \`!feedback [message]\` - Tell me what to improve
- \`!askme\` - I'll ask what you'd like me to do better`;
}

// Ask for preferences
function askForPreferences(channelId) {
  return `**I'd love to work better for your team!**

A few questions:
1. **How engaged should I be?** (low / medium / high)
2. **Preferred retro format?** (standard / starfish / sailboat)
3. **Favorite brainstorm technique?** (scamper / sixhats / hmw / mixed)
4. **What could I do better?** Any feedback on how I facilitate?

Just reply with any of these:
- \`!setengagement high\` - I'll be more actively involved
- \`!setretro starfish\` - I'll default to Starfish retros
- \`!setbrainstorm sixhats\` - I'll lean toward Six Hats technique
- \`!feedback shorter standups please\` - I'll adjust my approach

What would you like to tweak?`;
}

// Reminders - imported from shared module
import { createReminderManager } from 'bots-shared/reminders.js';

// Lazy-initialized reminder manager (needs postMessage from ctx)
let _reminderManager = null;
function getReminderManager(postMessage) {
  if (!_reminderManager) {
    _reminderManager = createReminderManager(postMessage);
  }
  return _reminderManager;
}

async function setReminder(channelId, userId, timeStr, message, ctx) {
  const mgr = getReminderManager(ctx.postMessage);
  return mgr.setReminder(channelId, userId, timeStr, message);
}

async function setTeamReminder(channelId, timeStr, message, ctx) {
  const mgr = getReminderManager(ctx.postMessage);
  return mgr.setTeamReminder(channelId, timeStr, message);
}

// Pin message
async function pinMessage(postId, ctx) {
  const { mmApi, log } = ctx;
  try {
    await mmApi(`/posts/${postId}/pin`, 'POST');
    return true;
  } catch (error) {
    log('error', 'Failed to pin message', { error: error.message });
    return false;
  }
}

// Main command handler
export async function handleCommand(cmd, post, ctx) {
  const {
    config, anthropic, state, log, mmApi, postMessage, postWithSplitting,
    memory, semanticMemory, emitToInstitutionalMemory, fetchChannelHistory,
    commandRouter
  } = ctx;

  const channelId = post.channel_id;
  let response = null;
  const replyTo = post.root_id || post.id;

  // Try modular router first (skills, workflows, documents)
  if (commandRouter && commandRouter.isRouterCommand(cmd.command)) {
    try {
      log('info', 'Using modular router for command', { command: cmd.command });
      await postMessage(channelId, `Processing \`!${cmd.command}\`...`, replyTo);

      const routerHistory = await fetchChannelHistory(channelId, 50);
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
        botName: 'spark',
        channelContext: routerChannelContext,
        semanticContext: routerSemanticContext,
        depth: 'standard',
        logFn: (msg) => log('info', msg)
      });

      if (routerResult) {
        await postWithSplitting(channelId, routerResult.text, replyTo, cmd.command);
        emitToInstitutionalMemory(cmd.command, cmd.args?.join(' '), routerResult.text, channelId, post.id);
        return null; // Command handled by router
      }
    } catch (routerErr) {
      log('error', 'Router failed, falling through to legacy', { error: routerErr.message });
    }
  }

  // Legacy command handling
  switch (cmd.command) {
    case 'standup':
      if (cmd.args[0]?.toLowerCase() === 'end') {
        response = await endStandup(channelId, ctx);
      } else {
        await startStandup(channelId, ctx);
        return null;
      }
      break;

    case 'scamper':
      await postMessage(channelId, "Applying SCAMPER technique...", replyTo);
      const scamperResult = await brainstormSCAMPER(cmd.args[0], ctx);
      await postWithSplitting(channelId, scamperResult, replyTo, 'scamper');
      emitToInstitutionalMemory('scamper', cmd.args[0], scamperResult, channelId, post.id);
      break;

    case 'sixhats':
      await postMessage(channelId, "Putting on the Six Thinking Hats...", replyTo);
      const sixhatsResult = await brainstormSixHats(cmd.args[0], ctx);
      await postWithSplitting(channelId, sixhatsResult, replyTo, 'sixhats');
      emitToInstitutionalMemory('sixhats', cmd.args[0], sixhatsResult, channelId, post.id);
      break;

    case 'hmw':
      await postMessage(channelId, "Generating How Might We questions...", replyTo);
      const hmwResult = await brainstormHMW(cmd.args[0], ctx);
      await postWithSplitting(channelId, hmwResult, replyTo, 'hmw');
      emitToInstitutionalMemory('hmw', cmd.args[0], hmwResult, channelId, post.id);
      break;

    case 'retro':
      await startRetro(channelId, cmd.args[0] || 'standard', ctx);
      return null;

    case 'icebreaker': {
      const icebreaker = generateIcebreaker();
      response = `**Icebreaker Time!** \n\n${icebreaker}`;
      break;
    }

    case 'celebrate':
      response = await celebrateWin(channelId, cmd.args[0], ctx);
      break;

    case 'tutorial':
      await postMessage(channelId, "Creating tutorial...", replyTo);
      response = await generateTutorial(cmd.args[0], ctx);
      break;

    case 'help':
      response = `## \u26a1 Spark Commands

**Standups & Retros:**
\u2022 \`!standup start\` / \`!standup end\` - Facilitate standup
\u2022 \`!retro [format]\` - Run retrospective (standard/starfish/sailboat)

**Brainstorming:**
\u2022 \`!scamper [topic]\` - SCAMPER innovation technique
\u2022 \`!sixhats [topic]\` - Six Thinking Hats analysis
\u2022 \`!hmw [topic]\` - How Might We questions

**Polls & Consensus:**
\u2022 \`!poll "Question?" "Opt1" "Opt2"\` - Multi-option poll
\u2022 \`!quickpoll yesno|agree|priority|team [question]\` - Quick poll
\u2022 \`!vote [question]\` - Simple yes/no vote
\u2022 \`!consensus "Decision" "Opt1" "Opt2"\` - Get team alignment (with follow-up)
\u2022 \`!polls\` - List recent polls in this channel
\u2022 \`!pollresults <poll-id>\` - View results of a specific poll

**Engagement:**
\u2022 \`!icebreaker\` - Fun team question
\u2022 \`!celebrate [win]\` - Celebrate achievement
\u2022 \`!cheer [person/team]\` - Shoutout someone
\u2022 \`!tutorial [topic]\` - Quick how-to guide

**Planning:**
\u2022 \`!followup [topic]\` - Create a follow-up plan
\u2022 \`!remindme [time] [msg]\` - Personal reminder
\u2022 \`!teamremind [time] [msg]\` - Team-wide reminder
\u2022 \`!pin\` - Pin a message (reply to it)

**Jira Backlog:**
\u2022 \`!story [description]\` - Create a User Story with acceptance criteria
\u2022 \`!bug [description]\` - Create a Bug with steps to reproduce
\u2022 \`!task [description]\` - Create a Task
\u2022 \`!backlog [description]\` - Auto-detect type and create issue

**GitHub & Codebase:**
\u2022 \`!onboard owner/repo\` - Onboard a repository
\u2022 \`!repos\` - List tracked repositories
\u2022 \`!codebase\` - Show full codebase overview
\u2022 \`!pr [number]\` - List PRs or view specific PR
\u2022 \`!issues [filter]\` - List issues (optional filter)
\u2022 \`!refresh\` - Refresh all repository data

**Settings:**
\u2022 \`!config\` - View settings
\u2022 \`!askme\` - Let me ask what to improve

_Or just @spark me with any question!_`;
      break;

    case 'config':
      response = showConfig(channelId);
      break;

    case 'askme':
      response = askForPreferences(channelId);
      break;

    case 'setengagement': {
      const engagement = cmd.args[0].toLowerCase();
      const prefsEng = getChannelPrefs(channelId);
      prefsEng.engagementLevel = engagement;
      savePreferences(log);
      response = `\u2705 Engagement level set to **${engagement}**. ${engagement === 'low' ? "I'll be more hands-off." : engagement === 'high' ? "I'll be more actively involved!" : "I'll balance my involvement."}`;
      break;
    }

    case 'setretro': {
      const retroFmt = cmd.args[0].toLowerCase();
      const prefsRetro = getChannelPrefs(channelId);
      prefsRetro.retroFormat = retroFmt;
      savePreferences(log);
      response = `\u2705 Default retro format set to **${retroFmt}**. I'll use this when you run \`!retro\` without specifying a format.`;
      break;
    }

    case 'setbrainstorm': {
      const bsStyle = cmd.args[0].toLowerCase();
      const prefsBS = getChannelPrefs(channelId);
      prefsBS.brainstormStyle = bsStyle;
      savePreferences(log);
      response = `\u2705 Brainstorm style preference set to **${bsStyle}**. ${bsStyle === 'mixed' ? "I'll suggest different techniques based on context." : `I'll lean toward ${bsStyle.toUpperCase()} when brainstorming.`}`;
      break;
    }

    case 'feedback': {
      const feedbackMsg = cmd.args[0];
      const prefsFB = getChannelPrefs(channelId);
      prefsFB.feedback.push({
        message: feedbackMsg,
        timestamp: Date.now()
      });
      savePreferences(log);
      response = `Thank you for the feedback! I've noted: **"${feedbackMsg}"**\n\nI'll work on improving. Your input helps me facilitate better!`;
      break;
    }

    case 'remindme':
      response = await setReminder(channelId, post.user_id, cmd.args[0], cmd.args[1], ctx);
      break;

    case 'teamremind':
      response = await setTeamReminder(channelId, cmd.args[0], cmd.args[1], ctx);
      break;

    case 'followup': {
      const followupTopic = cmd.args[0];
      await postMessage(channelId, "\ud83d\udccb Creating follow-up plan...", replyTo);
      response = await planFollowUp(channelId, followupTopic, ctx);
      emitToInstitutionalMemory('followup', followupTopic, response, channelId, post.id);
      break;
    }

    case 'cheer': {
      const cheerTarget = cmd.args[0];
      await addReaction(post.id, 'tada', ctx);
      response = `\ud83c\udf89 **Shoutout to ${cheerTarget}!**\n\n${getSparkCheerMessage()}`;
      break;
    }

    case 'pin':
      if (post.root_id) {
        const pinned = await pinMessage(post.root_id, ctx);
        response = pinned ? "\ud83d\udccc Message pinned!" : "Couldn't pin that message.";
      } else {
        response = "Reply to a message with `!pin` to pin it.";
      }
      break;

    // ===== JIRA COMMANDS =====
    case 'story':
      if (!config.jira?.enabled) {
        response = "\u274c Jira integration is not configured. Ask your admin to set up Jira in config.json.";
      } else {
        const storyRequest = cmd.args[0];
        await postMessage(channelId, "\ud83d\udcdd Creating Jira Story...", replyTo);
        const storyData = await generateJiraIssue(storyRequest, 'Story', ctx);
        if (storyData) {
          const result = await createJiraStory(storyData.summary, storyData.description, storyData.acceptanceCriteria || '', ctx);
          if (result.success) {
            response = `\u2705 **Story Created!**\n\n\ud83d\udccb **${result.key}**: ${storyData.summary}\n\ud83d\udd17 [View in Jira](${result.url})\n\n**Acceptance Criteria:**\n${storyData.acceptanceCriteria || '_None specified_'}`;
          } else {
            response = `\u274c Failed to create story: ${result.error}`;
          }
        } else {
          response = "\u274c Couldn't process that request. Try: `!story As a user, I want to...`";
        }
      }
      break;

    case 'bug':
      if (!config.jira?.enabled) {
        response = "\u274c Jira integration is not configured. Ask your admin to set up Jira in config.json.";
      } else {
        const bugRequest = cmd.args[0];
        await postMessage(channelId, "\ud83d\udc1b Creating Jira Bug...", replyTo);
        const bugData = await generateJiraIssue(bugRequest, 'Bug', ctx);
        if (bugData) {
          const result = await createJiraBug(bugData.summary, bugData.description, bugData.stepsToReproduce || '', ctx);
          if (result.success) {
            response = `\u2705 **Bug Created!**\n\n\ud83d\udc1b **${result.key}**: ${bugData.summary}\n\ud83d\udd17 [View in Jira](${result.url})\n\n**Steps to Reproduce:**\n${bugData.stepsToReproduce || '_Please add steps to reproduce_'}`;
          } else {
            response = `\u274c Failed to create bug: ${result.error}`;
          }
        } else {
          response = "\u274c Couldn't process that request. Try: `!bug Login button doesn't work on mobile`";
        }
      }
      break;

    case 'task':
      if (!config.jira?.enabled) {
        response = "\u274c Jira integration is not configured. Ask your admin to set up Jira in config.json.";
      } else {
        const taskRequest = cmd.args[0];
        await postMessage(channelId, "\ud83d\udccc Creating Jira Task...", replyTo);
        const taskData = await generateJiraIssue(taskRequest, 'Task', ctx);
        if (taskData) {
          const result = await createJiraTask(taskData.summary, taskData.description, ctx);
          if (result.success) {
            response = `\u2705 **Task Created!**\n\n\ud83d\udccc **${result.key}**: ${taskData.summary}\n\ud83d\udd17 [View in Jira](${result.url})`;
          } else {
            response = `\u274c Failed to create task: ${result.error}`;
          }
        } else {
          response = "\u274c Couldn't process that request. Try: `!task Update dependencies to latest versions`";
        }
      }
      break;

    case 'jira':
    case 'backlog':
      if (!config.jira?.enabled) {
        response = "\u274c Jira integration is not configured. Ask your admin to set up Jira in config.json.";
      } else {
        const backlogRequest = cmd.args[0];
        await postMessage(channelId, "\ud83d\udccb Creating backlog item...", replyTo);
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
            const typeEmoji = { Story: '\ud83d\udccb', Bug: '\ud83d\udc1b', Task: '\ud83d\udccc' };
            response = `\u2705 **${issueType} Created!**\n\n${typeEmoji[issueType]} **${result.key}**: ${backlogData.summary}\n\ud83d\udd17 [View in Jira](${result.url})`;
          } else {
            response = `\u274c Failed to create ${issueType.toLowerCase()}: ${result.error}`;
          }
        } else {
          response = "\u274c Couldn't process that request. Try describing what you need in plain language.";
        }
      }
      break;

    // ===== GITHUB ONBOARDING COMMANDS =====
    case 'onboard':
      if (!config.github?.enabled) {
        response = "\u274c GitHub integration is not configured. Add a GitHub token to config.json.";
      } else {
        const repoToOnboard = cmd.args[0].trim();
        await postMessage(channelId, `\ud83d\udd04 Onboarding **${repoToOnboard}**... This may take a moment.`, replyTo);
        const result = await onboardRepository(repoToOnboard, ctx);
        if (result.success) {
          response = `\u2705 **Repository Onboarded!**\n\n${result.summary}`;
        } else {
          response = `\u274c Failed to onboard: ${result.error}`;
        }
      }
      break;

    case 'repos': {
      if (!config.github?.enabled) {
        response = "\u274c GitHub integration is not configured.";
      } else {
        const ghCtx = getGithubContext();
        const trackedRepos = Object.keys(ghCtx.repos);
        if (trackedRepos.length === 0) {
          response = `\ud83d\udcc2 **No repositories onboarded yet.**\n\nUse \`!onboard owner/repo\` to add a repository.`;
        } else {
          response = `\ud83d\udcc2 **Tracked Repositories (${trackedRepos.length})**\n\n`;
          for (const repoName of trackedRepos) {
            const rCtx = ghCtx.repos[repoName];
            response += `\u2022 **${repoName}** - ${rCtx.techStack?.language || 'Unknown'} | ${rCtx.prs?.length || 0} PRs, ${rCtx.issues?.length || 0} issues\n`;
          }
          response += `\n_Last refresh: ${ghCtx.lastRefresh ? new Date(ghCtx.lastRefresh).toLocaleString() : 'Never'}_`;
        }
      }
      break;
    }

    case 'refresh':
      if (!config.github?.enabled) {
        response = "\u274c GitHub integration is not configured.";
      } else if (Object.keys(getGithubContext().repos).length === 0) {
        response = "No repositories to refresh. Use `!onboard owner/repo` first.";
      } else {
        await postMessage(channelId, "\ud83d\udd04 Refreshing all repositories...", replyTo);
        const results = await refreshAllRepos(ctx);
        const successful = results.filter(r => r.success).length;
        response = `\u2705 **Refresh Complete**\n\n${successful}/${results.length} repositories updated.\n_Last refresh: ${new Date().toLocaleString()}_`;
      }
      break;

    case 'codebase': {
      if (!config.github?.enabled) {
        response = "\u274c GitHub integration is not configured.";
      } else {
        const ghCtx = getGithubContext();
        if (Object.keys(ghCtx.repos).length === 0) {
          response = `\ud83d\udcc2 **No codebase context available.**\n\nOnboard repositories with \`!onboard owner/repo\` so I can help with code-aware facilitation.`;
        } else {
          const repos = Object.keys(ghCtx.repos);
          response = `## \ud83d\uddc2\ufe0f Codebase Overview\n\n`;
          response += `**${repos.length} repositories** tracked\n`;
          response += `_Last updated: ${ghCtx.lastRefresh ? new Date(ghCtx.lastRefresh).toLocaleString() : 'Unknown'}_\n\n`;

          for (const repoName of repos) {
            const rCtx = ghCtx.repos[repoName];
            if (!rCtx) continue;
            response += `### ${repoName}\n`;
            response += `${rCtx.info?.description || 'No description'}\n\n`;
            response += `**Stack:** ${rCtx.techStack?.language || 'Unknown'}`;
            if (rCtx.techStack?.frameworks?.length) response += ` | ${rCtx.techStack.frameworks.join(', ')}`;
            response += '\n';
            if (rCtx.structure?.directories?.length) {
              response += `**Dirs:** \`${rCtx.structure.directories.slice(0, 6).join('`, `')}\`${rCtx.structure.directories.length > 6 ? '...' : ''}\n`;
            }
            response += `**Activity:** ${rCtx.prs?.length || 0} open PRs, ${rCtx.issues?.length || 0} open issues\n`;
            if (rCtx.prs?.length > 0) {
              response += `**Top PRs:**\n`;
              rCtx.prs.slice(0, 3).forEach(pr => {
                response += `  \u2022 #${pr.number}: ${pr.title}\n`;
              });
            }
            response += '\n';
          }
          response += `\n_Use \`!pr [number]\` or \`!issues\` for more details._`;
        }
      }
      break;
    }

    case 'pr': {
      const ghCtx = getGithubContext();
      if (!config.github?.enabled || Object.keys(ghCtx.repos).length === 0) {
        response = "No codebase context. Use `!onboard owner/repo` first.";
      } else {
        const prNumber = cmd.args[0] ? parseInt(cmd.args[0]) : null;
        if (prNumber) {
          let foundPr = null;
          let foundRepo = null;
          for (const [repoName, rCtx] of Object.entries(ghCtx.repos)) {
            const pr = rCtx.prs?.find(p => p.number === prNumber);
            if (pr) { foundPr = pr; foundRepo = repoName; break; }
          }
          if (foundPr) {
            response = `## PR #${foundPr.number}: ${foundPr.title}\n\n`;
            response += `**Repo:** ${foundRepo}\n`;
            response += `**Author:** ${foundPr.author}\n`;
            response += `**Branch:** \`${foundPr.headBranch}\` \u2192 \`${foundPr.baseBranch}\`\n`;
            response += `**Status:** ${foundPr.draft ? '\ud83d\udcdd Draft' : '\ud83d\udfe2 Ready'}\n`;
            if (foundPr.labels?.length) response += `**Labels:** ${foundPr.labels.join(', ')}\n`;
            response += `**Created:** ${new Date(foundPr.createdAt).toLocaleDateString()}\n`;
            response += `\n\ud83d\udd17 [View on GitHub](${foundPr.url})`;
          } else {
            response = `PR #${prNumber} not found in tracked repositories.`;
          }
        } else {
          response = `## \ud83d\udccb Open Pull Requests\n\n`;
          let totalPrs = 0;
          for (const [repoName, rCtx] of Object.entries(ghCtx.repos)) {
            if (rCtx.prs?.length > 0) {
              response += `**${repoName}:**\n`;
              rCtx.prs.slice(0, 5).forEach(pr => {
                response += `  \u2022 #${pr.number}: ${pr.title} (${pr.author})${pr.draft ? ' \ud83d\udcdd' : ''}\n`;
                totalPrs++;
              });
            }
          }
          if (totalPrs === 0) {
            response = "No open PRs across tracked repositories.";
          }
        }
      }
      break;
    }

    case 'issues': {
      const ghCtx = getGithubContext();
      if (!config.github?.enabled || Object.keys(ghCtx.repos).length === 0) {
        response = "No codebase context. Use `!onboard owner/repo` first.";
      } else {
        const filter = cmd.args[0]?.toLowerCase() || '';
        response = `## \ud83d\udc1b Open Issues\n\n`;
        let totalIssues = 0;
        for (const [repoName, rCtx] of Object.entries(ghCtx.repos)) {
          let issues = rCtx.issues || [];
          if (filter) {
            issues = issues.filter(i =>
              i.labels.some(l => l.toLowerCase().includes(filter)) ||
              i.title.toLowerCase().includes(filter)
            );
          }
          if (issues.length > 0) {
            response += `**${repoName}:**\n`;
            issues.slice(0, 5).forEach(i => {
              const labels = i.labels.length ? ` [${i.labels.slice(0, 2).join(', ')}]` : '';
              response += `  \u2022 #${i.number}: ${i.title}${labels}\n`;
              totalIssues++;
            });
          }
        }
        if (totalIssues === 0) {
          response = filter
            ? `No issues matching "${filter}" in tracked repositories.`
            : "No open issues across tracked repositories.";
        } else {
          response += `\n_Filter: \`!issues bug\` or \`!issues feature\`_`;
        }
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
          let msg = `\ud83e\udde0 **Semantic Memory Stats**\n\n`;
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
          response = `\ud83e\udde0 **Semantic Memory**\n\n_Error getting stats: ${err.message}_`;
        }
      } else if (memSubCmd === 'search' && memArg) {
        try {
          const results = await semanticMemory.search(memArg, { limit: 5 });
          let msg = `\ud83d\udd0d **Memory Search:** "${memArg}"\n\n`;
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
          response = `\ud83d\udd0d **Memory Search**\n\n_Error: ${err.message}_`;
        }
      } else if (memSubCmd === 'graph' && memArg) {
        try {
          const personContext = await semanticMemory.getPersonContext(memArg);
          let msg = `\ud83d\udd78\ufe0f **Knowledge Graph:** ${memArg}\n\n`;
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
          response = `\ud83d\udd78\ufe0f **Knowledge Graph**\n\n_Error: ${err.message}_`;
        }
      } else {
        response = `\ud83e\udde0 **Semantic Memory Commands**\n\n\u2022 \`!memory\` or \`!memory stats\` - Show memory statistics\n\u2022 \`!memory search [query]\` - Search conversations & documents\n\u2022 \`!memory graph [userId]\` - Show knowledge graph for a user`;
      }
      break;
    }
  }

  return response;
}
