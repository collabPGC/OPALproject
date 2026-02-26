/**
 * Coaching Engine — LLM-powered, batched, cooldown-aware follow-ups
 *
 * Instead of generic template nudges, this module:
 *   1. Groups pending milestones by owner (one message per person, not per milestone)
 *   2. Picks the #1 priority milestone for each owner
 *   3. Uses the assigned persona's LLM to generate real coaching
 *   4. Sends via DM (not just the ops channel)
 *   5. Tracks nudge cooldowns (every 3 days, not daily)
 *
 * The coaching is interactive: the agent uses its domain knowledge to
 * research the HOW, provide tips, suggest next actions, and invite questions.
 */

import fs from 'fs';
import * as mm from 'bots-shared/mattermost.js';
import { FOUNDER_CONTEXT } from 'bots-shared/proactive-behavior.js';
import personaRouter from '../persona-router.js';
import programState from './program-state.js';

const NUDGE_STATE_FILE = '/mnt/volume_nyc3_01/institutional-memory/nudge-state.json';
const COOLDOWN_DAYS = 3;

const AGENT_TO_PERSONA = {
  'Athena': 'strategist', 'Priya': 'product-owner', 'Maya': 'growth-lead',
  'Rex': 'sales-bd', 'Kai': 'finance-analyst', 'Suki': 'compliance-ops',
  'Marcus': 'software-architect', 'Helena': 'enterprise-architect',
  'Cyrus': 'security-architect', 'Nimbus': 'cloud-architect',
  'Vera': 'healthcare-analyst', 'Dr. Claire': 'clinical-advisor',
  'Tensor': 'ml-engineer', 'Regina': 'regulatory-affairs',
};

// Owner name → Mattermost user ID (for DMs)
const OWNER_USER_IDS = {
  'Ruth': '9gy8ry96jbbexg8umzxuijsq1c',
  'Hubert': 'hes9xx7m7byb88o7za7883x76o',
  'Alex': 'gquh1hq5jfdyxqu3uwindqdorr',
  'Kwaku': 'ecnwcntig38y8eus5o4a8tu3ur',
};

let logger = () => {};
let opsChannelId = null;
let botUserId = null;

export function init(log, channelId, botId) {
  logger = log || (() => {});
  opsChannelId = channelId;
  botUserId = botId;
}

export function setOpsChannel(channelId) { opsChannelId = channelId; }
export function setBotUserId(id) { botUserId = id; }

/**
 * Main entry point — called by the 2 PM cron.
 */
export async function runCoachingCycle() {
  const nudgeState = loadNudgeState();
  const pendingByOwner = groupPendingByOwner();

  if (Object.keys(pendingByOwner).length === 0) {
    logger('info', '[coaching] No milestones need follow-up');
    return 0;
  }

  let sent = 0;

  for (const [owner, milestones] of Object.entries(pendingByOwner)) {
    // Check cooldown
    const lastNudge = nudgeState[owner]?.lastNudgedAt;
    if (lastNudge) {
      const daysSinceLast = (Date.now() - new Date(lastNudge).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLast < COOLDOWN_DAYS) {
        logger('info', '[coaching] Skipping (cooldown)', { owner, daysSinceLast: Math.floor(daysSinceLast) });
        continue;
      }
    }

    // Pick highest-priority milestone (tier 0 first, then lowest WS id, then lowest ms id)
    const priority = pickPriority(milestones);
    const otherCount = milestones.length - 1;

    try {
      const message = await generateCoachingMessage(owner, priority, otherCount, milestones);
      await sendCoachingDM(owner, message);
      if (opsChannelId) {
        await mm.postMessage(opsChannelId,
          `**Atlas** :compass: Sent coaching DM to **${owner}** — focused on **${priority.id}: ${priority.title}**` +
          (otherCount > 0 ? ` (+${otherCount} other pending)` : '')
        );
      }
      nudgeState[owner] = { lastNudgedAt: new Date().toISOString(), milestone: priority.id };
      sent++;
    } catch (err) {
      logger('error', '[coaching] Failed for owner', { owner, error: err.message });
    }
  }

  saveNudgeState(nudgeState);
  return sent;
}

