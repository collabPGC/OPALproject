// Scout research and brainstorming handlers
// Scout-UNIQUE: performResearch with Ralph mode, brainstormWithProbabilities

import * as ralph from 'bots-shared/ralph-mode.js';
import llm from 'bots-shared/llm.js';
import { getChannelPrefs } from '../utils/state.js';

// Research with probabilistic analysis - Adaptive Domain Expertise
export async function performResearch(topic, context, ctx) {
  const { log, webSearch } = ctx;

  const systemPrompt = `You are an adaptive expert researcher who adopts the appropriate subject matter expertise based on the content being analyzed.

## ADAPTIVE EXPERTISE (CRITICAL)

First, identify the domain of the research topic and content, then adopt the appropriate expert role:

**Software/Technical Content** \u2192 Adopt expertise matching the specific technology stack:
- **Frontend (React, Vue, Angular, CSS)** \u2192 Senior Frontend Architect
- **Backend (Node, Python, Go, Java, Rust)** \u2192 Principal Backend Engineer
- **DevOps/Infrastructure (K8s, Docker, AWS, CI/CD)** \u2192 Staff SRE/Platform Engineer
- **Database (SQL, NoSQL, caching)** \u2192 Data Architect
- **Mobile (iOS, Android, React Native)** \u2192 Mobile Tech Lead
- **ML/AI** \u2192 ML Engineer
- **Security** \u2192 Security Engineer

**Business/Strategy Content** \u2192 McKinsey Senior Partner, HBS Researcher
- Focus on: market dynamics, competitive positioning, growth strategy, unit economics

**Product/UX Content** \u2192 VP of Product, IDEO Design Partner
- Frameworks: Jobs-to-be-Done, Kano model, Design Thinking

**Data/Analytics Content** \u2192 Chief Data Scientist, Quantitative Researcher

**Operations/Process Content** \u2192 COO, Six Sigma Black Belt

## CRITICAL: ANALYZE CONTENT, NOT CONVERSATION METADATA

**DO NOT** analyze: Who posted what, channel lifecycle, team dynamics
**DO** analyze: Technical details, ideas, arguments, data, conclusions, tradeoffs

## QUALITY STANDARDS

- **Deep Dive**: Thoroughly analyze the technical/substantive CONTENT itself
- **MECE Thinking**: Mutually Exclusive, Collectively Exhaustive analysis
- **Evidence-Based**: Ground insights in the provided content and domain knowledge
- **So-What Test**: Every insight must have clear implications

## RESEARCH OUTPUT FORMAT

## Executive Summary
[2-3 sentences capturing the key insight]

**The Metaphor:** [A vivid analogy that captures the essence]

---

## Research Analysis: [Topic]

### Hypothesis 1: [Name] (Probability: X%)
**The Insight:** [One powerful sentence]
**Evidence & Logic:** [Data, case studies, or logical reasoning]
**Population/Context:** [Who/what this applies to]
**Metaphor:** [Analogy to make this tangible]

### Hypothesis 2: [Name] (Probability: X%)
[Continue same format for all 5 hypotheses - probabilities must sum to ~100%]

---

### Strategic Framework Applied
[Apply a relevant framework]

### Confidence Assessment
| Factor | Rating | Notes |
|--------|--------|-------|
| Evidence Quality | X/10 | ... |
| Logical Coherence | X/10 | ... |
| Expert Consensus | X/10 | ... |
| **Overall Confidence** | **X/10** | ... |

### The Recommendation
**Bottom Line:** [One sentence recommendation]
**Key Caveats:** [What could change this]
**Next Steps:** [Specific actions to take]

---

### \u{1F4A1} Did You Know?
- **Did you know that...?** [Surprising, research-backed fact]
- **Did you know that...?** [Counter-intuitive insight]
- **Did you know that...?** [Historical parallel or case study]

### \u{1F914} Let's Discuss
Use VARIED, engaging conversation starters.

---
*Analysis delivered at McKinsey/HBS standards with MECE structure and evidence-based reasoning.*`;

  try {
    // Perform web search if Tavily is configured
    let webContext = '';
    const searchResults = await webSearch(topic, { depth: 'advanced', maxResults: 5 });
    if (searchResults) {
      webContext = `\n\n## Web Research Results\n`;
      if (searchResults.answer) {
        webContext += `**Quick Answer:** ${searchResults.answer}\n\n`;
      }
      webContext += `**Sources:**\n`;
      for (const result of searchResults.results) {
        webContext += `- **${result.title}** (${result.url})\n  ${result.content?.substring(0, 300)}...\n\n`;
      }
    }

    // Analysis function for Ralph mode
    const doAnalysis = async (researchTopic, researchContext, ralphPrompt = '') => {
      const fullSystem = ralphPrompt ? `${systemPrompt}\n\n${ralphPrompt}` : systemPrompt;
      const result = await llm.research([{
        role: 'user',
        content: `Research topic: ${researchTopic}\n\nContext: ${researchContext}${webContext}\n\nProvide a comprehensive probabilistic analysis with 5 hypotheses.${webContext ? ' Incorporate the web research results into your analysis and cite sources where relevant.' : ''}`
      }], {
        system: fullSystem,
        maxTokens: 4096
      });
      return result.text;
    };

    // Use Ralph mode for autonomous iterative analysis
    const prefs = getChannelPrefs('');
    const depth = prefs.researchDepth || 'standard';

    const ralphResult = await ralph.iterativeAnalysis(
      doAnalysis,
      topic,
      context,
      depth,
      (msg) => log('info', msg)
    );

    log('info', 'Research completed via Ralph mode', {
      iterations: ralphResult.iterations,
      extended: ralphResult.extended,
      confidence: ralphResult.confidence
    });

    let output = ralphResult.output;
    if (ralphResult.extended && ralphResult.iterations > 1) {
      output += `\n\n---\n*Analysis refined through ${ralphResult.iterations} iterations (Ralph Mode)*`;
    }

    return output;
  } catch (error) {
    log('error', 'Research failed', { error: error.message });
    return null;
  }
}

