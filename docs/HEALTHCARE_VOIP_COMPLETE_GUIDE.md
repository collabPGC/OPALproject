# OPAL Healthcare VoIP - Complete Implementation Guide

## Overview

This document provides comprehensive guidance for implementing the OPAL healthcare VoIP system with complete audio support, including:

- **Hardware Fix**: ESP32-S3 audio amplifier wiring
- **Audio Codec**: ES8311 full configuration
- **VoIP Integration**: RTP/SRTP and SIP client implementation
- **Healthcare Features**: Voice calls, alerts, translation, procedures, directory lookup
- **HIPAA Compliance**: End-to-end encryption and audit logging

---

## Table of Contents

1. [Hardware Setup](#hardware-setup)
2. [Software Architecture](#software-architecture)
3. [Feature Implementations](#feature-implementations)
4. [HIPAA Compliance](#hipaa-compliance)
5. [Integration Examples](#integration-examples)
6. [Deployment Guide](#deployment-guide)
7. [Troubleshooting](#troubleshooting)

---

## Hardware Setup

### Quick Fix for Waveshare ESP32-S3-LCD-1.28

**Problem**: NS4150B amplifier requires control signals to enable audio output.

**Solution**: Add two 10kΩ resistors to control amplifier pins.

#### Materials Needed
- 2× 10kΩ resistors (1/4W or 0603 SMD)
- 30-36 AWG wire
- Soldering iron

#### Wiring Diagram

```
ESP32-S3 GPIO 48 ────[10kΩ]──── NS4150B Pin 1 (CTRL Enable)
ESP32-S3 GND    ────[10kΩ]──── NS4150B Pin 2 (BYP Normal Mode)
```

**See detailed wiring guide**: `/docs/hardware/esp32-audio-fix-wiring.md`

---

## Software Architecture

### ESP32 Firmware Components

```
firmware/
├── components/
│   ├── audio/
│   │   ├── audio_codec.h          # ES8311 codec driver API
│   │   └── audio_codec.c          # Full codec implementation
│   │
│   └── voip/
│       ├── rtp_handler.h          # RTP/SRTP protocol
│       └── sip_client.h           # SIP client for hospital PBX
```

### Python Gateway Service

```
gateway-service/
└── src/
    ├── voice_call_system.py       # WebSocket audio + SIP integration
    ├── alert_paging_system.py     # Emergency alerts & paging
    ├── translation_system.py      # Multi-language support
    ├── procedure_retrieval.py     # Step-by-step guidance
    ├── callee_lookup.py           # Hospital directory
    └── hipaa_encryption.py        # AES-256 encryption + audit
```

---

## Feature Implementations

### 1. Voice Call System

Full-duplex voice calls with HIPAA-compliant encryption.

**Features**:
- SIP registration with hospital PBX
- WebSocket audio streaming
- Call hold, transfer, conference
- Emergency call prioritization
- Call statistics and quality monitoring

**Example Usage**:

```python
from voice_call_system import VoiceCallSystem, CallPriority

# Initialize call system
call_system = VoiceCallSystem(
    sip_server="sip.hospital.local",
    sip_domain="hospital.local",
    enable_encryption=True
)

# Make a call
session = await call_system.initiate_call(
    caller_uri="sip:nurse101@hospital.local",
    callee_uri="sip:doctor205@hospital.local",
    priority=CallPriority.NORMAL
)

# Answer incoming call
await call_system.answer_call(session.call_id)

# Hang up
await call_system.hangup_call(session.call_id)
```

**API Endpoint**: `WS /api/v1/stream/{call_id}` for audio

---

### 2. Alert and Paging System

Multi-channel alert delivery for hospital communications.

**Features**:
- Code Blue / Code Red / Rapid Response alerts
- Department-wide paging
- Individual staff paging
- Multi-channel delivery (audio, mobile, SMS, email)
- Priority routing
- Acknowledgment tracking

**Example Usage**:

```python
from alert_paging_system import AlertPagingSystem, AlertType

alert_system = AlertPagingSystem()

# Send Code Blue emergency
alert = await alert_system.send_emergency_alert(
    emergency_type=AlertType.CODE_BLUE,
    location="Room 302, 3rd Floor East Wing",
    additional_info="Adult male, unresponsive"
)

# Page a department
await alert_system.page_department(
    department="Cardiology",
    message="Dr. Smith, please call extension 4567",
    sender_name="Front Desk"
)

# Acknowledge alert
await alert_system.acknowledge_alert(alert.alert_id, "nurse101")
```

---

### 3. Translation System

Real-time translation for patient-staff communication.

**Supported Languages**:
- English, Spanish, Mandarin, Cantonese, Vietnamese
- Korean, Tagalog, Russian, Arabic, French, German
- Portuguese, Italian, Japanese, Hindi

**Features**:
- Speech-to-speech translation
- Medical phrasebook (common questions/responses)
- Context-aware translation
- Low-latency processing

**Example Usage**:

```python
from translation_system import TranslationSystem, Language

translation = TranslationSystem(enable_caching=True)

# Text translation
result = await translation.translate(
    source_text="Do you have any pain?",
    source_lang=Language.ENGLISH,
    target_lang=Language.SPANISH,
    context="medical"
)
# Result: "¿Tiene algún dolor?"

# Quick medical phrase
phrase = await translation.get_quick_phrase("pain_level", Language.MANDARIN)
# Result: "从1到10，你感到多痛？"
```

**Common Medical Phrases**:
- `pain_level`: Pain assessment (1-10 scale)
- `allergies`: Medication allergy inquiry
- `medication_time`: Medication reminder
- `need_help`: Assistance offer
- `procedure_explanation`: Procedure introduction

---

### 4. Procedure Step Retrieval

Step-by-step guidance for medical procedures.

**Available Procedures**:
- Blood pressure measurement
- IV catheter insertion
- Wound care
- Specimen collection
- Medication administration
- Emergency protocols

**Features**:
- Sequential step delivery
- Safety checklists
- Time estimates
- Visual/audio guidance
- Progress tracking

**Example Usage**:

```python
from procedure_retrieval import ProcedureRetrievalSystem

proc_system = ProcedureRetrievalSystem()

# Search for procedures
results = await proc_system.search_procedures("blood pressure")

# Start guided session
session = await proc_system.start_procedure_session(results[0].procedure_id)

# Get current step
step = await proc_system.get_current_step(session.session_id)
print(f"Step {step.step_number}: {step.title}")
print(f"Instructions: {step.instructions}")

# Advance to next step
next_step = await proc_system.get_next_step(session.session_id)

# Get progress
progress = await proc_system.get_session_progress(session.session_id)
# {"current_step": 3, "total_steps": 5, "progress_percent": 60}
```

---

### 5. Callee Lookup System

Hospital directory and staff lookup.

**Features**:
- Search by name, department, role
- Extension/SIP URI resolution
- Presence and availability status
- On-call schedule integration
- Emergency contact routing

**Example Usage**:

```python
from callee_lookup import CalleeLookupSystem

lookup = CalleeLookupSystem(sip_domain="hospital.local")

# Search by name
results = await lookup.search_by_name("Jane Doe")

# Get contact URI
uri = await lookup.get_contact_uri(results[0].staff_id)
# Result: "sip:5101@hospital.local"

# Find available staff in department
available = await lookup.search_available_staff(department="Emergency")

# Get on-call staff
on_call = await lookup.get_on_call_staff()
```

---

### 6. HIPAA-Compliant Encryption

End-to-end encryption for all audio communications.

**Security Features**:
- **AES-256-GCM**: Audio payload encryption
- **SRTP**: Real-time transport protocol encryption
- **TLS 1.3**: Signaling channel encryption
- **Key Rotation**: Automatic key expiration and renewal
- **Audit Logging**: Complete encryption activity logs

**Example Usage**:

```python
from hipaa_encryption import HIPAAEncryption

hipaa = HIPAAEncryption(
    enable_audit_logging=True,
    key_rotation_interval_hours=24
)

# Encrypt audio data
audio_data = b"raw audio samples..."
encrypted, nonce = await hipaa.encrypt_audio(audio_data)

# Decrypt audio data
decrypted = await hipaa.decrypt_audio(encrypted, nonce)

# Generate SRTP keys
srtp_key, srtp_salt = hipaa.generate_srtp_keys()

# Get compliance report
from hipaa_encryption import HIPAAComplianceChecker
checker = HIPAAComplianceChecker()
report = checker.generate_compliance_report(hipaa)
```

---

## HIPAA Compliance

### Encryption Standards

✅ **Data in Transit**:
- TLS 1.3 for all HTTP/WebSocket connections
- SRTP with AES-256 for RTP audio streams
- Perfect Forward Secrecy (PFS) enabled

✅ **Data at Rest**:
- AES-256-GCM for stored audio (if required)
- Encrypted database fields for PHI
- Secure key storage (HSM recommended for production)

✅ **Access Controls**:
- Role-based access control (RBAC)
- Multi-factor authentication (MFA)
- Session timeout and auto-logout

✅ **Audit Logging**:
- All access to PHI logged with timestamps
- Encryption/decryption events tracked
- Automated log archival for 6+ years

### HIPAA Compliance Checklist

- [ ] TLS 1.3 enabled on all endpoints
- [ ] Audio streams encrypted with SRTP (AES-256)
- [ ] Audit logging enabled and tested
- [ ] Key rotation configured (24-hour intervals)
- [ ] Access controls implemented (RBAC)
- [ ] Business Associate Agreements (BAAs) signed
- [ ] Security risk assessment completed
- [ ] Incident response plan documented
- [ ] Staff HIPAA training completed

---

## Integration Examples

### Complete ESP32 + Gateway Integration

#### ESP32 Firmware (C)

```c
#include "audio_codec.h"
#include "rtp_handler.h"
#include "sip_client.h"

void app_main(void) {
    // 1. Initialize audio codec
    audio_codec_config_t audio_cfg = audio_get_default_config();
    audio_codec_init(&audio_cfg);

    // 2. Enable amplifier
    audio_amp_enable();

    // 3. Configure RTP with encryption
    rtp_config_t rtp_cfg = rtp_get_default_config();
    rtp_cfg.enable_srtp = true;
    rtp_cfg.srtp_profile = SRTP_PROFILE_AES256_CM_SHA1_80;
    rtp_init(&rtp_cfg);

    // 4. Initialize SIP client
    sip_config_t sip_cfg = sip_get_default_config();
    strcpy(sip_cfg.username, "nurse101");
    strcpy(sip_cfg.password, "secure_password");
    sip_init(&sip_cfg);

    // 5. Register with hospital PBX
    sip_register();

    // 6. Make a call
    sip_make_call("sip:doctor205@hospital.local", SIP_PRIORITY_NORMAL);

    // 7. Audio loop (send/receive)
    int16_t audio_buffer[320]; // 20ms @ 16kHz
    while (call_active) {
        // Record from microphone
        audio_codec_read(audio_buffer, sizeof(audio_buffer), NULL, 100);

        // Send via RTP (encrypted with SRTP)
        rtp_send((uint8_t*)audio_buffer, sizeof(audio_buffer));

        // Receive audio
        size_t received_len;
        rtp_receive((uint8_t*)audio_buffer, sizeof(audio_buffer), &received_len, 100);

        // Play to speaker
        audio_codec_write(audio_buffer, received_len, NULL, 100);
    }
}
```

#### Python Gateway Service

```python
from fastapi import FastAPI, WebSocket
from voice_call_system import VoiceCallSystem, AudioStreamHandler
from alert_paging_system import AlertPagingSystem
from translation_system import TranslationSystem
from procedure_retrieval import ProcedureRetrievalSystem
from callee_lookup import CalleeLookupSystem
from hipaa_encryption import HIPAAEncryption

app = FastAPI()

# Initialize all systems
call_system = VoiceCallSystem("sip.hospital.local", "hospital.local")
alert_system = AlertPagingSystem()
translation = TranslationSystem()
procedures = ProcedureRetrievalSystem()
directory = CalleeLookupSystem()
encryption = HIPAAEncryption()

audio_handler = AudioStreamHandler(call_system)

@app.websocket("/api/v1/stream/{call_id}")
async def audio_stream(websocket: WebSocket, call_id: str):
    """Bidirectional audio streaming"""
    await websocket.accept()
    await audio_handler.handle_audio_stream(websocket, call_id)

@app.post("/api/v1/call/initiate")
async def initiate_call(caller_uri: str, callee_uri: str):
    """Initiate voice call"""
    session = await call_system.initiate_call(caller_uri, callee_uri)
    return {"call_id": session.call_id}

@app.post("/api/v1/alert/emergency")
async def emergency_alert(location: str, emergency_type: str):
    """Send emergency alert"""
    alert = await alert_system.send_emergency_alert(
        AlertType[emergency_type.upper()], location
    )
    return {"alert_id": alert.alert_id}

@app.post("/api/v1/translate")
async def translate(text: str, source_lang: str, target_lang: str):
    """Translate text"""
    result = await translation.translate(
        text, Language[source_lang.upper()], Language[target_lang.upper()]
    )
    return {"translated_text": result.translated_text}

@app.get("/api/v1/procedures/search")
async def search_procedures(query: str):
    """Search procedures"""
    results = await procedures.search_procedures(query)
    return {"results": [{"id": p.procedure_id, "name": p.name} for p in results]}

@app.get("/api/v1/directory/search")
async def search_directory(name: str):
    """Search staff directory"""
    results = await directory.search_by_name(name)
    return {"results": [
        {"name": f"{s.first_name} {s.last_name}", "uri": s.sip_uri}
        for s in results
    ]}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, ssl_certfile="cert.pem", ssl_keyfile="key.pem")
```

---

## Deployment Guide

### Production Requirements

#### Hardware (ESP32)
- **ESP32-S3-BOX-3** (recommended) or Waveshare ESP32-S3-LCD-1.28
- Audio fixed with 10kΩ resistors (if using Waveshare)
- Minimum 4MB flash, 8MB recommended
- External antenna for better WiFi range

#### Server (Gateway)
- **CPU**: 4+ cores
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 50GB+ for audio logs and backups
- **Network**: 1Gbps, low-latency connection to hospital network
- **OS**: Ubuntu 22.04 LTS or RHEL 8+

#### Network Requirements
- **Bandwidth**: 100 kbps per concurrent call (G.711) or 40 kbps (Opus)
- **Latency**: <50ms within hospital network
- **QoS**: DSCP EF (46) for voice traffic
- **Firewall**: Ports 5060-5061 (SIP), 10000-20000 (RTP)

### Installation Steps

#### 1. ESP32 Firmware

```bash
# Install ESP-IDF
git clone --recursive https://github.com/espressif/esp-idf.git
cd esp-idf
./install.sh

# Build firmware
cd /path/to/OPALproject/software/firmware
idf.py build

# Flash to device
idf.py -p /dev/ttyUSB0 flash monitor
```

#### 2. Python Gateway Service

```bash
# Install dependencies
cd /path/to/OPALproject/software/gateway-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with hospital settings

# Run service
uvicorn src.main:app --host 0.0.0.0 --port 8000 \
    --ssl-keyfile /path/to/key.pem \
    --ssl-certfile /path/to/cert.pem
```

#### 3. Hospital PBX Integration

**Asterisk Configuration** (example):

```ini
; /etc/asterisk/sip.conf
[nurse101]
type=friend
secret=secure_password
host=dynamic
context=hospital
qualify=yes
nat=force_rport,comedia
encryption=yes
dtlsenable=yes
dtlsverify=fingerprint
dtlscertfile=/etc/asterisk/keys/asterisk.pem
dtlsprivatekey=/etc/asterisk/keys/asterisk.pem
```

---

## Troubleshooting

### ESP32 Audio Issues

#### No Audio Output

**Problem**: Speaker silent, no sound

**Checklist**:
1. Verify amplifier wiring: `GPIO 48 → NS4150B Pin 1`, `GND → Pin 2`
2. Check amplifier enable in code: `audio_amp_enable()`
3. Test with loopback: `audio_run_loopback_test(5000)`
4. Verify I2S configuration matches ES8311 datasheet
5. Check speaker connection (should be 8Ω)

**Debug Commands**:
```c
audio_test_amplifier();  // Play 1kHz tone
audio_get_chip_info(&chip_id, &version);  // Verify ES8311 detected
```

#### Distorted Audio

**Problem**: Audio is garbled or noisy

**Solutions**:
- Reduce volume: `audio_codec_set_volume(50)`
- Enable hospital mode (aggressive noise suppression): `audio_set_hospital_mode(true)`
- Check power supply (should be stable 3.3V, 500mA+)
- Add decoupling capacitors near ES8311 VDD pin

### VoIP Call Issues

#### Registration Failed

**Problem**: Cannot register with SIP server

**Checklist**:
1. Verify network connectivity: `ping sip.hospital.local`
2. Check credentials in `sip_config_t`
3. Verify firewall allows ports 5060-5061
4. Check SIP server logs for authentication errors

#### No Audio in Call

**Problem**: Call connects but no audio

**Checklist**:
1. Verify RTP ports open (10000-20000)
2. Check SRTP keys match on both sides
3. Test with unencrypted RTP first (dev only!)
4. Verify codec negotiation (G.711/Opus)

**Debug**:
```python
# Get RTP statistics
stats = rtp_get_stats()
print(f"Packets sent: {stats.packets_sent}")
print(f"Packets received: {stats.packets_received}")
print(f"Packet loss: {stats.packet_loss_percent}%")
```

### HIPAA Compliance Issues

#### Encryption Not Working

**Problem**: Audio transmitted unencrypted

**Checklist**:
1. Verify `enable_srtp=true` in RTP config
2. Check SRTP keys generated: `srtp_set_keys()`
3. Verify TLS certificates valid
4. Check audit log for encryption events

**Test Encryption**:
```python
# Verify encryption is active
stats = encryption.get_statistics()
assert stats['total_encryptions'] > 0, "No encryption activity!"

# Generate compliance report
report = HIPAAComplianceChecker.generate_compliance_report(encryption)
assert report['compliant'], "HIPAA compliance check failed!"
```

---

## Performance Optimization

### Audio Quality Tuning

```c
// For better quality in quiet environments
audio_codec_set_profile(AUDIO_PROFILE_MUSIC);
audio_codec_set_agc(false);

// For noisy hospital environments
audio_set_hospital_mode(true);  // Aggressive NS + AEC
audio_codec_set_mic_gain(80);   // Boost microphone
```

### Network Optimization

```python
# Reduce bandwidth with Opus codec
rtp_cfg.codec = CODEC_OPUS
rtp_cfg.sample_rate = 16000  # Wideband
# Opus: ~20-40 kbps vs G.711: 64 kbps
```

### Battery Life (Wearable Devices)

```c
// Enable low-power modes
audio_codec_set_profile(AUDIO_PROFILE_LOW_POWER);

// Sleep when idle
if (idle_for_seconds > 300) {
    audio_codec_sleep();  // Codec in low-power mode
    audio_amp_disable();   // Amplifier off
}

// Wake on activity
audio_codec_wake();
audio_amp_enable();
```

---

## Support and Resources

### Documentation
- **Hardware**: `/docs/hardware/esp32-audio-fix-wiring.md`
- **API Reference**: Generated from code comments
- **Protocol Specs**: RTP (RFC 3550), SIP (RFC 3261), SRTP (RFC 3711)

### Sample Code
- **ESP32 Examples**: `/software/firmware/examples/`
- **Python Examples**: Embedded in source files (`if __name__ == "__main__"`)

### External Resources
- ESP32-S3 Technical Reference: https://espressif.com/
- ES8311 Datasheet: Available from manufacturer
- HIPAA Security Rule: https://www.hhs.gov/hipaa/

---

## License

MIT License - See LICENSE file for details.

## Authors

OPAL Project Team
Version 1.0 - 2025-11-17
