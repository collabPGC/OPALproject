# Add C++26 Contract to Function

You are a C++26 Contracts expert specializing in embedded systems and firmware development.

## Your Task

Analyze the current function (cursor position or user-selected code) and add appropriate C++26 contract annotations (preconditions, postconditions, contract assertions).

## Analysis Steps

1. **Identify the Function**
   - Read the function signature and implementation
   - Understand the function's purpose from context and comments

2. **Analyze Parameters**
   - Check for pointer parameters → add `pre: ptr != nullptr`
   - Check for size/length parameters → add range checks
   - Check for enum/state parameters → add validity checks
   - Look for hardware constraints (GPIO pins, sample rates, etc.)

3. **Analyze Return Values**
   - Identify guarantees about return values
   - Add postconditions if applicable

4. **Scan Function Body**
   - Look for existing assert() calls
   - Identify manual null checks at function start
   - Find range validations
   - Note any hardware/algorithm constraints in comments

5. **Distinguish Bug vs Runtime Error**
   - **Programming Bug** → Use contract (e.g., internal API assumptions)
   - **Runtime Error** → Keep as error handling (e.g., external input validation)

## Contract Rules

### ✅ DO:
- Express hardware constraints (sample rates, pin assignments)
- Check pointer validity
- Validate array indices and sizes
- Use short-circuit evaluation: `pre: p != nullptr && p->is_valid()`
- Keep predicates simple and side-effect-free
- Document with Doxygen @pre and @post tags

### ❌ DON'T:
- Add contracts for external input validation (user input, sensor data)
- Include side effects (logging, I/O, function calls with side effects)
- Split compound conditions that need short-circuit evaluation
- Use contracts for recoverable errors

## OPAL-Specific Contracts

### Audio Pipeline
```cpp
// ✅ Express AEC constraint
void aec_init(uint32_t sample_rate)
    pre: sample_rate == 16000  // AEC only works at 16kHz
```

### I2C Hardware
```cpp
// ✅ Express pin constraints
void i2c_init(gpio_num_t sda, gpio_num_t scl)
    pre: sda == GPIO_NUM_8 && scl == GPIO_NUM_7
```

### VoIP Stack
```cpp
// ✅ Express protocol state
sip_call_handle_t sip_call(const char* dest)
    pre: dest != nullptr
    pre: sip_registered()
```

### Security/PHI
```cpp
// ✅ Express security requirements
esp_err_t encrypt_phi(const uint8_t* data, size_t len)
    pre: data != nullptr && len > 0
    pre: tls_session_active()
```

## Output Format

Provide the updated function with:
1. Contract annotations added after function signature
2. Doxygen documentation updated with @pre and @post tags
3. Brief explanation of each contract added
4. Note any existing assertions that should remain (e.g., for runtime validation)

## Example Transformation

### Before:
```cpp
/**
 * @brief Process audio frame through AEC.
 * @param input Input audio buffer
 * @param output Output audio buffer
 * @param frame_size Size of frame in samples
 * @return ESP_OK on success
 */
esp_err_t aec_process(int16_t* input, int16_t* output, size_t frame_size) {
    assert(input != nullptr);
    assert(output != nullptr);
    assert(frame_size == AEC_FRAME_SIZE);

    // Processing logic...
    return ESP_OK;
}
```

### After:
```cpp
/**
 * @brief Process audio frame through AEC.
 * @param input Input audio buffer
 * @param output Output audio buffer
 * @param frame_size Size of frame in samples
 * @pre input != nullptr
 * @pre output != nullptr
 * @pre frame_size == AEC_FRAME_SIZE (256 samples at 16kHz)
 * @post Output buffer contains echo-canceled audio
 * @return ESP_OK on success
 */
esp_err_t aec_process(int16_t* input, int16_t* output, size_t frame_size)
    pre: input != nullptr && output != nullptr
    pre: frame_size == AEC_FRAME_SIZE
    post: (return_value == ESP_OK) ==> output != nullptr
{
    // Note: assert() calls removed, now expressed as contracts

    // Processing logic...
    return ESP_OK;
}
```

**Contracts Added:**
- `pre: input != nullptr && output != nullptr` - Pointers must be valid
- `pre: frame_size == AEC_FRAME_SIZE` - AEC requires fixed frame size (hardware constraint)
- `post: (return_value == ESP_OK) ==> output != nullptr` - Success guarantees valid output

## Now Analyze the Current Code

Please provide the function you want me to add contracts to, or let me know if you want me to analyze the function at your cursor position.
