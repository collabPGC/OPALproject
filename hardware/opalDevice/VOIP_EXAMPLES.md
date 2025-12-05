# VoIP Working Examples for ESP32-C6

## Overview

While there are no **direct** ESP32-C6 VoIP examples, there are several ESP32 projects that can be adapted. This document lists available resources and how to adapt them for the ESP32-C6 with ES8311 codec.

---

## 1. ESP32 SIP Call Project (Recommended Starting Point)

### **Repository**: [sikorapatryk/sip-call](https://github.com/sikorapatryk/sip-call)

**Description**: Simple VoIP phone using ESP32 with SIP protocol
- Uses I2S microphone (SPH0645) and DAC (UDA1334A)
- Implements SIP (Session Initiation Protocol) for call management
- Connects to Asterisk VoIP server
- ESP-IDF framework

**Hardware Used**:
- ESP32 (can be adapted to ESP32-C6)
- SPH0645 I2S microphone
- UDA1334A I2S DAC

**Key Features**:
- SIP registration and call initiation
- Audio streaming over UDP
- GPIO-triggered call initiation

**Adaptation for ESP32-C6**:
1. Update ESP-IDF version to v5.5+ (supports ESP32-C6)
2. Replace I2S microphone/DAC with ES8311 codec
3. Update GPIO pin assignments (already done in your project)
4. Modify I2C initialization for ES8311 (your code already has this)
5. Update I2S configuration to match your pinout

**Key Files to Review**:
- `main/sip_client.c` - SIP protocol implementation
- `main/audio_stream.c` - Audio I2S handling
- `main/main.c` - Main application logic

---

## 2. Espressif ESP32 Internet Phone Solution

### **Official Solution**: [Espressif ESP32 VoIP](https://www.espressif.com/en/news/ESP32_VoIP)

**Description**: Commercial-grade VoIP solution by Espressif
- Dual-channel acoustic echo cancellation
- Noise reduction
- Optimized for voice quality

**Features**:
- High-quality audio processing
- Echo cancellation
- Noise suppression
- Professional implementation

**Note**: This is a commercial solution, may not have open-source code available.

---

## 3. Your Current MQTT Audio Streaming (Already Implemented)

### **Location**: `main/mqtt_audio.c`

**What You Already Have**:
- ✅ Real-time audio streaming over MQTT
- ✅ Bidirectional audio (mic → network, network → speaker)
- ✅ ES8311 codec integration
- ✅ I2S audio handling
- ✅ Buffer management

**Current Architecture**:
```
Microphone → I2S RX → Buffer (100ms) → MQTT Publish → Network
Network → MQTT Subscribe → Queue → I2S TX → Speaker
```

**Advantages**:
- Already working with your hardware
- MQTT is simpler than SIP
- Good for IoT applications
- Lower latency than SIP (no protocol overhead)

**Limitations**:
- Not standard VoIP (uses MQTT instead of SIP/RTP)
- Requires MQTT broker
- Not compatible with standard VoIP phones

---

## 4. SIP Protocol Implementation Options

### **Option A: Lightweight SIP Library**

**Library**: `libsip` or similar lightweight SIP stack

**Implementation Approach**:
```c
// SIP client structure
typedef struct {
    char *username;
    char *password;
    char *server;
    uint16_t port;
    int socket_fd;
} sip_client_t;

// SIP message types
#define SIP_REGISTER   "REGISTER"
#define SIP_INVITE     "INVITE"
#define SIP_ACK        "ACK"
#define SIP_BYE        "BYE"
```

**Key Functions Needed**:
- `sip_register()` - Register with SIP server
- `sip_invite()` - Initiate call
- `sip_ack()` - Acknowledge call
- `sip_bye()` - End call
- `sip_parse()` - Parse SIP messages

### **Option B: Full SIP Stack**

**Library**: `osip2` or `pjsip` (may be too large for ESP32-C6)

**Considerations**:
- Memory footprint (ESP32-C6 has limited RAM)
- Complexity vs. needs
- Real-time requirements

---

## 5. RTP (Real-time Transport Protocol) Implementation

### **Why RTP is Needed**:
- SIP handles call setup/signaling
- RTP handles actual audio data transmission
- Standard VoIP uses: SIP (signaling) + RTP (audio)

### **RTP Packet Structure**:
```c
typedef struct {
    uint8_t version:2;      // RTP version (always 2)
    uint8_t padding:1;
    uint8_t extension:1;
    uint8_t cc:4;           // CSRC count
    uint8_t marker:1;
    uint8_t pt:7;           // Payload type (PCM = 0)
    uint16_t sequence;      // Sequence number
    uint32_t timestamp;     // Timestamp
    uint32_t ssrc;          // Synchronization source
    uint8_t payload[];      // Audio data (PCM samples)
} rtp_packet_t;
```

