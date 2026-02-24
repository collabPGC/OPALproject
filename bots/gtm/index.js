/**
 * GTM Team Bot - Multi-persona go-to-market assistant for OPAL/LYNA
 *
 * A single bot process with 6 GTM personas:
 *   Athena (Strategist), Priya (Product Owner), Maya (Growth Lead),
 *   Rex (Sales/BD), Kai (Finance Analyst), Suki (Compliance/Ops)
 *
 * Routes messages to the appropriate persona based on commands, channels,
 * or topic detection. Integrates with institutional memory for event-sourced
 * organizational knowledge.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWebSocketManager } from 'bots-shared/websocket.js';
import * as mm from 'bots-shared/mattermost.js';
import * as llm from 'bots-shared/llm.js';
import institutionalMemory from 'bots-shared/institutional-memory';
import personaRouter from './persona-router.js';
import observationMode from './observation-mode.js';
import dailyDigest from './daily-digest.js';
import companyState from './company-state.js';
import documentManager from './document-manager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Configuration ──
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

// ── State ──
const state = {
  botUserId: null,
  conversationHistory: new Map(), // channelId -> [{role, content}]
  activePersona: new Map(),       // channelId -> persona key
  userCache: new Map(),           // userId -> username
};

const MAX_HISTORY = 20; // Messages per channel
const MAX_RESPONSE_LENGTH = 4000; // Mattermost post limit

// ── Logger ──
function log(level, message, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    bot: 'gtm',
    message,
    ...data,
  };
  const output = JSON.stringify(entry);
  if (level === 'error') {
    console.error(output);
  } else {
    console.log(output);
  }
}

// ── Initialization ──
async function main() {
  log('info', 'GTM Team Bot starting');

  // Init shared modules
  mm.init(config);
  await llm.init({ log });
  await institutionalMemory.init(log, { pollIntervalMs: 5000 });

  // Init persona router
  personaRouter.init(config.gtm || {});

  // Init observation mode
  observationMode.init(config.gtm?.observation || {});
  log('info', 'Observation mode initialized');

  // Init company state
  companyState.loadState();
  log('info', 'Company state loaded');

  // Init daily digest
  dailyDigest.init(config.gtm?.digest, log);

  // Init document manager
  documentManager.init(config.gtm?.documents || {}, log);
  log('info', 'Document manager initialized');

  log('info', 'Shared modules initialized');

  // Connect WebSocket
  const wsManager = createWebSocketManager(config, handleWebSocketEvent);
  await wsManager.connect();
  state.botUserId = wsManager.getBotUserId();

  log('info', 'GTM Bot connected', { botUserId: state.botUserId });
}

// ── WebSocket Event Handler ──
function handleWebSocketEvent(event, botUserId) {
  if (event.event === 'posted') {
    try {
      const post = JSON.parse(event.data.post);
      handlePost(post, botUserId, event.data);
    } catch (e) {
      log('error', 'Failed to parse post', { error: e.message });
    }
  } else if (event.event === 'reaction_added') {
    try {
      const reaction = JSON.parse(event.data.reaction);
      handleReaction(reaction);
    } catch (e) {
      // Ignore reaction parse errors
    }
  }
}

// ── Post Handler ──
async function handlePost(post, botUserId, eventData) {
  // Skip own messages
  if (post.user_id === botUserId) return;

  // Skip other bots
  const ignoreBots = config.gtm?.ignoreBotUserIds || [];
  if (ignoreBots.includes(post.user_id)) return;
  if (post.props?.from_bot === 'true' || post.props?.from_webhook === 'true') return;

  // Observe all messages (even without mentions) for passive tracking
  if (config.gtm?.observation?.enabled !== false) {
    try {
      observationMode.observeMessage(post, post.channel_id, post.user_id);
    } catch (e) {
      log('warn', 'Observation failed', { error: e.message });
    }
  }

  // Check if we're mentioned or in a DM
  const isDM = !post.channel_id || eventData?.channel_type === 'D';
  const isMentioned = post.message?.includes(`@gtm`) ||
                      post.message?.includes(`@gtm-team`) ||
                      isDM;

  // Check for explicit commands (always respond)
  // Includes original 6 GTM personas + 8 technical personas
  const hasCommand = /^!(?:strategist|strategy|athena|product|priya|po|growth|marketing|gtm|maya|sales|bd|rex|deals|finance|kai|budget|runway|compliance|ops|suki|regulatory|legal|team|software|marcus|arch|enterprise|helena|ehr|fhir|security|cyrus|hipaa|cloud|nimbus|infra|healthcare|vera|hc|clinical|claire|doc|ml|tensor|ai|fda|regina|reg)/i.test(post.message?.trim());

  if (!isMentioned && !hasCommand) return;

  const text = post.message || '';
  const channelId = post.channel_id;

  // Handle special commands
  if (/^!team\s+status/i.test(text.trim())) {
    await handleTeamStatus(channelId, post.id);
    return;
  }

  if (/^!team\s+context/i.test(text.trim())) {
    await handleTeamContext(channelId, post.id, text);
    return;
  }

  if (/^!team\s+digest/i.test(text.trim())) {
    await handleTeamDigest(channelId, post.id);
    return;
  }

  if (/^!team\s+gaps/i.test(text.trim())) {
    await handleTeamGaps(channelId, post.id);
    return;
  }

  if (/^!team\s+observation/i.test(text.trim())) {
    await handleObservationSummary(channelId, post.id);
    return;
  }

  if (/^!team\s+observe\s/i.test(text.trim())) {
    await handleObserveCommand(channelId, post.id, text, post.user_id);
    return;
  }

  if (/^!team\s+doc\s/i.test(text.trim())) {
    await handleDocCommand(channelId, post.id, text, post.user_id);
    return;
  }

  // Route to persona
  const { persona, reason, strippedText } = personaRouter.route(text, channelId);

  log('info', 'Routing to persona', {
    persona: persona.key,
    reason,
    channelId,
    userId: post.user_id,
  });

  // Track active persona for this channel
  state.activePersona.set(channelId, persona.key);

  // Get username
  let username = state.userCache.get(post.user_id);
  if (!username) {
    try {
      const user = await mm.getUser(post.user_id);
      username = user?.username || 'user';
      state.userCache.set(post.user_id, username);
    } catch {
      username = 'user';
    }
  }

  // Build conversation history
  addToHistory(channelId, 'user', `[${username}]: ${strippedText}`);

  // Build system prompt
  const systemPrompt = buildFullSystemPrompt(persona, channelId);

  // Get AI response
  try {
    const history = getHistory(channelId);
    const result = await llm.general(
      history.map(h => ({ role: h.role, content: h.content })),
      {
        system: systemPrompt,
        max_tokens: 2048,
      }
    );

    const responseText = result.text;
    if (!responseText) {
      log('warn', 'Empty response from LLM');
      return;
    }

    // Prefix with persona indicator
    const prefix = `**${persona.name}** *(${persona.label})*\n\n`;
    const fullResponse = prefix + responseText;

    // Post response (truncate if needed)
    const trimmed = fullResponse.length > MAX_RESPONSE_LENGTH
      ? fullResponse.slice(0, MAX_RESPONSE_LENGTH - 50) + '\n\n*...response truncated*'
      : fullResponse;

    await mm.postMessage(channelId, trimmed, post.root_id || post.id);

    // Add to history
    addToHistory(channelId, 'assistant', responseText);

    // Emit event to institutional memory
    await emitEventFromResponse(persona, strippedText, responseText, channelId, post.id);

    log('info', 'Response posted', {
      persona: persona.key,
      model: result.model,
      channelId,
      length: responseText.length,
    });

  } catch (error) {
    log('error', 'Failed to generate response', { error: error.message, persona: persona.key });
    await mm.postMessage(
      channelId,
      `**${persona.name}**: I encountered an error processing that request. Please try again.`,
      post.root_id || post.id
    );
  }
}

// ── Build System Prompt ──
function buildFullSystemPrompt(persona, channelId) {
  const parts = [];

  // Persona identity
  const personaPrompt = personaRouter.buildSystemPrompt(persona.key);
  if (personaPrompt) {
    parts.push(personaPrompt);
  }

  // Company & Product Context (always included)
  parts.push(`## COMPANY & PRODUCT CONTEXT
**OPAL** (opalpass.com) is building **LYNA** — a voice-first clinical intelligence platform for nurses.

**Mission:** Eliminate the $12B/year hospital communication crisis. Nurses lose 45 min/shift on outdated communication. 70% of serious safety events are linked to communication failures.

**Product — LYNA:** "Information OUT" for nurses (not "Documentation IN" for physicians like Suki/Abridge). Three capabilities: (1) Instant voice communication, (2) Real-time clinical decision support at bedside, (3) Execution layer that sends pages, initiates calls, broadcasts to teams.

**Architecture:** Local-first AI (Phi-3 SLM on hospital premises, no PHI in cloud). 7 integration systems: Operational KB (LYNA's data moat — door codes, pager numbers, prep checklists), Policy, EHR (Epic FHIR/Cerner read-only), Drug Info, Equipment Docs, Regulatory, Communications. <2s end-to-end latency.

**Device Strategy:** v1 iPhone app (zero procurement friction) → v2 Vocera/Apple Watch → v3+ dedicated LYNA badge ($22 BOM, ESP32-S3, XMOS voice processor, 12-hour battery).

**Market:** TAM $12-15B, SAM $4-5B. Target: 300-450 bed hospitals with Epic/Cerner, >12% nursing vacancy, legacy pagers. Pricing: $45-110/user/month. Typical Year 1 deal: $404K.

**Competition:** Vocera/Stryker (~40% market, 2,000+ hospitals, $3.1B acquisition — dated hardware, no AI). C8 Health ($18M raised, 100+ hospitals — text-only, physician/schedule-based, no voice, no EHR data, no execution layer). Suki ($168M — physician documentation). LYNA's defensible advantages: nurse-focused, assignment-based architecture, live FHIR integration, execution layer, operational KB data moat.

**Go-to-Market Flywheel:** Phase 1 (zero-friction policy lookup) → Phase 2 (SSO + FHIR, patient-aware) → Phase 3 (personalization, behavioral data) → Phase 4 (platform, hospital intelligence API).

**Financials:** Year 1: $6.2M → Year 5: $77.5M (88% CAGR). LTV:CAC 5.5x→11.2x. EBITDA positive Year 5. 450% ROI for 500-bed hospital.

**Funding:** Targeting $2-3M seed extension (Q1-Q2 2026), then $10-15M Series A (Q4) at $40-60M valuation. Board ask: $5.55M across clinical validation ($500K), flagship partnership ($800K), product dev ($2.5M), GTM engine ($1.75M).

**Team:** Ruth Okyere (Founder/CEO, RN at Mount Sinai, Columbia pre-med), Hubert Williams (Cloud/AI architect, 20+ yrs), Alex Harris (Embedded/firmware, Rockwell Automation, 20+ yrs, patents), Kwaku (ESP32 hardware dev), Kofi Agyeman.

**Market Window:** 18-24 months before well-funded incumbents recognize the nurse-focused clinical intelligence opportunity.`);

  // Institutional memory context
  try {
    const memoryContext = institutionalMemory.getContext({
      domain: persona.domains[0],
      limit: 10,
    });
    if (memoryContext) {
      parts.push(memoryContext);
    }
  } catch {
    // Memory context unavailable
  }

  // Cross-domain recent decisions
  try {
    const recentDecisions = institutionalMemory.query({
      type: 'DECISION',
      limit: 5,
      order: 'desc',
    });
    if (recentDecisions.length > 0) {
      const decisionsContext = recentDecisions.map(d =>
        `- [${d.domain}] ${d.title} (${d.timestamp.slice(0, 10)})`
      ).join('\n');
      parts.push(`## Recent Team Decisions\n${decisionsContext}`);
    }
  } catch {
    // Decisions unavailable
  }

  // Team roster (so personas know each other)
  parts.push(`## GTM Advisory Board

You are all personas within a single bot (@gtm-team). Users interact with you by messaging @gtm-team.

### Business Advisory (GTM Team)
| Name | Role | Summon with |
|------|------|-------------|
| Athena | Strategist | \`!strategist\` or \`!athena\` |
| Priya | Product Owner | \`!product\` or \`!priya\` |
| Maya | Growth Lead | \`!growth\` or \`!maya\` |
| Rex | Sales & BD | \`!sales\` or \`!rex\` |
| Kai | Finance Analyst | \`!finance\` or \`!kai\` |
| Suki | Compliance & Ops | \`!compliance\` or \`!suki\` |

### Technical Sub-team
| Name | Role | Summon with |
|------|------|-------------|
| Marcus | Software Architect | \`!software\` or \`!marcus\` |
| Helena | Enterprise Architect (Healthcare) | \`!enterprise\` or \`!helena\` |
| Cyrus | Security Architect | \`!security\` or \`!cyrus\` |
| Nimbus | Cloud Architect | \`!cloud\` or \`!nimbus\` |
| Vera | Healthcare Industry Analyst | \`!healthcare\` or \`!vera\` |
| Dr. Claire | Clinical Advisor | \`!clinical\` or \`!claire\` |
| Tensor | ML/AI Engineer | \`!ml\` or \`!tensor\` |
| Regina | Regulatory Affairs Specialist | \`!fda\` or \`!regina\` |

IMPORTANT: These are the team members. When referring to teammates, ALWAYS use the names above. When suggesting users talk to a teammate, tell them to use the command (e.g. "ask Cyrus with \`!security\`").`);

  // Response guidelines
  parts.push(`## Response Guidelines
- You are speaking as ${persona.name} (${persona.label}) on the GTM team for OPAL/LYNA
- Keep responses focused and actionable
- When you identify a decision, insight, or action item, note it clearly
- Reference other team members by their real names (Athena, Priya, Maya, Rex, Kai, Suki) and tell users how to summon them
- Stay in character but be collaborative`);

  return parts.join('\n\n');
}

// ── Emit Institutional Memory Events ──
async function emitEventFromResponse(persona, question, response, channelId, postId) {
  // Determine event type based on response content
  const lower = response.toLowerCase();
  let eventType = 'INSIGHT'; // Default

  if (lower.includes('recommend') || lower.includes('decision') || lower.includes('we should')) {
    eventType = 'INSIGHT'; // Insights by default, DECISION requires approval
  }
  if (lower.includes('action item') || lower.includes('next step') || lower.includes('todo')) {
    eventType = 'ACTION';
  }
  if (lower.includes('predict') || lower.includes('forecast') || lower.includes('expect')) {
    eventType = 'PREDICTION';
  }

  // Only emit if it seems substantive (not a casual response)
  if (response.length < 200) return;

  // Check event type is in persona's allowed emits
  if (!persona.emits.includes(eventType)) {
    eventType = persona.emits[0]; // Fallback to first allowed type
  }

  try {
    await institutionalMemory.emit({
      agent: persona.key,
      type: eventType,
      domain: persona.domains[0],
      title: question.slice(0, 120),
      content: response.slice(0, 2000),
      tags: extractTags(question + ' ' + response),
      source: { channelId, postId },
    });
  } catch (error) {
    log('error', 'Failed to emit event', { error: error.message });
  }
}

// ── Extract Tags ──
function extractTags(text) {
  const lower = text.toLowerCase();
  const tagPatterns = [
    'pricing', 'strategy', 'product', 'marketing', 'sales', 'finance',
    'compliance', 'regulatory', 'esp32', 'opal', 'lyna', 'hardware',
    'firmware', 'manufacturing', 'fundraising', 'investor', 'crowdfunding',
    'competitive', 'roadmap', 'mvp', 'beta', 'launch', 'partnership',
    'distribution', 'bom', 'supply chain', 'fcc', 'ce', 'certification',
  ];
  return tagPatterns.filter(t => lower.includes(t)).slice(0, 10);
}

// ── Conversation History ──
function addToHistory(channelId, role, content) {
  if (!state.conversationHistory.has(channelId)) {
    state.conversationHistory.set(channelId, []);
  }
  const history = state.conversationHistory.get(channelId);
  history.push({ role, content });

  // Trim to max
  while (history.length > MAX_HISTORY) {
    history.shift();
  }
}

function getHistory(channelId) {
  return state.conversationHistory.get(channelId) || [];
}

// ── Special Commands ──
async function handleTeamStatus(channelId, rootId) {
  try {
    const stats = institutionalMemory.getStats();
    const personas = personaRouter.listPersonaKeys();

    const lines = [
      '**GTM Team Status**\n',
      `**Team Members:** ${personas.map(k => {
        const p = personaRouter.getPersona(k);
        return `${p.name} (${p.label})`;
      }).join(', ')}`,
      '',
      '**Institutional Memory:**',
      `- Total events: ${stats.total}`,
      `- By type: ${stats.byType.map(t => `${t.type}: ${t.count}`).join(', ') || 'none'}`,
      `- By domain: ${stats.byDomain.map(d => `${d.domain}: ${d.count}`).join(', ') || 'none'}`,
      `- Pending approvals: ${stats.pendingApprovals}`,
      `- Active subscriptions: ${stats.activeSubscriptions}`,
      '',
      '**Business Advisory:**',
      '- `!strategist` / `!athena` — Strategy & positioning',
      '- `!product` / `!priya` — Product & roadmap',
      '- `!growth` / `!maya` — Marketing & GTM',
      '- `!sales` / `!rex` — Sales & partnerships',
      '- `!finance` / `!kai` — Finance & fundraising',
      '- `!compliance` / `!suki` — Regulatory & operations',
      '',
      '**Technical Sub-team:**',
      '- `!software` / `!marcus` — Software architecture',
      '- `!enterprise` / `!helena` — Healthcare enterprise (HL7/FHIR)',
      '- `!security` / `!cyrus` — Security & HIPAA',
      '- `!cloud` / `!nimbus` — Cloud infrastructure',
      '- `!healthcare` / `!vera` — Healthcare industry analysis',
      '- `!clinical` / `!claire` — Clinical workflows & advice',
      '- `!ml` / `!tensor` — ML/AI systems',
      '- `!fda` / `!regina` — FDA regulatory affairs',
      '',
      '**Team Commands:**',
      '- `!team status` — This status report',
      '- `!team context [domain]` — Show institutional memory',
      '- `!team digest` — Trigger advisory board digest',
      '- `!team gaps` — Show known gaps',
      '- `!team observation` — Show observation summary',
    ];

    await mm.postMessage(channelId, lines.join('\n'), rootId);
  } catch (error) {
    log('error', 'Failed to generate team status', { error: error.message });
  }
}

async function handleTeamContext(channelId, rootId, text) {
  try {
    const domain = text.replace(/^!team\s+context\s*/i, '').trim() || null;
    const context = institutionalMemory.getContext({
      domain: domain || undefined,
      limit: 15,
    });

    if (!context) {
      await mm.postMessage(channelId, 'No institutional memory events found yet.', rootId);
      return;
    }

    await mm.postMessage(channelId, context, rootId);
  } catch (error) {
    log('error', 'Failed to get team context', { error: error.message });
  }
}

