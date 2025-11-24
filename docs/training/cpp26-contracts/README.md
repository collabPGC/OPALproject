# C++26 Contracts Training Module
## Required Competency for OPAL Firmware Developers

**Training Duration:** 2-3 hours (self-paced)
**Prerequisites:** C++ programming, basic firmware development
**Status:** Mandatory for all C++ developers

---

## Learning Objectives

By the end of this training, you will be able to:

1. ✅ **Distinguish** between programming bugs (use contracts) and runtime errors (use error handling)
2. ✅ **Write** preconditions and postconditions for firmware APIs
3. ✅ **Identify** side effects in contract predicates
4. ✅ **Apply** contracts to OPAL-specific scenarios (audio, I2C, VoIP, security)
5. ✅ **Configure** contract build modes appropriately
6. ✅ **Review** code for contract best practices violations

---

## Training Modules

### Module 1: Fundamentals (30 min)
📄 **[01-fundamentals.md](01-fundamentals.md)**
- What are contracts?
- Functional safety vs memory safety
- The four contract modes (ignore, observe, enforce, quick_enforce)
- When to use contracts

### Module 2: Writing Contracts (45 min)
📄 **[02-writing-contracts.md](02-writing-contracts.md)**
- Preconditions and postconditions
- Contract predicates (no side effects!)
- Short-circuit evaluation
- Doxygen documentation integration

### Module 3: OPAL-Specific Contracts (45 min)
📄 **[03-opal-examples.md](03-opal-examples.md)**
- Audio pipeline contracts (AEC, I2S)
- I2C hardware contracts (GPIO, pull-ups)
- VoIP stack contracts (SIP, RTP)
- Security/PHI contracts (encryption, TLS)

### Module 4: Code Review & Best Practices (30 min)
📄 **[04-code-review.md](04-code-review.md)**
- Contract review checklist
- Common mistakes and how to avoid them
- Slash commands: `/add-contract`, `/review-contracts`
- Contract coverage metrics

### Module 5: Hands-On Exercises (30 min)
📄 **[05-exercises.md](05-exercises.md)**
- Practical coding exercises
- Review real OPAL code and add contracts
- Identify contract violations
- Quiz and assessment

---

## Skill Assessment

### Passing Criteria
- Score 90% or higher on the quiz (Module 5)
- Complete all hands-on exercises
- Successfully add contracts to 3 practice functions
- Identify 5 common contract violations

### Certification
Upon completion, add your name to the **Certified Developers** list:
📄 **[certified-developers.md](certified-developers.md)**

---

## Quick Reference Materials

### Cheat Sheet
📄 **[contracts-cheat-sheet.md](contracts-cheat-sheet.md)**
- One-page reference for daily use
- Common contract patterns
- DO/DON'T examples

### FAQ
📄 **[faq.md](faq.md)**
- Frequently asked questions
- Troubleshooting common issues

---

## Tools and Resources

### Slash Commands
- `/add-contract` - Add contracts to a function
- `/review-contracts` - Review contract usage

### Documentation
- `CONTRIBUTING.md` - Contract guidelines
- `standards/CODE_STANDARD_CPP.md` - Contract requirements
- `docs/development/cpp26-contracts-integration-plan.md` - Full technical details

### External Resources
- [C++26 Contracts Proposal (P2900R9)](http://wg21.link/p2900r9)
- [GCC Contracts Documentation](https://gcc.gnu.org/onlinedocs/gcc/C_002b_002b-Contracts.html)

---

## Training Schedule

### For New Developers
- **Week 1:** Complete Modules 1-2 (fundamentals + writing)
- **Week 2:** Complete Modules 3-4 (OPAL-specific + code review)
- **Week 3:** Complete Module 5 (hands-on + assessment)
- **Week 4:** Pair programming with certified developer

### For Existing Team
- **Week 1:** All-hands 2-hour workshop (Modules 1-2)
- **Week 2:** Self-paced Modules 3-5, office hours available
- **Week 3:** Assessment and certification

---

## Training Completion Checklist

- [ ] Read Module 1: Fundamentals
- [ ] Read Module 2: Writing Contracts
- [ ] Read Module 3: OPAL-Specific Contracts
- [ ] Read Module 4: Code Review & Best Practices
- [ ] Complete Module 5: Hands-On Exercises
- [ ] Pass assessment (90%+)
- [ ] Add name to certified developers list
- [ ] Add contracts to 3 real OPAL functions (supervised)
- [ ] Participate in contract code review (supervised)

---

## Getting Help

- **Office Hours:** Fridays 2-3pm (contract questions)
- **Slack Channel:** #cpp-contracts
- **Code Review:** Tag `@contracts-champion` in PRs

---

## Trainer Notes

### Workshop Delivery (2-hour session)
1. **Introduction (10 min)**
   - Why contracts matter for safety-critical firmware
   - Overview of OPAL use cases

2. **Fundamentals (30 min)**
   - Contracts vs assertions vs error handling
   - Live coding: Simple contract examples
   - Q&A

3. **OPAL-Specific Examples (40 min)**
   - Walk through audio pipeline contracts
   - Walk through I2C hardware contracts
   - Security/PHI contracts (HIPAA relevance)
   - Q&A

4. **Hands-On Practice (30 min)**
   - Attendees add contracts to sample functions
   - Group review and discussion
   - Common mistakes discussion

5. **Wrap-Up (10 min)**
   - Assessment overview
   - Resources and next steps
   - Certification process

---

**Last Updated:** 2025-11-24
**Module Owner:** Development Team Lead
**Review Cycle:** Quarterly