### **RTP Implementation Example**:
```c
esp_err_t rtp_send_audio(uint8_t *audio_data, size_t len, uint32_t timestamp) {
    rtp_packet_t rtp;
    rtp.version = 2;
    rtp.padding = 0;
    rtp.extension = 0;
    rtp.cc = 0;
    rtp.marker = 0;
    rtp.pt = 0;  // PCM
    rtp.sequence = htons(sequence_num++);
    rtp.timestamp = htonl(timestamp);
    rtp.ssrc = htonl(ssrc_id);
    
    memcpy(rtp.payload, audio_data, len);
    
    // Send via UDP socket
    return sendto(udp_socket, &rtp, sizeof(rtp) + len, 0, 
                  (struct sockaddr *)&remote_addr, sizeof(remote_addr));
}
```

---

## 6. Integration with Your Current Code

### **Hybrid Approach: MQTT + SIP**

You could implement both:
- **MQTT**: For IoT device communication (already working)
- **SIP**: For standard VoIP phone calls

### **Architecture**:
```
┌─────────────────────────────────────────┐
│         ESP32-C6 OPAL Device            │
├─────────────────────────────────────────┤
│  Audio System (ES8311 + I2S)           │
│  ├─ Microphone Input                    │
│  └─ Speaker Output                      │
├─────────────────────────────────────────┤
│  Network Layer                          │
│  ├─ MQTT Client (existing)              │
│  │  └─ opal/audio/in, opal/audio/out   │
│  └─ SIP Client (new)                    │
│     ├─ SIP Signaling (UDP/TCP)         │
│     └─ RTP Audio (UDP)                 │
└─────────────────────────────────────────┘
```

### **Code Structure**:
```
main/
├── audio_system.c      (existing - ES8311 codec)
├── mqtt_audio.c        (existing - MQTT streaming)
├── sip_client.c        (new - SIP protocol)
├── rtp_audio.c         (new - RTP audio transport)
└── opal_main.c         (existing - main app)
```

---

## 7. Step-by-Step Implementation Guide

### **Step 1: Review ESP32 SIP Example**
```bash
# Clone the ESP32 SIP example
git clone https://github.com/sikorapatryk/sip-call.git
cd sip-call

# Review key files:
# - main/sip_client.c (SIP protocol)
# - main/audio_stream.c (I2S audio)
# - main/main.c (application logic)
```

### **Step 2: Create SIP Client Module**

Create `main/sip_client.c`:
```c
#include "sip_client.h"
#include "esp_log.h"
#include "lwip/sockets.h"
#include "lwip/netdb.h"

static const char *TAG = "sip_client";

typedef struct {
    char username[64];
    char password[64];
    char server[128];
    uint16_t port;
    int socket_fd;
    bool registered;
} sip_client_ctx_t;

static sip_client_ctx_t sip_ctx = {0};

esp_err_t sip_client_init(const char *username, const char *password, 
                          const char *server, uint16_t port) {
    strncpy(sip_ctx.username, username, sizeof(sip_ctx.username) - 1);
    strncpy(sip_ctx.password, password, sizeof(sip_ctx.password) - 1);
    strncpy(sip_ctx.server, server, sizeof(sip_ctx.server) - 1);
    sip_ctx.port = port;
    
    // Create UDP socket for SIP
    sip_ctx.socket_fd = socket(AF_INET, SOCK_DGRAM, 0);
    if (sip_ctx.socket_fd < 0) {
        ESP_LOGE(TAG, "Failed to create socket");
        return ESP_FAIL;
    }
    
    ESP_LOGI(TAG, "SIP client initialized");
    return ESP_OK;
}

esp_err_t sip_register(void) {
    // Build SIP REGISTER message
    char register_msg[512];
    snprintf(register_msg, sizeof(register_msg),
        "REGISTER sip:%s SIP/2.0\r\n"
        "Via: SIP/2.0/UDP %s:%d\r\n"
        "From: <sip:%s@%s>;tag=%08x\r\n"
        "To: <sip:%s@%s>\r\n"
        "Call-ID: %08x@%s\r\n"
        "CSeq: 1 REGISTER\r\n"
        "Contact: <sip:%s@%s:%d>\r\n"
        "Max-Forwards: 70\r\n"
        "Content-Length: 0\r\n\r\n",
        sip_ctx.server,
        "192.168.1.100", 5060,  // Your device IP
        sip_ctx.username, sip_ctx.server, esp_random(),
        sip_ctx.username, sip_ctx.server,
        esp_random(), sip_ctx.server,
        sip_ctx.username, "192.168.1.100", 5060);
    
    // Send to SIP server
    struct sockaddr_in server_addr;
    server_addr.sin_family = AF_INET;
    server_addr.sin_port = htons(sip_ctx.port);
    inet_aton(sip_ctx.server, &server_addr.sin_addr);
    
    int sent = sendto(sip_ctx.socket_fd, register_msg, strlen(register_msg), 0,
                      (struct sockaddr *)&server_addr, sizeof(server_addr));
    
    if (sent < 0) {
        ESP_LOGE(TAG, "Failed to send REGISTER");
        return ESP_FAIL;
    }
    
    ESP_LOGI(TAG, "SIP REGISTER sent");
    return ESP_OK;
}
```

