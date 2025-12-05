# AEC Project Setup - Complete Guide

## ✅ Project Selected: `aec` (Acoustic Echo Cancellation)

**Location**: `esp-adf-temp/examples/advanced_examples/aec`

---

## Project Structure

### **Main Components**:
1. **Playback Pipeline**: MP3 from flash → decoder → filter → I2S → ES8311 speaker
2. **Recording Pipeline**: ES8311 mic → I2S → filter → AEC → WAV encoder → SD card
3. **AEC Algorithm**: Acoustic Echo Cancellation between playback and recording

### **Key Files**:
- `main/aec_examples.c` - Main application
- `main/test.mp3` - Test audio file (embedded)
- `CMakeLists.txt` - Build configuration
- `sdkconfig.defaults` - Default configuration

---

## Quick Start

### **Option 1: Use Setup Script** (Recommended)
```bash
setup_aec_project.bat
```

### **Option 2: Manual Setup**

1. **Set Environment Variables**:
```bash
$env:ADF_PATH = "G:\Projects\OPALproject\ProjectWork\hardware\opalDevice\esp-adf-temp"
$env:IDF_PATH = "C:\Users\huber\esp\v5.5.1\esp-idf"
```

2. **Navigate to Project**:
```bash
cd esp-adf-temp\examples\advanced_examples\aec
```

3. **Set Target**:
```bash
idf.py set-target esp32c6
```

4. **Configure**:
```bash
idf.py menuconfig
```
**Key Settings**:
- Audio board: Configure for ES8311 or use custom
- I2S pins: Update to match our pinout (GPIO19, 20, 21, 22, 23)
- I2C pins: Update to match our pinout (GPIO7, 8)
- SD card: Disable if not available

5. **Build**:
```bash
idf.py build
```

6. **Flash and Monitor**:
```bash
idf.py -p COM4 flash monitor
```

---

## Required Adaptations

### **1. Board Configuration** ⚠️ CRITICAL

**Problem**: Uses ESP-ADF `audio_board_init()` which is board-specific.

**Solution Options**:
- **Option A**: Create custom board config for ESP32-C6
- **Option B**: Replace with direct ES8311 initialization (recommended)

**Code to Replace**:
```c
// Original (line 101-102):
audio_board_handle_t board_handle = audio_board_init();
audio_hal_ctrl_codec(board_handle->audio_hal, AUDIO_HAL_CODEC_MODE_BOTH, AUDIO_HAL_CTRL_START);

// Replace with direct ES8311 init (similar to our audio_system.c)
```

### **2. Pin Configuration** ⚠️ CRITICAL

**Update I2S Pins** (in code or menuconfig):
- MCLK = GPIO19
- BCK = GPIO20
- LRCK = GPIO22
- DOUT = GPIO21
- DIN = GPIO23

**Update I2C Pins**:
- SDA = GPIO8
- SCL = GPIO7

### **3. SD Card Dependency** ⚠️ OPTIONAL

**Options**:
- **Option A**: Remove file saving (comment out SD card code)
- **Option B**: Save to flash instead
- **Option C**: Stream via MQTT

**Code to Comment Out** (lines 87-92, 138-157):
```c
// audio_board_sdcard_init(set, SD_MODE_1_LINE);
// fatfs_stream_writer = fatfs_stream_init(&fatfs_wd_cfg);
// audio_pipeline_register(pipeline_rec, fatfs_stream_writer, "fatfs_stream");
```

---

## Expected Challenges

1. **Board Abstraction**: ESP-ADF may not have ESP32-C6 board config
2. **I2S Driver**: May need ESP-IDF v5.x new I2S API
3. **Memory**: ESP-ADF uses more RAM (ESP32-C6 has 320KB)
4. **SD Card**: Not available, need to adapt

---

## Testing Strategy

### **Phase 1: Basic Build**
- Get project to compile
- Fix board abstraction issues
- Update pin configurations

### **Phase 2: Audio Output**
- Test MP3 playback
- Verify ES8311 speaker output
- Check I2S configuration

### **Phase 3: Audio Input**
- Test microphone recording
- Verify ES8311 microphone input
- Check I2S RX configuration

### **Phase 4: AEC Processing**
- Test full-duplex audio
- Verify AEC algorithm
- Check echo cancellation

---

## Documentation Created

1. **`BUILD_AEC_PROJECT.md`** - Build instructions
2. **`AEC_PROJECT_ADAPTATION.md`** - Detailed adaptation guide
3. **`setup_aec_project.bat`** - Setup script
4. **`ESP_ADF_PROJECT_RECOMMENDATIONS.md`** - Project selection guide

---

## Next Steps

1. **Run setup script**: `setup_aec_project.bat`
2. **Examine source code**: Review `main/aec_examples.c`
3. **Create adapted version**: Modify for our hardware
4. **Build and test**: Fix compilation errors
5. **Flash and verify**: Test audio functionality

---

## Key Code Sections

### **Board Initialization** (Line 101-108):
```c
audio_board_handle_t board_handle = audio_board_init();
audio_hal_ctrl_codec(board_handle->audio_hal, AUDIO_HAL_CODEC_MODE_BOTH, AUDIO_HAL_CTRL_START);
audio_hal_set_volume(board_handle->audio_hal, 80);
es8311_set_mic_gain(ES8311_MIC_GAIN_24DB);
```

### **AEC Configuration** (Line 120-129):
```c
aec_stream_cfg_t aec_config = AEC_STREAM_CFG_DEFAULT();
aec_config.input_format = "MR";  // Mic Reference
audio_element_handle_t element_aec = aec_stream_init(&aec_config);
```

### **Pipeline Setup** (Line 114-150):
- Recording pipeline: I2S → AEC → WAV encoder → SD card
- Playback pipeline: Flash → MP3 decoder → Filter → I2S

---

**Status**: ✅ AEC project selected and setup ready. Next: Adapt for our hardware.