async function handleTeamDigest(channelId, rootId) {
  try {
    await mm.postMessage(channelId, ':hourglass: Generating advisory board digest...', rootId);
    const digest = await dailyDigest.triggerDigest();
    if (!digest) {
      await mm.postMessage(channelId, 'No substantive content for digest at this time.', rootId);
    }
    // Note: The digest posts to the configured digest channel, not necessarily this channel
  } catch (error) {
    log('error', 'Failed to generate digest', { error: error.message });
    await mm.postMessage(channelId, 'Failed to generate digest: ' + error.message, rootId);
  }
}

async function handleTeamGaps(channelId, rootId) {
  try {
    const openGaps = companyState.getOpenGaps();
    const observedGaps = observationMode.getObservedGaps({ limit: 10 });

    const lines = ['**Known Gaps & Attention Items**\n'];

    if (openGaps.length > 0) {
      lines.push('**Domain Framework Gaps:**');
      for (const gap of openGaps.slice(0, 10)) {
        const severity = gap.severity === 'critical' ? ':red_circle:' : gap.severity === 'high' ? ':orange_circle:' : ':yellow_circle:';
        lines.push(`${severity} [${gap.domain}] ${gap.item}`);
      }
      lines.push('');
    }

    if (observedGaps.length > 0) {
      lines.push('**Observed in Conversations:**');
      for (const gap of observedGaps.slice(0, 5)) {
        const severity = gap.severity === 'high' ? ':orange_circle:' : ':yellow_circle:';
        lines.push(`${severity} "${gap.matchedText}" *(${gap.type})*`);
      }
      lines.push('');
    }

    if (openGaps.length === 0 && observedGaps.length === 0) {
      lines.push('No gaps currently tracked. Use domain commands to identify areas needing attention.');
    }

    await mm.postMessage(channelId, lines.join('\n'), rootId);
  } catch (error) {
    log('error', 'Failed to get team gaps', { error: error.message });
  }
}

