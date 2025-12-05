# ESP32-C6 Migration Complete - Ready to Build

**Date:** 2025-11-09
**Board:** Waveshare ESP32-C6-Touch-LCD-1.69 (with ES8311 audio)

---

## ✅ Changes Completed

### 1. Build Target Updated
- **Before:** ESP32-S3 (Xtensa architecture)
- **After:** ESP32-C6 (RISC-V architecture)
- **File:** `sdkconfig` lines 391-395

### 2. Pin Configuration Verified
All pin definitions in `main/hardware_config.h` are **100% correct** and match the official Waveshare factory firmware:

**I2C Pins:**
- SDA: GPIO 8 ✓
- SCL: GPIO 7 ✓

**I2S Audio Pins (ES8311 Codec):**
- MCLK: GPIO 19 ✓
- BCLK: GPIO 20 ✓
- LRCK: GPIO 22 ✓
- DOUT: GPIO 23 ✓
- DIN: GPIO 21 ✓
- Codec Enable: GPIO 13 ✓

**SPI LCD Pins (ST7789V2):**
- MOSI: GPIO 2 ✓
- SCK: GPIO 1 ✓
- CS: GPIO 5 ✓
- DC: GPIO 3 ✓
- RST: GPIO 4 ✓
- Backlight: GPIO 6 ✓

**Touch Controller (CST816T):**
- Interrupt: GPIO 11 ✓
- I2C Address: 0x15 ✓

**Other Peripherals:**
- RTC (PCF85063): I2C @ 0x51
- IMU (QMI8658): I2C @ 0x6B
- Power Key: GPIO 18
- Battery Enable: GPIO 15

### 3. Build Environment
- **Build directory:** Cleaned (removed old ESP32-S3 artifacts)
- **Scripts created:**
  - `rebuild_esp32c6.bat` - Build firmware
  - `flash_and_monitor_esp32c6.bat` - Flash and monitor
  - `set_target_esp32c6.bat` - Target configuration

---

## 🚀 Next Steps

### Step 1: Build Firmware

**Option A: Using the build script (recommended)**
```cmd
cd G:\Projects\OPALproject\ProjectWork\hardware\opalDevice
rebuild_esp32c6.bat
```

**Option B: Manual build**
```cmd
C:\Users\huber\esp\v5.5.1\esp-idf\export.bat
cd G:\Projects\OPALproject\ProjectWork\hardware\opalDevice
idf.py build
```

### Step 2: Flash to Device

After successful build:
```cmd
flash_and_monitor_esp32c6.bat
```

Or manually:
```cmd
idf.py -p COM4 flash monitor
```

---

## 🔍 Expected I2C Diagnostic Output

Once the serial monitor opens, you should see:

```
I (xxx) opal: ========================================
I (xxx) opal: OPAL Device Starting...
I (xxx) opal: ========================================

I (xxx) opal: I2C line levels: SDA=1, SCL=1 (both should be 1)
I (xxx) opal: Performing I2C bus recovery...
I (xxx) opal: Bus recovery: 0 clock pulses, final SDA=1 SCL=1 (OK)
I (xxx) opal: Initializing I2C bus (new driver @ 100kHz for ES8311)...
I (xxx) opal: I2C bus initialized (new driver)

I (xxx) I2C_Scanner: ========================================
I (xxx) I2C_Scanner: Scanning I2C bus...
I (xxx) I2C_Scanner: ========================================
I (xxx) I2C_Scanner:   Device found at address 0x18 (ES8311 Audio Codec)
I (xxx) I2C_Scanner:   Device found at address 0x51 (RTC - PCF85063)
I (xxx) I2C_Scanner:   Device found at address 0x6B (IMU - QMI8658)
I (xxx) I2C_Scanner: ========================================
I (xxx) I2C_Scanner: Scan complete. Found 3 device(s).
I (xxx) I2C_Scanner: ========================================

I (xxx) opal: Initializing I2S interface...
I (xxx) opal: I2S interface initialized successfully (MCLK running)
I (xxx) opal: ES8311: Driving GPIO 13 (Codec_CE) HIGH...
I (xxx) opal: ES8311: Writing reset (0x00=0x3F)...
I (xxx) opal: ✓ ES8311 reset write 1 ACK
I (xxx) opal: ES8311: Clearing reset (0x00=0x00)...
I (xxx) opal: ✓ ES8311 reset write 2 ACK
I (xxx) opal: ES8311: Reading reg 0x01...
I (xxx) opal: ✓✓✓ ES8311 Reg 0x01 = 0xXX (CODEC RESPONDING!)
```

