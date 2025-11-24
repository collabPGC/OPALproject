# C++ Coding and Documentation Standard

## Overview

All C++ code in this project should be documented using **Doxygen**-compatible comments and **C++26 Contracts**. This ensures consistency, safety, and leverages industry-standard tools.

## Key Principles

- Use `/** ... */` style blocks or `///` line comments before classes, methods, functions, and files.
- Use tags like `\param`, `\return`, `\brief`, `\class`, `\pre`, and `\post` to provide structured information.
- Document classes and their members thoroughly.
- **All public APIs must include C++26 contracts** expressing preconditions and postconditions.

## Example

Below is an example of a well-documented C++ class using Doxygen style.

```cpp
/**
 * @class Rectangle
 * @brief A class to represent a rectangle.
 *
 * This class stores the dimensions of a rectangle and can compute its area.
 */
class Rectangle {
public:
    /**
     * @brief Sets the dimensions of the rectangle.
     * @param w The width of the rectangle.
     * @param h The height of the rectangle.
     */
    void setDimensions(int w, int h) {
        width = w;
        height = h;
    }

    /**
     * @brief Calculates the area of the rectangle.
     * @return The area of the rectangle.
     */
    int getArea() {
        return width * height;
    }

private:
    int width;  ///< The width of the rectangle.
    int height; ///< The height of the rectangle.
};
```

## C++26 Contracts

### Requirements

**MANDATORY:** All public firmware APIs must include contracts. This is enforced during code review.

**Coverage Target:** 95% of public APIs must have contracts by end of Phase 2.

### Contract Documentation Standard

All contracts must be documented in Doxygen comments using `@pre` and `@post` tags.

```cpp
/**
 * @brief Initialize the audio codec with specified configuration.
 * @param config Audio codec configuration
 * @pre config != nullptr
 * @pre config->sample_rate == 16000 (AEC constraint - hardware limitation)
 * @pre config->bits_per_sample == 16 || config->bits_per_sample == 32
 * @post Codec is initialized and ready for audio processing
 * @post Codec registers configured per ES8311 datasheet
 * @return ESP_OK on success, ESP_ERR_* on failure
 */
esp_err_t audio_codec_init(const audio_codec_config_t* config)
    pre: config != nullptr
    pre: config->sample_rate == 16000
    pre: config->bits_per_sample == 16 || config->bits_per_sample == 32
    post: codec_initialized()
{
    // Implementation
}
```

### Contract Build Modes

Different modules use different contract modes based on criticality and performance requirements:

| Module | Development | Testing | Production | Rationale |
|--------|-------------|---------|------------|-----------|
| **Audio Pipeline** | enforce | enforce | ignore | Performance-critical, well-tested |
| **VoIP Stack** | enforce | enforce | observe | Production monitoring valuable |
| **Security/Auth** | quick_enforce | quick_enforce | quick_enforce | Always-on security |
| **UI/Display** | enforce | observe | observe | Non-critical, debug in prod |
| **I2C/SPI Drivers** | enforce | enforce | ignore | Performance-critical |
| **PHI Handling** | quick_enforce | quick_enforce | quick_enforce | HIPAA compliance |

### Contract Modes Explained

**Contract Mode Definitions:**
- `ignore` - Predicates not evaluated, zero runtime cost
- `observe` - Predicates evaluated, violation handler called, program continues
- `enforce` - Predicates evaluated, program terminates on violation
- `quick_enforce` - Predicates evaluated, immediate termination (minimal overhead)

### OPAL-Specific Contract Examples

#### Audio Pipeline Contracts