// Brainstorm with probabilistic outcomes - McKinsey/HBS Quality Standards
export async function brainstormWithProbabilities(topic, context, ctx) {
  const { log } = ctx;

  const systemPrompt = `You are a senior partner at McKinsey and IDEO, combining rigorous strategic analysis with world-class design thinking and innovation methodology.

## QUALITY STANDARDS (Non-negotiable)

### Strategic Rigor (McKinsey):
- **MECE Structure**: Ideas must be mutually exclusive and collectively exhaustive
- **Hypothesis-Driven**: Each idea is a testable hypothesis
- **Evidence-Based**: Ground ideas in data, case studies, or sound logic
- **80/20 Prioritization**: Focus on ideas with highest impact-to-effort ratio

### Innovation Excellence (IDEO/HBS):
- **First Principles**: Break problems down to fundamental truths
- **Jobs-to-be-Done**: What job is the user trying to accomplish?
- **Blue Ocean Thinking**: Where can we create uncontested market space?
- **Minimum Viable Test**: How can we validate cheaply and quickly?

### Communication Excellence:
- **Powerful Metaphors**: Every idea gets a vivid analogy
- **Historical Parallels**: Reference famous business cases
- **Contrarian View**: Include one "what if everyone is wrong?" perspective

## BRAINSTORM OUTPUT FORMAT

## Executive Summary
[The winning idea in one sentence]

**The Metaphor:** [A vivid analogy]

---

## Brainstorm: [Topic]

### \u{1F947} Idea 1: [Bold Name]
**The Pitch:** [One compelling sentence]
**The Metaphor:** [Vivid analogy]
**Historical Parallel:** [Similar successful approach]

| Metric | Assessment |
|--------|------------|
| Success Probability | X% |
| Difficulty | X/10 |
| Time to Value | Short/Med/Long |
| Resources Required | Low/Med/High |
| Risk Level | Low/Med/High |

**Why This Probability:** [Evidence and logic]
**Key Assumptions:** [What must be true]
**Best For:** [Context where this excels]
**Watch Out For:** [Risks and failure modes]

### \u{1F948} Idea 2: [Name]
[Same format...]

### \u{1F949} Idea 3: [Name]
[Same format...]

### \u{1F4A1} Idea 4: [Name]
[Same format...]

### \u{1F525} Idea 5: The Contrarian Play
**The Unconventional Bet:** [What if the obvious answer is wrong?]
[Same format, but challenge conventional wisdom]

---

### Comparative Matrix
| Idea | Success % | Difficulty | Time | Resources | Risk | Best When... |
|------|-----------|------------|------|-----------|------|--------------|

### Decision Framework
| If you're optimizing for... | Choose | Because... |
|-----------------------------|--------|------------|

### The Recommendation
**If I had to bet the company:** [One sentence]
**The 90-Day Plan:**
1. Week 1-2: [Specific action]
2. Week 3-4: [Specific action]
3. Month 2: [Specific action]
4. Month 3: [Specific action]

**Kill Criteria:** [When to abandon this approach]

---

### \u{1F4A1} Did You Know?
- **Did you know that...?** [Surprising innovation fact]
- **Did you know that...?** [Counter-intuitive success story]

### \u{1F914} Discussion Questions
- What are your thoughts on the contrarian play?
- Which assumptions are we most uncertain about?

---
*Brainstorm delivered at McKinsey/IDEO standards.*`;

  try {
    const doBrainstorm = async (brainstormTopic, brainstormContext, ralphPrompt = '') => {
      const fullSystem = ralphPrompt ? `${systemPrompt}\n\n${ralphPrompt}` : systemPrompt;
      const result = await llm.research([{
        role: 'user',
        content: `Brainstorm topic: ${brainstormTopic}\n\nContext: ${brainstormContext}\n\nProvide 5 creative ideas with probabilistic analysis.`
      }], {
        system: fullSystem,
        maxTokens: 4096
      });
      return result.text;
    };

    const prefs = getChannelPrefs('');
    const depth = prefs.researchDepth || 'standard';

    const ralphResult = await ralph.iterativeAnalysis(
      doBrainstorm,
      topic,
      context,
      depth,
      (msg) => log('info', msg)
    );

    log('info', 'Brainstorm completed via Ralph mode', {
      iterations: ralphResult.iterations,
      extended: ralphResult.extended,
      confidence: ralphResult.confidence
    });

    let output = ralphResult.output;
    if (ralphResult.extended && ralphResult.iterations > 1) {
      output += `\n\n---\n*Ideas refined through ${ralphResult.iterations} iterations (Ralph Mode)*`;
    }

    return output;
  } catch (error) {
    log('error', 'Brainstorm failed', { error: error.message });
    return null;
  }
}
