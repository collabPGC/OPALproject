# OPAL Project

OPAL is a nurse-worn medical assistant platform combining embedded hardware, an AI-powered team workspace, and a go-to-market engine.

## Repository Structure

```
OPALproject/
|
+-- bots/                  # AI Bot Platform (Mattermost)
|   +-- shared/            #   Shared infrastructure (LLM routing, memory, crew orchestration)
|   +-- scout/             #   Research & PM assistant bot
|   +-- spark/             #   Team engagement & facilitation bot
|   +-- gtm/               #   Go-to-market advisory board (14 personas)
|   +-- whatsapp-bridge/   #   WhatsApp <-> Mattermost bridge
|   +-- scripts/           #   Operational scripts (indexing, backfill)
|   +-- docs/              #   Bot platform architecture documentation
|
+-- hardware/              # Embedded Device (ESP32)
|   +-- opalDevice/        #   Firmware, schematics, audio system
|
+-- docs/                  # Project Documentation
|   +-- proposal/          #   MVP proposal and summaries
|   +-- analysis/          #   Market and technical analysis
|   +-- development/       #   Development guides
|
+-- project-management/    # SAFe PM Artifacts
|   +-- timeline/          #   Phase plans
|   +-- tasks/             #   Task tracking
|
+-- memory_system/         # Session Memory (ChromaDB)
+-- standards/             # Coding Standards (per language)
+-- build/                 # Build Logs
```

## AI Bot Platform

The bot platform is the operational backbone of the OPAL team workspace. Three specialized AI bots share a common infrastructure layer and operate as persistent team members inside Mattermost.

> Full architecture documentation: [`bots/docs/architecture.md`](bots/docs/architecture.md)

### Architecture Overview

```
  Mattermost Server (WebSocket)
         |
    +----+----+----+
    |         |    |
  Scout    Spark  GTM
    |         |    |
    +----+----+----+
         |
   Shared Platform (bots-shared)
    +----+----+----+----+
    |    |    |    |    |
  Model Crew Memory Skills Personas
  Router      System
    |
  +--+--+--+
  |  |  |  |
 Claude GPT Gemini GLM
```

### The Three Bots

| Bot | Purpose | Key Capabilities |
|-----|---------|-----------------|
| **Scout** | Research & PM Assistant | Deep analysis with probabilistic hypotheses, PDF export, Jira/GitHub integration, web search |
| **Spark** | Team Engagement | Standup/retro/brainstorm facilitation (SCAMPER, Six Hats, HMW), win celebration, async tasks |
| **GTM** | Go-to-Market Advisory Board | 14-persona routing (6 business + 8 technical), observation mode, daily digest, document generation |

### Shared Infrastructure

The `bots-shared` npm workspace package provides all cross-cutting capabilities:

**LLM Routing** --- Intelligent model selection across 4 providers (Anthropic, OpenAI, Google, GLM). Each task type (research, code, summary, translation, vision) routes to the best-fit model. Automatic fallback on failure.

| Task | Primary Model | Fallback |
|------|--------------|----------|
| Research/Analysis | Claude Opus 4.6 | GPT-5.2 |
| Code | Claude Opus 4.6 | GPT-5.2 |
| Summary | Claude Sonnet 4.6 | Gemini 3 Flash |
| Translation | GLM-4-Plus | Gemini 3 Flash |
| Long Context | Gemini 3.1 Pro | Gemini 3 Flash |

**Multi-Agent Orchestration (Crew System)** --- Complex tasks run through multi-agent pipelines with 9 specialized roles (Researcher, Analyst, Critic, Synthesizer, Ideator, Architect, Validator, PM Expert, Tech Expert). Four pipeline types:

- **Research**: Gather -> Analyze -> Challenge (Proof Gate) -> Synthesize
- **Brainstorm**: Diverge -> Evaluate -> Structure -> Converge
- **Dialectic**: Thesis -> Antithesis -> Synthesis -> Validate
- **Team Deliberation**: All agents contribute perspectives, cross-respond, then synthesize to consensus

**Three-Layer Memory System:**

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Institutional Memory | JSONL event log + SQLite FTS5 | Event-sourced organizational knowledge (decisions, actions, discoveries) |
| Semantic Memory | LanceDB + ONNX embeddings | Vector search over documents and conversations |
| Knowledge Graph | Graphology | Entity relationships (who discusses what, decision lineage) |

**Skill System** --- Reusable prompt templates defined in YAML + Markdown. Hot-loaded from disk (no restart needed). Skills support adaptive domain expertise, Ralph Mode (iterative self-critique), and quality assurance via crew pipelines.

**Persona System** --- Bot identities and adaptive domain expertise defined in Markdown files. Auto-detects domain from message content (frontend, backend, DevOps, ML, business, security) and applies matching expertise.

### Extending the Platform

| To add... | Do this |
|-----------|---------|
| New skill | Create `shared/skills/[name]/skill.yaml` + `prompt.md`. No code changes. |
| New LLM provider | Implement provider adapter in `shared/providers/`. Add to `models.json`. |
| New bot | Create directory, add to `workspaces` in root `package.json`, import from `bots-shared`. |
| New persona | Create `shared/personas/[name].md`. |
| New workflow | Create `shared/workflows/[name].yaml` chaining skills together. |

### Setup

```bash
cd bots/

# Install dependencies (creates workspace symlinks)
npm install

# Copy and configure model routing
cp shared/config/models.json.example shared/config/models.json
# Edit models.json with your API keys

# Copy and configure each bot
# Each bot needs a config.json with Mattermost URL, bot token, etc.

# Start services
sudo systemctl start scout-v2 spark-v2 gtm-bot
```

## Hardware

ESP32-based wearable device with audio processing (AEC), touch LCD, and wireless connectivity. See `hardware/opalDevice/` for firmware, schematics, and build documentation.

## Project Phases

- **Phase 1 (MVP):** Wearable assistant + LLM integration (policy Q&A + translation)
- **Phase 2:** EMPIC Payment Integration (Escrow, Metering & Split-Payouts)

## Key Documents

- [Architecture Document](bots/docs/architecture.md) --- Full bot platform architecture
- [Proposal Summary](docs/proposal/summary.md) --- MVP proposal
- [Phase 1 Plan](project-management/timeline/phase-1-plan.md) --- Timeline
- [Contributing Guide](CONTRIBUTING.md) --- Setup and contribution workflow
- [Coding Standards](standards/) --- Per-language coding standards
- [Ways of Working](WAYS_OF_WORKING.md) --- SAFe agent workflows

## Team

- **Ruth Okyere** --- Founder/CEO (RN, Mount Sinai)
- **Hubert Williams** --- Founding Engineer (Cloud/AI)
- **Alex Harris** --- Founding Engineer (Embedded/Firmware)