async function handleObservationSummary(channelId, rootId) {
  try {
    const summary = observationMode.getSummary();
    const topTopics = observationMode.getTopTopics(10);

    const lines = [
      '**Observation Summary**\n',
      `**Channels observed:** ${summary.channelsObserved}`,
      `**Messages tracked:** ${summary.messagesTracked}`,
      `**Gaps detected:** ${summary.gapCount} (${summary.highSeverityGaps} high severity)`,
      '',
    ];

    if (topTopics.length > 0) {
      lines.push('**Hot Topics:**');
      for (const topic of topTopics) {
        lines.push(`- ${topic.name}: ${topic.count} mentions`);
      }
    } else {
      lines.push('*No topics detected yet*');
    }

    await mm.postMessage(channelId, lines.join('\n'), rootId);
  } catch (error) {
    log('error', 'Failed to get observation summary', { error: error.message });
  }
}

async function handleObserveCommand(channelId, rootId, text, userId) {
  try {
    // Parse command: !team observe <action> [args]
    // Actions: list, add <channel> [weight], remove <channel>
    const parts = text.replace(/^!team\s+observe\s*/i, '').trim().split(/\s+/);
    const action = parts[0]?.toLowerCase();

    // Get username to check if it's Hubert (or an admin)
    let username = state.userCache.get(userId);
    if (!username) {
      try {
        const user = await mm.getUser(userId);
        username = user?.username || 'unknown';
        state.userCache.set(userId, username);
      } catch {
        username = 'unknown';
      }
    }

    // Only allow Hubert (or admins) to modify observation
    const allowedUsers = ['hubert', 'admin', 'sysadmin'];
    const canModify = allowedUsers.some(u => username.toLowerCase().includes(u));

    if (action === 'list' || !action) {
      const channels = observationMode.listObservedChannels();
      if (channels.length === 0) {
        await mm.postMessage(channelId, '**Observed Channels:** None configured', rootId);
        return;
      }

      const lines = ['**Observed Channels:**\n'];
      for (const ch of channels) {
        const weightIcon = ch.weight === 'authoritative' ? ':white_check_mark:' :
                          ch.weight === 'exploratory' ? ':bulb:' : ':clipboard:';
        lines.push(`${weightIcon} **${ch.name}** (${ch.weight}) - added by ${ch.addedBy}`);
      }
      lines.push('');
      lines.push('*Weights: :white_check_mark: authoritative, :clipboard: operational, :bulb: exploratory*');
      await mm.postMessage(channelId, lines.join('\n'), rootId);
      return;
    }

    if (!canModify) {
      await mm.postMessage(channelId, 'Only Hubert can modify observed channels. Use `!team observe list` to view current channels.', rootId);
      return;
    }

    if (action === 'add') {
      const channelName = parts[1];
      const weight = parts[2] || 'operational';

      if (!channelName) {
        await mm.postMessage(channelId, 'Usage: `!team observe add <channel-name> [authoritative|operational|exploratory]`', rootId);
        return;
      }

      // Validate weight
      const validWeights = ['authoritative', 'operational', 'exploratory'];
      if (!validWeights.includes(weight)) {
        await mm.postMessage(channelId, `Invalid weight "${weight}". Use: authoritative, operational, or exploratory`, rootId);
        return;
      }

      // Look up channel ID
      try {
        const searchResult = await mm.searchChannel(channelName);
        if (!searchResult) {
          await mm.postMessage(channelId, `Channel "${channelName}" not found.`, rootId);
          return;
        }

        observationMode.addChannel(searchResult.id, searchResult.name, weight, username);
        await mm.postMessage(channelId, `:eyes: Now observing **${searchResult.name}** (${weight})`, rootId);
        log('info', 'Channel added to observation', { channel: searchResult.name, weight, addedBy: username });
      } catch (err) {
        // If search fails, try using the name as-is (maybe it's already an ID)
        observationMode.addChannel(channelName, channelName, weight, username);
        await mm.postMessage(channelId, `:eyes: Now observing **${channelName}** (${weight})`, rootId);
      }
      return;
    }

    if (action === 'remove') {
      const channelName = parts[1];

      if (!channelName) {
        await mm.postMessage(channelId, 'Usage: `!team observe remove <channel-name>`', rootId);
        return;
      }

      // Find channel by name in observed list
      const channels = observationMode.listObservedChannels();
      const found = channels.find(ch => ch.name.toLowerCase() === channelName.toLowerCase());

      if (found) {
        observationMode.removeChannel(found.id);
        await mm.postMessage(channelId, `:see_no_evil: Stopped observing **${found.name}**`, rootId);
        log('info', 'Channel removed from observation', { channel: found.name, removedBy: username });
      } else {
        await mm.postMessage(channelId, `Channel "${channelName}" is not being observed.`, rootId);
      }
      return;
    }

    await mm.postMessage(channelId, `Unknown action "${action}". Use: list, add, or remove`, rootId);

  } catch (error) {
    log('error', 'Failed to handle observe command', { error: error.message });
    await mm.postMessage(channelId, 'Failed to process observe command: ' + error.message, rootId);
  }
}

