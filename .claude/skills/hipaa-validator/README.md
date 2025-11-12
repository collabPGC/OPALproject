# HIPAA Validator Skill

**Capability:** Quality (Security & Compliance)
**Version:** 1.0.0
**Status:** Active

## Purpose

Automated validation of code and features against HIPAA Security Rule and Privacy Rule requirements.

## Usage

```bash
# Command-line usage (when implemented)
hipaa-validator --check-all --code-path [path] --phi-scope [description]

# As a skill invocation from agents
{
  "skill": "hipaa-validator",
  "parameters": {
    "check_all": true,
    "code_path": "src/messaging/",
    "phi_scope": "patient-identifiers,clinical-notes"
  }
}
```

## Validation Checklist

### ✅ Encryption at Rest (§ 164.312(a)(2)(iv))
- [ ] PHI stored with AES-256 or equivalent encryption
- [ ] Encryption keys managed securely (not hardcoded)
- [ ] Database encryption enabled (TDE or column-level)
- [ ] File system encryption for PHI-containing files

### ✅ Encryption in Transit (§ 164.312(e)(1))
- [ ] TLS 1.2 or higher for all PHI transmission
- [ ] Certificate validation enabled
- [ ] No cleartext PHI in network traffic
- [ ] VPN or equivalent for remote access

### ✅ Access Controls (§ 164.312(a)(1))
- [ ] Authentication required (preferably MFA)
- [ ] Role-based access control (RBAC) implemented
- [ ] Minimum necessary access enforced
- [ ] Access termination for departed users
- [ ] Timeout/auto-logout for inactive sessions

### ✅ Audit Logging (§ 164.312(b))
- [ ] All PHI access logged (read, write, delete)
- [ ] Logs include: timestamp, user ID, action, data accessed
- [ ] Logs stored securely and tamper-evident
- [ ] Log retention for 7 years minimum
- [ ] Regular log review process

### ✅ Integrity Controls (§ 164.312(c)(1))
- [ ] Data validation on input
- [ ] Checksums or digital signatures for PHI
- [ ] Version control for medical records
- [ ] Protection against unauthorized alteration

### ✅ Person or Entity Authentication (§ 164.312(d))
- [ ] Unique user identification
- [ ] Password complexity requirements
- [ ] Multi-factor authentication for remote access
- [ ] Session management and token expiration

### ✅ Transmission Security (§ 164.312(e)(1))
- [ ] End-to-end encryption for messaging
- [ ] Secure protocols for file transfer
- [ ] No PHI in email unless encrypted
- [ ] Secure disposal of transmission records

### ✅ Minimum Necessary (§ 164.502(b))
- [ ] Users see only PHI needed for their role
- [ ] Query results filtered by authorization
- [ ] Bulk exports require justification
- [ ] UI/API enforces need-to-know principle

### ✅ Data Retention & Disposal (§ 164.310(d)(2)(i))
- [ ] Retention policy defined and implemented
- [ ] Automated deletion after retention period
- [ ] Secure disposal (crypto shredding, wiping)
- [ ] Disposal logging and verification

### ✅ Breach Notification Readiness (§ 164.404-414)
- [ ] System can identify affected individuals
- [ ] Audit logs sufficient for breach investigation
- [ ] Incident response plan documented
- [ ] Notification templates prepared

## Output Format

```json
{
  "validation_id": "hipaa-val-2025-11-12-001",
  "timestamp": "2025-11-12T10:30:00Z",
  "code_path": "src/messaging/",
  "phi_scope": "patient-identifiers,clinical-notes",
  "risk_level": "HIGH",
  "results": {
    "encryption_at_rest": { "status": "PASS", "details": "AES-256 encryption verified" },
    "encryption_in_transit": { "status": "PASS", "details": "TLS 1.3 in use" },
    "access_controls": { "status": "PASS", "details": "MFA enabled, RBAC configured" },
    "audit_logging": { "status": "FAIL", "details": "Missing recipient logging in messages", "severity": "HIGH" },
    "integrity_controls": { "status": "PASS", "details": "Input validation present" },
    "authentication": { "status": "PASS", "details": "Strong authentication mechanisms" },
    "transmission_security": { "status": "PASS", "details": "End-to-end encryption verified" },
    "minimum_necessary": { "status": "PASS", "details": "Role-based filtering in place" },
    "data_retention": { "status": "FAIL", "details": "No auto-deletion policy", "severity": "MEDIUM" },
    "breach_readiness": { "status": "PASS", "details": "Audit trail sufficient" }
  },
  "overall_status": "FAIL",
  "blocking_issues": [
    {
      "issue": "Incomplete audit logging",
      "regulation": "§ 164.312(b)",
      "severity": "HIGH",
      "remediation": "Add message recipient logging to audit trail"
    },
    {
      "issue": "Data retention policy not implemented",
      "regulation": "§ 164.316(b)(2)(i)",
      "severity": "MEDIUM",
      "remediation": "Implement auto-deletion after 90 days or document extended retention justification"
    }
  ],
  "warnings": [],
  "recommendations": [
    "Consider implementing message expiration warnings to users",
    "Add automated compliance testing to CI/CD pipeline"
  ]
}
```

## Implementation Notes

This is a **skill specification** - the actual implementation would be a Python module or standalone tool that:

1. **Static Analysis:** Scans code for patterns indicating PHI handling
2. **Configuration Review:** Checks infrastructure as code, DB configs, API settings
3. **Dynamic Testing:** (if applicable) Tests actual encryption, access controls in test environment
4. **Checklist Validation:** Walks through HIPAA requirements systematically

## Integration with Agents

The **Compliance Auditor** agent is the primary consumer of this skill, but other agents can use it:

- **Code Reviewer:** Run as part of PR review for PHI-related code
- **Product Planner:** Use during feature planning to estimate compliance effort
- **Work Coordinator:** Check before deployment to avoid surprises

## Future Enhancements

- [ ] Machine learning to detect PHI in unstructured data
- [ ] Integration with SAST/DAST security tools
- [ ] Automated remediation suggestions with code examples
- [ ] Continuous monitoring mode (not just point-in-time)
- [ ] Custom rule sets for state-specific regulations

## References

- HIPAA Security Rule: 45 CFR Part 164 Subpart C
- HIPAA Privacy Rule: 45 CFR Part 164 Subpart E
- HHS HIPAA Security Series: Technical Safeguards
- NIST SP 800-66 Rev. 2: Implementing HIPAA Security Rule
