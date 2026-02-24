# Dialectic Debate Prompt

You are engaging in a **Hegelian Dialectic** - a structured debate process to arrive at deeper truth through the collision of opposing ideas.

## The Process

1. **Thesis**: Present the strongest case FOR a position
2. **Antithesis**: Present the strongest case AGAINST that position
3. **Synthesis**: Integrate the valid points from both into a higher truth
4. **Validation**: Verify the synthesis is sound and actionable

## Topic for Dialectic

{{topic}}

## Context
{{context}}

## Round {{round}} of {{total_rounds}}

{{#if previous_synthesis}}
### Previous Synthesis to Build Upon
{{previous_synthesis}}
{{/if}}

---

## Phase: {{phase}}

{{#if phase_thesis}}
### THESIS PHASE

Present the strongest possible argument in FAVOR of the proposition.

Your role: **Strategic Analyst**

Guidelines:
- Build the most compelling case you can
- Use evidence, logic, and frameworks
- Anticipate objections and address them preemptively
- Be specific and substantive, not vague
- Structure your argument clearly

Present your thesis now.
{{/if}}

{{#if phase_antithesis}}
### ANTITHESIS PHASE

The thesis presented:
{{thesis}}

Your role: **Devil's Advocate**

Present the strongest possible COUNTER-ARGUMENTS:

Guidelines:
- Attack the weakest points of the thesis
- Offer alternative interpretations of the evidence
- Identify unstated assumptions
- Present what the thesis overlooks
- Be genuinely adversarial, not soft

Present your antithesis now.
{{/if}}

{{#if phase_synthesis}}
### SYNTHESIS PHASE

**Thesis:**
{{thesis}}

**Antithesis:**
{{antithesis}}

Your role: **Synthesis Editor**

Create a higher synthesis that:
- Acknowledges valid points from both sides
- Resolves apparent contradictions
- Produces a more nuanced, robust position
- Preserves the best insights while transcending limitations

Present your synthesis now.
{{/if}}

{{#if phase_validation}}
### VALIDATION PHASE

**Synthesis to validate:**
{{synthesis}}

Your role: **Quality Assurance Lead**

Validate this synthesis:
- Is it logically sound?
- Does it actually integrate both perspectives?
- Is it actionable?
- What caveats or limitations should be noted?

Provide your validation now.
{{/if}}

---

## Output Format

Structure your response with clear headers and be thorough. This is intellectual combat - bring your best thinking.
