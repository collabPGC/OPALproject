# WSJF Calculator Skill

**Capability:** Planning
**Version:** 1.0.0
**Status:** Active

## Purpose

Calculate Weighted Shortest Job First (WSJF) scores for features and epics to enable evidence-based prioritization.

## SAFe WSJF Formula

```
WSJF = Cost of Delay / Job Size

where:
Cost of Delay = User-Business Value + Time Criticality + Risk Reduction | Opportunity Enablement

Job Size = Effort estimate (story points or T-shirt size)
```

## Usage

```bash
# Command-line usage (when implemented)
wsjf-calculator --user-value 8 --time-criticality 5 --risk-reduction 3 --effort 5

# As a skill invocation from agents
{
  "skill": "wsjf-calculator",
  "parameters": {
    "user_business_value": 8,
    "time_criticality": 5,
    "risk_reduction_opportunity_enablement": 3,
    "job_size": 5
  }
}
```

## Scoring Guidelines

### User-Business Value (1-10)
**Question:** How much value does this deliver to users or the business?

- **10:** Critical patient safety feature or major revenue impact
- **8-9:** High-value feature with significant user benefit
- **5-7:** Moderate value, nice to have improvement
- **3-4:** Minor value, small enhancement
- **1-2:** Negligible direct value (e.g., internal refactoring)

**OPAL Healthcare Context:**
- Life-saving features = 10
- Care quality improvements = 8-9
- Efficiency gains for clinicians = 6-7
- Administrative convenience = 3-4

### Time Criticality (1-10)
**Question:** How time-sensitive is this? What happens if we delay?

- **10:** Regulatory deadline or patient safety emergency
- **8-9:** Competitive threat or significant opportunity cost
- **5-7:** Some urgency, but not critical
- **3-4:** Can wait, minimal urgency
- **1-2:** No time pressure

**OPAL Healthcare Context:**
- Compliance deadline (e.g., HIPAA) = 10
- Patient safety issue = 9-10
- Seasonal needs (e.g., flu season) = 7-8
- General feature request = 3-5

### Risk Reduction | Opportunity Enablement (1-10)
**Question:** Does this reduce technical/business risk OR enable future opportunities?

- **10:** Eliminates major technical debt or enables critical future work
- **8-9:** Significant risk reduction or enablement
- **5-7:** Moderate risk/opportunity impact
- **3-4:** Minor risk/opportunity impact
- **1-2:** Negligible risk/opportunity impact

**OPAL Healthcare Context:**
- Fixes potential HIPAA violation = 10
- Enables integration with major EHR = 9
- Reduces infrastructure costs = 6-7
- Refactors old code = 4-5

### Job Size (1-20 story points or T-shirt: XS=1, S=3, M=5, L=8, XL=13, XXL=20)
**Question:** How much effort is required?

Use team's historical velocity and estimation practices.

**OPAL Healthcare Context:**
- Simple UI change = XS (1)
- New screen or endpoint = S (3)
- New feature with backend+frontend = M (5)
- Complex integration (e.g., EHR) = L (8)
- Major architectural change = XL (13)
- Full subsystem = XXL (20)

## Output Format

```json
{
  "feature_id": "OPAL-123",
  "feature_name": "Nurse-to-Nurse Secure Messaging",
  "wsjf_calculation": {
    "user_business_value": 8,
    "time_criticality": 7,
    "risk_reduction_opportunity_enablement": 6,
    "cost_of_delay": 21,
    "job_size": 5,
    "wsjf_score": 4.2
  },
  "interpretation": {
    "priority_level": "HIGH",
    "rationale": "Strong value (8) with notable urgency (7). Good risk reduction (6). Manageable size (5). WSJF of 4.2 places this in top quartile.",
    "recommendation": "Prioritize for next sprint or current PI."
  },
  "context": {
    "timestamp": "2025-11-12T10:45:00Z",
    "calculated_by": "product-planner",
    "reviewed_by": null
  }
}
```

## Comparative Scoring

When comparing multiple features, rank by WSJF score (descending):

| Feature | Value | Criticality | Risk/Opp | CoD | Size | **WSJF** | Priority |
|---------|-------|-------------|----------|-----|------|----------|----------|
| Secure Messaging | 8 | 7 | 6 | 21 | 5 | **4.2** | 1st |
| Vitals Display | 7 | 6 | 4 | 17 | 3 | **5.7** | 2nd |
| Admin Dashboard | 5 | 3 | 2 | 10 | 8 | **1.25** | 3rd |

