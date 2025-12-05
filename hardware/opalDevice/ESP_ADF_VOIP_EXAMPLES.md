# ESP-ADF VoIP Examples and Audio Framework

## Overview

**ESP-ADF (Espressif Audio Development Framework)** is the **advanced audio framework** from Espressif, specifically designed for audio applications including VoIP.

**Repository**: https://github.com/espressif/esp-adf

---

## 1. ESP-ADF VoIP Example (Official!)

### **Location**: `examples/voip/sip/` or `examples/advanced_examples/voip/`

**This is the official Espressif VoIP example!**

**Note**: The exact path may vary by ESP-ADF version. Check both:
- `examples/voip/sip/` (older versions)
- `examples/advanced_examples/voip/` (newer versions)

**Features**:
- ✅ SIP (Session Initiation Protocol) implementation
- ✅ RTP (Real-time Transport Protocol) for audio
- ✅ Full-duplex audio (speaker + microphone)
- ✅ Acoustic Echo Cancellation (AEC)
- ✅ Noise reduction
- ✅ Optimized for ESP32 series

**Note**: The SIP library is provided as a pre-compiled binary (not open-source), but the example code is available.

---

## 2. How to Access ESP-ADF

### **Step 1: Clone ESP-ADF Repository**

```bash
# Clone ESP-ADF (this is the official Espressif Audio Development Framework)
git clone --recursive https://github.com/espressif/esp-adf.git
cd esp-adf
```

### **Step 2: Navigate to VoIP Example**

```bash
cd examples/advanced_examples/voip
```

### **Step 3: Review the Code Structure**

The VoIP example typically includes:
- `main/voip_main.c` - Main application
- `main/sip_client.c` - SIP protocol handling
- `main/rtp_audio.c` - RTP audio transport
- `components/` - Audio pipeline components
- `README.md` - Setup instructions

---

## 3. ESP-ADF Key Features

### **Audio Pipeline Architecture**

ESP-ADF uses a **pipeline-based architecture** for audio processing:

```
┌─────────────────────────────────────────┐
│         Audio Pipeline                  │
├─────────────────────────────────────────┤
│  Input → Processing → Output            │
│  (Mic)    (Codec)     (Speaker)         │
└─────────────────────────────────────────┘
```

**Components**:
- **Audio Elements**: Modular audio processing units
- **Audio Pipeline**: Connects elements together
- **Codec Support**: ES8311, ES8388, ES8374, etc.
- **Audio Effects**: AEC, noise reduction, equalizer

### **Supported Codecs**

ESP-ADF supports:
- ✅ **ES8311** (your codec!)
- ES8388
- ES8374
- ES7243
- And others

---

## 4. ESP-ADF Examples Directory Structure

```
esp-adf/
├── examples/
│   ├── advanced_examples/
│   │   ├── voip/                    ← VoIP example (what you need!)
│   │   ├── pipeline_duplex_app/     ← Full-duplex audio
│   │   ├── pipeline_http_mp3/       ← HTTP audio streaming
│   │   └── ...
│   ├── get-started/
│   │   └── play_mp3/                ← Basic audio playback
│   └── ...
├── components/
│   ├── audio_pipeline/              ← Pipeline framework
│   ├── audio_codec/                 ← Codec drivers
│   ├── audio_hal/                   ← Hardware abstraction
│   └── ...
└── ...
```

---

## 5. VoIP Example Details

### **What the VoIP Example Includes**:

1. **SIP Client**:
   - SIP registration
   - Call initiation (INVITE)
   - Call termination (BYE)
   - Call state management

2. **RTP Audio**:
   - Real-time audio transmission
   - UDP-based transport
   - Audio packetization

3. **Audio Processing**:
   - Acoustic Echo Cancellation (AEC)
   - Noise reduction
   - Audio codec (G.711, G.722, Opus)

4. **Network Handling**:
   - WiFi connection
   - SIP server communication
   - RTP stream management

---

## 6. Downloading ESP-ADF Examples

### **Option A: Clone Full Repository**

```bash
# Clone ESP-ADF (large repository, ~500MB+)
git clone --recursive https://github.com/espressif/esp-adf.git
cd esp-adf/examples/advanced_examples/voip
```

### **Option B: Download Specific Example (Sparse Checkout)**

```bash
# Clone only the VoIP example
git clone --filter=blob:none --sparse https://github.com/espressif/esp-adf.git
cd esp-adf
git sparse-checkout init --cone
git sparse-checkout set examples/advanced_examples/voip
```

