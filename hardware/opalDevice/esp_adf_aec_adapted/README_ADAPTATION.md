# AEC Project Adaptation for OPAL Device

## Overview

This is an adapted version of the ESP-ADF AEC (Acoustic Echo Cancellation) example, modified to work with the OPAL device (ESP32-C6 + ES8311 codec).

## Key Changes from Original

### 1. **Removed Board Abstraction**
- **Original**: Used `audio_board_init()` from ESP-ADF board abstraction
- **Adapted**: Direct ES8311 initialization (commented, as ESP-ADF I2S stream handles it)

### 2. **Removed SD Card Dependency**
- **Original**: Saved recorded audio to SD card via `fatfs_stream`
- **Adapted**: Removed file saving (SD card not available on OPAL device)
- Recording pipeline now: `[mic] → I2S → AEC → WAV encoder` (no file output)

### 3. **Updated Pin Configuration**
- **I2S Pins**: Should be configured via menuconfig to match our `hardware_config.h`:
  - MCLK = GPIO19
  - BCK = GPIO20
  - LRCK = GPIO22
  - DOUT = GPIO21
  - DIN = GPIO23
- **I2C Pins**: Should be configured via menuconfig:
  - SDA = GPIO8
  - SCL = GPIO7

### 4. **Mono Audio Configuration**
- Changed to mono (1 channel) to match our setup
- `I2S_CHANNELS = I2S_CHANNEL_FMT_ONLY_LEFT`
- `rsp_cfg_w.dest_ch = 1`

## Building This Project

### Prerequisites
1. ESP-IDF v5.5.1 installed
2. ESP-ADF cloned (in `esp-adf-temp`)
3. Environment variables set:
   ```bash
   $env:ADF_PATH = "G:\Projects\OPALproject\ProjectWork\hardware\opalDevice\esp-adf-temp"
   $env:IDF_PATH = "C:\Users\huber\esp\v5.5.1\esp-idf"
   ```

### Build Steps

1. **Copy this adapted code** to ESP-ADF AEC example directory, OR
2. **Create new project** using this code as base

**Option A: Modify ESP-ADF Example Directly**
```bash
cd esp-adf-temp\examples\advanced_examples\aec
# Replace main/aec_examples.c with our adapted version
```

**Option B: Create Standalone Project** (Recommended)
- Create new ESP-IDF project
- Copy adapted code
- Add ESP-ADF as component dependency
- Configure pins via menuconfig

### Configuration (menuconfig)

```bash
idf.py menuconfig
```

**Key Settings**:
1. **Audio Board**: 
   - May need to select "Custom" or configure manually
   - Or skip board selection and configure pins directly

2. **I2S Configuration**:
   - I2S pins: Set to match our hardware_config.h
   - I2S port: I2S_NUM_0
   - Sample rate: 8000 Hz (or 16000 Hz)

3. **I2C Configuration**:
   - I2C pins: SDA=GPIO8, SCL=GPIO7
   - I2C address: 0x18 (ES8311 default)

4. **SD Card**: Disable (not available)

### Build and Flash

```bash
idf.py set-target esp32c6
idf.py build
idf.py -p COM4 flash monitor
```

## Limitations and Notes

### 1. **ESP-ADF Board Abstraction**
- ESP-ADF uses board abstraction (`board.h`) which may not support ESP32-C6
- May need to create custom board configuration
- Or bypass board abstraction entirely (as in this adaptation)

### 2. **I2S Pin Configuration**
- ESP-ADF I2S stream uses menuconfig or board config for pins
- May need to modify ESP-ADF board configuration files
- Or set pins programmatically (if ESP-ADF supports it)

### 3. **File Saving**
- Original example saves to SD card
- This adaptation removes file saving
- Could be adapted to save to flash or stream via MQTT

### 4. **Memory Usage**
- ESP-ADF uses more RAM than direct ESP-IDF APIs
- ESP32-C6 has 320KB RAM - may need optimization

## Testing

1. **Build and flash** the adapted code
2. **Monitor serial output** for initialization messages
3. **Verify**:
   - MP3 playback starts
   - Microphone recording works
   - AEC processing is active
   - No file saving errors (since it's disabled)

## Next Steps

1. **Fix I2S pin configuration** - Ensure ESP-ADF uses our pins
2. **Test audio I/O** - Verify mic and speaker work
3. **Verify AEC** - Check echo cancellation is working
4. **Optimize memory** - If needed for ESP32-C6

## Files

- `aec_adapted_main.c` - Adapted main application
- `README_ADAPTATION.md` - This file

---

**Status**: Adapted code ready, needs ESP-ADF integration and pin configuration

