# AEC Project Adaptation Guide for OPAL Device

## Project Overview

**Source**: `esp-adf-temp/examples/advanced_examples/aec`
**Target**: ESP32-C6 with ES8311 codec (OPAL device)

---

## Key Findings from Source Code

### **Codec**: ✅ ES8311 (matches our hardware)
- The project already uses ES8311 codec
- Includes `#include "es8311.h"`

### **Board Abstraction**: ⚠️ Uses ESP-ADF board abstraction
- Uses `board.h` and `audio_board_init()`
- Designed for specific boards (Lyrat, Korvo, etc.)
- We may need to create custom board configuration

### **SD Card Dependency**: ⚠️ Requires SD card
- `audio_board_sdcard_init()` - saves recorded audio
- We can adapt to skip file saving or use flash

### **Audio Pipeline**:
```
Playback: [MP3 in flash] → mp3_decoder → filter → i2s_stream → [ES8311 speaker]
Record:   [ES8311 mic] → i2s_stream → filter → AEC → wav_encoder → [SD card]
```

---

## Required Adaptations

### 1. **Board Configuration** (CRITICAL)

**Problem**: ESP-ADF uses board abstraction (`board.h`) for specific boards.

**Options**:
- **Option A**: Create custom board configuration for ESP32-C6
- **Option B**: Bypass board abstraction and configure directly

**Recommended**: Option B - Direct configuration (simpler)

**Changes Needed**:
- Replace `audio_board_init()` with direct ES8311 initialization
- Use our `audio_system.c` approach or ESP-ADF components directly
- Configure I2S pins manually

### 2. **Pin Configuration** (CRITICAL)

**Update I2S Pins** to match our `hardware_config.h`:
```c
// Our pinout (from hardware_config.h):
#define I2S_MCK_PIN     GPIO_NUM_19
#define I2S_BCK_PIN     GPIO_NUM_20
#define I2S_LRCK_PIN    GPIO_NUM_22
#define I2S_DOUT_PIN    GPIO_NUM_21
#define I2S_DIN_PIN     GPIO_NUM_23
```

**Update I2C Pins**:
```c
// Our pinout:
#define I2C_SDA         GPIO_NUM_8
#define I2C_SCL         GPIO_NUM_7
```

### 3. **SD Card Dependency** (OPTIONAL)

**Options**:
- **Option A**: Remove file saving (just test AEC)
- **Option B**: Save to flash instead
- **Option C**: Use our MQTT system to stream

**Recommended**: Option A for initial testing

**Changes**:
- Comment out `audio_board_sdcard_init()`
- Comment out `fatfs_stream` element
- Skip file saving, just process audio

### 4. **ESP32-C6 Compatibility**

**Check**:
- ESP-ADF may not fully support ESP32-C6
- May need to adapt I2S driver calls
- Check if ESP-ADF components work on ESP32-C6

---

## Implementation Strategy

### **Approach 1: Minimal Adaptation** (Recommended for Testing)

1. **Keep ESP-ADF pipeline structure**
2. **Replace board initialization** with direct ES8311 config
3. **Update pin definitions** in code or via menuconfig
4. **Remove SD card dependency** (comment out)

### **Approach 2: Full Integration**

1. **Extract AEC algorithm** from ESP-ADF
2. **Integrate with our `audio_system.c`**
3. **Use our audio I/O** instead of ESP-ADF pipeline
4. **Add AEC processing** between mic and speaker

---

## Step-by-Step Adaptation

### **Step 1: Examine Source Code**
```bash
cd esp-adf-temp\examples\advanced_examples\aec
# Review main/aec_examples.c
```

### **Step 2: Create Modified Version**
- Copy AEC project to working directory
- Modify `main/aec_examples.c`
- Update pin configurations
- Remove SD card dependency

### **Step 3: Update CMakeLists.txt**
- Ensure ESP32-C6 target
- Update component dependencies
- Remove SD card dependencies if needed

### **Step 4: Configure (menuconfig)**
```bash
idf.py menuconfig
```
- Set target to ESP32-C6
- Configure audio board (or skip if using direct config)
- Update I2S/I2C pins
- Disable SD card if not available

### **Step 5: Build and Test**
```bash
idf.py build
idf.py -p COM4 flash monitor
```

---

## Key Code Sections to Modify

### **1. Board Initialization** (Replace)
```c
// Original:
audio_board_handle_t board_handle = audio_board_init();
audio_hal_ctrl_codec(board_handle->audio_hal, AUDIO_HAL_CODEC_MODE_BOTH, AUDIO_HAL_CTRL_START);

// Replace with direct ES8311 initialization (similar to our audio_system.c)
```

### **2. I2S Stream Configuration** (Update Pins)
```c
// Update i2s_stream_cfg_t to use our pins
// Or configure via menuconfig
```

### **3. SD Card Initialization** (Remove/Adapt)
```c
// Comment out:
// audio_board_sdcard_init(set, SD_MODE_1_LINE);
// fatfs_stream_cfg_t fatfs_cfg = FATFS_STREAM_CFG_DEFAULT();
// fatfs_stream_writer = fatfs_stream_init(&fatfs_cfg);
```

---

## Expected Challenges

1. **Board Abstraction**: ESP-ADF board config may not support ESP32-C6
2. **I2S Driver**: May need ESP-IDF v5.x I2S driver (new API)
3. **Memory**: ESP-ADF uses more RAM, ESP32-C6 has 320KB
4. **SD Card**: Not available, need to adapt

---

## Next Steps

1. **Run setup script**: `setup_aec_project.bat`
2. **Examine source code** in detail
3. **Create adapted version** with our pinout
4. **Test build** and fix compilation errors
5. **Flash and test** audio functionality

---

**Status**: Ready to adapt AEC project for our hardware

