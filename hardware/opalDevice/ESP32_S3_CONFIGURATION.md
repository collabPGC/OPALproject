# ESP32-S3 Configuration Complete

**Date:** 2025-11-09
**Board:** Waveshare ESP32-S3-Touch-LCD-1.69
**Reason:** Better GPIO voltage compatibility vs ESP32-C6

---

## ✅ Changes Completed

### 1. Build Target
- **Target:** ESP32-S3 (Xtensa architecture)
- **File:** `sdkconfig` already set to ESP32-S3

### 2. Pin Configuration Updated for ESP32-S3

All pins updated in `main/hardware_config.h`:

**I2C Pins:**
- SDA: GPIO 11 (was GPIO 8 for C6)
- SCL: GPIO 10 (was GPIO 7 for C6)

**SPI LCD Pins (ST7789V2):**
- MOSI: GPIO 7 (was GPIO 2)
- SCK: GPIO 6 (was GPIO 1)
- CS: GPIO 5 (same)
- DC: GPIO 4 (was GPIO 3)
- RST: GPIO 8 (was GPIO 4)
- Backlight: GPIO 15 (was GPIO 6)

**Touch Controller (CST816D):**
- Interrupt: GPIO 14 (was GPIO 11)
- Reset: GPIO 13 (was NC)
- I2C Address: 0x15 (same)

**Other Peripherals:**
- RTC (PCF85063): I2C @ 0x51, INT @ GPIO 41
- IMU (QMI8658): I2C @ 0x6B, INT1 @ GPIO 38
- Buzzer: GPIO 33 (old) / GPIO 42 (new)
- Power Key: GPIO 18
- Battery Enable: GPIO 15

### 3. Audio System Changes

**IMPORTANT:** ESP32-S3-Touch-LCD-1.69 does **NOT** have ES8311 audio codec!

- ❌ **NO ES8311** audio codec chip
- ❌ **NO speaker** or microphone
- ✅ **Only passive buzzer** available (GPIO 33)

**Code Changes:**
- Disabled ES8311 test code in `opal_main.c` (lines 526-656)
- Updated `hardware_config.h` to document buzzer-only audio

**Note:** If you need audio codec, you must use **ESP32-C6-Touch-LCD-1.69** variant.

---

## 🚀 Build and Flash Instructions

### Step 1: Build Firmware

Double-click: **`rebuild_esp32s3.bat`**

This will:
1. Clean the build directory
2. Set target to ESP32-S3
3. Build the firmware (~3-5 minutes)

### Step 2: Flash to Device

After successful build, double-click: **`flash_and_monitor_esp32s3.bat`**

This will:
- Flash firmware to COM4
- Open serial monitor
- Show I2C diagnostic output

---

## 🔍 Expected Diagnostic Output

Since ES8311 is disabled, you should see:

```
I (xxx) opal: ========================================
I (xxx) opal: OPAL Device Starting...
I (xxx) opal: ========================================

I (xxx) opal: I2C line levels: SDA=1, SCL=1 (both should be 1)
I (xxx) opal: Performing I2C bus recovery...
I (xxx) opal: Bus recovery: 0 clock pulses, final SDA=1 SCL=1 (OK)
I (xxx) opal: Initializing I2C bus (new driver @ 400kHz)...
I (xxx) opal: I2C bus initialized (new driver)

I (xxx) I2C_Scanner: ========================================
I (xxx) I2C_Scanner: Scanning I2C bus...
I (xxx) I2C_Scanner: ========================================
I (xxx) I2C_Scanner:   Device found at address 0x15 (Touch - CST816D)
I (xxx) I2C_Scanner:   Device found at address 0x51 (RTC - PCF85063)
I (xxx) I2C_Scanner:   Device found at address 0x6B (IMU - QMI8658)
I (xxx) I2C_Scanner: ========================================
I (xxx) I2C_Scanner: Scan complete. Found 3 device(s).
I (xxx) I2C_Scanner: ========================================

I (xxx) opal: ========================================
I (xxx) opal:   ESP32-S3 Configuration
I (xxx) opal:   Board: ESP32-S3-Touch-LCD-1.69
I (xxx) opal:   Audio: Buzzer only (NO ES8311 codec)
I (xxx) opal: ========================================
```