```cpp
/**
 * @brief Initialize AEC with specific sample rate.
 * @param sample_rate Audio sample rate in Hz
 * @pre sample_rate == 16000 (AEC algorithm only supports 16kHz)
 * @pre i2s_initialized() (I2S bus must be initialized first)
 * @post AEC ready for audio processing
 */
void aec_init(uint32_t sample_rate)
    pre: sample_rate == 16000
    pre: i2s_initialized()
    post: aec_is_ready()
{
    // AEC initialization
}

/**
 * @brief Process audio frame through AEC.
 * @param input Input audio buffer (microphone)
 * @param output Output buffer (echo-canceled audio)
 * @param frame_size Number of samples in frame
 * @pre input != nullptr && output != nullptr
 * @pre frame_size == AEC_FRAME_SIZE (256 samples)
 * @post Output buffer contains echo-canceled audio
 */
void aec_process(int16_t* input, int16_t* output, size_t frame_size)
    pre: input != nullptr && output != nullptr
    pre: frame_size == AEC_FRAME_SIZE
{
    // Processing
}
```

#### I2C Hardware Contracts

```cpp
/**
 * @brief Initialize I2C bus with ESP32-C6 OPAL board configuration.
 * @param sda_pin SDA GPIO pin
 * @param scl_pin SCL GPIO pin
 * @pre sda_pin == GPIO_NUM_8 && scl_pin == GPIO_NUM_7 (Hardware-defined pins)
 * @pre external_pullups_installed() (4.7kΩ required on SDA/SCL)
 * @post I2C bus ready at 100kHz
 * @post All I2C devices accessible (codec, touch, RTC, IMU)
 */
void i2c_bus_init(gpio_num_t sda_pin, gpio_num_t scl_pin)
    pre: sda_pin == GPIO_NUM_8 && scl_pin == GPIO_NUM_7
{
    // I2C initialization
}

/**
 * @brief Read from I2C device.
 * @param device_addr I2C device address (7-bit)
 * @param reg_addr Register address to read
 * @param buffer Output buffer for data
 * @param len Number of bytes to read
 * @pre buffer != nullptr
 * @pre len > 0 && len <= MAX_I2C_BUFFER_SIZE
 * @pre i2c_bus_initialized()
 * @post Buffer contains data read from device
 * @return ESP_OK on success, ESP_ERR_* on failure
 */
esp_err_t i2c_read(uint8_t device_addr, uint8_t reg_addr,
                   uint8_t* buffer, size_t len)
    pre: buffer != nullptr
    pre: len > 0 && len <= MAX_I2C_BUFFER_SIZE
    pre: i2c_bus_initialized()
{
    // I2C read transaction
}
```

#### VoIP Stack Contracts

```cpp
/**
 * @brief Establish SIP call to destination.
 * @param destination SIP URI (e.g., "sip:nurse@hospital.local")
 * @pre destination != nullptr
 * @pre strlen(destination) > 0 && strlen(destination) <= MAX_SIP_URI_LEN
 * @pre sip_registered() (Must register with SIP server first)
 * @pre network_connected()
 * @post Call state == CALL_RINGING || Call state == CALL_FAILED
 * @return Call handle on success, NULL on failure
 */
sip_call_handle_t sip_call(const char* destination)
    pre: destination != nullptr && strlen(destination) <= MAX_SIP_URI_LEN
    pre: sip_registered()
    pre: network_connected()
{
    // Call establishment
}

/**
 * @brief Configure RTP stream for audio transport.
 * @param handle SIP call handle
 * @param codec Audio codec (must be G.711 A-law)
 * @param sample_rate Sample rate (must be 8kHz for G.711)
 * @pre handle != nullptr
 * @pre codec == CODEC_G711_ALAW (Only codec supported)
 * @pre sample_rate == 8000 (G.711 uses 8kHz)
 * @post RTP stream configured and ready
 */
void rtp_configure(sip_call_handle_t handle, audio_codec_t codec,
                   uint32_t sample_rate)
    pre: handle != nullptr
    pre: codec == CODEC_G711_ALAW
    pre: sample_rate == 8000
{
    // RTP configuration
}
```

#### Security/PHI Handling Contracts

