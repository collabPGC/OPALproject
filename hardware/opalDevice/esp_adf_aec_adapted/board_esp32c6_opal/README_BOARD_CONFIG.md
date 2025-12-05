# ESP32-C6 OPAL Board Configuration for ESP-ADF

## Overview

This is a custom board configuration for ESP-ADF to support the ESP32-C6 OPAL device with **EXACT pinout values from the device datasheet**.

## Pinout (From Datasheet)

### I2S Pins:
- **MCLK** = GPIO19 (I2S_MCLK)
- **BCK** = GPIO20 (I2S_SCLK)  
- **LRCK** = GPIO22 (I2S_LRCK)
- **DOUT** = GPIO21 (I2S_ASDOUT)
- **DIN** = GPIO23 (I2S_DSDIN)

### I2C Pins:
- **SDA** = GPIO8
- **SCL** = GPIO7

**Source**: Device datasheet (matches `hardware_config.h`)

---

## Files

- `board_pins_config.h` - Header file with function declarations
- `board_pins_config.c` - Implementation with exact datasheet pinout values

---

## Integration with ESP-ADF

### Option 1: Add to ESP-ADF Components (Recommended)

1. Copy `board_esp32c6_opal/` directory to:
   ```
   esp-adf-temp/components/audio_board/esp32c6_opal/
   ```

2. Create `board.h` file (if needed) following ESP-ADF board structure

3. Update ESP-ADF CMakeLists.txt to include this board

### Option 2: Use as Component in Project

1. Add `board_esp32c6_opal/` as a component in your project
2. Ensure it's included before ESP-ADF board components
3. ESP-ADF will use `get_i2s_pins()` from this board config

---

## Usage

The `get_i2s_pins()` function is automatically called by ESP-ADF's I2S stream component. It returns the exact pinout values from the datasheet.

**No manual pin configuration needed** - ESP-ADF will use these pins automatically when this board config is selected.

---

## Verification

The board config logs the pins at initialization:
```
I (xxx) BOARD_PINS_OPAL: I2S pins configured for ESP32-C6 OPAL (port 0):
I (xxx) BOARD_PINS_OPAL:   MCLK=GPIO19, BCK=GPIO20, LRCK=GPIO22, DOUT=GPIO21, DIN=GPIO23
```

This confirms the exact datasheet pinout is being used.

---

## Important Notes

1. **Datasheet Values**: All pins are from the device datasheet, not ESP-ADF defaults
2. **No Board Abstraction**: This bypasses ESP-ADF's board abstraction for pin configuration
3. **ESP32-C6 Specific**: This config is specifically for ESP32-C6 OPAL device
4. **Port 0 Only**: ESP32-C6 uses I2S port 0

---

**Status**: Custom board configuration ready with exact datasheet pinout values

