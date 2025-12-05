# Espressif Official Sample Code for ESP32-C6

## Overview

This document lists official Espressif repositories and examples for ESP32-C6 audio, VoIP, and related functionality.

---

## 1. Official Espressif Repositories

### **ESP-IDF (Espressif IoT Development Framework)**
**Repository**: https://github.com/espressif/esp-idf

**Description**: Official ESP-IDF framework with examples

**Key Directories**:
- `examples/peripherals/i2s/` - I2S audio examples
- `examples/protocols/` - Network protocol examples (HTTP, MQTT, WebSocket)
- `components/esp_codec_dev/` - Audio codec device driver (supports ES8311)

**How to Access**:
```bash
# Clone ESP-IDF
git clone --recursive https://github.com/espressif/esp-idf.git
cd esp-idf

# Checkout ESP32-C6 compatible version (v5.5+)
git checkout v5.5.1

# Navigate to examples
cd examples/peripherals/i2s
```

**Relevant Examples**:
- `i2s_std` - Standard I2S mode example
- `i2s_tdm` - TDM mode example
- `i2s_duplex` - Duplex (TX+RX) example

---

### **ESP-ADF (Espressif Audio Development Framework)**
**Repository**: https://github.com/espressif/esp-adf

**Description**: Comprehensive audio framework for ESP32 series

**Key Features**:
- Audio codec support (including ES8311)
- Audio processing pipelines
- Streaming examples
- Audio effects (echo cancellation, noise reduction)

**How to Access**:
```bash
# Clone ESP-ADF
git clone --recursive https://github.com/espressif/esp-adf.git
cd esp-adf

# Check examples
cd examples
```

**Relevant Examples**:
- `pipeline_http_mp3` - HTTP audio streaming
- `pipeline_a2dp_sink` - Bluetooth audio
- `pipeline_audio_player` - Audio playback
- `pipeline_duplex_app` - Full-duplex audio

**Note**: ESP-ADF is primarily for ESP32, but many components work on ESP32-C6.

---

### **ESP Codec Device Component**
**Repository**: Part of ESP-IDF, also available as component

**Location**: `components/esp_codec_dev/` in ESP-IDF

**Description**: Unified audio codec driver supporting:
- ES8311 (your codec)
- ES8388
- ES8374
- And others

**Key Files**:
- `esp_codec_dev.h` - Main API
- `device/es8311/es8311.c` - ES8311 implementation

**How to Use**:
```c
#include "esp_codec_dev.h"
#include "esp_codec_dev_defaults.h"

// Already used in your code - see audio_system.c
```

---

## 2. Factory Firmware Code (Already in Your Project)

### **Location**: `ESP-IDF/01_factory/`

You already have Waveshare's factory firmware which uses Espressif's official APIs.

### **Key File**: `ESP-IDF/01_factory/components/esp_bsp/bsp_es8311.c`

This is the **official Espressif pattern** for ES8311 initialization:

```c
// From bsp_es8311.c (lines 70-121)
void bsp_es8311_init(i2c_master_bus_handle_t bus_handle)
{
    // 1. Initialize I2S
    es8311_i2s_init();
    
    // 2. Create I2S data interface
    audio_codec_i2s_cfg_t i2s_cfg = {
        .rx_handle = rx_handle,
        .tx_handle = tx_handle,
    };
    const audio_codec_data_if_t *data_if = audio_codec_new_i2s_data(&i2s_cfg);
    
    // 3. Create I2C control interface
    audio_codec_i2c_cfg_t i2c_cfg = {
        .addr = ES8311_CODEC_DEFAULT_ADDR,
        .bus_handle = bus_handle,
    };
    const audio_codec_ctrl_if_t *ctrl_if = audio_codec_new_i2c_ctrl(&i2c_cfg);
    
    // 4. Create GPIO interface
    const audio_codec_gpio_if_t *gpio_if = audio_codec_new_gpio();
    
    // 5. Configure ES8311 codec
    es8311_codec_cfg_t es8311_cfg = {
        .codec_mode = ESP_CODEC_DEV_WORK_MODE_BOTH,
        .ctrl_if = ctrl_if,
        .gpio_if = gpio_if,
        .pa_pin = GPIO_NUM_NC,
        .use_mclk = true,
        .hw_gain = {
            .pa_voltage = 5.0,
            .codec_dac_voltage = 3.3,
        },
    };
    const audio_codec_if_t *codec_if = es8311_codec_new(&es8311_cfg);
    
    // 6. Create output device (speaker)
    esp_codec_dev_cfg_t dev_cfg = {
        .dev_type = ESP_CODEC_DEV_TYPE_OUT,
        .codec_if = codec_if,
        .data_if = data_if,
    };
    output_dev = esp_codec_dev_new(&dev_cfg);
    
    // 7. Create input device (microphone)
    dev_cfg.dev_type = ESP_CODEC_DEV_TYPE_IN;
    input_dev = esp_codec_dev_new(&dev_cfg);
    
    // 8. Open devices
    esp_codec_dev_sample_info_t fs = {
        .sample_rate = 16000,
        .channel = 1,
        .bits_per_sample = 16,
    };
    esp_codec_dev_open(output_dev, &fs);
    esp_codec_dev_open(input_dev, &fs);
}
```

