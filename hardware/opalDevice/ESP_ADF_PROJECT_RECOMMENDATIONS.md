# ESP-ADF Project Recommendations

## Available Advanced Examples

1. **aec** - Acoustic Echo Cancellation ⭐ **RECOMMENDED**
2. **algorithm** - Audio algorithm examples
3. **audio_mixer_tone** - Audio mixing and tone generation
4. **dlna** - DLNA streaming
5. **downmix_pipeline** - Audio downmixing
6. **flexible_pipeline** - Flexible audio pipeline
7. **http_play_and_save_to_file** - HTTP audio playback and recording
8. **multi-room** - Multi-room audio
9. **nvs_dispatcher** - NVS-based audio routing
10. **wifi_bt_ble_coex** - WiFi/Bluetooth/BLE coexistence

---

## Top Recommendation: `aec` (Acoustic Echo Cancellation)

### **Why This Project?**

1. **Full-Duplex Audio**: Tests both microphone input and speaker output simultaneously
2. **VoIP-Ready**: Echo cancellation is essential for VoIP applications
3. **Complete Audio Pipeline**: Shows how ESP-ADF handles complex audio processing
4. **Real-World Use Case**: Exactly what we need for VoIP

### **What It Does**:
- Plays MP3 file from flash
- Records audio from microphone
- Performs Acoustic Echo Cancellation (AEC)
- Saves recorded audio to SD card (we can adapt this)

### **Audio Pipelines**:
```
Playback: [flash] → mp3_decoder → filter → i2s_stream → [codec_chip]
Record:  [codec_chip] → i2s_stream → filter → AEC → wav_encoder → [sdcard]
```

### **Requirements**:
- MicroSD card (we can adapt to use flash or skip file saving)
- ESP-IDF v5.3+
- Audio board with codec (we have ES8311)

---

## Alternative Options

### **Option 2: `audio_mixer_tone`** (Simpler)
- **Why**: Simpler, good for initial hardware testing
- **Use Case**: Test basic audio output
- **Complexity**: Low-Medium

### **Option 3: `flexible_pipeline`** (Learn Architecture)
- **Why**: Shows flexible audio pipeline setup
- **Use Case**: Learn ESP-ADF architecture
- **Complexity**: Medium-High

### **Option 4: `http_play_and_save_to_file`** (Playback + Recording)
- **Why**: Tests both playback and recording
- **Use Case**: Test complete audio I/O
- **Complexity**: Medium

---

## Recommendation: Start with `aec`

**Path**: `esp-adf-temp/examples/advanced_examples/aec`

**Reasons**:
1. ✅ Full-duplex audio (mic + speaker)
2. ✅ Echo cancellation (essential for VoIP)
3. ✅ Complete audio pipeline example
4. ✅ Most relevant to our VoIP goal

---

## Next Steps

1. **Select the project** (recommend `aec`)
2. **Copy to working directory** or work directly in ESP-ADF
3. **Update pinout** to match our `hardware_config.h`
4. **Update codec configuration** for ES8311
5. **Adapt for ESP32-C6** (if needed)
6. **Build and test**

---

**Which project would you like to build?**

