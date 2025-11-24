# C++26 Contracts Integration Plan
## Integrating Contracts into OPAL Software Development Process

**Date:** 2025-11-24
**Status:** Planning Phase
**Relevance:** ESP32-C6 Firmware Development (C/C++ codebase)

---

## Executive Summary

C++26 Contracts provide a standardized mechanism for expressing **functional correctness assumptions** through preconditions, postconditions, and assertions. This feature is highly relevant to the OPAL project's **ESP32-C6 firmware development** where reliability, safety, and real-time correctness are critical.

**Key Benefits for OPAL:**
- **Safety-Critical Systems**: VoIP firmware, audio pipeline, healthcare device reliability
- **Express Intent**: Document assumptions about I2C, I2S, audio codec behavior
- **Shift-Left Testing**: Catch bugs earlier in development cycle
- **Production Monitoring**: Run contract checks in production without termination (observe mode)
- **Zero-Overhead Option**: Disable contracts in release builds for performance-critical code

## Project Decisions (2025-11-24)

**Strategic Direction:**
1. ✅ **Plan Now**: Check in all materials immediately, prepare for future compiler support
2. ✅ **Full Coverage**: Target 95% of all public APIs with contracts (not just critical modules)
3. ✅ **Build Agent**: Develop "Contract Advisor" AI agent to assist developers
4. ✅ **Code Review**: Enforce contract requirements in pull request reviews
5. ✅ **Core Skill**: Make contracts a required competency for all C++ developers

---

## 1. Where Contracts Fit: Skills Development

### 1.1 Developer Training Materials

**Create Training Module: "C++26 Contracts for Embedded Systems"**

**Location:** `docs/training/cpp26-contracts/`

**Topics to Cover:**
1. **Functional Safety vs Memory Safety**
   - Contracts ensure functional correctness (e.g., audio pipeline sample rate constraints)
   - Memory safety is language-level (RAII, smart pointers)
   - Example: Ensuring AEC always runs at 16kHz (functional) vs preventing buffer overflows (memory)

2. **Four Contract Semantics for Firmware**
   - **Ignore**: Release builds, zero overhead
   - **Observe**: Production monitoring with telemetry
   - **Enforce**: Development/testing with fail-fast
   - **Quick Enforce**: Security-critical paths (authentication, PHI handling)

3. **Best Practices for Embedded/Real-Time Systems**
   - Never use contracts for external input validation (sensor readings, network data)
   - Use contracts for internal API assumptions (e.g., `pre: buffer != nullptr`)
   - Avoid side effects in predicates (no I2C/SPI calls in contracts)
   - Short-circuit compound conditions (`p != nullptr && *p == valid`)

4. **OPAL-Specific Use Cases**
   - **Audio Pipeline**: `pre: sample_rate == 16000` (AEC constraint)
   - **I2C Communication**: `pre: sda_pin == GPIO8 && scl_pin == GPIO7`
   - **VoIP Stack**: `pre: codec == G711_ALAW && channels == 1`
   - **Power Management**: `post: battery_level >= min_operating_voltage`

### 1.2 Required Developer Skills

| Skill | Current State | Target State | Training Resources |
|-------|---------------|--------------|-------------------|
| Understanding contract vs assert | Unknown | All C++ devs proficient | Training module + code examples |
| Writing preconditions/postconditions | Unknown | Standard practice | Code review checklist |
| Configuring contract build modes | Unknown | All devs understand | Build system documentation |
| Violation handler integration | Unknown | DevOps/monitoring team | Integration guide |
| Static analysis with contracts | Unknown | CI/CD automated | Tool configuration guide |

### 1.3 Skill Assessment Checklist

```cpp
// Developers should be able to identify issues in this code:

// ❌ BAD: Side effect in predicate
void set_volume(int vol)
    pre: vol >= 0 && vol <= 100 && log_call()
{ ... }

// ❌ BAD: Using contract for input validation
void process_sensor_data(int temp)
    pre: temp >= -40 && temp <= 125  // This is runtime validation, not a contract!
{ ... }

// ✅ GOOD: Express internal API assumption
void i2c_read(uint8_t* buffer, size_t len)
    pre: buffer != nullptr && len > 0 && len <= MAX_I2C_BUFFER
{ ... }

// ✅ GOOD: Hardware constraint
void aec_init(uint32_t sample_rate)
    pre: sample_rate == 16000  // AEC only works at 16kHz
{ ... }
```

---

## 2. Where Contracts Fit: AI Agents / Tooling

### 2.1 Specialized Agent: "Contract Advisor"

**Purpose:** Help developers add contracts to existing code and review contract usage.