### **Option C: Browse Online**

- **GitHub**: https://github.com/espressif/esp-adf/tree/master/examples/advanced_examples/voip
- **Documentation**: https://docs.espressif.com/projects/esp-adf/en/latest/

---

## 7. Adapting ESP-ADF VoIP for ESP32-C6

### **Key Differences**:

1. **Target Chip**: ESP-ADF examples are primarily for ESP32/ESP32-S3
2. **GPIO Pins**: Need to update to match your pinout
3. **Codec**: ES8311 is supported, but pin configuration may differ
4. **ESP-IDF Version**: ESP-ADF may target older ESP-IDF versions

### **Adaptation Steps**:

1. **Update Target**:
   ```cmake
   # In CMakeLists.txt or sdkconfig
   set(CMAKE_SYSTEM_NAME Generic)
   set(CMAKE_C_COMPILER riscv32-esp-elf-gcc)
   ```

2. **Update GPIO Pins**:
   - Replace I2S pin definitions with your `hardware_config.h` values
   - Update I2C pins (SDA=GPIO8, SCL=GPIO7)

3. **Update Codec Configuration**:
   - Use your ES8311 initialization code
   - Match I2S configuration to your setup

4. **Test Incrementally**:
   - Start with audio pipeline only
   - Add SIP client
   - Add RTP transport

---

## 8. ESP-ADF vs Your Current Code

### **ESP-ADF Approach** (Pipeline-based):
```c
// ESP-ADF uses audio pipeline
audio_pipeline_handle_t pipeline;
audio_element_handle_t i2s_stream_reader;
audio_element_handle_t codec_filter;
audio_element_handle_t i2s_stream_writer;

// Create pipeline
audio_pipeline_new(&pipeline);
audio_pipeline_register(pipeline, i2s_stream_reader, "i2s_rd");
audio_pipeline_register(pipeline, codec_filter, "codec");
audio_pipeline_register(pipeline, i2s_stream_writer, "i2s_wr");
audio_pipeline_link(pipeline, (const char *[]) {"i2s_rd", "codec", "i2s_wr"}, 3);
audio_pipeline_run(pipeline);
```

### **Your Current Approach** (Direct API):
```c
// Your code uses direct ESP-IDF APIs
esp_codec_dev_handle_t output_dev;
esp_codec_dev_write(output_dev, audio_data, len);
esp_codec_dev_read(input_dev, audio_data, len);
```

**Both approaches work!** ESP-ADF is more modular, your approach is more direct.

---

## 9. ESP-ADF Components You Can Use

### **Audio Pipeline** (`components/audio_pipeline/`)
- Modular audio processing
- Easy to add effects
- Good for complex audio applications

### **Audio Codec** (`components/audio_codec/`)
- ES8311 driver (already in ESP-IDF)
- Additional codec support
- Codec configuration helpers

### **Audio HAL** (`components/audio_hal/`)
- Hardware abstraction layer
- Board-specific configurations
- I2S initialization helpers

### **Audio Effects** (`components/audio_processing/`)
- Acoustic Echo Cancellation (AEC)
- Noise reduction
- Equalizer
- Automatic Gain Control (AGC)

---

## 10. Quick Start: Get VoIP Example

### **Command to Clone ESP-ADF**:

```bash
# Full clone (recommended for first time)
git clone --recursive https://github.com/espressif/esp-adf.git
cd esp-adf/examples/advanced_examples/voip

# Or use the download script (see download_espressif_examples.bat)
```

### **What You'll Get**:

1. **Complete VoIP implementation**
2. **SIP client code**
3. **RTP audio transport**
4. **Audio pipeline setup**
5. **Example configuration files**

---

## 11. Integration with Your Project

### **Option 1: Use ESP-ADF Components Only**

Extract specific components you need:
- Audio pipeline (if you want modular processing)
- Audio effects (AEC, noise reduction)
- Keep your current codec initialization

### **Option 2: Full ESP-ADF Migration**

Replace your audio system with ESP-ADF pipeline:
- More features (AEC, effects)
- More complex
- Requires more RAM

### **Option 3: Hybrid Approach** (Recommended)

- Keep your current `audio_system.c` (simpler, working)
- Add ESP-ADF audio effects if needed
- Use ESP-ADF VoIP example as reference for SIP/RTP

---

## 12. ESP-ADF Documentation