/**
 * Group all produced-but-not-done milestones by owner.
 * Only includes milestones produced >= 2 days ago.
 */
function groupPendingByOwner() {
  const workstreams = programState.getAllWorkstreams();
  const byOwner = {};

  for (const ws of workstreams) {
    for (const ms of ws.milestones) {
      if (!ms.deliverables || ms.deliverables.length === 0) continue;
      if (ms.status === 'completed') continue;

      const match = ms.notes?.match(/Agent-produced (\d{4}-\d{2}-\d{2})/);
      if (!match) continue;

      const producedDate = new Date(match[1]);
      const daysSince = (Date.now() - producedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 2) continue;

      const owner = ms.owner || 'Unknown';
      if (!byOwner[owner]) byOwner[owner] = [];
      byOwner[owner].push({
        ...ms,
        wsId: ws.id,
        wsName: ws.name,
        wsTier: ws.tier,
        daysSince: Math.floor(daysSince),
      });
    }
  }

  return byOwner;
}

/**
 * Pick the single most important milestone for an owner.
 * Priority: tier 0 > tier 1 > tier 2, then oldest first.
 */
function pickPriority(milestones) {
  return milestones.sort((a, b) => {
    const tierDiff = (a.wsTier ?? 99) - (b.wsTier ?? 99);
    if (tierDiff !== 0) return tierDiff;
    return b.daysSince - a.daysSince; // oldest produced first
  })[0];
}

/**
 * Generate a real coaching message using the persona's LLM.
 * This is NOT a template — the agent uses its domain expertise.
 */
async function generateCoachingMessage(owner, priority, otherCount, allMilestones) {
  const { default: llm } = await import('bots-shared/llm.js');
  const agent = priority.agents?.[0] || 'Atlas';
  const personaKey = AGENT_TO_PERSONA[agent] || 'strategist';
  const agentCmd = `!${agent.toLowerCase().replace('dr. ', '')}`;

  const systemPrompt = personaRouter.buildSystemPrompt(personaKey);

  const userPrompt = buildCoachingPrompt(owner, agent, agentCmd, priority, otherCount, allMilestones);

  try {
    const result = await llm.general(
      [{ role: 'user', content: userPrompt }],
      { system: systemPrompt + COACHING_SYSTEM_ADDENDUM, max_tokens: 1500 }
    );
    return result.text || fallbackMessage(owner, agent, agentCmd, priority);
  } catch (err) {
    logger('error', '[coaching] LLM failed, using fallback', { error: err.message });
    return fallbackMessage(owner, agent, agentCmd, priority);
  }
}

