# SIP/RTP Service for ESP32-C6 OPAL Device

## Overview

This is an adapted SIP/RTP service extracted from ESP-ADF VoIP example, specifically adapted for ESP32-C6 OPAL device with exact datasheet pinout values.

---

## Files

- `sip_service_opal.h` - Header file with API definitions
- `sip_service_opal.c` - Implementation adapted for ESP32-C6 OPAL

---

## Key Features

✅ **Uses Exact Datasheet Pinout** - I2S/I2C pins from device datasheet  
✅ **ESP32-C6 Compatible** - Adapted for ESP32-C6 architecture  
✅ **ES8311 Codec Support** - Works with ES8311 via ESP-ADF audio HAL  
✅ **G.711 A-law Codec** - Standard VoIP audio codec (8kHz, mono)  
✅ **Full-Duplex Audio** - Simultaneous send/receive via RTP  

---

## API

### **Start SIP Service**

```c
esp_rtc_handle_t sip_service_start(av_stream_handle_t av_stream, const char *uri);
```

**Parameters**:
- `av_stream` - Audio/video stream handle (from `av_stream_init()`)
- `uri` - SIP URI format: `"Transport://user:password@server:port"`
  - Example: `"tcp://100:100@192.168.1.123:5060"`

**Returns**: SIP handle on success, NULL on error

### **Stop SIP Service**

```c
int sip_service_stop(esp_rtc_handle_t esp_sip);
```

**Parameters**:
- `esp_sip` - SIP handle from `sip_service_start()`

**Returns**: ESP_OK on success, ESP_FAIL on error

---

## Usage Example

```c
#include "sip_service_opal.h"
#include "av_stream.h"

// Initialize audio stream
av_stream_config_t av_stream_config = {
    .enable_aec = true,
    .acodec_samplerate = 8000,  // G.711 uses 8kHz
    .acodec_type = AV_ACODEC_G711A,
    .vcodec_type = AV_VCODEC_NULL,
    .hal = {
        .audio_samplerate = 16000,  // I2S sample rate (can be different from codec)
        .audio_framesize = 320,     // Frame size
    },
};
av_stream_handle_t av_stream = av_stream_init(&av_stream_config);

// Start SIP service
const char *sip_uri = "tcp://100:100@192.168.1.123:5060";
esp_rtc_handle_t sip_handle = sip_service_start(av_stream, sip_uri);

// Make a call
esp_rtc_call(sip_handle, "1002");

// Answer incoming call
esp_rtc_answer(sip_handle);

// Hang up
esp_rtc_bye(sip_handle);

// Stop SIP service
sip_service_stop(sip_handle);
```

---

## SIP Events

The service handles the following SIP events:

- **ESP_RTC_EVENT_REGISTERED** - Successfully registered with SIP server
- **ESP_RTC_EVENT_UNREGISTERED** - Unregistered from SIP server
- **ESP_RTC_EVENT_CALLING** - Outgoing call in progress
- **ESP_RTC_EVENT_INCOMING** - Incoming call received
- **ESP_RTC_EVENT_AUDIO_SESSION_BEGIN** - Audio session started (RTP active)
- **ESP_RTC_EVENT_AUDIO_SESSION_END** - Audio session ended
- **ESP_RTC_EVENT_CALL_ANSWERED** - Call answered
- **ESP_RTC_EVENT_HANGUP** - Call ended
- **ESP_RTC_EVENT_ERROR** - Error occurred

---

## Audio Flow

### **Send Audio (Microphone -> RTP)**:
```
Microphone (I2S) -> Audio Encoder (G.711) -> RTP Send
```

### **Receive Audio (RTP -> Speaker)**:
```
RTP Receive -> Audio Decoder (G.711) -> Speaker (I2S)
```

**Note**: Uses exact datasheet pinout via ESP-ADF board configuration (`esp32c6_opal`)

---

## Dependencies

### **Required ESP-ADF Components**:

1. **`esp_rtc`** - SIP/RTP library (closed-source)
2. **`av_stream`** - Audio/video stream management
3. **`media_lib`** - Network media library
4. **Audio Pipeline** - ESP-ADF audio pipeline

### **Required ESP-IDF Components**:

1. **WiFi** - For network connectivity
2. **Netif** - Network interface management

---

## Configuration

### **SIP URI Format**:
```
Transport://user:password@server:port
```

**Examples**:
- `tcp://100:100@192.168.1.123:5060`
- `udp://user:pass@pbx.example.com:5060`

### **Audio Codec**:
- **Codec**: G.711 A-law (RTC_ACODEC_G711A)
- **Sample Rate**: 8000 Hz (standard for VoIP)
- **Channels**: Mono (1 channel)
- **Bit Width**: 16-bit

---

## Integration with ESP32-C6 OPAL

This service automatically uses:
- **Exact datasheet pinout** via ESP-ADF board configuration
- **ES8311 codec** via ESP-ADF audio HAL
- **I2S pins**: GPIO19/20/21/22/23 (from datasheet)
- **I2C pins**: GPIO7/8 (from datasheet)

No manual pin configuration needed - ESP-ADF handles it automatically.

---

## Next Steps

1. ✅ **Extract SIP/RTP code** (completed)
2. ✅ **Adapt for ESP32-C6 OPAL** (completed)
3. **Integrate with main application**
4. **Test with SIP server** (Asterisk/FreeSWITCH)

---

**Status**: ✅ Adapted SIP/RTP service ready for ESP32-C6 OPAL