async function handleDocCommand(channelId, rootId, text, userId) {
  try {
    // Parse command: !team doc <action> [args]
    const parts = text.replace(/^!team\s+doc\s*/i, '').trim().split(/\s+/);
    const action = parts[0]?.toLowerCase();

    // Get username
    let username = state.userCache.get(userId);
    if (!username) {
      try {
        const user = await mm.getUser(userId);
        username = user?.username || 'user';
        state.userCache.set(userId, username);
      } catch {
        username = 'user';
      }
    }

    if (action === 'list' || action === 'types') {
      const types = documentManager.listDocumentTypes();
      const lines = ['**Available Document Types:**\n'];

      // Group by category
      const categories = {
        investor: ['pitch-deck', 'executive-summary', 'financial-model'],
        market: ['tam-analysis', 'competitive-landscape', 'vocera-teardown'],
        product: ['prd', 'mvp-spec', 'roadmap'],
        gtm: ['launch-plan', 'pricing-model', 'channel-strategy'],
        clinical: ['clinical-validation-plan', 'pilot-design', 'workflow-analysis'],
        technical: ['architecture-doc', 'integration-spec', 'security-whitepaper'],
        regulatory: ['fda-strategy', 'hipaa-compliance-matrix'],
      };

      for (const [cat, keys] of Object.entries(categories)) {
        lines.push(`**${cat.charAt(0).toUpperCase() + cat.slice(1)}:**`);
        for (const key of keys) {
          const t = types.find(x => x.key === key);
          if (t) {
            lines.push(`- \`${t.key}\` - ${t.name} *(${t.owners})*`);
          }
        }
        lines.push('');
      }

      lines.push('**Usage:** `!team doc create <type> [title]`');
      await mm.postMessage(channelId, lines.join('\n'), rootId);
      return;
    }

    if (action === 'status') {
      const docs = documentManager.getDocumentsInProgress();
      const allDocs = documentManager.listDocuments();

      if (docs.length === 0 && allDocs.length === 0) {
        await mm.postMessage(channelId, 'No documents in progress or on file.', rootId);
        return;
      }

      const lines = ['**Document Status:**\n'];

      if (docs.length > 0) {
        lines.push('**In Progress:**');
        for (const doc of docs) {
          lines.push(`- \`${doc.id}\` ${doc.title} (${doc.typeName}) - ${doc.status}`);
        }
        lines.push('');
      }

      if (allDocs.length > 0) {
        lines.push('**On File:**');
        for (const doc of allDocs.slice(0, 10)) {
          lines.push(`- ${doc.name} [${doc.status}]`);
        }
      }

      await mm.postMessage(channelId, lines.join('\n'), rootId);
      return;
    }

    if (action === 'create') {
      const docType = parts[1];
      const title = parts.slice(2).join(' ') || null;

      if (!docType) {
        await mm.postMessage(channelId, 'Usage: `!team doc create <type> [title]`\n\nUse `!team doc list` to see available types.', rootId);
        return;
      }

      await mm.postMessage(channelId, `:writing_hand: Creating ${docType} document... This may take a moment.`, rootId);

      const result = await documentManager.createDocument(docType, title, null, username);

      if (!result.success) {
        await mm.postMessage(channelId, `:x: Failed to create document: ${result.error}`, rootId);
        return;
      }

      const lines = [
        `:page_facing_up: **Document Created:** ${result.doc.title}`,
        '',
        `**Type:** ${result.doc.typeName}`,
        `**ID:** \`${result.doc.id}\``,
        `**Status:** Draft`,
        '',
      ];

      if (result.pdfPath) {
        lines.push(`**PDF:** ${result.pdfPath}`);
      }
      lines.push('');
      lines.push('**To revise:** `!team doc revise ' + result.doc.id + ' <feedback>`');
      lines.push('**To finalize:** `!team doc finalize ' + result.doc.id + '`');

      await mm.postMessage(channelId, lines.join('\n'), rootId);

      // Also post a preview of the content
      if (result.content && result.content.length > 0) {
        const preview = result.content.length > 2000
          ? result.content.slice(0, 2000) + '\n\n*...truncated...*'
          : result.content;
        await mm.postMessage(channelId, '**Draft Preview:**\n\n' + preview, rootId);
      }

      return;
    }

    if (action === 'revise') {
      const docId = parts[1];
      const feedback = parts.slice(2).join(' ');

      if (!docId || !feedback) {
        await mm.postMessage(channelId, 'Usage: `!team doc revise <doc-id> <feedback>`', rootId);
        return;
      }

      await mm.postMessage(channelId, `:pencil2: Revising document ${docId}...`, rootId);

      const result = await documentManager.reviseDocument(docId, feedback, username);

      if (!result.success) {
        await mm.postMessage(channelId, `:x: Failed to revise: ${result.error}`, rootId);
        return;
      }

      await mm.postMessage(channelId, `:white_check_mark: Document revised (v${result.version}). PDF: ${result.pdfPath || 'generation failed'}`, rootId);
      return;
    }

    if (action === 'finalize') {
      const docId = parts[1];

      if (!docId) {
        await mm.postMessage(channelId, 'Usage: `!team doc finalize <doc-id>`', rootId);
        return;
      }

      const result = await documentManager.finalizeDocument(docId);

      if (!result.success) {
        await mm.postMessage(channelId, `:x: Failed to finalize: ${result.error}`, rootId);
        return;
      }

      await mm.postMessage(channelId, `:white_check_mark: Document finalized and moved to active.\n\n**PDF:** ${result.pdfPath}`, rootId);
      return;
    }

    await mm.postMessage(channelId, 'Unknown doc command. Use: `list`, `status`, `create`, `revise`, `finalize`', rootId);

  } catch (error) {
    log('error', 'Failed to handle doc command', { error: error.message });
    await mm.postMessage(channelId, 'Failed to process doc command: ' + error.message, rootId);
  }
}

// ── Reaction Handler (for approvals) ──
async function handleReaction(reaction) {
  // Handle approval/rejection reactions on pending events
  const approveEmojis = ['white_check_mark', 'heavy_check_mark', '+1'];
  const rejectEmojis = ['x', '-1'];

  const emojiName = reaction.emoji_name;
  if (!approveEmojis.includes(emojiName) && !rejectEmojis.includes(emojiName)) return;

  // Check if this post has a pending approval
  // (We'd need to track which posts correspond to which events)
  // For now, this is a placeholder for Phase 2 approval workflow
}

// ── Graceful Shutdown ──
process.on('SIGTERM', () => {
  log('info', 'SIGTERM received, shutting down');
  dailyDigest.stop();
  institutionalMemory.shutdown();
  process.exit(0);
});

process.on('SIGINT', () => {
  log('info', 'SIGINT received, shutting down');
  dailyDigest.stop();
  institutionalMemory.shutdown();
  process.exit(0);
});

// ── Start ──
main().catch(error => {
  log('error', 'Fatal error', { error: error.message, stack: error.stack });
  process.exit(1);
});