**Agent Capabilities:**
1. **Analyze Function Signatures**
   - Identify functions that would benefit from contracts
   - Suggest preconditions based on null checks, range validations
   - Suggest postconditions based on return value patterns

2. **Migration from assert() to Contracts**
   - Scan for `assert()`, `ESP_ERROR_CHECK()`, manual checks
   - Recommend which should become contracts vs remain runtime checks
   - Distinguish between:
     - **Programming bugs** → contracts
     - **External errors** → traditional error handling

3. **Contract Review**
   - Check for side effects in predicates
   - Validate compound condition safety (short-circuit evaluation)
   - Ensure no contract on virtual functions (not supported yet)
   - Flag predicates that might throw exceptions

4. **Build Mode Recommendations**
   - Suggest contract mode per module:
     - Core audio pipeline: `enforce` (development), `ignore` (release)
     - Security/auth: `quick_enforce` (always on)
     - Non-critical UI: `observe` (production monitoring)

**Example Agent Prompt:**
```
You are a C++26 Contracts expert specializing in embedded systems.
Analyze the following function and suggest appropriate contracts:
- Identify assumptions about parameters
- Distinguish programming bugs from runtime errors
- Ensure predicates have no side effects
- Consider real-time constraints (embedded system)
```

### 2.2 Static Analysis Integration

**Tool:** Clang Static Analyzer with Contract Support

**CI/CD Integration:**
```yaml
# .github/workflows/contracts-check.yml
- name: Contract Analysis
  run: |
    clang++ -std=c++26 -fcontracts=enforce \
            -Werror=contract-violation \
            -fsanitize=address,undefined \
            firmware/**/*.cpp
```

### 2.3 Contract Coverage Metrics

**Tooling to Build:**
- **Contract Coverage Reporter**: Tracks % of public APIs with contracts
- **Violation Telemetry**: Aggregates contract violations from production devices
- **Contract Audit Tool**: Lists functions missing contracts

---

## 3. Where Contracts Fit: Slash Commands / IDE Integration

### 3.1 Proposed Slash Commands

**Location:** `.claude/commands/`

#### `/add-contract`
```markdown
# Add Contract to Function

Analyze the current function and add appropriate C++26 contracts:
1. Read the function signature and body
2. Identify preconditions (parameter assumptions)
3. Identify postconditions (return value guarantees)
4. Add contract annotations using C++26 syntax
5. Ensure no side effects in predicates

Example:
```cpp
// Before:
void process_audio(int16_t* samples, size_t count) {
    assert(samples != nullptr);
    assert(count > 0 && count <= MAX_SAMPLES);
    // ...
}

// After:
void process_audio(int16_t* samples, size_t count)
    pre: samples != nullptr
    pre: count > 0 && count <= MAX_SAMPLES
{
    // ...
}
```
```

#### `/review-contracts`
```markdown
# Review Contract Usage

Review all contracts in the current file:
1. Check for side effects in predicates
2. Validate compound conditions use short-circuit operators
3. Ensure contracts express programming bugs, not runtime errors
4. Check for proper separation of concerns

Report findings with severity:
- 🔴 Critical: Side effects, unsafe predicates
- 🟡 Warning: Missing contracts on public APIs
- 🟢 Good: Well-formed contracts
```

#### `/contract-mode`
```markdown
# Configure Contract Build Mode

Suggest appropriate contract build mode for the current module:
- Analyze module purpose (core, security, UI, telemetry)
- Consider performance requirements
- Recommend mode: ignore, observe, enforce, quick_enforce
- Generate CMake configuration snippet
```

### 3.2 IDE Snippets / Templates

**VSCode Snippets:** `.vscode/cpp-contracts.code-snippets`

```json
{
  "precondition": {
    "prefix": "pre",
    "body": ["pre: $1"],
    "description": "C++26 precondition contract"
  },
  "postcondition": {
    "prefix": "post",
    "body": ["post: $1"],
    "description": "C++26 postcondition contract"
  },
  "contract-assert": {
    "prefix": "cassert",
    "body": ["contract_assert: $1;"],
    "description": "C++26 contract assertion"
  }
}
```

---

## 4. Where Contracts Fit: Software Development Process

### 4.1 Update CONTRIBUTING.md

**Add Section: "Contract Guidelines"**