function buildCoachingPrompt(owner, agent, agentCmd, priority, otherCount, allMilestones) {
  const otherList = allMilestones
    .filter(m => m.id !== priority.id)
    .map(m => `  - ${m.id}: ${m.title} (${m.daysSince}d ago)`)
    .join('\n');

  return `You are ${agent}, personally checking in with ${owner} via DM.

## Context
I produced a deliverable for **${priority.id}: ${priority.title}** ${priority.daysSince} days ago.
It's part of Workstream ${priority.wsId}: ${priority.wsName} (Tier ${priority.wsTier ?? '?'}).
${owner} hasn't marked it done or responded yet.
${otherCount > 0 ? `\n${owner} also has ${otherCount} other pending deliverable(s):\n${otherList}\n` : ''}

## Your Task
Write a SHORT coaching DM (under 800 chars) to ${owner}. This is a Mattermost DM, not a formal report.

**DO:**
- Open with something warm and specific (not "hope you're well")
- Name the ONE most important thing ${owner} should do TODAY for milestone ${priority.id}
- Break that one thing into 2-3 sub-steps so small they feel obvious. Example: "Step 1: open the doc I sent. Step 2: read just the stakeholder map on page 2. Step 3: circle the 2 names you recognize. That's it — 10 minutes."
- Be specific about HOW — use your domain expertise. If this is about hospital outreach, tell them who to call and what to say. If it's about regulatory, tell them exactly which section to read and what to look for.
- Give a concrete tip or insider insight from your domain
- Normalize that this is unfamiliar: "${owner} has likely never done this exact thing before — acknowledge that and make it feel doable"
- Offer to do it TOGETHER right now: "Want to draft that email with me? Just tell me what you want to say and I'll shape it"
- Invite a response: ask ONE specific question about what's making it hard to start
- Mention they can work through it interactively: \`@gtm-team ${agentCmd}\`

**DON'T:**
- List multiple milestones — focus on the #1 priority only${otherCount > 0 ? `\n- Mention the other ${otherCount} milestones (I'll handle those next time)` : ''}
- Use headers, bullet walls, or formal structure — write like a person
- Say "checking in" or "gentle reminder" — be direct and helpful
- Assume they're ignoring you — assume they don't know where to start
- Present multiple options — give ONE clear recommendation
- Include completion commands or bot syntax — just talk naturally`;
}

const COACHING_SYSTEM_ADDENDUM = `

${FOUNDER_CONTEXT}

## DM Coaching Mode
You are writing a personal DM to a colleague, not a formal document.
Be warm, specific, and actionable. Write 3-5 short paragraphs max.
Use your deep domain expertise to give genuinely useful advice — the kind
a senior mentor would share over coffee. End with ONE question that invites
dialogue, not a list of options.
Remember: if they haven't acted, it's almost certainly because they don't
know where to start — not because they don't care. Make the first step
so small and concrete it feels impossible NOT to do.`;

/**
 * Fallback message if LLM fails — still better than the old template.
 */
function fallbackMessage(owner, agent, agentCmd, ms) {
  return (
    `Hey ${owner} — ${agent} here. Quick note about **${ms.id}: ${ms.title}** ` +
    `which I put together ${ms.daysSince} days ago.\n\n` +
    `I know things are busy, so here's my suggestion: just look at the first action item ` +
    `in the deliverable. It should take about 15 minutes. If something doesn't make sense ` +
    `or doesn't match what you're seeing on the ground, tell me — I'll adjust.\n\n` +
    `Whenever you're ready to work through it together, just ping me: \`@gtm-team ${agentCmd}\``
  );
}

/**
 * Send coaching message as a DM to the owner.
 */
async function sendCoachingDM(owner, message) {
  const userId = OWNER_USER_IDS[owner];
  if (!userId) {
    logger('warn', '[coaching] No user ID for owner, posting to ops channel', { owner });
    if (opsChannelId) await mm.postMessage(opsChannelId, `**${owner}** (no DM available):\n\n${message}`);
    return;
  }

  if (!botUserId) {
    // Try to get it
    botUserId = await mm.getBotUserId();
  }

  if (!botUserId) {
    logger('error', '[coaching] Cannot send DM — no bot user ID');
    if (opsChannelId) await mm.postMessage(opsChannelId, `**${owner}** (DM failed):\n\n${message}`);
    return;
  }

  try {
    // Create or get DM channel
    const dmChannel = await mm.mmApi('/channels/direct', 'POST', [botUserId, userId]);
    await mm.postMessage(dmChannel.id, message);
    logger('info', '[coaching] DM sent', { owner, channelId: dmChannel.id });
  } catch (err) {
    logger('error', '[coaching] DM failed, posting to ops channel', { owner, error: err.message });
    if (opsChannelId) await mm.postMessage(opsChannelId, `**${owner}** (DM failed):\n\n${message}`);
  }
}

// ── Nudge state persistence ──

function loadNudgeState() {
  try {
    if (fs.existsSync(NUDGE_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(NUDGE_STATE_FILE, 'utf8'));
    }
  } catch (err) {
    logger('warn', '[coaching] Failed to load nudge state', { error: err.message });
  }
  return {};
}

function saveNudgeState(nudgeState) {
  try {
    fs.writeFileSync(NUDGE_STATE_FILE, JSON.stringify(nudgeState, null, 2));
  } catch (err) {
    logger('error', '[coaching] Failed to save nudge state', { error: err.message });
  }
}

export default { init, setOpsChannel, setBotUserId, runCoachingCycle };
