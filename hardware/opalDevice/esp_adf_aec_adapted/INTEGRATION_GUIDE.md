# AEC Project Integration Guide - Using Datasheet Pinout

## Overview

This guide explains how to integrate the adapted AEC project with ESP-ADF, ensuring **EXACT datasheet pinout values** are used.

---

## Key Components Created

1. **`aec_adapted_main.c`** - Adapted AEC main code
2. **`board_esp32c6_opal/`** - Custom ESP-ADF board configuration with datasheet pinout

---

## Pinout Source: Device Datasheet

**CRITICAL**: All pin values come from the device datasheet and match `hardware_config.h`:

### I2S Pins (From Datasheet):
- GPIO19 = I2S_MCLK (MCLK)
- GPIO20 = I2S_SCLK (BCK)
- GPIO22 = I2S_LRCK (LRCK)
- GPIO21 = I2S_ASDOUT (DOUT)
- GPIO23 = I2S_DSDIN (DIN)

### I2C Pins (From Datasheet):
- GPIO8 = SDA
- GPIO7 = SCL

---

## Integration Steps

### Step 1: Add Custom Board Configuration to ESP-ADF

```bash
# Copy board configuration to ESP-ADF
cp -r esp_adf_aec_adapted/board_esp32c6_opal esp-adf-temp/components/audio_board/esp32c6_opal
```

### Step 2: Update ESP-ADF to Recognize ESP32-C6 Board

ESP-ADF may need updates to support ESP32-C6. Check:
- `esp-adf-temp/components/audio_board/CMakeLists.txt`
- Add ESP32-C6 board option if needed

### Step 3: Use Adapted AEC Code

Replace ESP-ADF AEC example main file:
```bash
cp esp_adf_aec_adapted/aec_adapted_main.c esp-adf-temp/examples/advanced_examples/aec/main/aec_examples.c
```

### Step 4: Configure Build

```bash
cd esp-adf-temp/examples/advanced_examples/aec
idf.py set-target esp32c6
idf.py menuconfig
```

**In menuconfig**:
- Select ESP32-C6 OPAL board (if option exists)
- Or configure pins manually to match datasheet values

### Step 5: Build and Flash

```bash
idf.py build
idf.py -p COM4 flash monitor
```

---

## How Pinout is Applied

### ESP-ADF I2S Stream Flow:

1. **ESP-ADF calls `get_i2s_pins()`** from board configuration
2. **Our custom board config** (`board_esp32c6_opal/board_pins_config.c`) returns datasheet pinout values
3. **ESP-ADF I2S stream** uses these pins for I2S initialization
4. **Result**: Exact datasheet pinout is used automatically

### Code Flow:

```
ESP-ADF I2S Stream Init
    ↓
Calls get_i2s_pins(port, &board_i2s_pin)
    ↓
Our board_esp32c6_opal/board_pins_config.c
    ↓
Returns datasheet pinout:
    - MCLK = GPIO19
    - BCK = GPIO20
    - LRCK = GPIO22
    - DOUT = GPIO21
    - DIN = GPIO23
    ↓
ESP-ADF configures I2S with these pins
```

---

## Verification

### At Runtime:

The board config logs the pins being used:
```
I (xxx) BOARD_PINS_OPAL: I2S pins configured for ESP32-C6 OPAL (port 0):
I (xxx) BOARD_PINS_OPAL:   MCLK=GPIO19, BCK=GPIO20, LRCK=GPIO22, DOUT=GPIO21, DIN=GPIO23
```

### In Code:

The `aec_adapted_main.c` also logs pins:
```
I (xxx) AEC_OPAL: Using pinout from hardware_config.h:
I (xxx) AEC_OPAL:   I2S: MCLK=GPIO19, BCK=GPIO20, LRCK=GPIO22, DOUT=GPIO21, DIN=GPIO23
```

Both should match the datasheet values.

---

## Troubleshooting

### Issue: ESP-ADF doesn't recognize ESP32-C6 board

**Solution**: 
- Create board selection in menuconfig
- Or manually ensure `get_i2s_pins()` is called from our board config

### Issue: Wrong pins being used

**Solution**:
- Verify `board_esp32c6_opal/board_pins_config.c` has correct datasheet values
- Check that ESP-ADF is using our board config (not default)
- Verify menuconfig board selection

### Issue: Compilation errors

**Solution**:
- Ensure ESP-ADF supports ESP32-C6 (may need updates)
- Check that board_def.h structure matches ESP-ADF expectations
- Verify all includes are correct

---

## Files Summary

### Created Files:
1. `esp_adf_aec_adapted/aec_adapted_main.c` - Main AEC code
2. `esp_adf_aec_adapted/board_esp32c6_opal/board_pins_config.h` - Board config header
3. `esp_adf_aec_adapted/board_esp32c6_opal/board_pins_config.c` - Board config implementation
4. `esp_adf_aec_adapted/board_esp32c6_opal/README_BOARD_CONFIG.md` - Board config docs
5. `esp_adf_aec_adapted/INTEGRATION_GUIDE.md` - This file

### Key Features:
- ✅ Uses exact datasheet pinout values
- ✅ Custom ESP-ADF board configuration
- ✅ Automatic pin configuration via `get_i2s_pins()`
- ✅ Logging to verify correct pins

---

**Status**: Integration ready - uses exact datasheet pinout values throughout