**Note:** Vitals Display has higher WSJF (5.7) than Secure Messaging (4.2) because it's smaller (3 vs 5), despite lower absolute value. This is intentional—WSJF favors high value + small size.

## Integration with Planning

### During Backlog Refinement
Product Planner uses WSJF to:
1. Score all candidate features
2. Rank by WSJF score
3. Present ranked list to stakeholders
4. Discuss any controversial scores

### During PI Planning
1. Start with highest WSJF features
2. Fill sprint capacity in WSJF order
3. Make trade-offs explicit when deviating from WSJF ranking
4. Document why lower-WSJF items were prioritized (if any)

### Handling Ties
If WSJF scores are very close (within 0.5):
- Consider strategic alignment
- Check dependencies
- Consult stakeholders
- Look at team preferences/expertise

## Anti-Patterns to Avoid

❌ **Gaming the System:** Inflating scores to boost favorite features
❌ **Ignoring WSJF:** Calculating but not using it for decisions
❌ **One-Person Scoring:** Scores should involve multiple perspectives
❌ **Set and Forget:** Re-score periodically as context changes
❌ **Size Manipulation:** Don't artificially reduce size estimates to boost WSJF

## Healthcare-Specific Considerations

### Patient Safety Always Wins
If a feature has patient safety implications:
- User-Business Value should be 9-10 automatically
- Time Criticality may be 9-10 if urgent
- WSJF will naturally be very high
- **Exception:** Patient safety features can bypass WSJF entirely

### Regulatory Compliance
Compliance-driven features (e.g., HIPAA):
- Time Criticality = 10 if there's a deadline
- Risk Reduction = 9-10 (non-compliance risk is high)
- These will rank high in WSJF naturally

### Integration vs. Feature Work
Integrations (EHR, Nurse Call) often have:
- Lower immediate User-Business Value (infrastructure)
- Higher Opportunity Enablement (enables future features)
- Larger Job Size (complex)
- Result: Lower WSJF, but strategically critical

**Recommendation:** Create a separate "Enabler" backlog for infrastructure/integration work with its own WSJF ranking.

## Example: OPAL Feature Scoring

### Feature: "Emergency Code Blue Alert"
**Description:** Broadcast Code Blue emergency to all nearby nurses' wearables

- **User-Business Value:** 10 (life-saving, critical patient safety)
- **Time Criticality:** 9 (needed before hospital pilot)
- **Risk Reduction:** 7 (reduces response time risk)
- **Cost of Delay:** 10 + 9 + 7 = 26
- **Job Size:** 5 (moderate complexity, backend + frontend + notification)
- **WSJF:** 26 / 5 = **5.2**

**Interpretation:** Extremely high priority. Top of backlog.

### Feature: "Shift Schedule Export to CSV"
**Description:** Allow nurses to export their schedules to CSV file

- **User-Business Value:** 4 (nice convenience, not critical)
- **Time Criticality:** 2 (no urgency)
- **Risk Reduction:** 1 (negligible)
- **Cost of Delay:** 4 + 2 + 1 = 7
- **Job Size:** 2 (very simple, just export logic)
- **WSJF:** 7 / 2 = **3.5**

**Interpretation:** Medium priority. Nice to have, easy to do. Could fit in sprint if capacity allows.

## Implementation Notes

This is a **skill specification** - the actual implementation would be:

1. **Simple Calculator:** Python/JS function that takes inputs, returns WSJF
2. **Interactive Tool:** Web form or CLI that prompts for each dimension
3. **Batch Processor:** Reads backlog from Jira/CSV, scores all items
4. **Dashboard:** Visualizes WSJF rankings with charts

## Integration with Agents

- **Product Planner:** Primary user, scores features during backlog refinement
- **Capacity Planner:** Uses WSJF rankings to fill sprint capacity
- **RTE Coordinator:** Uses WSJF for Program Increment planning
- **Product Owner:** Reviews WSJF scores to validate prioritization

## References

- SAFe WSJF Guide: https://scaledagileframework.com/wsjf/
- SAFe Economic Framework
- Don Reinertsen, "Principles of Product Development Flow"
- .github/spec-kit/modules/WSJF-Calculator.ps1 (existing implementation)
