# VoIP Quick Start Guide - ESP32-C6 OPAL

## Quick Start

### **1. Copy Files**

Copy VoIP files to your project:
```bash
cp voip_opal/sip_service_opal.* your_project/main/
cp voip_opal/voip_app_opal.* your_project/main/
```

### **2. Update CMakeLists.txt**

Add to `main/CMakeLists.txt`:
```cmake
set(COMPONENT_SRCS 
    sip_service_opal.c
    voip_app_opal.c
    # ... your other files
)

# Add ESP-ADF components
list(APPEND EXTRA_COMPONENT_DIRS "$ENV{ADF_PATH}/examples/protocols/components/av_stream")
list(APPEND EXTRA_COMPONENT_DIRS "$ENV{ADF_PATH}/examples/protocols/components/audio_flash_tone")
```

### **3. Configure**

```bash
idf.py set-target esp32c6
idf.py menuconfig
```

**Required Settings**:
- `Audio HAL` → `Audio board` → `ESP32-C6-OPAL`
- `Example Configuration` → Set WiFi SSID/Password
- `VoIP App Configuration` → Set SIP URI: `tcp://user:pass@server:port`

### **4. Build and Flash**

```bash
idf.py build
idf.py -p COM4 flash monitor
```

### **5. Use**

The application automatically:
- Connects to WiFi
- Starts SIP service when connected
- Registers with SIP server

**Make a call**:
```c
esp_rtc_call(esp_sip, "1002");
```

**Answer call**:
```c
esp_rtc_answer(esp_sip);
```

**Hang up**:
```c
esp_rtc_bye(esp_sip);
```

---

## Key Points

✅ **Uses exact datasheet pinout** (automatic via ESP-ADF)  
✅ **G.711 A-law codec** (8kHz, mono)  
✅ **AEC enabled** (Acoustic Echo Cancellation)  
✅ **Full-duplex audio** (simultaneous send/receive)  

---

**Status**: Ready to use!