### **Step 3: Create RTP Audio Module**

Create `main/rtp_audio.c`:
```c
#include "rtp_audio.h"
#include "audio_system.h"
#include "esp_log.h"
#include "lwip/sockets.h"

static const char *TAG = "rtp_audio";

typedef struct {
    int socket_fd;
    struct sockaddr_in remote_addr;
    uint16_t sequence;
    uint32_t ssrc;
    uint32_t timestamp;
} rtp_ctx_t;

static rtp_ctx_t rtp_ctx = {0};

esp_err_t rtp_audio_init(const char *remote_ip, uint16_t remote_port) {
    // Create UDP socket for RTP
    rtp_ctx.socket_fd = socket(AF_INET, SOCK_DGRAM, 0);
    if (rtp_ctx.socket_fd < 0) {
        ESP_LOGE(TAG, "Failed to create RTP socket");
        return ESP_FAIL;
    }
    
    // Set remote address
    rtp_ctx.remote_addr.sin_family = AF_INET;
    rtp_ctx.remote_addr.sin_port = htons(remote_port);
    inet_aton(remote_ip, &rtp_ctx.remote_addr.sin_addr);
    
    rtp_ctx.sequence = 0;
    rtp_ctx.ssrc = esp_random();
    rtp_ctx.timestamp = 0;
    
    ESP_LOGI(TAG, "RTP audio initialized");
    return ESP_OK;
}

esp_err_t rtp_send_audio(uint8_t *audio_data, size_t len) {
    // RTP header (12 bytes)
    uint8_t rtp_header[12];
    rtp_header[0] = 0x80;  // Version 2, no padding, no extension, no CSRC
    rtp_header[1] = 0x00;  // No marker, payload type 0 (PCM)
    rtp_header[2] = (rtp_ctx.sequence >> 8) & 0xFF;
    rtp_header[3] = rtp_ctx.sequence & 0xFF;
    rtp_header[4] = (rtp_ctx.timestamp >> 24) & 0xFF;
    rtp_header[5] = (rtp_ctx.timestamp >> 16) & 0xFF;
    rtp_header[6] = (rtp_ctx.timestamp >> 8) & 0xFF;
    rtp_header[7] = rtp_ctx.timestamp & 0xFF;
    rtp_header[8] = (rtp_ctx.ssrc >> 24) & 0xFF;
    rtp_header[9] = (rtp_ctx.ssrc >> 16) & 0xFF;
    rtp_header[10] = (rtp_ctx.ssrc >> 8) & 0xFF;
    rtp_header[11] = rtp_ctx.ssrc & 0xFF;
    
    // Send RTP header + audio data
    struct iovec iov[2];
    iov[0].iov_base = rtp_header;
    iov[0].iov_len = 12;
    iov[1].iov_base = audio_data;
    iov[1].iov_len = len;
    
    struct msghdr msg;
    msg.msg_name = &rtp_ctx.remote_addr;
    msg.msg_namelen = sizeof(rtp_ctx.remote_addr);
    msg.msg_iov = iov;
    msg.msg_iovlen = 2;
    msg.msg_control = NULL;
    msg.msg_controllen = 0;
    msg.msg_flags = 0;
    
    int sent = sendmsg(rtp_ctx.socket_fd, &msg, 0);
    
    if (sent > 0) {
        rtp_ctx.sequence++;
        rtp_ctx.timestamp += len / 2;  // 16-bit samples
    }
    
    return (sent > 0) ? ESP_OK : ESP_FAIL;
}
```

### **Step 4: Integrate with Audio System**

