# Research Skill Definition

**Version**: 1.0
**Type**: Multi-Agent Research Pipeline

## Capability
Executes comprehensive research through a 4-stage pipeline with specialized agents that gather, analyze, challenge, and synthesize information.

## Pipeline Stages

### Stage 1: Information Gathering
**Agent**: Senior Research Analyst
**Role**: Gather comprehensive information and identify key insights
**Goal**: Collect relevant data, context, and source material

**Output Schema (STRICT)**:
```
## Research Summary

### Key Facts (LOCKED)
- [Fact 1 with source]
- [Fact 2 with source]
- [Fact 3 with source]

### Stakeholders Identified
- [Stakeholder 1]: [Role/Interest]
- [Stakeholder 2]: [Role/Interest]

### Open Questions
- [Question requiring further investigation]

### Sources
- [Source 1]
- [Source 2]
```

### Stage 2: Analysis & Hypothesis Generation
**Agent**: Strategic Analyst
**Role**: Analyze data and generate hypotheses with supporting evidence
**Goal**: Apply frameworks, identify patterns, generate testable hypotheses

**Output Schema (STRICT)**:
```
## Strategic Analysis

### Framework Applied
[Name of framework: MECE, Porter's, SWOT, etc.]

### Hypotheses (LOCKED)
1. H1: [Hypothesis statement]
   - Evidence: [Supporting data]
   - Confidence: [High/Medium/Low]

2. H2: [Hypothesis statement]
   - Evidence: [Supporting data]
   - Confidence: [High/Medium/Low]

### Pattern Identification
- [Pattern 1]
- [Pattern 2]

### Initial Recommendations
1. [Recommendation 1]
2. [Recommendation 2]
```

### Stage 2.5: Proof Gate (Challenge)
**Agent**: Devil's Advocate
**Role**: Challenge assumptions and identify weaknesses
**Goal**: Stress-test analysis before final synthesis

**Output Schema (STRICT)**:
```
## Critical Review (PROOF GATE)

### Assumptions Challenged
| Assumption | Challenge | Severity |
|------------|-----------|----------|
| [Assumption 1] | [Counter-evidence] | High/Med/Low |

### Risks Identified
- **Risk 1**: [Description] - Mitigation: [Action]
- **Risk 2**: [Description] - Mitigation: [Action]

### Alternative Interpretations
- [Alternative view 1]
- [Alternative view 2]

### Validation Status
- [ ] Logic is sound
- [ ] Evidence is sufficient
- [ ] Recommendations are actionable
- [ ] Risks are addressed

**GATE DECISION**: PASS / REVISE
```

### Stage 3: Synthesis & Recommendations
**Agent**: Synthesis Editor
**Role**: Combine perspectives into actionable output
**Goal**: Produce clear, prioritized recommendations

**Output Schema (STRICT)**:
```
## Final Synthesis

### Executive Summary (LOCKED)
[2-3 sentence summary of findings and recommendation]

### Key Findings
1. [Finding 1]
2. [Finding 2]
3. [Finding 3]

### Recommendations (LOCKED)
| Priority | Recommendation | Rationale | Effort |
|----------|---------------|-----------|--------|
| P0 | [Action] | [Why] | [H/M/L] |
| P1 | [Action] | [Why] | [H/M/L] |
| P2 | [Action] | [Why] | [H/M/L] |

### Next Steps
1. [Immediate action]
2. [Short-term action]
3. [Long-term action]

### Confidence Assessment
Overall confidence in recommendations: [High/Medium/Low]
Key uncertainties: [List]
```

## Constraints
- **LOCKED Blocks**: Content in `(LOCKED)` sections is final output - must be precise
- **Evidence Required**: All claims must cite evidence or sources
- **Structured Output**: Follow schemas exactly for downstream processing
- **Proof Gate**: Stage 2.5 must PASS before proceeding to Stage 3
