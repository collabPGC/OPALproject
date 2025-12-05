# AEC Project Integration - Verification Checklist

## ✅ Integration Status: COMPLETE

All components have been integrated and are ready for building.

---

## Verification Checklist

### 1. ✅ Custom Board Configuration
- [x] `esp-adf-temp/components/audio_board/esp32c6_opal/board_pins_config.c` - Complete with all functions
- [x] `esp-adf-temp/components/audio_board/esp32c6_opal/board_pins_config.h` - Header file
- [x] `esp-adf-temp/components/audio_board/esp32c6_opal/board.c` - Board initialization
- [x] `esp-adf-temp/components/audio_board/esp32c6_opal/board.h` - Board interface
- [x] `esp-adf-temp/components/audio_board/esp32c6_opal/board_def.h` - Board definitions

**Pinout Values (From Datasheet)**:
- I2S: GPIO19=MCLK, GPIO20=BCK, GPIO22=LRCK, GPIO21=DOUT, GPIO23=DIN
- I2C: GPIO8=SDA, GPIO7=SCL

### 2. ✅ ESP-ADF Build System Integration
- [x] `Kconfig.projbuild` - Added `ESP32_C6_OPAL_BOARD` option
- [x] `CMakeLists.txt` - Added board build configuration
- [x] Board will appear in `idf.py menuconfig` as "ESP32-C6-OPAL"

### 3. ✅ AEC Code Adaptation
- [x] `aec_examples.c` - Updated to use `audio_board_init()`
- [x] Includes `audio_hal.h` for codec control
- [x] Uses ESP-ADF board abstraction correctly
- [x] SD card dependency removed
- [x] ES8311 mic gain configuration added

### 4. ✅ Code Dependencies
- [x] `#include "board.h"` - Board abstraction
- [x] `#include "audio_hal.h"` - Audio HAL functions
- [x] `#include "es8311.h"` - ES8311 codec driver
- [x] All ESP-ADF components available

---

## Build Instructions

### **Quick Start**:
```bash
build_aec_project.bat
```

### **Manual Build Steps**:

1. **Set Environment Variables**:
```powershell
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

## Expected Runtime Output

### **Board Initialization**:
```
I (xxx) AUDIO_BOARD_OPAL: Initializing ESP32-C6 OPAL audio board (ES8311 codec)
I (xxx) AUDIO_BOARD_OPAL: Using datasheet pinout: I2S pins GPIO19/20/21/22/23, I2C pins GPIO7/8
I (xxx) AUDIO_BOARD_OPAL: Audio board initialized successfully
```

### **Pin Configuration**:
```
I (xxx) BOARD_PINS_OPAL: I2S pins configured for ESP32-C6 OPAL (port 0):
I (xxx) BOARD_PINS_OPAL:   MCLK=GPIO19, BCK=GPIO20, LRCK=GPIO22, DOUT=GPIO21, DIN=GPIO23
I (xxx) BOARD_PINS_OPAL: I2C pins configured for ESP32-C6 OPAL (port 0):
I (xxx) BOARD_PINS_OPAL:   SDA=GPIO8, SCL=GPIO7
```

### **AEC Initialization**:
```
I (xxx) AEC_OPAL: ========================================
I (xxx) AEC_OPAL: AEC Example - Adapted for OPAL Device
I (xxx) AEC_OPAL: ESP32-C6 + ES8311 Codec
I (xxx) AEC_OPAL: ========================================
I (xxx) AEC_OPAL: [2.0] Initialize codec chip
I (xxx) AEC_OPAL: Using datasheet pinout (via ESP-ADF board config):
I (xxx) AEC_OPAL:   I2S: MCLK=GPIO19, BCK=GPIO20, LRCK=GPIO22, DOUT=GPIO21, DIN=GPIO23
I (xxx) AEC_OPAL:   I2C: SDA=GPIO8, SCL=GPIO7
```

---

## Troubleshooting

### **Issue: Board not found in menuconfig**
- **Solution**: Verify `Kconfig.projbuild` has `ESP32_C6_OPAL_BOARD` option
- **Solution**: Check `CMakeLists.txt` includes the board configuration

### **Issue: Build errors about missing functions**
- **Solution**: Verify `board_pins_config.c` has all required functions
- **Solution**: Check that `board_def.h` defines all required macros

### **Issue: Wrong pins being used**
- **Solution**: Verify `get_i2s_pins()` returns correct datasheet values
- **Solution**: Check menuconfig board selection is "ESP32-C6-OPAL"

### **Issue: Codec initialization fails**
- **Solution**: Verify I2C communication (check SDA/SCL pins)
- **Solution**: Verify ES8311 CE pin is hard-wired HIGH (not controllable)
- **Solution**: Check I2C device detection in serial monitor

---

## Files Summary

### **ESP-ADF Board Configuration**:
- `esp-adf-temp/components/audio_board/esp32c6_opal/board_pins_config.c` ✅
- `esp-adf-temp/components/audio_board/esp32c6_opal/board_pins_config.h` ✅
- `esp-adf-temp/components/audio_board/esp32c6_opal/board.c` ✅
- `esp-adf-temp/components/audio_board/esp32c6_opal/board.h` ✅
- `esp-adf-temp/components/audio_board/esp32c6_opal/board_def.h` ✅

### **ESP-ADF Build System**:
- `esp-adf-temp/components/audio_board/Kconfig.projbuild` ✅
- `esp-adf-temp/components/audio_board/CMakeLists.txt` ✅

### **AEC Code**:
- `esp-adf-temp/examples/advanced_examples/aec/main/aec_examples.c` ✅

### **Documentation**:
- `build_aec_project.bat` - Build script ✅
- `AEC_INTEGRATION_COMPLETE.md` - Integration docs ✅
- `AEC_BUILD_READY.md` - Build instructions ✅
- `INTEGRATION_VERIFICATION.md` - This file ✅

---

## Key Features

✅ **Exact Datasheet Pinout** - All pins from device datasheet  
✅ **Custom Board Configuration** - ESP-ADF recognizes ESP32-C6 OPAL  
✅ **Automatic Pin Configuration** - ESP-ADF uses correct pins via `get_i2s_pins()`  
✅ **Board Abstraction** - Uses ESP-ADF board system correctly  
✅ **ES8311 Codec** - Properly configured with mic gain  
✅ **SD Card Removed** - No file saving dependency  

---

**Status**: ✅ **READY TO BUILD** - All integration complete with exact datasheet pinout

