# Dialectic Skill Definition

**Version**: 1.0
**Type**: Multi-Agent Debate Pipeline

## Capability
Executes dialectic reasoning through structured debate between thesis and antithesis agents, converging to synthesized truth through iterative refinement.

## Philosophy
Based on Hegelian dialectic:
- **Thesis**: Initial position or proposition
- **Antithesis**: Counter-position that negates or challenges
- **Synthesis**: Higher truth that reconciles both perspectives

## Pipeline Stages

### Stage 1: Thesis Presentation
**Agent**: Strategic Analyst
**Role**: Present strong initial position with supporting arguments
**Goal**: Establish well-reasoned thesis

**Output Schema (STRICT)**:
```
## THESIS

### Core Proposition (LOCKED)
[Single clear statement of position]

### Supporting Arguments
1. **Argument 1**: [Claim]
   - Evidence: [Data/Logic]
   - Strength: [Strong/Moderate/Weak]

2. **Argument 2**: [Claim]
   - Evidence: [Data/Logic]
   - Strength: [Strong/Moderate/Weak]

3. **Argument 3**: [Claim]
   - Evidence: [Data/Logic]
   - Strength: [Strong/Moderate/Weak]

### Underlying Assumptions
- [Assumption 1]
- [Assumption 2]

### Predicted Objections
- [Objection 1]: [Pre-emptive response]
```

### Stage 2: Antithesis Challenge
**Agent**: Devil's Advocate
**Role**: Present strongest counter-arguments
**Goal**: Expose weaknesses, offer alternatives

**Output Schema (STRICT)**:
```
## ANTITHESIS

### Counter-Proposition (LOCKED)
[Direct challenge to thesis]

### Refutations
1. **Against Argument 1**:
   - Flaw: [Logical/evidential weakness]
   - Counter-evidence: [Alternative data]

2. **Against Argument 2**:
   - Flaw: [Logical/evidential weakness]
   - Counter-evidence: [Alternative data]

### Alternative Perspective
[Entirely different framing of the problem]

### Challenged Assumptions
| Assumption | Why It's Problematic |
|------------|---------------------|
| [Assumption 1] | [Challenge] |
| [Assumption 2] | [Challenge] |

### Strongest Counter-Argument (LOCKED)
[The single most compelling reason to reject the thesis]
```

### Stage 3: Synthesis
**Agent**: Synthesis Editor
**Role**: Reconcile thesis and antithesis
**Goal**: Produce higher truth incorporating valid points from both

**Output Schema (STRICT)**:
```
## SYNTHESIS

### Reconciled Position (LOCKED)
[New position that transcends the debate]

### What Survives from Thesis
- [Valid point 1]
- [Valid point 2]

### What Survives from Antithesis
- [Valid challenge 1]
- [Valid challenge 2]

### What's Transcended
- [Limitation of thesis]
- [Limitation of antithesis]

### New Understanding
[How the synthesis provides insight neither side alone offered]

### Remaining Tensions
- [Unresolved tension 1]
- [Unresolved tension 2]
```

### Stage 4: Validation (Proof Gate)
**Agent**: Quality Assurance Lead
**Role**: Validate synthesis quality
**Goal**: Ensure synthesis is genuine progress, not false compromise

**Output Schema (STRICT)**:
```
## VALIDATION (PROOF GATE)

### Synthesis Quality Check
| Criterion | Status | Notes |
|-----------|--------|-------|
| Addresses core thesis | ✓/✗ | [Explanation] |
| Incorporates valid antithesis | ✓/✗ | [Explanation] |
| Provides new insight | ✓/✗ | [Explanation] |
| Is actionable | ✓/✗ | [Explanation] |
| Avoids false compromise | ✓/✗ | [Explanation] |

### Recommendation
**VERDICT**: ACCEPT / REQUEST REVISION / ESCALATE

### Final Output (LOCKED)
[Approved synthesis statement]
```

## Iteration Rules
- If PROOF GATE fails, return to Stage 1 with accumulated insights
- Maximum 3 rounds recommended
- Each round should produce increasingly refined synthesis

## Use Cases
- Strategic decision-making with competing priorities
- Risk assessment requiring multiple perspectives
- Innovation where conventional thinking is limiting
- Conflict resolution between stakeholder positions
