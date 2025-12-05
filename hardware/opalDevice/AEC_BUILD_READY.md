# AEC Project - Ready to Build

## ✅ Integration Complete

The ESP-ADF AEC project has been fully integrated with the ESP32-C6 OPAL device using **EXACT datasheet pinout values**.

---

## What Was Integrated

### 1. **Custom Board Configuration Created**
- **Location**: `esp-adf-temp/components/audio_board/esp32c6_opal/`
- **Files**:
  - `board_pins_config.c` - I2S/I2C pins from datasheet ✅
  - `board_pins_config.h` - Header ✅
  - `board.c` - Board initialization ✅
  - `board.h` - Board interface ✅
  - `board_def.h` - Board definitions ✅

### 2. **Added to ESP-ADF Build System**
- ✅ Added `ESP32_C6_OPAL_BOARD` to `Kconfig.projbuild`
- ✅ Added board to `CMakeLists.txt`
- ✅ Board will appear in `idf.py menuconfig`

### 3. **Adapted AEC Code**
- ✅ Replaced `aec_examples.c` with adapted version
- ✅ Uses datasheet pinout values
- ✅ SD card dependency removed

---

## Datasheet Pinout Values (Used Throughout)

### **I2S Pins** (From Device Datasheet):
```c
MCLK  = GPIO19  // I2S_MCLK
BCK   = GPIO20  // I2S_SCLK
LRCK  = GPIO22  // I2S_LRCK
DOUT  = GPIO21  // I2S_ASDOUT
DIN   = GPIO23  // I2S_DSDIN
```

### **I2C Pins** (From Device Datasheet):
```c
SDA = GPIO8
SCL = GPIO7
```

**Source**: Device datasheet (matches `hardware_config.h`)

---

## How to Build

### **Quick Start**:
```bash
build_aec_project.bat
```

### **Manual Steps**:

1. **Set Environment Variables**:
```bash
$env:ADF_PATH = "G:\Projects\OPALproject\ProjectWork\hardware\opalDevice\esp-adf-temp"
$env:IDF_PATH = "C:\Users\huber\esp\v5.5.1\esp-idf"
```

2. **Navigate to AEC Project**:
```bash
cd esp-adf-temp\examples\advanced_examples\aec
```

3. **Set Target**:
```bash
idf.py set-target esp32c6
```

4. **Configure** (CRITICAL):
```bash
idf.py menuconfig
```
**Navigate to**: `Audio HAL` → `Audio board`
**Select**: `ESP32-C6-OPAL (Waveshare Touch LCD 1.69 with ES8311)`

5. **Build**:
```bash
idf.py build
```

6. **Flash and Monitor**:
```bash
idf.py -p COM4 flash monitor
```

---

## Verification

### **At Build Time**:
```
-- Current board name is ESP32-C6-OPAL (using datasheet pinout)
```

### **At Runtime**:
```
I (xxx) BOARD_PINS_OPAL: I2S pins configured for ESP32-C6 OPAL (port 0):
I (xxx) BOARD_PINS_OPAL:   MCLK=GPIO19, BCK=GPIO20, LRCK=GPIO22, DOUT=GPIO21, DIN=GPIO23
I (xxx) BOARD_PINS_OPAL: I2C pins configured for ESP32-C6 OPAL (port 0):
I (xxx) BOARD_PINS_OPAL:   SDA=GPIO8, SCL=GPIO7
```

---

## Files Modified

### **In ESP-ADF**:
1. `esp-adf-temp/components/audio_board/esp32c6_opal/` - Complete board config
2. `esp-adf-temp/components/audio_board/Kconfig.projbuild` - Board option added
3. `esp-adf-temp/components/audio_board/CMakeLists.txt` - Build config added
4. `esp-adf-temp/examples/advanced_examples/aec/main/aec_examples.c` - Adapted code

### **In Project Root**:
1. `build_aec_project.bat` - Build script
2. `AEC_INTEGRATION_COMPLETE.md` - Integration docs
3. `AEC_BUILD_READY.md` - This file

---

## Key Features

✅ **Exact Datasheet Pinout** - All pins from device datasheet
✅ **Custom Board Configuration** - ESP-ADF recognizes ESP32-C6 OPAL
✅ **Automatic Pin Configuration** - ESP-ADF uses correct pins via `get_i2s_pins()`
✅ **SD Card Removed** - No file saving dependency
✅ **ES8311 Codec** - Properly configured for our hardware
✅ **Board Abstraction** - Uses ESP-ADF board system correctly

---

## Next Steps

1. **Run build script**: `build_aec_project.bat`
2. **Select ESP32-C6-OPAL board** in menuconfig
3. **Build and flash**
4. **Verify pins** in serial monitor logs
5. **Test audio** functionality (playback and recording with AEC)

---

**Status**: ✅ Ready to build - All integration complete with exact datasheet pinout