```markdown
## Contract Guidelines (C++26)

### When to Use Contracts
✅ **Use contracts for:**
- Preconditions on public API functions (e.g., pointer validity, range checks)
- Hardware constraints (sample rates, pin assignments, timing requirements)
- Algorithm invariants (e.g., array indices, state machine states)
- Postconditions that guarantee correctness (return value ranges)

❌ **Do NOT use contracts for:**
- External input validation (user input, sensor data, network packets)
- Recoverable runtime errors (file I/O, network failures)
- Side effects (logging, telemetry, hardware I/O)

### Contract Checklist
- [ ] All public firmware APIs have preconditions
- [ ] No side effects in contract predicates
- [ ] Compound conditions use short-circuit operators (`&&`, `||`)
- [ ] Contracts express programming bugs, not runtime errors
- [ ] Contract build mode specified per module

### Example
```cpp
// ✅ GOOD: Express hardware constraint
void es8311_init(i2s_port_t port)
    pre: port == I2S_NUM_0  // ES8311 only on I2S port 0
    pre: i2c_initialized()  // Codec requires I2C
{
    // ...
}

// ❌ BAD: Using contract for external validation
void handle_network_packet(uint8_t* data, size_t len)
    pre: len <= MAX_PACKET_SIZE  // This is input validation, not a contract!
{
    // Should use: if (len > MAX_PACKET_SIZE) return ERROR_INVALID_PACKET;
}
```
```

### 4.2 Update CODE_STANDARD_CPP.md

**Add Contract Documentation Standards:**

```markdown
## Contract Documentation

All public firmware APIs must include contracts in Doxygen comments:

```cpp
/**
 * @brief Initialize the audio codec with specified configuration.
 * @param config Audio codec configuration
 * @pre config != nullptr
 * @pre config->sample_rate == 16000 (AEC constraint)
 * @pre config->bits_per_sample == 16 || config->bits_per_sample == 32
 * @post Codec is initialized and ready for audio processing
 * @post Codec registers are configured per datasheet
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_codec_init(const audio_codec_config_t* config)
    pre: config != nullptr
    pre: config->sample_rate == 16000
    pre: config->bits_per_sample == 16 || config->bits_per_sample == 32
{
    // Implementation
}
```

### Contract Modes by Module

| Module | Development | Testing | Production | Rationale |
|--------|-------------|---------|------------|-----------|
| Audio Pipeline | enforce | enforce | ignore | Performance-critical, well-tested |
| VoIP Stack | enforce | enforce | observe | Production monitoring valuable |
| Security/Auth | quick_enforce | quick_enforce | quick_enforce | Always-on security |
| UI/Display | enforce | observe | observe | Non-critical, debug in prod |
| I2C/SPI Drivers | enforce | enforce | ignore | Performance-critical |

```

### 4.3 Code Review Checklist

**Add to Pull Request Template:**

```markdown
## Contract Review

- [ ] All new public APIs have preconditions documented
- [ ] Contracts express programming bugs, not runtime errors
- [ ] No side effects in contract predicates
- [ ] Contract build mode appropriate for module
- [ ] Doxygen comments include `@pre` and `@post` tags
- [ ] Contracts validated with static analysis (CI passing)
```

### 4.4 CI/CD Pipeline Integration

**`.github/workflows/firmware-contracts.yml`**

```yaml
name: Firmware Contract Checks

on: [push, pull_request]

jobs:
  contract-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install Clang 18+ (C++26 support)
        run: |
          wget https://apt.llvm.org/llvm.sh
          chmod +x llvm.sh
          sudo ./llvm.sh 18

      - name: Build with Contracts (Enforce Mode)
        run: |
          cd hardware/opalDevice
          idf.py -DCXX_STANDARD=26 -DCONTRACT_MODE=enforce build

      - name: Static Analysis with Contracts
        run: |
          clang-tidy --checks='-*,contracts-*' \
                     hardware/opalDevice/**/*.cpp

      - name: Contract Coverage Report
        run: |
          python3 scripts/contract_coverage.py \
                  --source hardware/opalDevice \
                  --threshold 80
```

### 4.5 Migration Strategy

**Phase 1: Pilot (Weeks 1-2)**
- Select 2-3 critical modules (audio pipeline, I2C drivers)
- Add contracts to 10-20 key functions
- Configure build modes
- Train team on contract usage

**Phase 2: Core Firmware (Weeks 3-6)**
- Add contracts to all public APIs in core firmware
- Integrate violation handler with logging system
- Enable contract checks in CI/CD
- Collect contract violation telemetry

**Phase 3: Full Adoption (Weeks 7-12)**
- All new code must include contracts (enforced in code review)
- Migrate remaining assert() to contracts where appropriate
- Optimize contract modes per module
- Publish internal best practices guide

**Phase 4: Production Monitoring (Ongoing)**
- Deploy observe mode in production for non-critical paths
- Collect and analyze contract violation data
- Iterate on contract coverage and accuracy

---

## 5. Specific OPAL Use Cases

### 5.1 Audio Pipeline Contracts

```cpp
/**
 * @brief Initialize AEC with specific sample rate.
 * @pre sample_rate == 16000  // AEC only works at 16kHz
 * @pre i2s_initialized()
 * @post AEC ready for audio processing
 */
