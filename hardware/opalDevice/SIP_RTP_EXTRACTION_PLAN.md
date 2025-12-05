# SIP/RTP Code Extraction Plan from ESP-ADF

## Overview

Extract SIP (Session Initiation Protocol) and RTP (Real-time Transport Protocol) code from ESP-ADF VoIP example to add VoIP functionality to our OPAL device.

---

## ESP-ADF VoIP Example Location

### **Possible Locations**:
1. `esp-adf/examples/voip/sip/` (older versions)
2. `esp-adf/examples/advanced_examples/voip/` (newer versions)
3. Browse online: https://github.com/espressif/esp-adf/tree/master/examples

### **How to Find**:
```bash
# After cloning ESP-ADF
cd esp-adf
find examples -name "*voip*" -o -name "*sip*"
```

---

## Key Components to Extract

### 1. **SIP Client** (Session Initiation Protocol)
- SIP registration with server
- Call initiation (INVITE)
- Call termination (BYE)
- Call state management
- SIP message parsing

**Files to Look For**:
- `main/sip_client.c` or `components/sip/`
- SIP library interface code

**Note**: SIP library is pre-compiled (binary), but example code shows how to use it.

### 2. **RTP Audio Transport** (Real-time Transport Protocol)
- RTP packet creation
- UDP socket management
- Audio packetization
- Jitter buffer (if included)

**Files to Look For**:
- `main/rtp_audio.c` or `components/rtp/`
- UDP socket handling code

### 3. **Network Management**
- WiFi connection handling
- SIP server configuration
- RTP stream management
- Network error recovery

**Files to Look For**:
- `main/network_handler.c`
- WiFi integration code

### 4. **Audio Codec Integration**
- Audio encoding (G.711, G.722, Opus)
- Audio decoding
- Audio buffer management

**Files to Look For**:
- Codec integration code
- Audio pipeline setup

---

## Extraction Strategy

### **Step 1: Review ESP-ADF VoIP Example Structure**

```bash
cd esp-adf/examples/voip/sip  # or advanced_examples/voip
ls -la
# Review main/ directory
# Review components/ directory
# Review README.md
```

### **Step 2: Identify Key Files**

Look for:
- `main/voip_main.c` - Main application
- `main/sip_*.c` - SIP client code
- `main/rtp_*.c` - RTP transport code
- `main/network_*.c` - Network handling
- `CMakeLists.txt` - Dependencies

### **Step 3: Extract SIP Client Code**

**What to Extract**:
- SIP client initialization
- SIP registration function
- Call initiation function (INVITE)
- Call termination function (BYE)
- SIP message handling
- SIP event callbacks

**What to Adapt**:
- Replace ESP-ADF audio pipeline with our `audio_system.c`
- Update WiFi manager integration
- Adapt for ESP32-C6 (if needed)

### **Step 4: Extract RTP Audio Code**

**What to Extract**:
- RTP packet creation
- UDP socket setup
- Audio packetization
- RTP header construction
- Audio buffer management

**What to Adapt**:
- Integrate with our `audio_play()` and `audio_record()` functions
- Match our audio format (16kHz, 16-bit, mono)
- Adapt for ESP32-C6 network stack

### **Step 5: Create Integration Layer**

**New Files to Create**:
- `main/voip_sip.c` - SIP client wrapper
- `main/voip_rtp.c` - RTP transport wrapper
- `main/voip_manager.c` - VoIP state management
- `main/voip_config.h` - Configuration (SIP server, credentials)

**Integration Points**:
- Use our `audio_system.c` for audio I/O
- Use our WiFi manager
- Use our MQTT system (optional - for signaling)

---

## Implementation Plan

### **Phase 1: Extract and Review**
1. Clone ESP-ADF (if not already done)
2. Locate VoIP example
3. Review code structure
4. Document key functions and APIs

### **Phase 2: Extract SIP Code**
1. Copy SIP client initialization code
2. Copy SIP registration code
3. Copy call management code
4. Create wrapper functions

### **Phase 3: Extract RTP Code**
1. Copy RTP packet creation code
2. Copy UDP socket code
3. Copy audio packetization code
4. Integrate with our audio system

### **Phase 4: Integration**
1. Create VoIP manager module
2. Integrate with audio system
3. Integrate with WiFi manager
4. Add configuration system

### **Phase 5: Testing**
1. Test SIP registration
2. Test call initiation
3. Test audio transmission (RTP)
4. Test audio reception (RTP)
5. Test call termination

---

## Key Considerations

### **ESP32-C6 Compatibility**:
- ESP-ADF examples target ESP32/ESP32-S3
- ESP32-C6 is newer - may need adaptations
- Network stack should be compatible
- Audio APIs should be compatible

### **Memory Constraints**:
- ESP32-C6 has 320KB RAM
- ESP-ADF uses more RAM than direct APIs
- May need to optimize or use lighter components
- Consider using direct ESP-IDF APIs instead of ESP-ADF pipeline

### **SIP Library**:
- SIP library is pre-compiled (binary)
- Not open-source
- Example code shows how to use it
- May need to link against ESP-ADF SIP library

### **Audio Integration**:
- Keep our `audio_system.c` (simpler, working)
- Don't use ESP-ADF audio pipeline (uses more RAM)
- Use ESP-ADF for SIP/RTP only
- Integrate with our audio I/O functions

---

## File Structure After Extraction

```
main/
├── audio_system.c          # Keep (our audio system)
├── voip_sip.c              # NEW: SIP client (from ESP-ADF)
├── voip_rtp.c               # NEW: RTP transport (from ESP-ADF)
├── voip_manager.c           # NEW: VoIP state management
├── voip_config.h            # NEW: VoIP configuration
└── opal_main.c              # Update: Add VoIP initialization
```

---

## Dependencies

### **From ESP-ADF**:
- SIP library (pre-compiled binary)
- SIP example code (source)
- RTP example code (source)

### **From ESP-IDF**:
- WiFi stack
- UDP sockets
- FreeRTOS
- Audio codec driver (ES8311)

### **From Our Code**:
- `audio_system.c` - Audio I/O
- WiFi manager
- Hardware configuration

---

## Next Steps

1. **Wait for ESP-ADF Clone**:
   ```bash
   # Check if esp-adf-temp is ready
   ls esp-adf-temp/examples
   ```

2. **Locate VoIP Example**:
   ```bash
   find esp-adf-temp/examples -name "*voip*" -o -name "*sip*"
   ```

3. **Review Code**:
   - Read `main/voip_main.c`
   - Read SIP client code
   - Read RTP code
   - Document key functions

4. **Extract Code**:
   - Copy relevant files
   - Create wrapper functions
   - Integrate with our system

---

**Status**: Waiting for ESP-ADF clone to complete, then extract SIP/RTP code

