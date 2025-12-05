# VoIP Integration Guide for ESP32-C6 OPAL

## Overview

This guide explains how to integrate the VoIP (SIP/RTP) functionality into your ESP32-C6 OPAL project.

---

## Files Created

1. **`sip_service_opal.h`** - SIP service header
2. **`sip_service_opal.c`** - SIP service implementation
3. **`voip_app_opal.c`** - Complete VoIP application example
4. **`voip_app_opal.h`** - VoIP application header

---

## Integration Steps

### **Step 1: Copy Files to Your Project**

Copy the VoIP files to your project:
```bash
cp voip_opal/sip_service_opal.* your_project/main/
cp voip_opal/voip_app_opal.* your_project/main/
```

### **Step 2: Update CMakeLists.txt**

Add the VoIP source files to your `main/CMakeLists.txt`:
```cmake
set(COMPONENT_SRCS 
    your_main.c
    sip_service_opal.c
    voip_app_opal.c
    # ... other source files
)
```

### **Step 3: Configure ESP-ADF Components**

Ensure your `CMakeLists.txt` includes ESP-ADF components:
```cmake
# Add ESP-ADF components
list(APPEND EXTRA_COMPONENT_DIRS "$ENV{ADF_PATH}/examples/protocols/components/av_stream")
list(APPEND EXTRA_COMPONENT_DIRS "$ENV{ADF_PATH}/examples/protocols/components/audio_flash_tone")
```

### **Step 4: Select ESP32-C6 OPAL Board**

In `idf.py menuconfig`:
- Navigate to: `Audio HAL` → `Audio board`
- Select: `ESP32-C6-OPAL (Waveshare Touch LCD 1.69 with ES8311)`

### **Step 5: Configure WiFi and SIP**

In `idf.py menuconfig`:
- Navigate to: `Example Configuration`
- Set `WiFi SSID` and `WiFi Password`
- Navigate to: `VoIP App Configuration`
- Set `SIP_URI` (format: `tcp://user:password@server:port`)

---

## Usage

### **Basic Usage**

The `voip_app_opal.c` provides a complete example that:
1. Initializes WiFi
2. Starts SIP service when WiFi connects
3. Handles incoming/outgoing calls
4. Manages audio sessions

### **Making Calls**

```c
#include "voip_app_opal.h"

// Make a call to extension 1002
esp_rtc_call(esp_sip, "1002");
```

### **Answering Calls**

```c
// Answer incoming call
esp_rtc_answer(esp_sip);
```

### **Hanging Up**

```c
// Hang up current call
esp_rtc_bye(esp_sip);
```

---

## Configuration

### **SIP URI Format**

```
Transport://user:password@server:port
```

**Examples**:
- `tcp://100:100@192.168.1.123:5060`
- `udp://user:pass@pbx.example.com:5060`

### **Audio Configuration**

- **Codec**: G.711 A-law (RTC_ACODEC_G711A)
- **Sample Rate**: 8000 Hz (standard for VoIP)
- **Channels**: Mono (1 channel)
- **Bit Width**: 16-bit
- **AEC**: Enabled (Acoustic Echo Cancellation)

### **I2S Configuration**

- **Sample Rate**: 16000 Hz (can be different from codec)
- **Channels**: 1 (mono)
- **Bit Width**: 16-bit

**Note**: Uses exact datasheet pinout via ESP-ADF board configuration:
- I2S: GPIO19/20/21/22/23
- I2C: GPIO7/8

---

## Dependencies

### **Required ESP-ADF Components**:

1. **`esp_rtc`** - SIP/RTP library (closed-source)
2. **`av_stream`** - Audio/video stream management
3. **`media_lib`** - Network media library
4. **`wifi_service`** - WiFi service
5. **`esp_peripherals`** - Peripheral management
6. **Audio Pipeline** - ESP-ADF audio pipeline

### **Required ESP-IDF Components**:

1. **WiFi** - Network connectivity
2. **Netif** - Network interface
3. **NVS** - Non-volatile storage

---

## Build Instructions

### **1. Set Environment Variables**

```powershell
$env:ADF_PATH = "G:\Projects\OPALproject\ProjectWork\hardware\opalDevice\esp-adf-temp"
$env:IDF_PATH = "C:\Users\huber\esp\v5.5.1\esp-idf"
```

### **2. Configure Project**

```bash
cd your_project
idf.py set-target esp32c6
idf.py menuconfig
```

**Important Settings**:
- Audio board: `ESP32-C6-OPAL`
- WiFi SSID/Password
- SIP URI

### **3. Build and Flash**

```bash
idf.py build
idf.py -p COM4 flash monitor
```

---

## Testing

### **Prerequisites**

1. **SIP Server**: Set up Asterisk, FreeSWITCH, or similar
2. **Network**: Device must be on same network as SIP server
3. **WiFi**: Device must be connected to WiFi

### **Test Sequence**

1. **Flash firmware** to device
2. **Connect to WiFi** (via smart config or pre-configured)
3. **Wait for registration** - Look for "ESP_RTC_EVENT_REGISTERED"
4. **Make a test call** - Use `esp_rtc_call(esp_sip, "extension")`
5. **Answer incoming call** - Use `esp_rtc_answer(esp_sip)`

---

## Troubleshooting

### **Issue: SIP service fails to start**

**Solutions**:
- Verify WiFi is connected
- Check SIP URI format
- Verify SIP server is reachable
- Check network connectivity

### **Issue: No audio**

**Solutions**:
- Verify ESP32-C6 OPAL board is selected in menuconfig
- Check I2S/I2C pins are correct (should be automatic)
- Verify ES8311 codec is initialized
- Check audio stream is started

### **Issue: Registration fails**

**Solutions**:
- Verify SIP URI credentials
- Check SIP server is running
- Verify network connectivity
- Check firewall settings

---

## Key Features

✅ **Exact Datasheet Pinout** - Uses ESP-ADF board configuration  
✅ **ESP32-C6 Compatible** - Adapted for ESP32-C6 architecture  
✅ **ES8311 Codec** - Full support via ESP-ADF audio HAL  
✅ **G.711 A-law** - Standard VoIP codec  
✅ **AEC Enabled** - Acoustic Echo Cancellation  
✅ **Full-Duplex** - Simultaneous send/receive  

---

## Next Steps

1. ✅ **Extract SIP/RTP code** (completed)
2. ✅ **Adapt for ESP32-C6 OPAL** (completed)
3. ✅ **Create complete application** (completed)
4. **Integrate into your project**
5. **Test with SIP server**

---

**Status**: ✅ VoIP application ready for ESP32-C6 OPAL device

