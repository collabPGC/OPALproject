# OPAL Bot Platform - Architecture Document

**Version:** 1.0
**Date:** 2026-02-24
**Status:** Living document

---

## Table of Contents

1. [Architecture Vision](#1-architecture-vision)
2. [Guiding Principles](#2-guiding-principles)
3. [System Context (L0)](#3-system-context-l0)
4. [Platform Containers (L1)](#4-platform-containers-l1)
5. [Shared Infrastructure Components (L2)](#5-shared-infrastructure-components-l2)
6. [Intelligence Layer (L3)](#6-intelligence-layer-l3)
7. [Memory & Knowledge Architecture](#7-memory--knowledge-architecture)
8. [Bot Implementations](#8-bot-implementations)
9. [Data Architecture](#9-data-architecture)
10. [Deployment & Operations](#10-deployment--operations)
11. [Extension Points](#11-extension-points)
12. [Appendices](#12-appendices)

---

## 1. Architecture Vision

### 1.1 Purpose

The OPAL Bot Platform is a multi-agent AI system embedded in a Mattermost workspace that augments a startup team with persistent, context-aware AI collaborators. Each bot operates as a specialized team member --- not a tool you invoke, but a colleague that listens, remembers, and contributes.

### 1.2 Architectural Goal

> Provide a **shared runtime substrate** where specialized bots share memory, models, and capabilities --- so adding a new bot or capability is wiring together existing components, not building from scratch.

### 1.3 Key Qualities (Ranked)

| Priority | Quality Attribute | Rationale |
|----------|------------------|-----------|
| 1 | **Modularity** | Must add/remove bots and capabilities without ripple effects |
| 2 | **Extensibility** | New skills, personas, providers via config files, not code |
| 3 | **Shared Context** | All agents draw from one organizational memory |
| 4 | **Resilience** | Provider failures cascade gracefully via fallback |
| 5 | **Observability** | Structured JSON logs, model routing traceability |
| 6 | **Cost Efficiency** | Route budget tasks to cheap models, premium tasks to capable models |

### 1.4 Scope Boundaries

**In scope:** Bots, shared AI infrastructure, memory systems, Mattermost integration.
**Out of scope:** Mattermost server itself, PostgreSQL administration, OPALPass product backend.

---

## 2. Guiding Principles

### P1 --- Config Over Code

Skills, personas, workflows, and model routing rules are **data files** (YAML, Markdown, JSON). Adding a new capability should not require touching `.js` files. Code handles orchestration; data defines behavior.

### P2 --- Shared Everything

Bots are thin shells around shared infrastructure. If two bots need the same capability, it lives in `shared/`. No duplication, no drift. The `bots-shared` npm workspace package enforces this structurally.

### P3 --- Fail Loud, Fail Fast

Broken imports fail at startup (`npm install` or `node` module resolution), not silently at runtime. Model routing fails to fallback, not to silence. Events are append-only --- nothing is ever quietly deleted.

### P4 --- Intelligence Is Routed, Not Hardcoded

No bot is coupled to a specific LLM provider or model. The Model Router selects the best-fit model per task. Providers can be added, removed, or rebalanced by editing `models.json`.

### P5 --- Memory Is Layered

Different kinds of knowledge need different storage. Vector search for semantic similarity, knowledge graphs for relationships, event logs for organizational history. Each layer has a clear purpose and query pattern.

### P6 --- Agents Over Monoliths

Complex tasks run through multi-agent pipelines (Crew system), not single massive prompts. Each agent role has a defined mandate. Proof gates (Critic, Validator) catch weak reasoning before it reaches the user.

---

## 3. System Context (L0)

The outermost view: the platform and its external dependencies.

```
                           +---------------------+
                           |    Human Users      |
                           |  (OPAL Team via     |
                           |   Mattermost UI)    |
                           +----------+----------+
                                      |
                                      | WebSocket / REST API
                                      v
                           +---------------------+
                           |   Mattermost Server |
                           |  (Enterprise 11.1)  |
                           +----------+----------+
                                      |
                      +---------------+---------------+
                      |               |               |
               +------v----+  +------v----+  +------v----+
               |  Scout    |  |  Spark    |  |  GTM Bot  |
               | (Research)|  | (Engage)  |  | (Advisory)|
               +-----------+  +-----------+  +-----------+
                      |               |               |
                      +-------+-------+-------+-------+
                              |               |
                    +---------v---------+     |
                    |  Shared Platform  |     |
                    |  (bots-shared)    |     |
                    +---+----+----+----+     |
                        |    |    |          |
          +-------------+    |    +----------+----------+
          |                  |               |          |
   +------v------+  +-------v-------+  +----v----+  +-v----------+
   | LLM APIs    |  | Vector Store  |  | SQLite  |  | WhatsApp   |
   | (4 providers)|  | (LanceDB)    |  | (FTS5)  |  | Bridge     |
   +--------------+  +---------------+  +---------+  +------------+
   | Anthropic    |  | Documents     |  | Inst.   |  | Baileys    |
   | OpenAI       |  | Conversations |  | Memory  |  | <-> MM     |
   | Google       |  |               |  | Index   |  |            |
   | GLM/OpenRtr  |  |               |  |         |  |            |
   +--------------+  +---------------+  +---------+  +------------+
```

### External Dependencies

| System | Role | Protocol |
|--------|------|----------|
| Mattermost Server | Message bus, user auth, channels | WebSocket + REST |
| Anthropic API | Claude models (Opus, Sonnet, Haiku) | HTTPS |
| OpenAI API | GPT models (5.2, 5-mini) | HTTPS |
| Google AI API | Gemini models (3.1 Pro, 3 Flash, 2.5 Flash) | HTTPS |
| OpenRouter | GLM-4-Plus (Zhipu) | HTTPS |
| Jira Cloud | Issue tracking integration | REST |
| GitHub API | Repository tracking | REST |
| Tavily API | Web search (Scout) | REST |
| WhatsApp | Message bridging via Baileys | WebSocket |

---

## 4. Platform Containers (L1)

Decomposition into deployable units.

```
/opt/mattermost/bots-v2/
|
+-- package.json          # npm workspace root
|
+-- shared/               # SHARED PLATFORM (bots-shared package)
|   +-- providers/        #   LLM provider adapters
|   +-- stores/           #   Persistence (vector, graph, embeddings)
|   +-- institutional-memory/  # Event-sourced org knowledge
|   +-- crew/             #   Multi-agent orchestration
|   +-- skills/           #   Reusable skill definitions (YAML+MD)
|   +-- personas/         #   Bot personality definitions (MD)
|   +-- workflows/        #   Multi-step workflow definitions (YAML)
|   +-- search/           #   Hybrid search (semantic + keyword)
|   +-- config/           #   Model routing config (models.json)
|
+-- scout/                # BOT: Research & PM Assistant
|   +-- index.js          #   Process entry point (systemd: scout-v2)
|   +-- ai/               #   Bot-specific AI (prompts, intent)
|   +-- handlers/         #   Message handlers (files, jira, github)
|   +-- pdf/              #   PDF generation
|   +-- utils/            #   State, response templates
|
+-- spark/                # BOT: Team Engagement & PM
|   +-- index.js          #   Process entry point (systemd: spark-v2)
|   +-- ai/               #   Bot-specific AI
|   +-- handlers/         #   Handlers (brainstorm, standup, retro)
|   +-- utils/            #   State, response templates
|
+-- gtm/                  # BOT: Go-To-Market Advisory Board
|   +-- index.js          #   Process entry point (systemd: gtm-bot)
|   +-- persona-router.js #   14-persona routing (6 GTM + 8 technical)
|   +-- observation-mode.js
|   +-- daily-digest.js   #   Scheduled daily briefings
|   +-- document-manager.js
|
+-- whatsapp-bridge/      # BRIDGE: WhatsApp <-> Mattermost
|   +-- index.js          #   Process entry point
|
+-- scripts/              # OPERATIONAL SCRIPTS (not a workspace package)
    +-- index-product-brief.js
    +-- index-opalpass-content.js
    +-- backfill-institutional-memory.js
```

### Container Responsibilities

| Container | Process | Port | Responsibility |
|-----------|---------|------|----------------|
| `scout-v2` | `node scout/index.js` | --- | Research, analysis, PDF, Jira, GitHub |
| `spark-v2` | `node spark/index.js` | --- | Team ceremonies, brainstorm, engagement |
| `gtm-bot` | `node gtm/index.js` | --- | Multi-persona advisory, daily digest, docs |
| `whatsapp-bridge` | `node whatsapp-bridge/index.js` | 3388 | Bidirectional WhatsApp sync |

All bots connect outward to Mattermost via WebSocket. No bot exposes an HTTP server (except the WhatsApp bridge QR page).

---

## 5. Shared Infrastructure Components (L2)

The `bots-shared` package decomposes into six subsystems.

### 5.1 LLM Subsystem

Responsible for all interaction with language models.

```
                    Bot code
                       |
                       v
                  +----------+
                  |  llm.js  |  High-level API
                  +----+-----+  .research(), .code(), .summarize(), .vision(), ...
                       |
                       v
              +----------------+
              | model-router.js|  Task-based model selection
              +--------+-------+  Scoring, fallback, direct access
                       |
          +------------+------------+
          |            |            |
    +-----v----+ +----v-----+ +----v-----+
    |anthropic | | openai   | | google   |  ...provider adapters
    |.js       | | .js      | | .js      |
    +----------+ +----------+ +----------+
                       |
                 models.json   (routing rules, model catalog)
```

**Key design decisions:**

- **Task types drive selection:** `research` -> premium reasoning models, `summary` -> budget models, `translation` -> multilingual-optimized models.
- **Fallback is automatic:** If the primary model errors, the router walks down the preferred list. The bot never knows a failover happened.
- **Direct bypass available:** `llm.complete(modelId, ...)` skips routing for cases where a specific model is required.
- **Provider interface is uniform:** Each provider adapter implements `init()`, `complete()`, `stream()`, `isEnabled()`, `getModels()`, `hasModel()`. Adding a provider means implementing this interface.

**Routing configuration** (`config/models.json`):

```
routing.research.preferred = [claude-opus-4-6, gpt-5.2, gemini-3.1-pro]
routing.summary.preferred  = [claude-sonnet-4-6, gemini-3-flash, gpt-5-mini]
routing.translation.preferred = [glm-4-plus, gemini-3-flash, claude-haiku-4-5]
routing.vision.preferred   = [claude-opus-4-6, gpt-5.2, gemini-3.1-pro]
```

### 5.2 Command & Skill Subsystem

Responsible for mapping user commands to executable behavior.

```
  "!research quantum computing"
              |
              v
     +------------------+
     | command-router.js |
     +--------+---------+
              |
    +---------+---------+----------+
    |                   |          |
    v                   v          v
WORKFLOW_TRIGGERS?   skill-       "doc"/"document"?
  dialectic,         loader.js      |
  council,              |           v
  deep-research         v       document-
    |              skills/       generator.js
    v              *.yaml
crew/index.js      *.md
    |
    v
Multi-agent pipeline
```

**Skill anatomy** (in `shared/skills/[name]/`):

| File | Purpose |
|------|---------|
| `skill.yaml` | Metadata: triggers, model preference, Ralph mode, temperature, max tokens |
| `prompt.md` | Template with `{{topic}}`, `{{context}}`, `{{domain_expertise}}` variables |
| `examples.md` | Few-shot examples (optional) |

Skills are **hot-loaded from disk** on each invocation --- no restart needed to update a prompt.

**Ralph Mode** (`ralph-mode.js`): An autonomous self-critique loop. After generating initial output, the system analyzes for gaps (hedging language, missing sections, uncertainties), generates a self-critique, and refines. Repeats until confident or max iterations reached. Activated per-skill via `ralphMode: 'always' | 'auto' | 'off'`.

### 5.3 Persona Subsystem

Responsible for shaping bot identity and adaptive expertise.

```
persona-manager.js
     |
     +-- personas/scout.md       # Bot identity, traits, style
     +-- personas/spark.md
     +-- personas/gtm.md
     +-- personas/domain/
          +-- frontend.md        # Auto-detected domain expertise
          +-- backend.md
          +-- devops.md
          +-- ml.md
          +-- business.md
          +-- security.md
```

**System prompt assembly:**

```
  Bot persona (identity + traits + communication style)
+ Domain expertise (auto-detected from message content)
+ Skill prompt (the actual task template)
= Final system prompt sent to LLM
```

**GTM persona routing** is uniquely deep: 6 business personas (Strategist, Product Owner, Growth Lead, Sales/BD, Finance Analyst, Compliance/Ops) and 8 technical personas (Software, Architect, Enterprise, EHR/FHIR, Security, Healthcare, Clinical, ML/FDA). Messages route by command, channel mapping, @mention parsing, or topic detection.

### 5.4 Multi-Agent Orchestration (Crew System)

Responsible for complex tasks requiring multiple perspectives.

```
crew/index.js

AGENT ROLES (9):
  researcher   -> Gather, synthesize sources
  analyst      -> Hypotheses, MECE frameworks
  critic       -> Challenge, stress-test
  synthesizer  -> Combine perspectives -> recommendations
  ideator      -> Divergent creative thinking
  architect    -> Structure into frameworks
  validator    -> QA, fact-check, consistency
  pm_expert    -> PM methodology guidance
  tech_expert  -> Technical architecture guidance

PIPELINE TYPES (4):

  Research:    Gather -> Analyze -> Challenge* -> Synthesize
  Brainstorm:  Diverge -> Evaluate -> Structure -> Converge
  Analysis:    Context -> Framework -> Validate* -> Recommend
  Dialectic:   Thesis -> Antithesis -> Synthesis -> Validate

  * = Proof Gate (must pass quality threshold)

EXECUTION MODES:
  Pipeline       - Sequential stage execution, context accumulation
  Dialectic      - Multi-round thesis/antithesis/synthesis debate
  Deliberation   - All agents contribute, cross-respond, then synthesize
```

Each agent runs as an independent LLM call with a role-specific system prompt. Output from stage N becomes input context for stage N+1, building a cumulative reasoning chain.

**Team Deliberation** (the most sophisticated mode): All agents give initial perspectives -> each agent responds to all others' views -> Validator assesses quality -> Synthesizer produces consensus output. A 6-agent deliberation produces 14 LLM calls.

### 5.5 Messaging Subsystem

Responsible for connecting bots to Mattermost.

```
websocket.js
  |
  +-- connect()          # Authenticate, establish WS
  +-- onMessage(event)   # Dispatch to bot handler
  +-- scheduleReconnect()# Exponential backoff, max 10 attempts
  |
mattermost.js
  +-- mmApi(path, opts)  # REST API wrapper
  +-- postMessage()      # Post to channel
  +-- addReaction()      # Add emoji reaction
  +-- getChannelHistory()
```

Each bot process maintains its own WebSocket connection. Messages arrive as `posted` events, get parsed, classified, and dispatched to the appropriate handler.

### 5.6 Search Subsystem

Responsible for finding relevant context across all stores.

```
search/index.js
  |
  +-- hybrid.js     # Semantic (vector) + BM25 (keyword) fusion
  +-- reranker.js   # LLM-based relevance reranking (optional)
```

Three-stage pipeline: semantic search across vector stores, keyword search via FTS5, merge results, optionally rerank with an LLM for complex queries.

---

## 6. Intelligence Layer (L3)

How a user message traverses the system.

### 6.1 Message Lifecycle

```
 User posts message in Mattermost
          |
          v
 [WebSocket Event Received]
          |
          v
 [Parse & Filter]
  - Ignore own messages, system messages, other bots
  - Extract: channel, user, thread, mentions, files
          |
          v
 [Intent Classification]
  - Command? (starts with !)
  - @mention?
  - Question pattern? (regex + LLM classification)
  - Win/success detection?
  - File upload?
  - Casual conversation?
          |
          +--------+--------+--------+--------+
          |        |        |        |        |
       COMMAND  @MENTION  QUESTION  FILE    PASSIVE
          |        |        |        |        |
          v        v        v        v        v
     command-    Build     Skill    File    Index in
     router.js   context   lookup  pipeline memory,
          |      + LLM       |       |     observe
          |      response    |       |
          |        |         |       |
          v        v         v       v
     [Skill/Workflow/Crew]  [Extract, chunk,
          |                  embed, index]
          |                      |
          v                      v
     [Optional: Ralph Mode]  [Doc/Conv Store]
          |
          v
     [Format Response]
          |
          v
     [Post to Mattermost]
          |
          v
     [Side Effects]
      - Cache in conversation history
      - Index in semantic memory
      - Emit institutional memory event
      - Trigger subscription handlers
```

### 6.2 LLM Call Decision Tree

```
 Task arrives
      |
      v
 Is it a workflow trigger? (dialectic, council, deep-research, ...)
      |--- Yes --> crew/index.js (multi-agent pipeline, 4-14 LLM calls)
      |
      v
 Is it a skill with QA enabled?
      |--- Yes --> crew.runPipeline() (4 LLM calls via research/brainstorm pipeline)
      |
      v
 Should Ralph Mode activate? (skill.ralphMode + topic complexity)
      |--- Yes --> Iterative loop (2-4 LLM calls with self-critique)
      |
      v
 Standard single-shot skill execution (1 LLM call)
```

### 6.3 Model Selection Logic

```
 llm.research(messages, options)
      |
      v
 router.complete('research', messages, options)
      |
      v
 selectModel('research', {costTier, requiredCapabilities, preferredProvider})
      |
      v
 Load routing.research.preferred = [claude-opus-4-6, gpt-5.2, gemini-3.1-pro]
      |
      v
 For each candidate:
   - Is provider enabled? (API key present + not disabled)
   - Does model have required capabilities? (reasoning, vision, ...)
   - Does model match requested cost tier? (premium, standard, budget)
   - Score = position_in_preferred_list + provider_preference_bonus
      |
      v
 Return highest-scoring candidate
      |
      v
 On error: walk down preferred list until one succeeds (fallback)
      |
      v
 On total failure: throw (all models failed)
```

---

## 7. Memory & Knowledge Architecture

Three distinct persistence layers, each optimized for a different access pattern.

### 7.1 Layer Overview

```
+===========================================================================+
|                        MEMORY ARCHITECTURE                                |
+===========================================================================+
|                                                                           |
|  LAYER 1: Institutional Memory (Event-Sourced)                           |
|  +-----------------------------------------------------------------+     |
|  |  Source of truth: JSONL append-only event log                   |     |
|  |  Query layer: SQLite + FTS5 full-text search                   |     |
|  |  Coordination: Subscription manager (inter-agent events)       |     |
|  |  Safety: Loop prevention (reaction chain tracking)             |     |
|  |                                                                 |     |
|  |  Access pattern: "What did the team decide about X?"           |     |
|  |  Access pattern: "What happened in domain Y last week?"        |     |
|  +-----------------------------------------------------------------+     |
|                                                                           |
|  LAYER 2: Semantic Memory (Vector Stores)                                |
|  +-----------------------------------------------------------------+     |
|  |  Documents: LanceDB (PDF/DOCX chunks + embeddings)             |     |
|  |  Conversations: LanceDB (message history + embeddings)         |     |
|  |  Embeddings: ONNX local (Xenova/all-MiniLM-L6-v2)             |     |
|  |                                                                 |     |
|  |  Access pattern: "Find content similar to this query"          |     |
|  |  Access pattern: "What did someone say about X?"               |     |
|  +-----------------------------------------------------------------+     |
|                                                                           |
|  LAYER 3: Knowledge Graph (Relationship Store)                           |
|  +-----------------------------------------------------------------+     |
|  |  Engine: Graphology (in-memory graph library)                  |     |
|  |  Persistence: JSON file export                                  |     |
|  |  Entities: Person, Channel, Topic, Decision, Message            |     |
|  |  Relations: MENTIONED, DISCUSSED_IN, DECIDED, RELATES_TO, ...   |     |
|  |                                                                 |     |
|  |  Access pattern: "Who discusses topic X?"                      |     |
|  |  Access pattern: "What decisions relate to decision Y?"        |     |
|  +-----------------------------------------------------------------+     |
|                                                                           |
+===========================================================================+
```

### 7.2 Institutional Memory Detail

The most architecturally distinctive subsystem. Built on event sourcing principles.

**Source of truth:** Daily JSONL files in `/mnt/volume_nyc3_01/institutional-memory/events/`.

```
# File: 2026-02-24.jsonl (one JSON object per line)
{"id":"evt-abc","timestamp":"2026-02-24T10:30:00Z","type":"DECISION","domain":"engineering","agent":"human:hubert","title":"Use ESP32-S3 for v2 hardware","content":"...","confidence":0.9,"tags":["hardware","approved"]}
{"id":"evt-def","timestamp":"2026-02-24T11:00:00Z","type":"DISCOVERY","domain":"product","agent":"scout","title":"Competitor launched similar feature","content":"...","confidence":0.7,"relations":[{"type":"FOLLOWS_FROM","targetId":"evt-abc"}]}
```

**Architecture:**

| Component | File | Purpose |
|-----------|------|---------|
| Event Log | `event-log.js` | Append-only JSONL write, daily file rotation, read-back |
| SQLite Index | `sqlite-index.js` | FTS5 full-text search + structured filters over events |
| Event Schema | `event-schema.js` | Validates event structure, defines types/domains/relations |
| Subscription Manager | `subscription-manager.js` | Inter-agent coordination: subscribe to event patterns |
| Loop Prevention | `loop-prevention.js` | Tracks reaction chains, prevents infinite agent loops |

**Cross-process coordination:** Each bot polls the JSONL directory every 5 seconds for events written by other bots. New events are synced into the local SQLite index and matched against subscriptions.

**Event types:** `DECISION`, `ACTION`, `DISCOVERY`, `INSIGHT`, `OBSERVATION`, `APPROVAL`
**Domains:** `engineering`, `product`, `business`, `compliance`, `operations`, `strategy`

### 7.3 Semantic Memory Detail

**Embedding pipeline:**

```
Text chunk
    |
    v
embedder.js (ONNX, Xenova/all-MiniLM-L6-v2)
    |
    v
384-dimensional float32 vector
    |
    v
LanceDB table (vector + metadata)
```

**Document store schema:** `{ text, embedding, fileName, section, pageNumber, channelId, timestamp }`
**Conversation store schema:** `{ text, embedding, userName, channelId, timestamp, postId }`

Embeddings run locally on CPU (no API calls), fast enough for real-time indexing of incoming messages and documents.

### 7.4 Knowledge Graph Detail

Graphology-based in-memory graph stored as JSON. Entities are nodes, relationships are edges.

**Entity types:** Person, Channel, Topic, Decision, Message, Document
**Relation types:** MENTIONED, DISCUSSED_IN, DECIDED, RELATES_TO, ASSIGNED_TO, CREATED_BY, PART_OF

The graph enables traversal queries: "Who has discussed architecture decisions?" walks Person->DISCUSSED_IN->Topic->DECIDED->Decision edges.

---

## 8. Bot Implementations

### 8.1 Scout --- Research & PM Assistant

**Identity:** Concierge-style research assistant. Deep analysis, document generation, integrations.

**Unique capabilities:**
- Deep research with probabilistic hypothesis generation (McKinsey/HBS framework)
- PDF export via pandoc/xelatex with professional styling, PDFKit fallback
- Focalboard capture integration
- Tavily-powered web search for real-time research
- Jira and GitHub integration for PM workflows

**Handler structure:**

| Handler | Responsibility |
|---------|---------------|
| `handlers/files.js` | File uploads: image analysis (Vision), PDF/DOCX extraction, spreadsheet parsing |
| `handlers/research.js` | Research and brainstorm with Ralph mode iteration |
| `handlers/jira.js` | Create/update/transition Jira issues |
| `handlers/github.js` | Repository tracking, PR status |
| `handlers/commands.js` | Command parsing, dispatch to shared router |
| `handlers/summary.js` | Channel summarization |
| `handlers/crew.js` | Multi-agent pipeline invocation |
| `pdf/export.js` | PDF generation (pandoc/xelatex + PDFKit fallback) |

**Config-driven behavior** (`scout/config.json`):
- Trigger keywords, monitored channels
- Jira project mapping, GitHub repos
- Capture/Focalboard configuration

### 8.2 Spark --- Team Engagement & PM

**Identity:** Team facilitator. Ceremonies, engagement, collaboration dynamics.

**Unique capabilities:**
- Standup facilitation (start/end, collect updates)
- Brainstorm facilitation (SCAMPER, Six Hats, HMW)
- Retrospective facilitation (Standard, Starfish, Sailboat)
- Icebreaker generation
- Win celebration and morale tracking
- Async task processing via worker threads

**Handler structure:**

| Handler | Responsibility |
|---------|---------------|
| `handlers/brainstorm.js` | SCAMPER, Six Hats, How Might We frameworks |
| `handlers/standup.js` | Start/end standup, collect updates |
| `handlers/retro.js` | Retrospective facilitation |
| `handlers/engagement.js` | Icebreakers, celebrations, tutorials |
| `handlers/files.js` | File processing (shared with Scout pattern) |
| `handlers/jira.js` | Jira integration |
| `handlers/github.js` | GitHub integration |
| `handlers/commands.js` | Command dispatch |

### 8.3 GTM --- Go-To-Market Advisory Board

**Identity:** Six-persona advisory board providing strategic counsel.

**Unique capabilities:**
- 14-persona routing system (6 business + 8 technical)
- Observation mode: passively tracks market/strategy discussions
- Company state persistence (`company-state.js`)
- Daily digest: automated morning briefing
- Document generation: proposals, strategic plans
- Deep institutional memory integration

**Persona routing priority:**

```
1. Explicit command: !strategist, !finance, !growth, !sales, !product, !compliance
2. Channel mapping (config-driven per-channel persona)
3. @mention with role: "@gtm strategist", "@gtm finance"
4. Topic detection (keyword patterns)
5. Default: strategist (Athena)
```

**GTM Personas:**

| Persona | Name | Domain |
|---------|------|--------|
| Strategist | Athena | Business strategy, positioning |
| Product Owner | Priya | Product roadmap, prioritization |
| Growth Lead | Maya | Growth, marketing, partnerships |
| Sales/BD | Rex | Sales pipeline, BD, partnerships |
| Finance Analyst | Kai | Unit economics, financial modeling |
| Compliance/Ops | Suki | Regulatory, HIPAA, operations |

### 8.4 WhatsApp Bridge

**Purpose:** Bidirectional message bridge between a WhatsApp group and Mattermost channel.

**Technology:** Baileys library (WhatsApp Web protocol emulation). Requires initial QR code authentication. Maintains persistent session in `auth_info/`.

**Message flow:** WhatsApp message -> format + prefix sender name -> POST to Mattermost channel. Mattermost message -> format -> send to WhatsApp group.

---

## 9. Data Architecture

### 9.1 Storage Map

| Data | Location | Format | Retention |
|------|----------|--------|-----------|
| Institutional events | `/mnt/volume_nyc3_01/institutional-memory/events/` | JSONL (daily files) | Append-only, permanent |
| Company state | `/mnt/volume_nyc3_01/institutional-memory/company-state.json` | JSON | Overwritten on update |
| Document vectors | `/mnt/volume_nyc3_01/vectordb/documents/` | LanceDB | Grows with documents |
| Conversation vectors | `/mnt/volume_nyc3_01/vectordb/conversations/` | LanceDB | Grows with messages |
| Knowledge graph | `/mnt/volume_nyc3_01/graphdb/knowledge.json` | JSON (Graphology) | Overwritten on save |
| GTM documents | `/mnt/volume_nyc3_01/gtm-documents/` | Markdown + PDF | Permanent |
| Task queue | `shared/data/task-queue.json` | JSON | Cleared on completion |
| File index | `shared/data/file-index.json` | JSON | Grows with uploads |
| Product brief | `shared/data/product-brief.md` | Markdown | Indexed into vectors |
| Website content | `shared/data/opalpass-website-content.md` | Markdown | Indexed into vectors |
| Bot configs | `[bot]/config.json` | JSON | Static |
| Model routing | `shared/config/models.json` | JSON | Static |

### 9.2 Data Flow Diagram

```
[PDF uploaded] --> pdf-utils.js --> chunk text --> embedder.js --> doc-store (LanceDB)
                                                              |
[Message posted] --> conv-store (LanceDB)                     |
                 |                                            |
                 +--> graph-store (Graphology) --> knowledge.json
                 |
                 +--> institutional-memory (if decision/action/discovery)
                      +--> JSONL event log
                      +--> SQLite FTS5 index
                      +--> Subscription manager --> notify other agents
```

---

## 10. Deployment & Operations

### 10.1 Process Model

```
systemd
  |
  +-- scout-v2.service    -> node /opt/mattermost/bots-v2/scout/index.js
  +-- spark-v2.service    -> node /opt/mattermost/bots-v2/spark/index.js
  +-- gtm-bot.service     -> node /opt/mattermost/bots-v2/gtm/index.js
```

All three run as independent Node.js processes (Node v20.19.6) under systemd. Each maintains its own WebSocket connection to Mattermost and its own in-memory state.

### 10.2 Initialization Sequence

Every bot follows the same startup sequence:

```
1. Load config.json
2. Initialize logger (structured JSON to stdout)
3. Initialize LLM router (load models.json, connect providers)
4. Initialize memory systems (LanceDB, Graphology, embedder)
5. Initialize institutional memory (sync JSONL -> SQLite, start polling)
6. Initialize persona manager (load persona .md files)
7. Initialize skill loader (scan skills/ directory)
8. Connect WebSocket to Mattermost (authenticate, start listening)
9. Bot-specific initialization (Jira, GitHub, cron jobs, etc.)
```

Failure at any step is logged and may prevent the bot from starting. Check `journalctl -u <service>` for the failed step.

### 10.3 Operational Commands

```bash
# Service lifecycle
sudo systemctl restart scout-v2 spark-v2 gtm-bot
sudo systemctl status scout-v2
sudo journalctl -u scout-v2 -f              # Follow logs
sudo journalctl -u gtm-bot --since "5 min ago"

# npm workspace
cd /opt/mattermost/bots-v2 && npm install    # Reinstall all dependencies

# Data backup
tar -czf backup-$(date +%Y%m%d).tar.gz \
  /mnt/volume_nyc3_01/institutional-memory/ \
  /mnt/volume_nyc3_01/vectordb/ \
  /mnt/volume_nyc3_01/graphdb/
```

### 10.4 Monitoring

- **Logs:** Structured JSON to stdout, captured by journald. Key fields: `timestamp`, `level`, `message`, plus context.
- **Model routing:** Every LLM call logs `selectedModel`, `selectedProvider`, `taskType`, and `wasFallback` if applicable.
- **Memory:** Monitor `/mnt/volume_nyc3_01/` disk usage. JSONL and LanceDB grow over time.
- **Health:** Bots log `WebSocket connected` on successful connection. Absence indicates a problem.

---

## 11. Extension Points

### 11.1 Add a New Skill

Create a directory in `shared/skills/[name]/`:

```yaml
# skill.yaml
name: my-skill
description: What this skill does
triggers: [myskill, ms]
model: auto              # or specific model ID
ralphMode: auto          # always | auto | off
temperature: 0.7
maxTokens: 4096
```

```markdown
<!-- prompt.md -->
# Task: {{topic}}

Context from the conversation:
{{context}}

Domain expertise: {{domain_expertise}}

[Your prompt template here]
```

No code changes needed. Hot-loaded on next invocation.

### 11.2 Add a New LLM Provider

1. Create `shared/providers/[name].js` implementing:
   - `init(config, logger)` --- connect/validate API key
   - `complete(modelId, messages, options)` --- chat completion
   - `stream(modelId, messages, options)` --- streaming completion
   - `isEnabled()`, `getModels()`, `hasModel(modelId)`
2. Register in `shared/providers/index.js`
3. Add config block to `shared/config/models.json` with models, tiers, capabilities
4. Add model IDs to `routing` preferred lists as desired

### 11.3 Add a New Bot

1. Create `[bot-name]/` directory with `package.json` (add `"bots-shared": "*"` dependency)
2. Add to `workspaces` array in root `package.json`
3. Run `npm install` from root
4. Implement `index.js` following the initialization sequence pattern
5. Create systemd service file
6. Import shared modules: `import llm from 'bots-shared/llm.js'`, etc.

### 11.4 Add a New Persona

Create `shared/personas/[name].md` with identity, traits, communication style, and guidelines. Reference from bot config or persona-router.

### 11.5 Add a New Workflow

Create `shared/workflows/[name].yaml` defining steps that chain skills together:

```yaml
name: my-workflow
description: Multi-step analysis
steps:
  - skill: research
    input: "{{topic}}"
    output: initial_research
  - skill: critique
    input: "{{initial_research}}"
    output: critique
  - skill: synthesize
    inputs: [initial_research, critique]
    output: final
```

---

## 12. Appendices

### A. Model Catalog (as of 2026-02-24)

| Model ID | Provider | Tier | Key Capabilities | Context |
|----------|----------|------|-------------------|---------|
| claude-opus-4-6 | Anthropic | Premium | reasoning, code, vision, deep thinking | 200K |
| claude-sonnet-4-6 | Anthropic | Standard | reasoning, code, vision, deep thinking | 200K |
| claude-haiku-4-5 | Anthropic | Budget | reasoning, code, vision, fast | 200K |
| gpt-5.2 | OpenAI | Premium | reasoning, code, vision, deep thinking | 400K |
| gpt-5-mini | OpenAI | Budget | reasoning, code, vision, fast | 400K |
| gemini-3.1-pro | Google | Premium | reasoning, code, vision, deep thinking | 1M |
| gemini-3-flash | Google | Standard | reasoning, code, vision, fast | 1M |
| gemini-2.5-flash | Google | Budget | general, fast | 1M |
| glm-4-plus | GLM/OpenRouter | Standard | reasoning, code, chinese, vision | 128K |

### B. Task Type -> Model Routing

| Task Type | Primary | Fallback 1 | Fallback 2 |
|-----------|---------|------------|------------|
| research | Claude Opus 4.6 | GPT-5.2 | Gemini 3.1 Pro |
| code | Claude Opus 4.6 | GPT-5.2 | Sonnet 4.6 |
| summary | Sonnet 4.6 | Gemini 3 Flash | GPT-5-mini |
| translation | GLM-4-Plus | Gemini 3 Flash | Haiku 4.5 |
| vision | Claude Opus 4.6 | GPT-5.2 | Gemini 3.1 Pro |
| long-context | Gemini 3.1 Pro | Gemini 3 Flash | GPT-5.2 |
| math | GPT-5.2 | Claude Opus 4.6 | Gemini 3.1 Pro |
| general | Sonnet 4.6 | Gemini 3 Flash | GPT-5-mini |

### C. Crew Pipeline Detail

**Research Pipeline (4 stages, 4 LLM calls):**

| Stage | Agent | Action | Purpose |
|-------|-------|--------|---------|
| 1 | Researcher | Gather | Comprehensive information collection |
| 2 | Analyst | Analyze | Hypotheses, MECE frameworks, patterns |
| 2.5 | Critic | Challenge | **Proof Gate** --- stress-test assumptions |
| 3 | Synthesizer | Synthesize | Actionable recommendations |

**Team Deliberation (14 LLM calls for 6 agents):**

| Round | What Happens | LLM Calls |
|-------|-------------|-----------|
| 1 | Each agent gives initial perspective | 6 |
| 2 | Each agent responds to all others | 6 |
| 3 | Validator assesses deliberation quality | 1 |
| 4 | Synthesizer produces consensus | 1 |

### D. npm Workspace Structure

```
opal-bots (root)
  +-- shared    -> bots-shared (npm package, symlinked)
  +-- scout     -> depends on bots-shared
  +-- spark     -> depends on bots-shared
  +-- gtm       -> depends on bots-shared
  +-- whatsapp-bridge -> depends on bots-shared
```

Import pattern: `import llm from 'bots-shared/llm.js'`

Resolution: `node_modules/bots-shared -> ../../shared/` (symlink created by `npm install`)

### E. Glossary

| Term | Definition |
|------|-----------|
| **Crew** | Multi-agent orchestration system inspired by CrewAI |
| **Pipeline** | Ordered sequence of agent stages that process a task |
| **Proof Gate** | Stage where a Critic or Validator must approve before continuing |
| **Ralph Mode** | Iterative self-critique loop (named after Ralph Wiggum technique) |
| **Deliberation** | Full-team discussion mode where all agents contribute and cross-respond |
| **Institutional Memory** | Event-sourced organizational knowledge system (JSONL + SQLite) |
| **Model Router** | Intelligent LLM selection based on task type, cost, capabilities |
| **Persona** | Bot identity definition including traits, style, and domain expertise |
| **Skill** | Reusable prompt template with metadata, hot-loaded from YAML/MD files |
| **Workflow** | Multi-step skill chain defined in YAML |