void aec_init(uint32_t sample_rate)
    pre: sample_rate == 16000
{
    // AEC implementation
}

/**
 * @brief Process audio frame through AEC.
 * @pre input != nullptr && output != nullptr
 * @pre frame_size == AEC_FRAME_SIZE
 * @post Output contains echo-canceled audio
 */
void aec_process(int16_t* input, int16_t* output, size_t frame_size)
    pre: input != nullptr && output != nullptr
    pre: frame_size == AEC_FRAME_SIZE
{
    // Processing
}
```

### 5.2 I2C Hardware Contracts

```cpp
/**
 * @brief Initialize I2C bus with pull-up resistors.
 * @pre sda_pin == GPIO_NUM_8 && scl_pin == GPIO_NUM_7
 * @pre external_pullups_installed()  // 4.7kΩ required!
 * @post I2C bus ready at 100kHz
 */
void i2c_bus_init(gpio_num_t sda_pin, gpio_num_t scl_pin)
    pre: sda_pin == GPIO_NUM_8 && scl_pin == GPIO_NUM_7
{
    // I2C initialization
}
```

### 5.3 VoIP Stack Contracts

```cpp
/**
 * @brief Establish SIP call to destination.
 * @pre destination != nullptr
 * @pre strlen(destination) <= MAX_SIP_URI_LEN
 * @pre sip_registered()  // Must register with server first
 * @post Call state == CALL_RINGING or CALL_FAILED
 */
sip_call_handle_t sip_call(const char* destination)
    pre: destination != nullptr
    pre: sip_registered()
{
    // Call establishment
}
```

### 5.4 Security/PHI Handling Contracts

```cpp
/**
 * @brief Encrypt PHI data before transmission.
 * @pre data != nullptr && encrypted_out != nullptr
 * @pre len > 0 && len <= MAX_PHI_SIZE
 * @pre tls_session_active()  // TLS 1.3 required
 * @post Data encrypted with AES-256-GCM
 * @post No PHI in plaintext logs
 */
esp_err_t encrypt_phi(const uint8_t* data, size_t len, uint8_t* encrypted_out)
    pre: data != nullptr && encrypted_out != nullptr
    pre: len > 0 && len <= MAX_PHI_SIZE
    pre: tls_session_active()
{
    // Encryption (always enforce this contract!)
}
```

---

## 6. Violation Handler Integration

### 6.1 Custom Violation Handler for OPAL

```cpp
// opal_contract_handler.cpp

#include <esp_log.h>
#include <esp_system.h>
#include "telemetry.h"
#include "crash_reporter.h"

static const char* TAG = "CONTRACT";

// Global contract violation handler
void opal_contract_violation_handler(
    const std::source_location& loc,
    const char* predicate
) {
    // 1. Log to ESP32 flash
    ESP_LOGE(TAG, "Contract violation at %s:%d - %s",
             loc.file_name(), loc.line(), predicate);

    // 2. Send telemetry (if observe mode)
    telemetry_report_contract_violation(loc, predicate);

    // 3. Trigger crash reporter (if enforce mode)
    #if CONTRACT_MODE == ENFORCE
        crash_reporter_save_context();
        esp_restart();  // Safe restart
    #endif

    // 4. Continue execution (if observe mode)
    // No action needed - function returns
}

// Register handler at startup
void contracts_init() {
    std::set_contract_violation_handler(opal_contract_violation_handler);
}
```

### 6.2 Build Configuration

**`CMakeLists.txt`**
```cmake
# Contract build mode configuration
if(CONFIG_CONTRACT_MODE_ENFORCE)
    target_compile_options(${COMPONENT_LIB} PRIVATE -fcontracts=enforce)
elseif(CONFIG_CONTRACT_MODE_OBSERVE)
    target_compile_options(${COMPONENT_LIB} PRIVATE -fcontracts=observe)
elseif(CONFIG_CONTRACT_MODE_IGNORE)
    target_compile_options(${COMPONENT_LIB} PRIVATE -fcontracts=ignore)
elseif(CONFIG_CONTRACT_MODE_QUICK_ENFORCE)
    target_compile_options(${COMPONENT_LIB} PRIVATE -fcontracts=quick_enforce)
endif()
```

**`Kconfig`**
```kconfig
menu "Contract Configuration"