Modify `main/opal_main.c` to add SIP/RTP support:
```c
// Add to includes
#include "sip_client.h"
#include "rtp_audio.h"

// In app_main(), after WiFi connects:
if (wifi_manager_init() == ESP_OK) {
    // Initialize SIP client
    sip_client_init("opal_device", "password", "sip.example.com", 5060);
    sip_register();
    
    // Initialize RTP audio
    rtp_audio_init("192.168.1.50", 5004);  // Remote RTP endpoint
}
```

---

## 8. Recommended Libraries and Resources

### **SIP Libraries**:
1. **libsip** - Lightweight SIP stack (C)
2. **osip2** - Open SIP stack (may be too large)
3. **pjsip** - Full-featured SIP stack (definitely too large for ESP32-C6)

### **Audio Codecs** (Optional - for compression):
1. **Opus** - Best for VoIP (low latency, good quality)
2. **G.711** - Simple PCM (no compression, standard)
3. **G.722** - Wideband codec

### **Useful Links**:
- [ESP32 SIP Call GitHub](https://github.com/sikorapatryk/sip-call)
- [SIP Protocol RFC 3261](https://tools.ietf.org/html/rfc3261)
- [RTP Protocol RFC 3550](https://tools.ietf.org/html/rfc3550)
- [ESP-IDF Network Examples](https://github.com/espressif/esp-idf/tree/master/examples/protocols)

---

## 9. Comparison: MQTT vs SIP for VoIP

| Feature | MQTT (Current) | SIP (Standard VoIP) |
|---------|----------------|---------------------|
| **Protocol** | MQTT over TCP | SIP (UDP/TCP) + RTP (UDP) |
| **Latency** | Low (direct) | Low (RTP direct) |
| **Compatibility** | IoT devices | Standard phones |
| **Complexity** | Simple | More complex |
| **Codec Support** | Any | Standard (G.711, G.722, Opus) |
| **Echo Cancellation** | Manual | Built-in (some stacks) |
| **Call Management** | Custom | Standard (SIP) |
| **Use Case** | IoT streaming | Phone calls |

---

## 10. Quick Start: Adapt ESP32 SIP Example

### **Steps**:

1. **Clone the example**:
```bash
git clone https://github.com/sikorapatryk/sip-call.git
cd sip-call
```

2. **Update for ESP32-C6**:
   - Change target in `CMakeLists.txt` or `sdkconfig`
   - Update ESP-IDF to v5.5+
   - Replace I2S microphone/DAC code with ES8311 codec calls

3. **Update GPIO pins**:
   - Use your `hardware_config.h` pin definitions
   - Replace I2S pin assignments

4. **Integrate ES8311**:
   - Replace `i2s_mic_init()` with `audio_system_init()`
   - Replace `i2s_dac_init()` with ES8311 speaker output
   - Use your existing `audio_record()` and `audio_play()` functions

5. **Test**:
   - Connect to Asterisk SIP server
   - Register device
   - Make test call

---

## 11. Summary

### **What You Have**:
- ✅ MQTT-based audio streaming (working)
- ✅ ES8311 codec integration (needs I2C fix)
- ✅ I2S audio handling
- ✅ Network infrastructure

### **What You Need for VoIP**:
- SIP client implementation (can adapt from ESP32 example)
- RTP audio transport (simple UDP)
- SIP server (Asterisk, FreeSWITCH, or cloud service)

### **Recommended Approach**:
1. **Short-term**: Continue with MQTT audio streaming (simpler, already working)
2. **Long-term**: Add SIP/RTP support for standard VoIP compatibility
3. **Hybrid**: Support both MQTT (IoT) and SIP (phone calls)

### **Next Steps**:
1. Fix I2C hardware (add pull-up resistors)
2. Test MQTT audio streaming
3. If needed, adapt ESP32 SIP example for ESP32-C6
4. Integrate SIP client with your existing audio system

---

## 12. Example Code Repository Structure

If you want to create a VoIP implementation:

```
voip/
├── sip_client.c          # SIP protocol handling
├── sip_client.h
├── rtp_audio.c          # RTP audio transport
├── rtp_audio.h
├── sip_parser.c         # SIP message parsing
└── sip_parser.h
```

**Integration with existing code**:
- Use `audio_system.c` for ES8311 codec
- Use `mqtt_audio.c` as reference for audio streaming
- Add SIP/RTP modules alongside MQTT

---

**Note**: The ESP32 SIP example is the best starting point. It's well-documented and can be adapted to ESP32-C6 with your ES8311 codec.