### Good Results Indicators:
- ✅ SDA=1, SCL=1 (lines idle HIGH, not stuck)
- ✅ 0 clock pulses (bus not stuck, no recovery needed)
- ✅ Found 3 devices (ES8311 @ 0x18, RTC @ 0x51, IMU @ 0x6B)
- ✅ ES8311 responding (codec successfully initialized)

### Problem Indicators:
- ⚠️ SDA=0 or SCL=0 → Line stuck LOW, check wiring or add external pull-ups
- ⚠️ Found 0 devices → Bus stuck or devices not powered
- ⚠️ ES8311 NACK → Codec not ready despite MCLK/CE sequence

---

## 📊 Build Success Criteria

The build is successful if you see:
```
Project build complete. To flash, run:
 idf.py -p PORT flash
or
 idf.py -p PORT flash monitor  to flash and monitor serial output
```

Typical build time: 2-5 minutes (first build), 30-60 seconds (incremental)

---

## ⚙️ Technical Details

### Architecture Change
- **ESP32-S3:** Xtensa LX7 dual-core @ 240MHz
- **ESP32-C6:** RISC-V single-core @ 160MHz + low-power RISC-V @ 20MHz

### Key Differences
1. **Instruction Set:** Xtensa → RISC-V
2. **Wireless:** WiFi 4 + BLE 5 → WiFi 6 + BLE 5 + Zigbee/Thread
3. **Peripherals:** Both have I2C, SPI, I2S, but different GPIO availability
4. **Toolchain:** Different compiler (xtensa-esp32s3-elf → riscv32-esp-elf)

### Why This Board is Better for Your Project
1. ✅ **Has ES8311 audio codec** (ESP32-S3-Touch-LCD-1.69 does NOT)
2. ✅ **Has speaker and microphone** for AI voice applications
3. ✅ **WiFi 6 support** for better performance and lower latency
4. ✅ **Zigbee/Thread support** for IoT mesh networking
5. ✅ **All peripherals confirmed:** LCD, touch, IMU, RTC, audio, battery

---

## 🐛 Troubleshooting

### Build Errors

**"CMake Error: The current CMakeCache.txt directory is different"**
```cmd
rm -rf build sdkconfig
idf.py set-target esp32c6
idf.py build
```

**"Component 'xxx' not found"**
```cmd
idf.py reconfigure
idf.py build
```

### Flash Errors

**"A fatal error occurred: Could not open COM4"**
- Close any serial monitor programs (Arduino IDE, PuTTY, etc.)
- Check Device Manager for correct COM port
- Try unplugging/replugging the device

**"A fatal error occurred: Failed to connect to ESP32-C6"**
- Press and hold BOOT button while connecting
- Press RESET button
- Try: `idf.py -p COM4 -b 115200 flash`

---

## 📝 Session Notes

**Previous Work (from Neo4j):**
- Migrated from mixed I2C drivers to all-new I2C master driver API
- Implemented comprehensive I2C bus diagnostics
- Enabled I2C internal pull-ups for better bus stability
- Added detailed logging and error handling for ES8311 initialization
- Successfully flashed diagnostic firmware (but to wrong target)

**Current Status:**
- ✅ Confirmed hardware is ESP32-C6-Touch-LCD-1.69 with audio
- ✅ Pin configuration verified against factory firmware
- ✅ Build target corrected from ESP32-S3 to ESP32-C6
- ✅ Build directory cleaned
- 🔄 **Ready to build and test**

---

**Next Action:** Run `rebuild_esp32c6.bat` in Windows CMD and observe the build output.