choice CONTRACT_MODE
    prompt "Contract enforcement mode"
    default CONTRACT_MODE_ENFORCE
    help
        Select contract checking mode for firmware build.

config CONTRACT_MODE_IGNORE
    bool "Ignore (no checks)"
config CONTRACT_MODE_OBSERVE
    bool "Observe (check but continue)"
config CONTRACT_MODE_ENFORCE
    bool "Enforce (check and terminate)"
config CONTRACT_MODE_QUICK_ENFORCE
    bool "Quick Enforce (minimal overhead)"

endchoice

endmenu
```

---

## 7. Metrics and Success Criteria

### 7.1 Contract Coverage Goals

| Milestone | Target | Measurement |
|-----------|--------|-------------|
| Phase 1 (Pilot) | 10-20 functions | Manual count |
| Phase 2 (Core) | 80% of public APIs | Automated tool |
| Phase 3 (Full) | 95% of public APIs | CI enforcement |
| Phase 4 (Production) | Contract violations < 1/day | Telemetry |

### 7.2 Quality Metrics

**Before Contracts:**
- Assert coverage: Unknown
- Bug detection timing: Late (testing/production)
- API documentation: Inconsistent

**After Contracts (Target):**
- Contract coverage: 95% public APIs
- Bug detection: Shift left (caught at compile time or early testing)
- API documentation: Contracts + Doxygen standardized

### 7.3 Production Telemetry

**Track in Production (Observe Mode):**
- Contract violations per module per day
- Top 10 most frequently violated contracts
- Correlation with bug reports

**Example Dashboard:**
```
Contract Violations (Last 7 Days)
- audio_pipeline: 3 violations (pre: sample_rate == 16000)
- i2c_drivers: 1 violation (pre: buffer != nullptr)
- voip_stack: 0 violations
```

---

## 8. Open Questions and Future Work

### 8.1 Compiler Support Timeline

- **GCC 14+**: Full C++26 contracts support expected Q2 2026
- **Clang 18+**: Experimental support available now
- **ESP-IDF toolchain**: Upgrade path needed (currently GCC 12.2)

**Action:** Monitor ESP-IDF compiler upgrades, test contracts in parallel

### 8.2 Exception Handling in Predicates

**Known Issue:** Predicates that throw exceptions add try-catch overhead

**Mitigation:**
- Avoid predicates that can throw
- Use `noexcept` functions in contracts
- Monitor overhead in benchmarks

### 8.3 Virtual Function Contracts

**Current Limitation:** Contracts not supported on virtual functions yet

**Workaround:** Use contract_assert inside virtual functions temporarily

---

## 9. Action Items

### Immediate (Week 1)
- [ ] Add this document to `docs/development/`
- [ ] Update `CONTRIBUTING.md` with contract guidelines
- [ ] Update `CODE_STANDARD_CPP.md` with contract documentation standards
- [ ] Create training materials in `docs/training/cpp26-contracts/`
- [ ] Identify 2-3 pilot modules for contract adoption

### Short-term (Weeks 2-4)
- [ ] Implement custom violation handler for OPAL
- [ ] Add contract build modes to CMakeLists.txt and Kconfig
- [ ] Create slash commands: `/add-contract`, `/review-contracts`
- [ ] Add contract checks to CI/CD pipeline
- [ ] Train development team on contract usage

### Medium-term (Months 2-3)
- [ ] Build "Contract Advisor" AI agent
- [ ] Develop contract coverage reporting tool
- [ ] Migrate assert() to contracts in core firmware
- [ ] Deploy observe mode in production
- [ ] Collect and analyze contract violation telemetry

### Long-term (Ongoing)
- [ ] Enforce 95% contract coverage in CI
- [ ] Integrate contracts into onboarding for new developers
- [ ] Publish internal case studies and best practices
- [ ] Contribute findings back to C++ standards committee

---

## 10. References

### External Resources
- [C++26 Contracts Proposal (P2900R9)](http://wg21.link/p2900r9)
- [GCC Contracts Documentation](https://gcc.gnu.org/onlinedocs/gcc/C_002b_002b-Contracts.html)
- [C++ Coding Standards (Sutter & Alexandrescu)](https://herbsutter.com/books/)

### Internal Documentation
- `CONTRIBUTING.md` - Development guidelines
- `standards/CODE_STANDARD_CPP.md` - C++ coding standards
- `hardware/opalDevice/docs/architecture/` - System architecture
- `project-management/timeline/phase-1-plan.md` - Development timeline

---

**Document Owner:** Development Team Lead
**Review Cycle:** Quarterly
**Next Review:** 2026-02-24
