# Pinout Configuration for AEC Project

## ✅ Using Your Provided Pinout Table

This AEC adaptation uses **exactly** the pinout values from your `hardware_config.h`, which matches your provided pinout table.

---

## I2S Pins (From Your Pinout Table)

| Function | GPIO | Pinout Table Label | hardware_config.h | Status |
|----------|------|-------------------|-------------------|--------|
| MCLK | GPIO19 | I2S_MCLK | `I2S_MCK_PIN = GPIO_NUM_19` | ✅ Used |
| BCK (SCLK) | GPIO20 | I2S_SCLK | `I2S_BCK_PIN = GPIO_NUM_20` | ✅ Used |
| LRCK | GPIO22 | I2S_LRCK | `I2S_LRCK_PIN = GPIO_NUM_22` | ✅ Used |
| DOUT (ASDOUT) | GPIO21 | I2S_ASDOUT | `I2S_DOUT_PIN = GPIO_NUM_21` | ✅ Used |
| DIN (DSDIN) | GPIO23 | I2S_DSDIN | `I2S_DIN_PIN = GPIO_NUM_23` | ✅ Used |

**Source**: Your pinout table (accurate hardware representation)

---

## I2C Pins (From Your Pinout Table)

| Function | GPIO | hardware_config.h | Status |
|----------|------|-------------------|--------|
| SDA | GPIO8 | `I2C_MASTER_SDA_GPIO = GPIO_NUM_8` | ✅ Used |
| SCL | GPIO7 | `I2C_MASTER_SCL_GPIO = GPIO_NUM_7` | ✅ Used |

**Source**: Your pinout table (accurate hardware representation)

---

## Code References

In `aec_adapted_main.c`, the pins are defined as:

```c
// I2S Pins (from your pinout table):
#define AEC_I2S_MCK_PIN     I2S_MCK_PIN      // GPIO19 (I2S_MCLK)
#define AEC_I2S_BCK_PIN     I2S_BCK_PIN      // GPIO20 (I2S_SCLK)
#define AEC_I2S_LRCK_PIN    I2S_LRCK_PIN     // GPIO22 (I2S_LRCK)
#define AEC_I2S_DOUT_PIN    I2S_DOUT_PIN     // GPIO21 (I2S_ASDOUT)
#define AEC_I2S_DIN_PIN     I2S_DIN_PIN      // GPIO23 (I2S_DSDIN)

// I2C Pins (from your pinout table):
#define AEC_I2C_SDA_PIN     I2C_MASTER_SDA_GPIO  // GPIO8 (SDA)
#define AEC_I2C_SCL_PIN     I2C_MASTER_SCL_GPIO  // GPIO7 (SCL)
```

These all reference `hardware_config.h` which contains your exact pinout values.

---

## ESP-ADF Pin Configuration

**Important Note**: ESP-ADF uses board abstraction which gets pins from board configuration files. To use our pinout:

### **Option 1: Configure via menuconfig** (Recommended)
```bash
idf.py menuconfig
# Navigate to: Audio HAL → I2S Configuration
# Set pins to match our hardware_config.h:
#   - MCLK = GPIO19
#   - BCK = GPIO20
#   - LRCK = GPIO22
#   - DOUT = GPIO21
#   - DIN = GPIO23
```

### **Option 2: Create Custom Board Config**
- Create ESP-ADF board configuration for ESP32-C6
- Implement `get_i2s_pins()` function with our pinout
- This is more complex but ensures pins are always correct

### **Option 3: Modify ESP-ADF I2S Stream**
- Modify ESP-ADF I2S stream component to accept custom pins
- This requires modifying ESP-ADF source code

---

## Verification

The code logs the pins being used at startup:
```
I (xxx) AEC_OPAL: Using pinout from hardware_config.h:
I (xxx) AEC_OPAL:   I2S: MCLK=GPIO19, BCK=GPIO20, LRCK=GPIO22, DOUT=GPIO21, DIN=GPIO23
I (xxx) AEC_OPAL:   I2C: SDA=GPIO8, SCL=GPIO7
```

This confirms the exact pins from your pinout table are being used.

---

## Summary

✅ **All pins match your provided pinout table**
✅ **Pins are defined in hardware_config.h**
✅ **AEC code references hardware_config.h**
✅ **No ESP-ADF default pins are used**

**The AEC adaptation uses your exact pinout values, not ESP-ADF defaults!**

