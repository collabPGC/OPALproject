# Building an AI-Powered Team: How Multi-Agent Architecture Changed Our Research Quality

*What happened when we stopped asking one AI for answers and started letting them debate instead*

---

## The Problem We Were Solving

Last month, someone asked Scout (our research bot) to analyze competitor pricing strategies. The first response was confident, well-structured—and missed three major players entirely.

We'd seen this pattern before. Single-pass AI responses are fast, but they carry blind spots. The model commits to a direction early and rarely questions itself.

So we asked: **what if the AI could argue with itself before responding?**

---

## The Courtroom Insight

Think about how courts work. You don't ask one lawyer to determine truth. You have a prosecutor building one case, a defense attorney challenging every assumption, and a jury synthesizing both perspectives.

The adversarial process produces better outcomes than either side alone.

We built this into our bots. Every significant research query now goes through multiple AI "agents" with different roles before you see the response:

| Agent | Role | Question They Ask |
|-------|------|-------------------|
| **Researcher** | Gather evidence | *"What are the facts? What sources exist?"* |
| **Analyst** | Find patterns | *"What frameworks apply? What patterns emerge?"* |
| **Critic** | Challenge everything | *"What assumptions are untested? What's missing?"* |
| **Synthesizer** | Integrate views | *"Given all perspectives, what should we conclude?"* |

**The result?** That competitor analysis, run through the full pipeline, caught all the missing players. The Critic specifically flagged: *"Three major enterprise players absent: Amazon CodeWhisperer, Tabnine, Sourcegraph Cody."*

---

## Watch It Work

When you type `!research competitor pricing for AI coding assistants`, here's what actually happens:

**Stage 1 - Researcher gathers:** Searches documents, web, and memory. Finds 12 competitors with pricing data for 9 of them.

**Stage 2 - Analyst patterns:** Applies frameworks. Identifies three pricing models emerging: pure subscription, hybrid usage, and freemium.

**Stage 3 - Critic challenges:** Tests every assumption. Flags gaps: *"Missing Amazon and Tabnine. Cursor usage pricing unverified."*

**Stage 4 - Synthesizer integrates:** Creates final analysis incorporating all perspectives, with caveats clearly marked.

**Total time:** ~45 seconds for four model calls.
**Quality improvement:** Catches ~40% more gaps than single-pass.

The key insight: **we made quality automatic, not optional.** You don't remember to ask for review—it happens by default.
## The Architecture

Two bots share common infrastructure:

- **Scout** handles research and analysis
- **Spark** handles creative and strategic work

Both connect to a shared layer that manages:
- **Skills** - Modular AI capabilities (research, brainstorm, critique, etc.)
- **Crew** - Multi-agent orchestration pipeline
- **Memory** - Semantic search across past conversations and documents
- **Model Router** - Picks the right AI model for each task type

The bots can call Anthropic, OpenAI, or Google models depending on the task.

---

## The Four Pillars

### 1. Skills: Modular Capabilities

Every capability is a separate "skill" defined in config files, not code. A skill has a YAML config (triggers, model preferences, temperature) and a markdown prompt template.

**Why this matters:** We can A/B test prompts, version control them, and update without restarts. Adding a new capability takes 10 minutes.

| Skill | What It Does |
|-------|--------------|
| `research` | Deep investigation with evidence gathering |
| `brainstorm` | Divergent thinking, generates 10+ ideas |
| `critique` | Devil's advocate, finds weaknesses |
| `synthesize` | Combines perspectives into recommendations |
| `dialectic` | Thesis vs antithesis, then synthesis |

---

### 2. Crew: The Multi-Agent Pipeline

This is where the courtroom analogy comes to life. Each agent has a distinct personality:

- **Researcher** gathers facts without judgment
- **Analyst** applies frameworks and spots patterns
- **Critic** (the secret sauce) acts as a "proof gate" - challenges everything before it reaches you
- **Synthesizer** creates the final integrated view

The Critic stage catches confident-but-wrong responses. It asks: *"What would a skeptic say? What's the weakest link in this reasoning?"*

---

### 3. Ralph Mode: Iterative Self-Improvement

Named after Geoffrey Huntley's technique - the idea that LLMs can improve through self-critique loops.

**The problem it solves:** Sometimes the first pass is 80% there but has gaps. Instead of surfacing incomplete answers, Ralph mode detects uncertainty and iterates.

**How it works:** After generating a response, the system scans for uncertainty phrases like "more research needed" or "limited information available." If found, it loops back with a self-critique prompt. Maximum 5 iterations, but most queries finish in 1-2.

---

### 4. Memory: Context That Persists

Without memory, every conversation starts from zero. With it, the bots know your team's context.

**Two complementary stores:**

| Store | What It Does | Example Query |
|-------|--------------|---------------|
| **Vector (LanceDB)** | Semantic similarity search | *"Find messages similar to 'pricing strategy'"* |
| **Graph (Graphology)** | Relationship mapping | *"Who discussed this? What was decided?"* |

When Scout researches a topic, it first checks what your team has already discussed. Responses build on existing context.
## The Skeptic's Corner

**"Isn't this over-engineered? Can't you just write a better prompt?"**

Fair question. Here's when single-pass is fine:
- Simple factual lookups
- Formatting/editing tasks
- Code generation with clear specs

Here's when multi-agent shines:
- Open-ended research with unknown unknowns
- Strategic analysis where blind spots matter
- Creative work that benefits from tension
- Anything where being confidently wrong is costly

The overhead is ~4x the API calls. For a $0.01 query, that's $0.04. For research that would take a human 2 hours, that's a bargain.

---

## When It Failed

**Query:** *"Analyze our Q3 sales pipeline"*

**What went wrong:** The Researcher pulled data from memory, but the memory contained outdated Q2 numbers. The Critic didn't catch it because the data looked internally consistent.

**Lesson:** Multi-agent catches reasoning errors, not data freshness issues. We added timestamp awareness to memory retrieval.

---

## The Numbers

| Metric | Single-Pass | Multi-Agent |
|--------|-------------|-------------|
| Response time | ~8 sec | ~45 sec |
| Gap detection | ~60% | ~85% |
| User satisfaction | 3.2/5 | 4.1/5 |
| Cost per query | $0.01-0.03 | $0.04-0.12 |

Worth it for research. Overkill for quick questions.

---

## Commands

| Command | What Happens |
|---------|--------------|
| `!research [topic]` | Full crew pipeline, 4-stage review |
| `!brainstorm [topic]` | Diverge, critique, then converge |
| `!dialectic [topic]` | Thesis vs antithesis to synthesis |
| `!team [topic]` | All 6 agents deliberate |

---

## What We're Still Figuring Out

- **Auto-routing:** When should a query skip the full pipeline?
- **Latency:** Can we parallelize without losing context?
- **Smaller models:** Could fine-tuned specialists replace expensive generalists?

If you're building something similar, compare notes with us. No playbook yet—just experiments.

---

*Built by OPAL Partnership. Ask Scout or Spark anything in the channels.*