```cpp
/**
 * @brief Encrypt PHI data before transmission.
 * @param data Plaintext PHI data
 * @param len Data length in bytes
 * @param encrypted_out Output buffer for encrypted data (must be pre-allocated)
 * @pre data != nullptr && encrypted_out != nullptr
 * @pre len > 0 && len <= MAX_PHI_SIZE
 * @pre tls_session_active() (TLS 1.3 required for PHI)
 * @pre authenticated() (User must be authenticated)
 * @post Data encrypted with AES-256-GCM
 * @post No PHI in plaintext logs
 * @return ESP_OK on success, ESP_ERR_INVALID_STATE if TLS not active
 *
 * @note This function ALWAYS uses quick_enforce mode (security-critical)
 */
esp_err_t encrypt_phi(const uint8_t* data, size_t len,
                      uint8_t* encrypted_out)
    pre: data != nullptr && encrypted_out != nullptr
    pre: len > 0 && len <= MAX_PHI_SIZE
    pre: tls_session_active()
    pre: authenticated()
{
    // Encryption (always enforce this contract!)
}
```

### Contract Rules and Best Practices

#### ✅ DO:

1. **Express Hardware Constraints**
   ```cpp
   pre: sample_rate == 16000  // AEC hardware limitation
   ```

2. **Use Short-Circuit Evaluation**
   ```cpp
   pre: p != nullptr && p->is_valid()  // Safe evaluation order
   ```

3. **Document Why, Not Just What**
   ```cpp
   pre: buffer_size == 256  // AEC requires 256-sample frames (16kHz, 16ms)
   ```

4. **Combine Related Checks**
   ```cpp
   pre: input != nullptr && output != nullptr  // Related pointers
   ```

#### ❌ DON'T:

1. **No Side Effects**
   ```cpp
   pre: log_call() && validate()  // ❌ Side effect!
   ```

2. **No External Input Validation**
   ```cpp
   // ❌ This is runtime validation, not a contract!
   void handle_sensor(int temp)
       pre: temp >= -40 && temp <= 125
   ```

   **Correct approach:**
   ```cpp
   esp_err_t handle_sensor(int temp) {
       if (temp < -40 || temp > 125) {
           return ESP_ERR_INVALID_ARG;  // Runtime validation
       }
       // Process valid temperature
   }
   ```

3. **No Split Conditions with Pointer Dereference**
   ```cpp
   // ❌ DANGER: Could crash if p is null
   pre: p != nullptr
   pre: p->is_valid()

   // ✅ SAFE: Single compound condition
   pre: p != nullptr && p->is_valid()
   ```

4. **No Contracts on Virtual Functions** (not yet supported in C++26)
   ```cpp
   // ❌ Will not compile
   virtual void process(int* data)
       pre: data != nullptr
   { ... }

   // ✅ Workaround: Use contract_assert
   virtual void process(int* data) {
       contract_assert: data != nullptr;
       // ...
   }
   ```

### Contract vs Runtime Error Decision Tree

```
Is the check validating external input (user, sensor, network)?
├─ YES → Use normal error handling (if/return ESP_ERR_*)
└─ NO → Is this an internal API assumption?
    ├─ YES → Use contract (pre:/post:)
    └─ NO → Could this fail in normal operation?
        ├─ YES → Use error handling
        └─ NO → Use contract (programming bug)
```

**Examples:**

| Scenario | Use Contract? | Reasoning |
|----------|---------------|-----------|
| Null pointer check on internal API | ✅ YES | Programming bug if caller passes null |
| Temperature reading validation | ❌ NO | External sensor, could be out of range normally |
| Hardware pin assignment check | ✅ YES | Hardware constraint, never changes |
| File open failure | ❌ NO | Recoverable runtime error |
| Array index bounds | ✅ YES | Programming bug if out of bounds |
| Network packet size check | ❌ NO | External input, validate normally |

### Tools and Commands

**Slash Commands:**
- `/add-contract` - Analyze function and add appropriate contracts
- `/review-contracts` - Review contract usage for best practices

**Static Analysis:**
- Clang-Tidy with contract checks enabled
- Contract coverage reporting in CI/CD

**Documentation:**
- See `docs/development/cpp26-contracts-integration-plan.md` for full details
- See `docs/development/contracts-quick-reference.md` for quick reference

