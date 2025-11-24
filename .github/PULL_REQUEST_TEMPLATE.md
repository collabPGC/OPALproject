# Pull Request

## Description

<!-- Provide a clear and concise description of your changes -->

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)

## Related Issues

<!-- Link to related issues using #issue_number -->
Fixes #
Related to #

## Changes Made

<!-- List the main changes in bullet points -->
-
-
-

## Testing

<!-- Describe the tests you ran to verify your changes -->

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

**Test Configuration:**
- Hardware:
- Firmware version:
- Build configuration:

**Test Results:**
```
<!-- Paste relevant test output here -->
```

## Code Quality Checklist

### General
- [ ] Code follows the project's coding standards
- [ ] Self-review of code completed
- [ ] Code is commented, particularly in hard-to-understand areas
- [ ] No unnecessary console logs or debug code
- [ ] Documentation updated (if applicable)

### Python Code (if applicable)
- [ ] Formatted with `black`
- [ ] Linted with `ruff`
- [ ] Follows Google Python Style Guide
- [ ] Type hints added where appropriate

### TypeScript/JavaScript Code (if applicable)
- [ ] Formatted with `Prettier`
- [ ] Linted with `ESLint`
- [ ] TSDoc documentation added

### C++ Code (if applicable)
- [ ] Doxygen documentation added
- [ ] **C++26 Contracts added (see below)**

---

## C++26 Contracts Review (Required for C++ Code)

> **Note:** All C++ firmware code must include contracts. See `CONTRIBUTING.md` and `standards/CODE_STANDARD_CPP.md` for guidelines.

### Contract Coverage
- [ ] All new public APIs have preconditions documented
- [ ] All new public APIs have postconditions (where applicable)
- [ ] Existing modified APIs updated with contracts (if missing)
- [ ] Contract coverage: ___% of modified/new public functions

### Contract Quality
- [ ] ✅ Contracts express **programming bugs**, not runtime errors
- [ ] ✅ No **side effects** in contract predicates
- [ ] ✅ Compound conditions use **short-circuit evaluation** (`&&`, `||`)
- [ ] ✅ Doxygen comments include matching `@pre` and `@post` tags
- [ ] ✅ Contract build mode appropriate for module (see table below)
- [ ] ✅ No contracts on virtual functions (use `contract_assert` instead)

### Contract Examples from This PR

<!-- Provide 1-2 examples of contracts added in this PR -->

**Example 1:**
```cpp
/**
 * @brief [Function description]
 * @pre [Precondition]
 * @post [Postcondition]
 */
void function_name(...)
    pre: [condition]
    post: [condition]
{
    // Implementation
}
```

**Example 2:**
```cpp
// [If applicable]
```

### Contract Mode Configuration

Module contract mode confirmed:

| Module | Mode | Reasoning |
|--------|------|-----------|
| [module_name] | [ignore/observe/enforce/quick_enforce] | [brief explanation] |

### Contract Review Tools Used

- [ ] `/add-contract` slash command used
- [ ] `/review-contracts` slash command used
- [ ] Manual review completed
- [ ] Static analysis passed (CI)

### Common Contract Mistakes Avoided

<!-- Check all that apply -->

- [x] ✅ No side effects (e.g., `log_call()`, `counter++`)
- [x] ✅ No split conditions with pointer dereference
- [x] ✅ No external input validation (sensor, network, user input)
- [x] ✅ No contracts on virtual functions

---

## Security Checklist (if applicable)

- [ ] No hardcoded secrets or credentials
- [ ] PHI data handled securely (TLS 1.3, encryption contracts)
- [ ] Input validation performed at system boundaries
- [ ] Sensitive data not logged

## Performance Impact

<!-- Describe any performance implications -->

- [ ] No significant performance impact
- [ ] Performance tested and acceptable
- [ ] Performance benchmarks included

**Benchmark Results:**
```
<!-- If applicable -->
```

## Deployment Notes

<!-- Any special deployment instructions or considerations -->

- [ ] No database migrations required
- [ ] No configuration changes required
- [ ] Backward compatible

## Screenshots (if applicable)

<!-- Add screenshots for UI changes -->

## Additional Context

<!-- Add any other context about the PR here -->

---

## Reviewer Checklist

### For Reviewers: Contract Review Focus

When reviewing C++ code, pay special attention to:

1. **Contract Coverage**
   - Are contracts present on all new/modified public APIs?
   - Are contracts appropriate (bugs vs runtime errors)?

2. **Contract Safety**
   - No side effects in predicates?
   - Short-circuit evaluation used correctly?
   - No split conditions that could crash?

3. **Contract Documentation**
   - Doxygen `@pre` and `@post` match actual contracts?
   - Contract rationale clear (hardware constraints, etc.)?

4. **Contract Modes**
   - Build mode appropriate for module criticality?
   - Security-critical code uses `quick_enforce`?

**Use `/review-contracts` command to assist review.**

---

## Definition of Done

- [ ] Code review approved by at least one maintainer
- [ ] All CI checks passing
- [ ] Contracts added and reviewed (C++ code)
- [ ] Documentation updated
- [ ] No merge conflicts
- [ ] Ready to merge

---

**By submitting this PR, I confirm that:**
- I have read and followed the `CONTRIBUTING.md` guidelines
- My code adheres to the project's coding standards
- I have added appropriate tests for my changes
- I have updated documentation as needed
- For C++ code: I have added contracts and they follow best practices