### **Official Links**:
- **GitHub**: https://github.com/espressif/esp-adf
- **Documentation**: https://docs.espressif.com/projects/esp-adf/en/latest/
- **Get Started**: https://docs.espressif.com/projects/esp-adf/en/latest/get-started/
- **API Reference**: https://docs.espressif.com/projects/esp-adf/en/latest/api-reference/

### **VoIP-Specific Docs**:
- **VoIP Example**: https://github.com/espressif/esp-adf/tree/master/examples/advanced_examples/voip
- **SIP Library**: Note - SIP implementation is pre-compiled (not open-source)

---

## 13. Summary

### **ESP-ADF VoIP Example**:
- ✅ **Official Espressif VoIP implementation**
- ✅ **Location**: `esp-adf/examples/advanced_examples/voip/`
- ✅ **Features**: SIP + RTP + AEC + Noise reduction
- ✅ **Codec Support**: ES8311 (your codec!)

### **How to Get It**:
```bash
git clone --recursive https://github.com/espressif/esp-adf.git
cd esp-adf/examples/advanced_examples/voip
```

### **For Your Project**:
- **Best Use**: Reference for SIP/RTP implementation
- **Integration**: Extract SIP/RTP code, keep your audio system
- **Benefits**: Official, tested, includes AEC

---

## 14. Quick Download Script

I've created `download_esp_adf.bat` to automatically download ESP-ADF:

```bash
# Run the download script
download_esp_adf.bat
```

This will:
- Clone the full ESP-ADF repository
- Download all examples including VoIP
- Set up the directory structure

---

## 15. ESP-ADF VoIP Example Structure

Based on the official repository, the VoIP example typically includes:

```
esp-adf/examples/advanced_examples/voip/
├── main/
│   ├── voip_main.c          # Main application
│   ├── sip_client.c         # SIP protocol implementation
│   ├── rtp_audio.c          # RTP audio transport
│   └── network_handler.c    # Network management
├── components/
│   └── (custom components if any)
├── CMakeLists.txt
├── README.md                # Setup instructions
└── sdkconfig.defaults       # Default configuration
```

---

## 16. Key ESP-ADF VoIP Features

### **SIP Implementation**:
- SIP registration with server
- Call initiation (INVITE)
- Call termination (BYE)
- Call state management
- SIP message parsing

### **RTP Audio**:
- Real-time audio packetization
- UDP-based transport
- Audio codec support (G.711, G.722, Opus)
- Jitter buffer management

### **Audio Processing**:
- Acoustic Echo Cancellation (AEC)
- Noise reduction
- Automatic Gain Control (AGC)
- Audio pipeline for modular processing

### **Network**:
- WiFi connection management
- SIP server communication
- RTP stream handling
- Network error recovery

---

## 17. Next Steps

1. **Download ESP-ADF**:
   ```bash
   # Use the download script
   download_esp_adf.bat
   
   # Or manually:
   git clone --recursive https://github.com/espressif/esp-adf.git
   ```

2. **Review VoIP Example**:
   ```bash
   cd esp-adf/examples/advanced_examples/voip
   # Review main/voip_main.c
   # Review SIP implementation
   # Review RTP audio handling
   ```

3. **Extract Relevant Code**:
   - SIP client implementation
   - RTP audio transport
   - Network handling
   - Audio pipeline setup

4. **Integrate with Your Code**:
   - Keep your `audio_system.c` (ES8311 initialization)
   - Add SIP/RTP from ESP-ADF example
   - Adapt for ESP32-C6 pinout
   - Update GPIO pins to match your hardware

---

## 18. Important Notes

### **SIP Library**:
- The SIP protocol implementation is provided as a **pre-compiled library**
- It is **not open-source** (binary only)
- But the example code showing how to use it is available

### **ESP32-C6 Compatibility**:
- ESP-ADF examples are primarily for ESP32/ESP32-S3
- ESP32-C6 is newer and may need adaptations
- GPIO pins will definitely need updating
- I2S configuration should work (same API)

### **Memory Requirements**:
- ESP-ADF uses more RAM than direct ESP-IDF APIs
- ESP32-C6 has limited RAM (320KB)
- May need to optimize or use lighter components

---

**The ESP-ADF VoIP example is the official Espressif solution for VoIP on ESP32!**

**Repository**: https://github.com/espressif/esp-adf
**VoIP Example**: `examples/advanced_examples/voip/`