**This is the official Espressif pattern** - your `audio_system.c` follows the same structure!

---

## 3. How to Get Official Examples

### **Method 1: Clone ESP-IDF Repository**

```bash
# Install ESP-IDF (if not already installed)
# Follow: https://docs.espressif.com/projects/esp-idf/en/latest/esp32c6/get-started/

# Clone ESP-IDF
git clone --recursive https://github.com/espressif/esp-idf.git
cd esp-idf
git checkout v5.5.1  # Use ESP32-C6 compatible version

# Navigate to I2S examples
cd examples/peripherals/i2s/i2s_std
```

### **Method 2: Use ESP-IDF Component Manager**

Your project already uses component manager. Check `main/idf_component.yml`:

```yaml
## IDF Component Manager Manifest File
dependencies:
  espressif/esp_codec_dev: "^1.0.0"  # Official Espressif codec driver
```

This automatically downloads the official `esp_codec_dev` component which includes ES8311 support.

### **Method 3: Browse Online**

- **ESP-IDF Examples**: https://github.com/espressif/esp-idf/tree/master/examples
- **ESP-ADF Examples**: https://github.com/espressif/esp-adf/tree/master/examples
- **Documentation**: https://docs.espressif.com/projects/esp-idf/en/latest/esp32c6/

---

## 4. Key Official Examples for Audio/VoIP

### **A. I2S Standard Mode Example**
**Path**: `esp-idf/examples/peripherals/i2s/i2s_std/`

