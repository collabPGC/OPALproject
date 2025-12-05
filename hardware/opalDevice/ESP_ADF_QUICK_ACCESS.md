# Quick Access to ESP-ADF VoIP Examples

## Direct Links

### **ESP-ADF Repository**:
- **GitHub**: https://github.com/espressif/esp-adf
- **Documentation**: https://docs.espressif.com/projects/esp-adf/en/latest/

### **VoIP Example Locations** (check both):
1. `examples/voip/sip/` - SIP client example
2. `examples/advanced_examples/voip/` - Advanced VoIP example
3. Browse online: https://github.com/espressif/esp-adf/tree/master/examples

---

## Quick Download Command

```bash
# Clone ESP-ADF (full repository, ~500MB+)
git clone --recursive https://github.com/espressif/esp-adf.git

# Navigate to examples
cd esp-adf/examples

# Check for VoIP examples
ls voip/          # If exists
ls advanced_examples/voip/  # If exists
```

---

## What ESP-ADF Provides

### **Audio Pipeline Examples**:
- `pipeline_duplex_app/` - Full-duplex audio (mic + speaker)
- `pipeline_http_mp3/` - HTTP audio streaming
- `pipeline_a2dp_sink/` - Bluetooth audio
- `advanced_examples/aec/` - Acoustic Echo Cancellation

### **Codec Support**:
- ES8311 (your codec!) ✅
- ES8388
- ES8374
- And others

### **Audio Components**:
- `components/audio_pipeline/` - Pipeline framework
- `components/audio_codec/` - Codec drivers
- `components/audio_hal/` - Hardware abstraction
- `components/audio_processing/` - AEC, noise reduction

---

## Key Files to Review

Once you clone ESP-ADF, look for:

1. **VoIP Example**:
   - `examples/voip/sip/main/` - SIP client code
   - `examples/voip/sip/README.md` - Setup instructions

2. **Audio Pipeline**:
   - `examples/advanced_examples/pipeline_duplex_app/` - Full-duplex reference
   - Shows how to set up mic → processing → speaker pipeline

3. **Codec Driver**:
   - `components/audio_codec/codec/es8311/` - ES8311 driver
   - `components/audio_codec/codec/es8311/es8311.c` - Implementation

---

## Integration Strategy

### **Option 1: Use ESP-ADF Pipeline** (Full Migration)
- Replace your `audio_system.c` with ESP-ADF pipeline
- More features (AEC, effects)
- More complex, uses more RAM

### **Option 2: Extract Components** (Recommended)
- Keep your `audio_system.c` (simpler, working)
- Extract SIP/RTP code from VoIP example
- Use ESP-ADF as reference for network audio

### **Option 3: Hybrid**
- Use ESP-ADF audio effects (AEC, noise reduction)
- Keep your direct ESP-IDF codec initialization
- Add SIP/RTP from ESP-ADF example

---

## Next Steps

1. **Clone ESP-ADF**:
   ```bash
   git clone --recursive https://github.com/espressif/esp-adf.git
   ```

2. **Explore Examples**:
   ```bash
   cd esp-adf/examples
   # Browse available examples
   ```

3. **Review VoIP Code**:
   - Find SIP implementation
   - Find RTP audio handling
   - Adapt for ESP32-C6

4. **Extract What You Need**:
   - SIP client code
   - RTP transport
   - Network handling

---

**The ESP-ADF is the official Espressif Audio Development Framework with VoIP support!**

