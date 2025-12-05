# SIP/RTP Code Extraction from ESP-ADF VoIP Example

## Overview

This document details the extraction of SIP/RTP code from the ESP-ADF VoIP example for adaptation to ESP32-C6 OPAL device.

---

## Key Finding: ESP-ADF Uses `esp_rtc` Library

The ESP-ADF VoIP example uses a high-level abstraction called `esp_rtc` which handles SIP/RTP internally. The actual SIP/RTP implementation is likely in a closed-source library.

---

## Extracted Code Structure

### 1. **SIP Service Wrapper** (`sip_service.c`)

**Location**: `esp-adf-temp/examples/protocols/voip/main/sip_service.c`

**Key Functions**:
- `sip_service_start()` - Initializes SIP/RTP service
- `sip_service_stop()` - Stops SIP/RTP service
- `_esp_sip_event_handler()` - Handles SIP events
- `_send_audio()` - Sends audio data via RTP
- `_receive_audio()` - Receives audio data via RTP

**Key Code**:
```c
esp_rtc_handle_t sip_service_start(av_stream_handle_t av_stream, const char *uri)
{
    // Configure data callbacks
    esp_rtc_data_cb_t data_cb = {
        .send_audio = _send_audio,
        .receive_audio = _receive_audio,
    };
    
    // Configure SIP/RTP service
    esp_rtc_config_t sip_service_config = {
        .uri = uri,                    // SIP URI: "tcp://user:pass@server:port"
        .ctx = av_stream,              // Audio stream context
        .local_addr = _get_network_ip(), // Local IP address
        .acodec_type = RTC_ACODEC_G711A, // Audio codec (G.711 A-law)
        .data_cb = &data_cb,           // Audio data callbacks
        .event_handler = _esp_sip_event_handler, // SIP event handler
    };
    
    return esp_rtc_service_init(&sip_service_config);
}
```

### 2. **Audio Callbacks**

**Send Audio** (Microphone -> RTP):
```c
static int _send_audio(unsigned char *data, int len, void *ctx)
{
    av_stream_handle_t av_stream = (av_stream_handle_t) ctx;
    av_stream_frame_t frame = {0};
    frame.data = data;
    frame.len = len;
    if (av_audio_enc_read(&frame, av_stream) < 0) {
        return 0;
    }
    return frame.len;
}
```

**Receive Audio** (RTP -> Speaker):
```c
static int _receive_audio(unsigned char *data, int len, void *ctx)
{
    av_stream_handle_t av_stream = (av_stream_handle_t) ctx;
    av_stream_frame_t frame = {0};
    frame.data = data;
    frame.len = len;
    return av_audio_dec_write(&frame, av_stream);
}
```

### 3. **SIP Event Handler**

**Events Handled**:
- `ESP_RTC_EVENT_REGISTERED` - Successfully registered with SIP server
- `ESP_RTC_EVENT_UNREGISTERED` - Unregistered from SIP server
- `ESP_RTC_EVENT_CALLING` - Outgoing call in progress
- `ESP_RTC_EVENT_INCOMING` - Incoming call received
- `ESP_RTC_EVENT_AUDIO_SESSION_BEGIN` - Audio session started
- `ESP_RTC_EVENT_AUDIO_SESSION_END` - Audio session ended
- `ESP_RTC_EVENT_CALL_ANSWERED` - Call answered
- `ESP_RTC_EVENT_HANGUP` - Call ended
- `ESP_RTC_EVENT_ERROR` - Error occurred

---

## Dependencies

### **Required ESP-ADF Components**:

1. **`esp_rtc`** - SIP/RTP library (likely closed-source)
   - Provides: `esp_rtc_service_init()`, `esp_rtc_call()`, `esp_rtc_answer()`, `esp_rtc_bye()`
   - Header: `esp_rtc.h`

2. **`av_stream`** - Audio/Video stream management
   - Provides: `av_stream_init()`, `av_audio_enc_start()`, `av_audio_dec_start()`
   - Header: `av_stream.h`

3. **`media_lib`** - Network media library
   - Provides: `media_lib_add_default_adapter()`, `media_lib_netif_get_ipv4_info()`
   - Headers: `media_lib_adapter.h`, `media_lib_netif.h`

4. **Audio Pipeline** - ESP-ADF audio pipeline
   - I2S stream, audio elements, etc.

---

## Adaptation Plan for ESP32-C6 OPAL

### **Step 1: Extract Core SIP/RTP Code**

1. Copy `sip_service.c` and `sip_service.h` to our project
2. Adapt for ESP32-C6 (remove ESP32-S3 specific code if any)
3. Use our custom board configuration (`esp32c6_opal`)

### **Step 2: Integrate with Audio System**

1. Use ESP-ADF `av_stream` for audio encoding/decoding
2. Use our I2S configuration (datasheet pinout)
3. Use ES8311 codec via ESP-ADF audio HAL

### **Step 3: Network Configuration**

1. Use ESP-IDF WiFi stack
2. Get local IP address for RTP
3. Configure SIP URI (user:pass@server:port)

### **Step 4: Audio Codec**

- **G.711 A-law** (default in ESP-ADF)
- **Sample Rate**: 8000 Hz (standard for VoIP)
- **Channels**: Mono (1 channel)
- **Bit Width**: 16-bit

---

## Files to Extract

### **From ESP-ADF VoIP Example**:

1. `examples/protocols/voip/main/sip_service.c` ✅
2. `examples/protocols/voip/main/sip_service.h` ✅
3. `examples/protocols/voip/main/voip_app.c` (reference only)

### **Dependencies** (from ESP-ADF components):

1. `esp_rtc` library (closed-source, must use as-is)
2. `av_stream` component
3. `media_lib` component
4. Audio pipeline components

---

## Next Steps

1. ✅ **Extract SIP/RTP code structure** (this document)
2. **Create adapted SIP service for ESP32-C6 OPAL**
3. **Integrate with our audio system** (using datasheet pinout)
4. **Test with SIP server** (Asterisk/FreeSWITCH)

---

## Important Notes

- **Closed-Source Library**: The actual SIP/RTP implementation is in `esp_rtc` library (likely closed-source)
- **API Abstraction**: We work with the `esp_rtc` API, not raw SIP/RTP packets
- **Audio Pipeline**: Uses ESP-ADF's `av_stream` for audio encoding/decoding
- **Network**: Requires WiFi connection and local IP address

---

**Status**: ✅ Code structure extracted and documented

