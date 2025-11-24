# C++26 Contracts Cheat Sheet
## One-Page Quick Reference for OPAL Firmware Development

---

## The 10-Second Rule

**Contract** = "This should NEVER happen in correct code" (programming bug)
**Error Handling** = "This MIGHT happen in normal operation" (runtime error)

---

## When to Use Contracts

| Scenario | Contract? | What to Use |
|----------|-----------|-------------|
| Internal API pointer check | ✅ YES | `pre: ptr != nullptr` |
| Hardware constraint (AEC 16kHz) | ✅ YES | `pre: sample_rate == 16000` |
| GPIO pin assignment | ✅ YES | `pre: sda == GPIO_NUM_8` |
| **Sensor reading validation** | ❌ NO | `if (temp < -40) return ERROR;` |
| **Network packet validation** | ❌ NO | `if (len > MAX) return ERROR;` |
| **User input checking** | ❌ NO | Validate normally |

---

## Contract Syntax

```cpp
/**
 * @brief Function description
 * @param data Input buffer
 * @pre data != nullptr
 * @pre len > 0 && len <= MAX_SIZE
 * @post Buffer processed successfully
 */
void process(uint8_t* data, size_t len)
    pre: data != nullptr
    pre: len > 0 && len <= MAX_SIZE
    post: processing_complete()
{
    // Implementation
}
```

---

## The Four Modes

| Mode | When | Example |
|------|------|---------|
| **ignore** | Production release | Audio pipeline (performance-critical) |
| **observe** | Production monitoring | VoIP stack (catch edge cases) |
| **enforce** | Development/testing | All modules during dev |
| **quick_enforce** | Security-critical | PHI encryption, auth |

---

## Common Patterns

### Pattern 1: Null Pointer Check
```cpp
void process(Data* data)
    pre: data != nullptr
{ ... }
```

### Pattern 2: Range Validation
```cpp
void set_volume(int vol)
    pre: vol >= 0 && vol <= 100
{ ... }
```

### Pattern 3: Hardware Constraint
```cpp
void aec_init(uint32_t rate)
    pre: rate == 16000  // AEC only works at 16kHz
{ ... }
```

### Pattern 4: State Precondition
```cpp
void send_data(const uint8_t* buf)
    pre: connection_established()
    pre: buf != nullptr
{ ... }
```

### Pattern 5: Multiple Related Pointers
```cpp
void process(int16_t* in, int16_t* out)
    pre: in != nullptr && out != nullptr
{ ... }
```

---

## DON'T DO THIS ❌

### ❌ Side Effects
```cpp
pre: log_call() && validate()  // Modifies state!
```

### ❌ Split Pointer Checks
```cpp
pre: p != nullptr      // DANGER!
pre: p->is_valid()     // Could crash
```
**Fix:** `pre: p != nullptr && p->is_valid()`

### ❌ External Input Validation
```cpp
void handle_temp(int temp)
    pre: temp >= -40 && temp <= 125  // Wrong!
```
**Fix:** Use `if (temp < -40) return ERROR;`

### ❌ Contracts on Virtual Functions
```cpp
virtual void process(int* data)
    pre: data != nullptr  // Not supported yet!
```
**Fix:** Use `contract_assert: data != nullptr;` inside function

---

## OPAL-Specific Contracts

### Audio Pipeline
```cpp
void aec_init(uint32_t rate)
    pre: rate == 16000
```

### I2C Hardware
```cpp
void i2c_init(gpio_num_t sda, gpio_num_t scl)
    pre: sda == GPIO_NUM_8 && scl == GPIO_NUM_7
```

### VoIP Stack
```cpp
sip_call_handle_t sip_call(const char* dest)
    pre: dest != nullptr
    pre: sip_registered()
```

### Security/PHI
```cpp
esp_err_t encrypt_phi(const uint8_t* data, size_t len)
    pre: data != nullptr && len > 0
    pre: tls_session_active()
```

---

## Decision Tree

```
Is this validating external input?
├─ YES → Use error handling (if/return)
└─ NO → Is this an API assumption?
    ├─ YES → Use contract
    └─ NO → Could this fail normally?
        ├─ YES → Error handling
        └─ NO → Contract
```

---

## Code Review Checklist

- [ ] All public APIs have contracts?
- [ ] No side effects in predicates?
- [ ] Short-circuit evaluation used? (`&&`, `||`)
- [ ] Contracts express bugs, not runtime errors?
- [ ] Doxygen `@pre` and `@post` tags match?
- [ ] Contract mode appropriate for module?

---

## Slash Commands

- `/add-contract` - Add contracts to function
- `/review-contracts` - Review contract usage

---

## Quick Examples

### ✅ GOOD
```cpp
// Hardware constraint
pre: sample_rate == 16000

// Short-circuit safety
pre: p != nullptr && p->is_valid()

// Range check
pre: index >= 0 && index < array_size
```

### ❌ BAD
```cpp
// Side effect
pre: counter++ < 100

// External input
pre: user_input < 1000

// Split condition
pre: p != nullptr
pre: p->value == 42
```

---

## Resources

- Full Details: `docs/development/cpp26-contracts-integration-plan.md`
- Training: `docs/training/cpp26-contracts/`
- Standards: `standards/CODE_STANDARD_CPP.md`
- Guidelines: `CONTRIBUTING.md`

---

**Print this and keep it at your desk!**