### Good Results:
- ✅ SDA=1, SCL=1 (lines idle HIGH)
- ✅ 0 clock pulses (no bus recovery needed)
- ✅ Found 3 devices (Touch @ 0x15, RTC @ 0x51, IMU @ 0x6B)
- ✅ **NO 0x18 device** (ES8311 not present on S3 variant - this is correct!)

### Problem Indicators:
- ⚠️ SDA=0 or SCL=0 → Line stuck LOW
- ⚠️ Found 0 devices → Bus stuck or devices not powered
- ⚠️ Found device @ 0x18 → Wrong board (you have C6 variant, not S3!)

---

## 🔧 ESP32-S3 vs ESP32-C6 Comparison

| Feature | ESP32-S3 | ESP32-C6 |
|---------|----------|----------|
| **CPU** | Xtensa LX7 dual-core @ 240MHz | RISC-V single-core @ 160MHz |
| **GPIO Voltage** | Better compatibility | Some voltage issues |
| **Wireless** | WiFi 4 + BLE 5 | WiFi 6 + BLE 5 + Zigbee |
| **Audio Codec** | ❌ NO (buzzer only) | ✅ YES (ES8311 + speaker + mic) |
| **Display** | ✅ ST7789V2 LCD | ✅ ST7789V2 LCD |
| **Touch** | ✅ CST816D | ✅ CST816T |
| **IMU** | ✅ QMI8658 | ✅ QMI8658 |
| **RTC** | ✅ PCF85063 | ✅ PCF85063 |
| **I2C Pins** | GPIO 10/11 | GPIO 7/8 |
| **Price** | Lower | Slightly higher |

**Recommendation:**
- Use **ESP32-S3** for: Display projects, GPIO compatibility, lower cost
- Use **ESP32-C6** for: Audio applications, WiFi 6, IoT mesh networks

---

## ⚙️ Technical Notes

### GPIO Voltage Issues (C6)
The ESP32-C6 had GPIO voltage compatibility issues with some peripherals. ESP32-S3 handles 3.3V peripheral interfacing better.

### I2C Bus Differences
- **ESP32-S3:** GPIO10 (SCL), GPIO11 (SDA) - shared by all I2C devices
- **ESP32-C6:** GPIO7 (SCL), GPIO8 (SDA) - shared by all I2C devices

Both configurations use I2C_NUM_0 with 400kHz clock.

### Audio Limitations
If you need audio features:
1. **Hardware:** Switch to ESP32-C6-Touch-LCD-1.69 (has ES8311)
2. **Software:** Revert pin changes and re-enable ES8311 code
3. **Alternative:** Use external I2S audio codec module

---

## 📝 Files Modified

1. `main/hardware_config.h` - Updated all pin definitions for S3
2. `main/opal_main.c` - Disabled ES8311 test code (lines 526-656)
3. `sdkconfig` - Already set to ESP32-S3
4. Created: `rebuild_esp32s3.bat` - Build script
5. Created: `flash_and_monitor_esp32s3.bat` - Flash script

---

## 🐛 Troubleshooting

### Build Fails with "xtensa compiler not found"
```cmd
rm -rf build sdkconfig.old
rebuild_esp32s3.bat
```

### I2C Scan Finds Device @ 0x18
This means you have the **ESP32-C6** variant (with audio), not ESP32-S3!
- Check your board label
- If you have C6, revert to C6 configuration

### Touch/LCD Not Working
- Verify pin connections match the new S3 pin mapping
- Check SPI pins: GPIO 6 (SCK), GPIO 7 (MOSI)
- Check touch pins: GPIO 14 (INT), GPIO 13 (RST)

---

**Ready to Build:** Run `rebuild_esp32s3.bat` in your project folder! 🎯
