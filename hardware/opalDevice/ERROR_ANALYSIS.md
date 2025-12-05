# Runtime Error Analysis

## Expected Errors (Not Real Problems)

### 1. **I2C Timeout/NACK Errors** (EXPECTED)
These are **diagnostic messages**, not failures:
- `✗ NACK/timeout at 0x15 (CST816S): ESP_ERR_TIMEOUT`
- `✗ NACK/timeout at 0x18 (ES8311): ESP_ERR_TIMEOUT`
- `No devices found (all addresses NACK/timeout)`

**Why:** The isolation tests intentionally probe devices to diagnose hardware issues. If devices aren't connected, these messages are expected.

**Action:** None needed - these are informational diagnostics.

### 2. **Isolation Test Messages** (EXPECTED)
The code runs systematic tests (TEST A, B, C, FINAL) that produce many log messages:
- Line level checks
- Bus scans
- Device probes

**Why:** This is intentional diagnostic output to help identify hardware issues.

**Action:** None needed - this is working as designed.

## Real Errors (Need Attention)

### 1. **I2C Bus Initialization Failure**
```
E opal: I2C init failed
```
**Impact:** Critical - application stops
**Cause:** I2C bus couldn't be created
**Fix:** Check pin configuration, GPIO conflicts

### 2. **Pin Conflict Errors**
```
E opal: CONFLICT: LCD pins overlap with I2C!
E opal: PIN CONFLICT DETECTED - I2C bus will not work!
```
**Impact:** Critical - I2C won't work
**Cause:** GPIO pins are used by multiple peripherals
**Fix:** Check `hardware_config.h` for pin conflicts

### 3. **CE Pin Readback Mismatch**
```
E opal: CRITICAL: CE pin (GPIO21) is LOW after setting HIGH!
```
**Impact:** Codec won't initialize
**Cause:** GPIO21 not driving CE pin correctly
**Fix:** Check hardware wiring, GPIO configuration

### 4. **LCD/Touch Initialization Failures**
```
E opal: LCD init failed
E opal: Touch init failed
```
**Impact:** UI won't work
**Cause:** Hardware not connected or misconfigured
**Fix:** Check SPI/LCD connections, touch I2C connection

### 5. **Audio Codec Initialization Failure**
```
W opal: Audio init failed (continuing)
```
**Impact:** Audio won't work
**Cause:** ES8311 not responding on I2C
**Fix:** Check I2C connection, CE pin, power supply

## Reducing Log Noise

If you want fewer diagnostic messages, you can:

### Option 1: Reduce I2C Log Level
Already done in code:
```c
esp_log_level_set("i2c.master", ESP_LOG_WARN);
```

### Option 2: Reduce Application Log Level
Add to `sdkconfig`:
```
CONFIG_LOG_DEFAULT_LEVEL_WARN=y
```

### Option 3: Comment Out Isolation Tests
After hardware is verified, you can comment out the isolation test sections in `app_main()`.

## What to Look For

**Critical Errors (Red flags):**
- `I2C init failed` - Bus not created
- `PIN CONFLICT DETECTED` - GPIO overlap
- `CRITICAL:` messages - Hardware issues

**Expected Warnings (Can ignore):**
- `NACK/timeout` during isolation tests
- `No devices found` during scans
- `Audio init failed` if codec not connected

**Success Indicators:**
- `I2C bus created successfully`
- `✓ ACK at 0x15` or `✓ ACK at 0x18`
- `Scan complete: X device(s) found` (where X > 0)

## Next Steps

1. **Identify which errors are appearing** - Share the most frequent error messages
2. **Check if devices are actually connected** - Hardware verification needed
3. **Reduce log verbosity** if needed - Can adjust log levels
4. **Focus on critical errors** - Ignore expected diagnostic messages

---

**Note:** Many "errors" are actually diagnostic messages helping identify hardware issues. The real problem is likely that I2C devices aren't physically connected or powered.

