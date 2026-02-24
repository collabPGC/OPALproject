#!/usr/bin/env node

/**
 * Backfill Institutional Memory from Historical Mattermost Messages
 *
 * Queries PostgreSQL for substantive messages, classifies them via LLM,
 * and emits institutional memory events.
 *
 * Usage:
 *   node backfill-institutional-memory.js              # Full run
 *   node backfill-institutional-memory.js --dry-run    # Classify but don't emit
 *   node backfill-institutional-memory.js --channel brainstorming  # Single channel
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Lazy imports — only load heavy modules when needed
let modelRouter = null;
let institutionalMemory = null;

const DRY_RUN = process.argv.includes('--dry-run');
const SINGLE_CHANNEL = process.argv.includes('--channel')
  ? process.argv[process.argv.indexOf('--channel') + 1]
  : null;

const STATE_FILE = '/mnt/volume_nyc3_01/institutional-memory/backfill-state.json';
const BATCH_SIZE = 10;

const CHANNELS = [
  'whatsapp-brainstorming', 'investor-details', 'product-architecture',
  'esp-dev', 'opal-customers', 'off-topic', 'bot-details',
  'town-square', 'pm-dashboard',
];

const BOT_IDS = {
  'jcefztkyb3b8ikwh61piuke5sa': 'scout',
  'a1gfqnxmt7r7frrzaowehsgb5h': 'spark',
  'youbb9zomtnrfy5zktaruawurr': 'gtm-team',
};

// Channel → likely domain hint (helps the LLM classify)
const CHANNEL_DOMAIN_HINT = {
  'product-architecture': 'product',
  'opal-customers':       'gtm',
  'investor-details':     'finance',
  'esp-dev':              'engineering',
  'whatsapp-brainstorming':'strategy',
  'off-topic':            'strategy',
  'bot-details':          'operations',
  'town-square':          'strategy',
  'pm-dashboard':         'product',
};

// ─── Logging ───────────────────────────────────────────

function log(level, msg, data) {
  const ts = new Date().toISOString().slice(11, 19);
  const extra = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`[${ts}] ${level.toUpperCase().padEnd(5)} ${msg}${extra}`);
}

// ─── Database Queries ──────────────────────────────────

function queryPg(sql) {
  const escaped = sql.replace(/'/g, "'\\''");
  const cmd = `sudo -u postgres psql -d mattermost_test -t -A -F '|||' -c '${escaped}'`;
  try {
    const out = execSync(cmd, { maxBuffer: 50 * 1024 * 1024, encoding: 'utf8' });
    return out.trim().split('\n').filter(Boolean);
  } catch (err) {
    log('error', 'PostgreSQL query failed', { error: err.message });
    return [];
  }
}

function queryPgJson(sql) {
  const escaped = sql.replace(/'/g, "'\\''");
  const cmd = `sudo -u postgres psql -d mattermost_test -t -A -c '${escaped}'`;
  try {
    const out = execSync(cmd, { maxBuffer: 50 * 1024 * 1024, encoding: 'utf8' });
    return out.trim().split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  } catch (err) {
    log('error', 'PostgreSQL JSON query failed', { error: err.message });
    return [];
  }
}

// ─── State Management (idempotency) ───────────────────

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch {}
  return { processedPostIds: new Set(), stats: { processed: 0, emitted: 0, skipped: 0, errors: 0 } };
}

function saveState(state) {
  const serializable = {
    ...state,
    processedPostIds: [...state.processedPostIds],
    lastRun: new Date().toISOString(),
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(serializable, null, 2));
}

function hydrateState(raw) {
  return {
    ...raw,
    processedPostIds: new Set(raw.processedPostIds || []),
    stats: raw.stats || { processed: 0, emitted: 0, skipped: 0, errors: 0 },
  };
}

// ─── Message Fetching ──────────────────────────────────

function fetchHumanMessages(channelName) {
  const botIdList = Object.keys(BOT_IDS).map(id => `'${id}'`).join(',');
  const rows = queryPgJson(`
    SELECT json_build_object(
      'id', p.id,
      'message', p.message,
      'username', u.username,
      'userid', p.userid,
      'channel', c.name,
      'channelid', p.channelid,
      'rootid', p.rootid,
      'createat', p.createat
    )
    FROM posts p
    JOIN users u ON p.userid = u.id
    JOIN channels c ON p.channelid = c.id
    WHERE p.deleteat = 0 AND p.type = ''
      AND c.name = '${channelName}'
      AND p.userid NOT IN (${botIdList})
      AND u.username NOT IN ('github', 'jira', 'zoom', 'boards', 'playbooks')
      AND LENGTH(p.message) >= 200
    ORDER BY p.createat ASC
  `);
  return rows;
}

function fetchBotStructuredOutputs(channelName) {
  const rows = queryPgJson(`
    SELECT json_build_object(
      'id', p.id,
      'message', LEFT(p.message, 3000),
      'username', u.username,
      'userid', p.userid,
      'channel', c.name,
      'channelid', p.channelid,
      'rootid', p.rootid,
      'createat', p.createat
    )
    FROM posts p
    JOIN users u ON p.userid = u.id
    JOIN channels c ON p.channelid = c.id
    WHERE p.deleteat = 0 AND p.type = ''
      AND c.name = '${channelName}'
      AND p.userid IN ('jcefztkyb3b8ikwh61piuke5sa', 'a1gfqnxmt7r7frrzaowehsgb5h')
      AND LENGTH(p.message) >= 500
      AND (p.message LIKE '%## %' OR p.message LIKE '%**Research%' OR p.message LIKE '%**Brainstorm%'
           OR p.message LIKE '%**SCAMPER%' OR p.message LIKE '%Six Hats%' OR p.message LIKE '%How Might We%'
           OR p.message LIKE '%**Analysis%' OR p.message LIKE '%Executive Summary%'
           OR p.message LIKE '%# %')
    ORDER BY p.createat ASC
  `);
  return rows;
}

// ─── LLM Classification ───────────────────────────────

const CLASSIFICATION_SYSTEM = `You classify organizational messages into institutional memory events.

Valid event types: DECISION, DEBATE, PREDICTION, OUTCOME, ACTION, INSIGHT, ARTIFACT, MEETING, CONTEXT_CHANGE, OBJECTIVE, INITIATIVE, GAP, OBSERVATION

Valid domains: strategy, product, gtm, finance, compliance, operations, engineering, healthcare-systems, security, infrastructure, healthcare-industry, clinical, ai-ml, regulatory

For each message, return a JSON array of objects (one per message):
{
  "post_id": "<id>",
  "type": "<EVENT_TYPE>",
  "domain": "<domain>",
  "title": "<concise title, max 120 chars, imperative or noun-phrase>",
  "tags": ["tag1", "tag2"],
  "skip": false
}

Guidelines:
- Set "skip": true for trivial messages (greetings, short reactions, off-topic chatter, quotes without context)
- Set "skip": true for GitHub webhook notifications (subscriptions, push events)
- INSIGHT: Novel observations, research findings, connections between ideas
- ARTIFACT: Documents, reports, slide decks, summaries, deliverables
- DECISION: When someone decides or recommends a specific course of action
- ACTION: Explicit tasks, to-dos, next steps
- MEETING: Meeting notes, standup summaries, retrospectives
- PREDICTION: Forecasts about markets, timelines, outcomes
- CONTEXT_CHANGE: Market shifts, new competitors, pivots, team changes
- DEBATE: Arguments for/against something, pros and cons
- Use the channel domain hint but override it if the content clearly belongs elsewhere
- Return ONLY the JSON array, no markdown fences or explanation`;

async function classifyBatch(messages, channelName) {
  const domainHint = CHANNEL_DOMAIN_HINT[channelName] || 'strategy';

  const formatted = messages.map((m, i) => {
    const agent = BOT_IDS[m.userid] || `human:${m.username}`;
    const preview = m.message.slice(0, 1500);
    return `--- Message ${i + 1} ---
post_id: ${m.id}
author: ${agent}
channel: ${channelName} (domain hint: ${domainHint})
date: ${new Date(m.createat).toISOString().slice(0, 10)}
content:
${preview}`;
  }).join('\n\n');

  const userMsg = `Classify these ${messages.length} messages:\n\n${formatted}`;

  try {
    const response = await modelRouter.complete('summary', [
      { role: 'user', content: userMsg }
    ], {
      system: CLASSIFICATION_SYSTEM,
      maxTokens: 2000,
      temperature: 0.1,
    });

    // Extract text from response (handles both string and Anthropic content block array)
    let text = '';
    if (typeof response.content === 'string') {
      text = response.content;
    } else if (Array.isArray(response.content)) {
      text = response.content.map(b => b.text || '').join('');
    } else {
      text = response.text || String(response.content || '');
    }
    // Extract JSON array from response (handle possible markdown fences)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      log('warn', 'No JSON array found in LLM response', { preview: text.slice(0, 200) });
      return [];
    }
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    log('error', 'Classification failed', { error: err.message });
    return [];
  }
}

// ─── Event Emission ────────────────────────────────────

async function emitEvent(msg, classification) {
  const agent = BOT_IDS[msg.userid] || `human:${msg.username}`;
  const timestamp = new Date(msg.createat).toISOString();

  const eventData = {
    agent,
    type: classification.type,
    domain: classification.domain,
    title: (classification.title || 'Untitled').slice(0, 200),
    content: msg.message.slice(0, 2000),
    tags: classification.tags || [],
    timestamp,
    source: { channelId: msg.channelid, postId: msg.id },
    metadata: { backfilled: true, originalAuthor: msg.username, channel: msg.channel },
  };

  if (DRY_RUN) {
    log('info', `[DRY RUN] Would emit: [${eventData.type}] ${eventData.title}`, {
      agent, domain: eventData.domain, date: timestamp.slice(0, 10),
    });
    return true;
  }

  try {
    const stored = await institutionalMemory.emit(eventData);
    log('info', `Emitted: [${stored.type}] ${stored.title}`, {
      id: stored.id, agent, domain: stored.domain,
    });
    return true;
  } catch (err) {
    log('error', `Failed to emit event`, { error: err.message, postId: msg.id });
    return false;
  }
}

// ─── Main ──────────────────────────────────────────────

async function main() {
  log('info', `=== Institutional Memory Backfill ===`);
  log('info', `Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  if (SINGLE_CHANNEL) log('info', `Channel filter: ${SINGLE_CHANNEL}`);

  // Initialize dependencies
  if (!DRY_RUN) {
    const imModule = await import('../shared/institutional-memory/index.js');
    institutionalMemory = imModule.default;
    await institutionalMemory.init(log, { pollIntervalMs: 0 });
    log('info', 'Institutional memory initialized');
  }

  const routerModule = await import('../shared/model-router.js');
  modelRouter = routerModule.default;
  await modelRouter.init({ log: () => {} });
  log('info', 'Model router initialized');

  // Load state
  const rawState = loadState();
  const state = hydrateState(rawState);
  log('info', `Loaded state: ${state.processedPostIds.size} previously processed posts`);

  const channels = SINGLE_CHANNEL ? [SINGLE_CHANNEL] : CHANNELS;

  for (const channelName of channels) {
    log('info', `\n--- Processing channel: ${channelName} ---`);

    // Fetch human messages + bot structured outputs
    const humanMsgs = fetchHumanMessages(channelName);
    const botMsgs = fetchBotStructuredOutputs(channelName);
    const allMsgs = [...humanMsgs, ...botMsgs]
      .sort((a, b) => a.createat - b.createat);

    // Filter already processed
    const newMsgs = allMsgs.filter(m => !state.processedPostIds.has(m.id));

    log('info', `Found ${allMsgs.length} messages (${humanMsgs.length} human, ${botMsgs.length} bot), ${newMsgs.length} new`);

    if (newMsgs.length === 0) continue;

    // Process in batches
    for (let i = 0; i < newMsgs.length; i += BATCH_SIZE) {
      const batch = newMsgs.slice(i, i + BATCH_SIZE);

      log('info', `Classifying batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(newMsgs.length / BATCH_SIZE)} (${batch.length} messages)`);

      const classifications = await classifyBatch(batch, channelName);

      if (classifications.length === 0) {
        log('warn', 'Empty classification result, skipping batch');
        continue;
      }

      for (const cls of classifications) {
        const msg = batch.find(m => m.id === cls.post_id);
        if (!msg) {
          log('warn', `Classification references unknown post_id: ${cls.post_id}`);
          continue;
        }

        state.stats.processed++;
        state.processedPostIds.add(msg.id);

        if (cls.skip) {
          state.stats.skipped++;
          log('debug', `Skipped: ${msg.id} (${msg.username})`);
          continue;
        }

        const success = await emitEvent(msg, cls);
        if (success) {
          state.stats.emitted++;
        } else {
          state.stats.errors++;
        }
      }

      // Save state after each batch
      saveState(state);

      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < newMsgs.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  // Final stats
  log('info', `\n=== Backfill Complete ===`);
  log('info', `Processed: ${state.stats.processed}`);
  log('info', `Emitted:   ${state.stats.emitted}`);
  log('info', `Skipped:   ${state.stats.skipped}`);
  log('info', `Errors:    ${state.stats.errors}`);

  if (!DRY_RUN && institutionalMemory) {
    const stats = institutionalMemory.getStats();
    log('info', `Total events in institutional memory: ${stats.logEventCount}`);
    institutionalMemory.shutdown();
  }
}

main().catch(err => {
  log('error', 'Backfill failed', { error: err.message, stack: err.stack });
  process.exit(1);
});
