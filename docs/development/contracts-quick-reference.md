# C++26 Contracts Quick Reference
## For OPAL Firmware Development

---

## The 5-Second Summary

**Contracts = Explicit Assumptions in Your API**

```cpp
// Before: Implicit assumption
void process(int* data, size_t len) {
    // Hope caller passed valid pointer...
}

// After: Explicit contract
void process(int* data, size_t len)
    pre: data != nullptr && len > 0
{
    // Compiler/runtime can verify assumption
}
```

---

## When to Use Contracts (OPAL-Specific)

| Scenario | Use Contract? | Example |
|----------|---------------|---------|
| Hardware constraint (AEC 16kHz only) | ✅ YES | `pre: sample_rate == 16000` |
| I2C pin assignment (GPIO7/8 only) | ✅ YES | `pre: scl == GPIO7 && sda == GPIO8` |
| Pointer validity check | ✅ YES | `pre: buffer != nullptr` |
| **External sensor reading validation** | ❌ NO | Use `if (temp < -40) return ERROR;` |
| **Network packet validation** | ❌ NO | Use normal error handling |
| **User input checking** | ❌ NO | Use validation functions |

**Rule of Thumb:**
- **Contracts** = "This should never happen in correct code" (programming bug)
- **Error Handling** = "This might happen in normal operation" (runtime error)

---

## The Four Contract Modes

| Mode | When to Use | OPAL Example |
|------|-------------|--------------|
| **ignore** | Production release builds | Audio pipeline (performance-critical) |
| **observe** | Production monitoring | VoIP stack (detect edge cases) |
| **enforce** | Development/testing | All modules during development |
| **quick_enforce** | Security-critical code | PHI encryption, authentication |

---

## Contract Best Practices Checklist

### ✅ DO:
```cpp
// Express hardware/algorithm constraints
void aec_init(uint32_t rate)
    pre: rate == 16000  // AEC only works at 16kHz
{ ... }

// Use short-circuit evaluation for safety
void process(Data* p)
    pre: p != nullptr && p->is_valid()
{ ... }

// Document in Doxygen
/**
 * @brief Initialize I2C bus
 * @pre sda_pin == GPIO8 && scl_pin == GPIO7
 * @pre external_pullups_4k7_installed()
 */
void i2c_init(gpio_num_t sda, gpio_num_t scl)
    pre: sda == GPIO_NUM_8 && scl == GPIO_NUM_7
{ ... }
```

### ❌ DON'T:
```cpp
// NO side effects in predicates
void func()
    pre: log_call() && validate()  // ❌ Side effect!
{ ... }

// NO contracts for external input
void handle_sensor(int temp)
    pre: temp >= -40 && temp <= 125  // ❌ This is validation!
{ ... }

// NO split conditions (breaks short-circuit)
void process(Data* p)
    pre: p != nullptr      // ❌ Dangerous split!
    pre: p->is_valid()     // Could crash if p is null
{ ... }
```

---

## OPAL Critical Contracts

### Audio Pipeline
```cpp
void aec_init(uint32_t sample_rate)
    pre: sample_rate == 16000
{ ... }
```

### I2C Hardware
```cpp
void i2c_bus_init(gpio_num_t sda, gpio_num_t scl)
    pre: sda == GPIO_NUM_8 && scl == GPIO_NUM_7
{ ... }
```

### VoIP Stack
```cpp
sip_call_handle_t sip_call(const char* dest)
    pre: dest != nullptr
    pre: sip_registered()
{ ... }
```

### Security/PHI
```cpp
esp_err_t encrypt_phi(const uint8_t* data, size_t len)
    pre: data != nullptr && len > 0
    pre: tls_session_active()
{ ... }  // Always enforce this!
```

---

## Integration Roadmap

### Week 1: Foundation
- [ ] Read integration plan document
- [ ] Update CONTRIBUTING.md with contract guidelines
- [ ] Select 2-3 pilot modules (audio pipeline, I2C drivers)

### Week 2-3: Pilot
- [ ] Add contracts to 10-20 key functions
- [ ] Configure build modes (enforce for dev)
- [ ] Train team (1-hour workshop)

### Week 4-8: Core Adoption
- [ ] Add contracts to all public APIs (80% coverage goal)
- [ ] Integrate violation handler with logging
- [ ] Enable contract checks in CI/CD

### Week 9+: Production
- [ ] Deploy observe mode in production
- [ ] Collect violation telemetry
- [ ] Iterate on contract coverage

---

## Questions to Discuss

1. **Compiler Timeline:**
   - ESP-IDF currently uses GCC 12.2 (no C++26 support)
   - Need to plan upgrade to GCC 14+ (expected Q2 2026)
   - Can prototype contracts in parallel with current toolchain

2. **Contract Coverage Goals:**
   - Target 80% of public APIs by end of Phase 1?
   - Enforce in code review or CI/CD?

3. **Build Mode Strategy:**
   - Which modules should use observe mode in production?
   - Which need quick_enforce for security?

4. **Tooling Investment:**
   - Build "Contract Advisor" AI agent? (Priority: Medium)
   - Create contract coverage reporting tool? (Priority: High)
   - Integrate with existing CI/CD? (Priority: High)

5. **Team Training:**
   - 1-hour workshop sufficient?
   - Need hands-on coding exercises?
   - Assign contract "champions" per team?

---

## Key Takeaways

1. **Contracts express functional correctness, not memory safety**
   - Perfect for embedded systems with hardware constraints

2. **Four modes provide flexibility**
   - Zero overhead in production (ignore mode)
   - Production monitoring without crashes (observe mode)

3. **Shift left: Find bugs earlier**
   - Contracts move assertions from body to interface
   - Static analysis tools can reason about contracts

4. **Not a drop-in replacement for assert()**
   - Contracts have stricter rules (no side effects)
   - This is a feature, not a bug—catches real errors

5. **Gradual adoption path**
   - Start with pilot modules
   - Expand to core firmware
   - Full enforcement in CI/CD

---

**Full Details:** See `cpp26-contracts-integration-plan.md`
