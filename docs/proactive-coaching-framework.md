# Proactive Coaching Framework

**Version:** 1.0
**Date:** 2026-02-26
**Status:** Production (first coaching cycle fires Feb 27, 2026)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Design Philosophy](#2-design-philosophy)
3. [Architecture](#3-architecture)
4. [Shared Foundation: proactive-behavior.js](#4-shared-foundation)
5. [Coaching Engine: coaching.js](#5-coaching-engine)
6. [Production Integration: agent-producer.js](#6-production-integration)
7. [Orchestration: Cron Schedule](#7-orchestration)
8. [State Management](#8-state-management)
9. [Configuration Reference](#9-configuration-reference)
10. [Flow Diagrams](#10-flow-diagrams)
11. [Adding a New Team Member](#11-adding-a-new-team-member)
12. [Adding a New Agent/Persona](#12-adding-a-new-agent-persona)
13. [Tuning & Troubleshooting](#13-tuning--troubleshooting)

---

## 1. Overview

The Proactive Coaching Framework transforms OPAL's AI agents from passive report generators into active mentors who guide founders through execution. Instead of producing deliverables and going silent, agents:

- **Produce deliverables with coaching baked in** — every output includes a "Your One Move" section with sub-steps
- **Follow up via personalized DMs** — LLM-powered messages using each agent's domain expertise
- **Respect human attention** — batched by owner, 3-day cooldown, priority-ranked
- **Normalize startup discomfort** — all agents share awareness that founders are doing things for the first time

### System Components

| Component | File | Purpose |
|-----------|------|---------|
| Shared Foundation | `shared/proactive-behavior.js` | FOUNDER_CONTEXT, coaching pillars, prompt builders |
| Coaching Engine | `gtm/nerve-center/coaching.js` | LLM-powered coaching DM generation and delivery |
| Production System | `gtm/nerve-center/agent-producer.js` | Autonomous deliverable production with coaching context |
| Orchestration | `gtm/nerve-center/index.js` | Cron scheduling and system wiring |
| State | `gtm/nerve-center/program-state.js` | Milestone/workstream persistence |

---

## 2. Design Philosophy

### The Inertia Problem

When a startup founder receives a 10-page strategy document, the most common response is... nothing. Not because they don't care, but because:

- They've never done this before (Ruth has never cold-emailed a CNO)
- The gap between "read this document" and "execute it" feels enormous
- Decision paralysis sets in when faced with multiple options
- Fear of doing it wrong creates avoidance

### The Seven Coaching Principles

These are encoded in `FOUNDER_CONTEXT` and shared across ALL agents:

| # | Principle | Example |
|---|-----------|---------|
| 1 | **Inertia is uncertainty, not laziness** | Assume "I don't know where to start" before "they're ignoring me" |
| 2 | **Break first steps into sub-steps** | "Open the doc. Read just Section 2. Circle 2 names you recognize. 10 min." |
| 3 | **Normalize the discomfort** | "This feels unfamiliar because it IS unfamiliar — that's normal" |
| 4 | **Remove decision paralysis** | ONE recommendation, not 5 options |
| 5 | **Make the scary thing small** | "Send this 3-sentence email" not "pitch the CNO" |
| 6 | **Celebrate micro-progress** | If they read the doc — acknowledge it |
| 7 | **Always offer to do it together** | "Tell me what you want to say and I'll shape it" |

### The Five Coaching Pillars

Every substantive agent output should include:

| Pillar | What It Means |
|--------|---------------|
| **WHO** | Name the specific human who should act |
| **HOW** | Step-by-step instructions with trivially small first step |
| **WHAT_TO_SAY** | Draft emails, scripts, talking points — ready to copy-paste |
| **WHAT_TO_WATCH** | What good/bad responses look like, red flags, progress signals |
| **NEXT_TOUCH** | When the agent will check back, how to reach out for help |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SHARED FOUNDATION                             │
│              shared/proactive-behavior.js                        │
│                                                                  │
│  FOUNDER_CONTEXT ─── 7 coaching principles                      │
│  COACHING_PILLARS ── WHO, HOW, WHAT_TO_SAY, WHAT_TO_WATCH, ...  │
│  buildCoachingPrompt() ── System prompt injection                │
│  buildFollowUpMessage() ── 3-tier follow-up messages             │
│  appendCoachingFooter() ── Post-process any bot response         │
└──────────┬──────────────────────────────────┬───────────────────┘
           │                                  │
           ▼                                  ▼
┌─────────────────────┐         ┌─────────────────────────────┐
│   COACHING ENGINE    │         │    PRODUCTION SYSTEM         │
│  nerve-center/       │         │  nerve-center/               │
│  coaching.js         │         │  agent-producer.js           │
│                      │         │                              │
│  runCoachingCycle()  │         │  runProductionCycle()        │
│  ├─ groupByOwner()   │         │  ├─ shouldProduce()          │
│  ├─ checkCooldown()  │         │  ├─ buildProductionContext() │
│  ├─ pickPriority()   │         │  │   └─ injects FOUNDER_CTX │
│  ├─ generateMsg()    │         │  ├─ createDocument()         │
│  │   └─ persona LLM  │         │  │   or produceFreeForm()   │
│  └─ sendDM()         │         │  └─ announceDeliverable()   │
│                      │         │      └─ coaching action box  │
│  Fires: 2 PM daily   │         │  Fires: 9:15 AM daily       │
│  Cooldown: 3 days    │         │                              │
└──────────┬───────────┘         └──────────────────────────────┘
           │
           ▼
┌─────────────────────┐
│  MATTERMOST DM API   │
│  /channels/direct    │
│  Owner gets personal  │
│  coaching message     │
└──────────────────────┘
```

---

## 4. Shared Foundation

**File:** `shared/proactive-behavior.js`

### Exports

```javascript
export const FOUNDER_CONTEXT        // String — injected into system prompts
export const COACHING_PILLARS       // Object — 5 pillar definitions
export function buildCoachingPrompt(opts)      // System prompt builder
export function buildFollowUpMessage(opts)     // 3-tier follow-up generator
export function appendCoachingFooter(content, opts)  // Response post-processor
```

### FOUNDER_CONTEXT

A constant string block that describes the team's specific domain gaps:

- **Ruth** — Nurse, not a business development exec. Never cold-emailed a CNO, pitched to an innovation program, or structured a pilot proposal.
- **Hubert** — Engineer, not a fundraiser. Never built a data room, modeled unit economics, or prepared for due diligence.
- **Alex** — Firmware engineer. Enterprise sales, regulatory filings, and hospital procurement are foreign territory.

Followed by the 7 coaching principles (see Section 2).

**Usage:** Import and inject into any LLM system prompt where agents produce actionable outputs.

```javascript
import { FOUNDER_CONTEXT } from 'bots-shared/proactive-behavior.js';
// Append to system prompt:
const systemPrompt = basePrompt + '\n\n' + FOUNDER_CONTEXT;
```

### buildCoachingPrompt(opts)

Generates a complete coaching instruction block for any agent's system prompt.

**Parameters:**

| Param | Type | Example | Description |
|-------|------|---------|-------------|
| `ownerName` | string | `"Ruth"` | The human who will execute |
| `agentName` | string | `"Rex"` | The agent producing the output |
| `agentCommand` | string | `"!rex"` | How to summon the agent interactively |
| `teamMembers` | string[] | `["Ruth", "Hubert"]` | All humans available for tasks |

**Returns:** A prompt string that instructs the LLM to structure its response with:
1. The Content (main deliverable)
2. "Your One Move, {owner}" — single action TODAY with sub-steps
3. "What To Watch For" — good/bad response signals
4. "Let's Do This Together" — low-friction offer to collaborate

### buildFollowUpMessage(opts)

Generates a coaching follow-up message that varies by how many days have passed.

**Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `ownerName` | string | Who should have acted |
| `agentName` | string | Who produced the deliverable |
| `agentCommand` | string | How to summon the agent |
| `taskTitle` | string | What was produced |
| `daysSince` | number | Days since production |
| `completionCommand` | string | e.g. `"!atlas milestone 8.1 done"` |

**Tone progression:**

| Days | Tone | Key Message |
|------|------|-------------|
| 1-3 | Optimistic check-in | "Pick just the FIRST action item (~15 min)" |
| 4-7 | Gentle problem-solving | "What's blocking you? Tell me and I'll find a way around it" |
| 8+ | Direct diagnosis | "Is this still a priority? Should someone else own this?" |

### appendCoachingFooter(content, opts)

Post-processes any substantive bot response (>200 chars) by appending interactive help options:

```
---
**{Agent}** is here to help you execute, not just advise. Options:
- `@gtm-team !agent walk me through this` — interactive step-by-step
- `@gtm-team !agent I tried X and it didn't work` — troubleshooting
- `@gtm-team !agent what should I do first?` — just the #1 priority action
```

---

## 5. Coaching Engine

**File:** `gtm/nerve-center/coaching.js`

### Purpose

Generates and delivers personalized coaching DMs to milestone owners using the assigned agent's persona and domain expertise. This replaces the old template-based nudge system.

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **DMs, not channel posts** | Channel posts are noisy and impersonal. DMs feel like a colleague reaching out. |
| **Batched by owner** | One message per person, focused on their #1 priority. Not a wall of nudges. |
| **3-day cooldown** | Prevents notification fatigue. Gives time to act before re-nudging. |
| **LLM-generated, not templates** | Each message uses the persona's domain expertise for context-specific advice. |
| **2-day grace period** | Don't nudge on deliverables produced yesterday — give them time to read. |

### Agent-to-Persona Mapping

Maps agent display names to persona keys for system prompt loading:

```javascript
const AGENT_TO_PERSONA = {
  'Athena': 'strategist',       'Priya': 'product-owner',
  'Maya': 'growth-lead',        'Rex': 'sales-bd',
  'Kai': 'finance-analyst',     'Suki': 'compliance-ops',
  'Marcus': 'software-architect','Helena': 'enterprise-architect',
  'Cyrus': 'security-architect', 'Nimbus': 'cloud-architect',
  'Vera': 'healthcare-analyst', 'Dr. Claire': 'clinical-advisor',
  'Tensor': 'ml-engineer',      'Regina': 'regulatory-affairs',
};
```

### Owner-to-User-ID Mapping

Maps human names to Mattermost user IDs for DM channel creation:

```javascript
const OWNER_USER_IDS = {
  'Ruth':   '9gy8ry96jbbexg8umzxuijsq1c',
  'Hubert': 'hes9xx7m7byb88o7za7883x76o',
  'Alex':   'gquh1hq5jfdyxqu3uwindqdorr',
  'Kwaku':  'ecnwcntig38y8eus5o4a8tu3ur',
};
```

### runCoachingCycle() — Main Entry Point

Called by the 2 PM weekday cron. Returns the count of DMs sent.

**Algorithm:**

```
1. Load nudge state (cooldown tracking)
2. Group all pending milestones by owner
   - Filter: has deliverables, not completed, produced >= 2 days ago
3. For each owner:
   a. Check 3-day cooldown → skip if too recent
   b. Pick highest-priority milestone (tier first, then oldest)
   c. Generate coaching message via persona LLM
   d. Send as DM (fallback: ops channel)
   e. Record nudge timestamp
4. Save nudge state
```

### Priority Selection Algorithm

```javascript
function pickPriority(milestones) {
  return milestones.sort((a, b) => {
    const tierDiff = (a.wsTier ?? 99) - (b.wsTier ?? 99);
    if (tierDiff !== 0) return tierDiff;  // Tier 0 beats Tier 1 beats Tier 2
    return b.daysSince - a.daysSince;     // Within tier: oldest first
  })[0];
}
```

### LLM Coaching Prompt Structure

The coaching prompt instructs the persona to write a SHORT DM (under 800 chars):

**DO:**
- Open with something warm and specific
- Name the ONE most important thing the owner should do TODAY
- Break it into 2-3 sub-steps so small they feel obvious
- Be specific about HOW using domain expertise
- Give a concrete tip or insider insight
- Normalize that this is unfamiliar
- Offer to do it TOGETHER right now
- Ask ONE specific question about what's blocking them

**DON'T:**
- List multiple milestones
- Use headers, bullet walls, or formal structure
- Say "checking in" or "gentle reminder"
- Assume they're ignoring you
- Present multiple options

### DM Delivery Mechanism

```
1. Look up owner → Mattermost user ID
2. Create DM channel: POST /api/v4/channels/direct [botUserId, ownerUserId]
3. Post message to DM channel
4. Log to ops channel: "Sent coaching DM to {owner} — focused on {milestone}"
```

**Fallback chain:**
- If no user ID → post to ops channel with owner name
- If no bot user ID → post to ops channel with "DM failed"
- If DM API fails → post to ops channel with "DM failed"

### Nudge State Persistence

**File:** `/mnt/volume_nyc3_01/institutional-memory/nudge-state.json`

```json
{
  "Ruth": {
    "lastNudgedAt": "2026-02-27T18:00:00.000Z",
    "milestone": "8.1"
  }
}
```

---

## 6. Production Integration

**File:** `gtm/nerve-center/agent-producer.js`

### How Coaching is Baked Into Deliverables

When `runProductionCycle()` produces a deliverable, the production context injected into the LLM includes:

1. **FOUNDER_CONTEXT** — Full text of the 7 coaching principles
2. **"Your One Move" section** — Instructs the LLM to include a single action TODAY with sub-steps
3. **"Let's Do This Together" section** — Instructs the LLM to offer interactive collaboration
4. **Inertia awareness** — "Remember: {owner} is likely doing this for the first time"

### Production Context Template

Every deliverable prompt includes this footer:

```
${FOUNDER_CONTEXT}

## YOUR ROLE: Wise Guide & Coach
You are not just producing a document — you are guiding {owner} through this step.

### 1. The Deliverable
[Actual content]

### 2. Your One Move, {owner}
- SINGLE most important action TODAY
- 2-3 sub-steps so small they feel obvious
- Acknowledge this is new territory
- Time estimate: "This takes ~15 minutes"

### 3. Let's Do This Together
- Offer to draft emails/messages together
- "Come back and tell me what happened — I'll adjust"
- "Feeling unsure? That's completely normal"
```

### Deliverable Announcement

After production, the ops channel receives an action box:

```
**{owner}** — the deliverable above is your starting point, not a finished product.

1. Read through it (~10 min)
2. Fill in the blanks — swap placeholders for real names/contacts
3. Flag what's wrong — tell {agent} what needs fixing
4. Start executing — pick the first action item and do it today

Need a walkthrough? @gtm-team !{agent} walk me through this step by step
Stuck or unsure? @gtm-team !{agent} I tried X and it didn't work
Done? !atlas milestone {id} done
```

---

## 7. Orchestration

**File:** `gtm/nerve-center/index.js`

### Cron Schedule (all times America/New_York)

| Time | Days | Job | Handler |
|------|------|-----|---------|
| 8:30 AM | Mon-Fri | Morning check | `tracker.runChecks()` + `deliverPendingMessages()` + `postMorningSummary()` |
| 9:15 AM | Mon-Fri | Agent production | `agentProducer.runProductionCycle()` |
| 2:00 PM | Mon-Fri | Coaching DMs | `coaching.runCoachingCycle()` |
| 8:45 AM | Monday | Weekly report | `reporting.generateWeeklyReport()` |
| Every 4h | Daily | Reminder delivery | `deliverPendingMessages()` |

### Initialization Sequence

```javascript
coaching.init(log, opsChannelId, config.botUserId || null);
```

After WebSocket connects and bot user ID is known:

```javascript
coaching.setBotUserId(state.botUserId);
```

---

## 8. State Management

### Program State

**File:** `/mnt/volume_nyc3_01/institutional-memory/program-state.json`

**Milestone schema:**

```json
{
  "id": "8.1",
  "title": "Mt Sinai Innovation Program Research",
  "week": 1,
  "owner": "Ruth",
  "agents": ["Vera"],
  "status": "in_progress",
  "notes": "Agent-produced 2026-02-25: analysis_8.1_1772071239225",
  "deliverables": ["analysis_8.1_1772071239225"],
  "blockedBy": []
}
```

**Key fields for coaching:**
- `status` — Must not be "completed" for coaching to fire
- `notes` — Contains "Agent-produced YYYY-MM-DD" regex for age calculation
- `deliverables` — Must be non-empty (has been produced)
- `owner` — Maps to OWNER_USER_IDS for DM delivery
- `agents[0]` — Maps to AGENT_TO_PERSONA for LLM persona selection

### Nudge State

**File:** `/mnt/volume_nyc3_01/institutional-memory/nudge-state.json`

Tracks per-owner cooldown timestamps. Persisted after each coaching cycle.

### Milestone Lifecycle

```
pending → in_progress → (deliverable produced) → coaching DM sent → completed
  │                           │                        │
  │  Auto-promoted by         │  Agent production      │  3-day cooldown
  │  tracker (1 week          │  cycle (9:15 AM)       │  between DMs
  │  before target week)      │                        │
  └───────────────────────────┘                        └──► repeat until done
```

---

## 9. Configuration Reference

### Constants

| Constant | Value | Location | Purpose |
|----------|-------|----------|---------|
| `COOLDOWN_DAYS` | 3 | coaching.js:22 | Min days between coaching DMs per owner |
| `NUDGE_STATE_FILE` | `/mnt/.../nudge-state.json` | coaching.js:21 | Cooldown persistence |
| `STATE_FILE` | `/mnt/.../program-state.json` | program-state.js | Milestone data |
| LLM max_tokens (coaching) | 1500 | coaching.js:167 | Keep DMs short |
| LLM max_tokens (production) | 3000 | agent-producer.js | Room for detailed output |
| Post truncation limit | 14000 chars | agent-producer.js | Mattermost 16k limit |
| Pending milestone age cutoff | 2 days | coaching.js:121 | Don't nudge too early |
| Tracker check interval | 1 hour | index.js:52 | Auto-promotion frequency |

### Timezone

All crons default to `America/New_York`. Configurable via `config.timezone` in init.

---

## 10. Flow Diagrams

### Coaching DM Flow (Daily 2 PM)

```
CRON 2:00 PM
    │
    ▼
runCoachingCycle()
    │
    ├─► loadNudgeState()
    │   └─ Read nudge-state.json
    │
    ├─► groupPendingByOwner()
    │   ├─ For each workstream → for each milestone:
    │   │   ├─ Has deliverables?          NO → skip
    │   │   ├─ Status = completed?        YES → skip
    │   │   ├─ Notes match "Agent-produced"? NO → skip
    │   │   └─ Produced >= 2 days ago?    NO → skip
    │   └─ Group by ms.owner
    │
    ├─► For each owner:
    │   │
    │   ├─ Check cooldown (3 days)
    │   │   └─ Skip if lastNudgedAt < 3 days ago
    │   │
    │   ├─ pickPriority(milestones)
    │   │   └─ Sort: tier ASC, daysSince DESC → take first
    │   │
    │   ├─ generateCoachingMessage()
    │   │   ├─ agent = ms.agents[0] || 'Atlas'
    │   │   ├─ persona = AGENT_TO_PERSONA[agent]
    │   │   ├─ systemPrompt = personaRouter.buildSystemPrompt(persona)
    │   │   │                + COACHING_SYSTEM_ADDENDUM (includes FOUNDER_CONTEXT)
    │   │   ├─ userPrompt = buildCoachingPrompt(owner, agent, priority, others)
    │   │   └─ result = llm.general([{role:'user', content: userPrompt}], {system, max_tokens:1500})
    │   │
    │   ├─ sendCoachingDM()
    │   │   ├─ userId = OWNER_USER_IDS[owner]
    │   │   ├─ dmChannel = POST /channels/direct [botUserId, userId]
    │   │   └─ postMessage(dmChannel.id, message)
    │   │
    │   └─ nudgeState[owner] = { lastNudgedAt: now, milestone: id }
    │
    └─► saveNudgeState()
```

### Deliverable Production Flow (Daily 9:15 AM)

```
CRON 9:15 AM
    │
    ▼
runProductionCycle()
    │
    ├─► For each workstream → for each milestone:
    │   │
    │   ├─ shouldProduce(ms)?
    │   │   ├─ agents.length > 0?           NO → skip (human-only)
    │   │   ├─ deliverables.length === 0?   NO → skip (already produced)
    │   │   ├─ status === 'in_progress'?    NO → skip
    │   │   └─ checkUnblocked(ms.id)?       NO → skip (deps not met)
    │   │
    │   ├─ Resolve: agent → persona → personaKey
    │   │
    │   ├─ Check MILESTONE_DOC_MAP[ms.id]:
    │   │   ├─ Has docs[] → documentManager.createDocument(type, title, context)
    │   │   │               context includes FOUNDER_CONTEXT + coaching sections
    │   │   └─ No docs   → produceFreeFormAnalysis(ms, ws, personaKey)
    │   │                   LLM call with persona + FOUNDER_CONTEXT
    │   │
    │   ├─ programState.updateMilestone(ms.id, { deliverables, notes })
    │   │
    │   └─ announceDeliverable() → ops channel with action guidance
    │
    └─► Return produced count
```

---

## 11. Adding a New Team Member

To add a new person to the coaching framework:

### Step 1: Add to OWNER_USER_IDS (coaching.js)

```javascript
const OWNER_USER_IDS = {
  'Ruth': '9gy8ry96jbbexg8umzxuijsq1c',
  'Hubert': 'hes9xx7m7byb88o7za7883x76o',
  'Alex': 'gquh1hq5jfdyxqu3uwindqdorr',
  'Kwaku': 'ecnwcntig38y8eus5o4a8tu3ur',
  'NewPerson': '<mattermost-user-id>',  // ← Add here
};
```

**Finding the Mattermost user ID:**
```bash
/opt/mattermost/bin/mmctl --local user search <username> --json | jq '.[0].id'
```

### Step 2: Update FOUNDER_CONTEXT (proactive-behavior.js)

Add a line describing the new person's background and domain gaps:

```javascript
export const FOUNDER_CONTEXT = `## Understanding Who You're Coaching
...
- NewPerson is a [background]. They have never [specific gap 1],
  [specific gap 2], or [specific gap 3].
...`;
```

### Step 3: Assign Milestones

Update program-state.json to assign milestones with `"owner": "NewPerson"`.

### Step 4: Restart

```bash
sudo systemctl restart gtm-bot
```

---

## 12. Adding a New Agent/Persona

To add a new AI agent to the coaching framework:

### Step 1: Create the Persona

Add a persona markdown file:
```
shared/personas/gtm/<persona-key>.md
```

### Step 2: Register in Persona Router

In `gtm/persona-router.js`, add the persona configuration.

### Step 3: Add to AGENT_TO_PERSONA (coaching.js + agent-producer.js)

Both files maintain the same mapping. Add to both:

```javascript
const AGENT_TO_PERSONA = {
  ...existing,
  'NewAgent': 'new-persona-key',
};
```

### Step 4: Map Milestones to Document Types (agent-producer.js)

If the agent will produce specific document types, add to `MILESTONE_DOC_MAP`:

```javascript
const MILESTONE_DOC_MAP = {
  ...existing,
  'X.1': { docs: ['doc-type'], context: 'Specific context for this milestone' },
};
```

### Step 5: Restart

```bash
sudo systemctl restart gtm-bot
```

---

## 13. Tuning & Troubleshooting

### Changing Cooldown Period

Edit `COOLDOWN_DAYS` in `coaching.js`:

```javascript
const COOLDOWN_DAYS = 3;  // Change to desired number
```

### Changing Coaching Cron Time

Edit the cron schedule in `nerve-center/index.js`:

```javascript
// Currently: '0 14 * * 1-5' = 2 PM weekdays
cron.schedule('0 14 * * 1-5', async () => { ... });
```

### Checking Nudge State

```bash
cat /mnt/volume_nyc3_01/institutional-memory/nudge-state.json | jq .
```

### Resetting Cooldown for a Specific Owner

Edit nudge-state.json to remove or backdate the entry:

```bash
# Remove Ruth's cooldown (she'll get nudged on next cycle)
jq 'del(.Ruth)' nudge-state.json > tmp && mv tmp nudge-state.json
```

### Viewing Coaching Logs

```bash
sudo journalctl -u gtm-bot --since today | grep -i coaching
```

### Force-Triggering a Coaching Cycle

Via Mattermost (if Atlas commands are wired):
```
!atlas produce
```

Or directly via the bot's Node.js runtime (restart required to pick up):
```bash
# Check which milestones are eligible
sudo journalctl -u gtm-bot | grep "coaching.*Skipping\|coaching.*DM sent"
```

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| No coaching DMs sent | All milestones < 2 days old | Wait for the grace period |
| No coaching DMs sent | All owners within cooldown | Check nudge-state.json |
| No coaching DMs sent | No deliverables on milestones | Check program-state.json deliverables arrays |
| DM goes to ops channel instead | Owner not in OWNER_USER_IDS | Add the mapping |
| DM goes to ops channel instead | Bot user ID not set | Check coaching.init() receives botUserId |
| LLM fallback message sent | LLM API error | Check API key, model availability |
| Permission denied on state files | File owned by root | `sudo chown mattermost:mattermost <file>` |

### File Permissions Checklist

All state files must be owned by `mattermost:mattermost`:

```bash
ls -la /mnt/volume_nyc3_01/institutional-memory/program-state.json
ls -la /mnt/volume_nyc3_01/institutional-memory/nudge-state.json
ls -la /mnt/volume_nyc3_01/institutional-memory/events/*.jsonl
```

---

## Appendix: Sample Coaching DM

Below is an example of a coaching DM generated by Vera (healthcare-analyst) for Ruth regarding Mt Sinai innovation program research:

> Hey Ruth — Vera here. I put together the Mt Sinai innovation program research and stakeholder map a few days ago, and I wanted to help you take the first concrete step with it.
>
> Here's what I'd suggest doing today — it should take about 15 minutes:
>
> **Step 1:** Open the stakeholder map I created. Look at the "Innovation & Digital Health" section.
> **Step 2:** Circle the 2-3 names you actually recognize from your time at Mt Sinai. Even if you've only seen them in passing — that counts.
> **Step 3:** For each name you circled, jot down one sentence about how you know them ("saw her at nursing orientation," "he runs the unit next to mine").
>
> That's it. You're not pitching anyone yet — you're just mapping your existing connections to the innovation ecosystem. Every founder I've worked with in healthcare started exactly this way.
>
> This might feel unfamiliar because you're approaching Mt Sinai as a potential business partner, not as a nurse. That's completely normal — you have insider knowledge that outside companies would pay consultants for.
>
> Want to go through the stakeholder map together right now? Just tell me which names look familiar and I'll help you figure out the best way to reconnect: `@gtm-team !vera`
>
> What's the one thing that feels most uncertain about reaching out to people at Mt Sinai?
