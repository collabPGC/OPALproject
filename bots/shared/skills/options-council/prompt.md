# Options Council Prompt - Multi-Perspective Strategic Analysis

You are convening a **Strategic Options Council** - a structured multi-perspective debate where diverse strategic options are presented, advocated for, critiqued, and synthesized into actionable recommendations.

## The Process

1. **Option Generation**: Generate 4-6 distinct strategic approaches
2. **Advocacy Round**: Each option is championed by an advocate
3. **Critique Round**: Devil's advocates challenge each option
4. **Comparison**: Systematic comparison across criteria
5. **Synthesis**: Integrate best elements into recommendations

## Topic for Council

{{topic}}

## Context
{{context}}

---

## Phase: {{phase}}

{{#if phase_generate}}
### OPTION GENERATION PHASE

Generate {{num_options}} distinct strategic options for: {{topic}}

Each option should represent a meaningfully different approach:

**Option 1: Aggressive/Bold**
- Philosophy: Move fast, capture market, accept higher risk
- Key characteristics: [describe approach]

**Option 2: Moderate/Balanced**
- Philosophy: Balance risk and opportunity
- Key characteristics: [describe approach]

**Option 3: Conservative/Defensive**
- Philosophy: Minimize risk, protect existing position
- Key characteristics: [describe approach]

**Option 4: Innovative/Disruptive**
- Philosophy: Challenge conventional thinking, create new paradigm
- Key characteristics: [describe approach]

For each option, provide:
- **Name**: Descriptive title
- **Philosophy**: Core principle/approach
- **Key Actions**: 3-5 specific steps
- **Resource Requirements**: Investment, team, time
- **Expected Outcomes**: Success metrics
- **Key Risks**: Top 3 risks
{{/if}}

{{#if phase_advocacy}}
### ADVOCACY PHASE

You are the **Champion for Option {{option_number}}: {{option_name}}**

Make the strongest possible case FOR this option:

**Why This Option is Superior:**
1. [Strongest argument]
2. [Second strongest]
3. [Third strongest]

**Unique Advantages Only This Option Provides:**
- [Advantage 1]
- [Advantage 2]

**Why Alternative Options Are Inferior:**
- Option X fails because...
- Option Y misses the point that...

**Evidence and Precedent:**
- [Case study / data supporting this approach]

**Response to Likely Objections:**
- Objection: [anticipated criticism]
  Response: [compelling counter]
{{/if}}

{{#if phase_critique}}
### CRITIQUE PHASE

You are the **Devil's Advocate** reviewing all options.

For each option, provide rigorous critique:

**Option {{option_number}}: {{option_name}}**

**Fatal Flaws:**
- [Critical weakness that could cause failure]

**Hidden Risks:**
- [Risk not acknowledged in advocacy]

**Optimistic Assumptions:**
- [Assumption that may not hold]

**Missing Considerations:**
- [Factor not addressed]

**Comparison Weakness:**
- [How another option handles this better]

**Risk Score: [1-5]** with justification
{{/if}}

{{#if phase_compare}}
### COMPARISON MATRIX PHASE

Create comprehensive comparison:

| Criterion | Option 1 | Option 2 | Option 3 | Option 4 |
|-----------|----------|----------|----------|----------|
| Feasibility (1-5) | | | | |
| ROI Potential (1-5) | | | | |
| Time to Value | | | | |
| Resource Needs | | | | |
| Risk Level (1-5) | | | | |
| Strategic Fit (1-5) | | | | |
| Scalability (1-5) | | | | |
| **TOTAL SCORE** | | | | |

**Winner by Criterion:**
- Best Feasibility: Option X because...
- Best ROI: Option Y because...
- Fastest to Value: Option Z because...
- Lowest Risk: Option W because...

**Trade-off Analysis:**
- If priority is speed: Choose Option X
- If priority is certainty: Choose Option Y
- If priority is scale: Choose Option Z
{{/if}}

{{#if phase_synthesize}}
### SYNTHESIS PHASE

Based on the full council debate:

**Primary Recommendation: [Option Name]**

*Rationale:* [Why this option wins overall]

**Hybrid Enhancement:**
Incorporate the best elements from other options:
- From Option X: [Element to include]
- From Option Y: [Element to include]

**Implementation Sequence:**
1. Phase 1 (0-3 months): [Actions]
2. Phase 2 (3-6 months): [Actions]
3. Phase 3 (6-12 months): [Actions]

**Decision Gates:**
- At [milestone], evaluate [criteria] - if [condition], pivot to [alternative]

**Risk Mitigation from Council:**
- Key risk identified: [risk]
- Mitigation: [action]

**Minority Opinion:**
[Summarize dissenting view and when it would become the better choice]

**Final Recommendation:**
[Clear, actionable recommendation with confidence level]
{{/if}}

---

## Output Guidelines

- Each option should be genuinely viable, not a straw man
- Advocacy should be passionate but intellectually honest
- Critique should be fair but unflinching
- Synthesis should be more than splitting the difference
- End with clear, actionable recommendation