**What it demonstrates**:
- I2S initialization
- Audio data transmission
- Standard I2S mode (what you're using)

**Key Code**:
```c
// From ESP-IDF official example
i2s_chan_config_t chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_0, I2S_ROLE_MASTER);
i2s_std_config_t std_cfg = {
    .clk_cfg = {
        .sample_rate_hz = 16000,
        .clk_src = I2S_CLK_SRC_DEFAULT,
        .mclk_multiple = I2S_MCLK_MULTIPLE_256,
    },
    .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_STEREO),
    .gpio_cfg = {
        .mclk = I2S_MCK_PIN,
        .bclk = I2S_BCK_PIN,
        .ws = I2S_LRCK_PIN,
        .dout = I2S_DOUT_PIN,
        .din = I2S_DIN_PIN,
    },
};
```

**This matches your code exactly!**

---

### **B. ESP Codec Device Example**
**Path**: `esp-idf/components/esp_codec_dev/` (component, not standalone example)

**What it provides**:
- Unified API for all codecs
- ES8311 driver implementation
- Audio device abstraction

**Your code already uses this** - see `audio_system.c` lines 132-177.

---

### **C. Network Protocol Examples**
**Path**: `esp-idf/examples/protocols/`

**Relevant Examples**:
- `mqtt/` - MQTT client (you're already using this)
- `http_request/` - HTTP client
- `websocket/` - WebSocket client
- `tcp_client/` - Raw TCP client (useful for RTP)

**For VoIP, you'd use**:
- TCP client example for SIP signaling
- UDP socket for RTP audio

---

## 5. Extracting Code from Official Examples

### **Step 1: Clone ESP-IDF**
```bash
git clone --recursive https://github.com/espressif/esp-idf.git
cd esp-idf
git checkout v5.5.1
```

### **Step 2: Copy Relevant Example**
```bash
# Copy I2S example to your project
cp -r examples/peripherals/i2s/i2s_std ~/my_project/i2s_example

# Or just browse and copy specific files
```

### **Step 3: Review Key Files**
- `main/i2s_example_main.c` - Main application
- `main/i2s_example_main.h` - Header file

### **Step 4: Adapt for Your Hardware**
- Update GPIO pins (already done in your project)
- Replace with ES8311 codec calls (already done)
- Integrate with your network code

---

## 6. Official Documentation Links

### **ESP32-C6 Specific**:
- **I2S API**: https://docs.espressif.com/projects/esp-idf/en/latest/esp32c6/api-reference/peripherals/i2s.html
- **Audio Codec Dev**: https://docs.espressif.com/projects/esp-idf/en/latest/esp32c6/api-reference/components/esp_codec_dev.html
- **Network APIs**: https://docs.espressif.com/projects/esp-idf/en/latest/esp32c6/api-reference/network/index.html

### **Codec Device Component**:
- **GitHub**: https://github.com/espressif/esp-idf/tree/master/components/esp_codec_dev
- **ES8311 Driver**: https://github.com/espressif/esp-idf/tree/master/components/esp_codec_dev/device/es8311

---

## 7. Comparison: Your Code vs Official Examples

### **Your Code** (`main/audio_system.c`):
```c
// Lines 34-111: I2S initialization
static esp_err_t audio_i2s_init(void) {
    i2s_chan_config_t chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM, I2S_ROLE_MASTER);
    i2s_std_config_t std_cfg = {
        .clk_cfg = {
            .sample_rate_hz = AUDIO_SAMPLE_RATE,
            .clk_src = I2S_CLK_SRC_DEFAULT,
            .mclk_multiple = I2S_MCLK_MULTIPLE_256,
        },
        // ... matches official pattern
    };
    // ... follows official Espressif pattern
}
```

### **Official Example** (`esp-idf/examples/peripherals/i2s/i2s_std/main/i2s_example_main.c`):
```c
// Same structure, same API calls
i2s_chan_config_t chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_0, I2S_ROLE_MASTER);
i2s_std_config_t std_cfg = {
    .clk_cfg = {
        .sample_rate_hz = 16000,
        .clk_src = I2S_CLK_SRC_DEFAULT,
        .mclk_multiple = I2S_MCLK_MULTIPLE_256,
    },
    // ... identical structure
};
```

**Conclusion**: Your code already follows the official Espressif pattern!

---

## 8. Quick Reference: Official API Usage

### **I2S (Official API)**:
```c
#include "driver/i2s_std.h"

// Create channel
i2s_chan_config_t chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_0, I2S_ROLE_MASTER);
i2s_new_channel(&chan_cfg, &tx_handle, &rx_handle);

// Configure standard mode
i2s_std_config_t std_cfg = { /* your config */ };
i2s_channel_init_std_mode(tx_handle, &std_cfg);

// Enable
i2s_channel_enable(tx_handle);
```

### **Codec Device (Official API)**:
```c
#include "esp_codec_dev.h"
#include "esp_codec_dev_defaults.h"

// Create I2S data interface
audio_codec_i2s_cfg_t i2s_cfg = { .rx_handle = rx, .tx_handle = tx };
const audio_codec_data_if_t *data_if = audio_codec_new_i2s_data(&i2s_cfg);

// Create I2C control interface
audio_codec_i2c_cfg_t i2c_cfg = { .addr = 0x18, .bus_handle = bus };
const audio_codec_ctrl_if_t *ctrl_if = audio_codec_new_i2c_ctrl(&i2c_cfg);

// Create codec
es8311_codec_cfg_t codec_cfg = { /* config */ };
const audio_codec_if_t *codec_if = es8311_codec_new(&codec_cfg);

// Create device
esp_codec_dev_cfg_t dev_cfg = {
    .dev_type = ESP_CODEC_DEV_TYPE_OUT,
    .codec_if = codec_if,
    .data_if = data_if,
};
esp_codec_dev_handle_t dev = esp_codec_dev_new(&dev_cfg);
```

**This is exactly what your code does!**

---

## 9. Summary

### **What You Already Have**:
- ✅ Official Espressif codec device component (via component manager)
- ✅ Factory firmware using official APIs (in `ESP-IDF/01_factory/`)
- ✅ Your code follows official Espressif patterns
- ✅ All APIs match official ESP-IDF examples

### **What You Can Get**:
1. **ESP-IDF Repository**: Full framework with examples
2. **ESP-ADF Repository**: Audio framework (for ESP32, adaptable to ESP32-C6)
3. **Official Documentation**: Complete API reference

### **Your Code Status**:
- ✅ Uses official `esp_codec_dev` component
- ✅ Follows official I2S API patterns
- ✅ Matches factory firmware structure
- ✅ No modifications needed - already using official code!

---

## 10. Next Steps

1. **Review Official Examples**:
   ```bash
   git clone https://github.com/espressif/esp-idf.git
   cd esp-idf/examples/peripherals/i2s/i2s_std
   ```

2. **Compare with Your Code**:
   - Your `audio_system.c` already matches official patterns
   - Your I2S configuration is correct
   - Your codec initialization is correct

3. **For VoIP**:
   - Use official TCP/UDP examples for network
   - Your MQTT audio streaming is already working
   - Add SIP/RTP on top if needed

**Bottom Line**: Your code is already using official Espressif APIs and patterns. The factory firmware in `ESP-IDF/01_factory/` is the best reference for your specific hardware.

