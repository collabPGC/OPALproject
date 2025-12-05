# Select ESP-ADF Project to Build

## Available Advanced Examples

Based on ESP-ADF exploration, here are the available advanced examples:

1. **aec** - Acoustic Echo Cancellation
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

## Recommended Projects for Our Hardware

### **Option 1: `aec` (Acoustic Echo Cancellation)** ⭐ RECOMMENDED
- **Why**: Tests full-duplex audio (mic + speaker), essential for VoIP
- **Complexity**: Medium
- **Use Case**: Test complete audio system, prepare for VoIP
- **Location**: `esp-adf-temp/examples/advanced_examples/aec`

### **Option 2: `flexible_pipeline`**
- **Why**: Shows flexible audio pipeline setup
- **Complexity**: Medium-High
- **Use Case**: Learn ESP-ADF audio pipeline architecture
- **Location**: `esp-adf-temp/examples/advanced_examples/flexible_pipeline`

### **Option 3: `http_play_and_save_to_file`**
- **Why**: Tests both playback and recording
- **Complexity**: Medium
- **Use Case**: Test complete audio I/O
- **Location**: `esp-adf-temp/examples/advanced_examples/http_play_and_save_to_file`

### **Option 4: `audio_mixer_tone`**
- **Why**: Simple audio generation and mixing
- **Complexity**: Low-Medium
- **Use Case**: Test basic audio output
- **Location**: `esp-adf-temp/examples/advanced_examples/audio_mixer_tone`

---

## Selection Recommendation

**For VoIP preparation**: Choose **`aec`** (Acoustic Echo Cancellation)
- Tests full-duplex audio
- Similar to VoIP requirements
- Good for understanding ESP-ADF audio pipeline

**For simple testing**: Choose **`audio_mixer_tone`**
- Simpler
- Good for initial hardware verification

---

## Next Steps After Selection

1. **Copy selected example** to our project or work directory
2. **Update pinout** to match our `hardware_config.h`
3. **Update codec configuration** for ES8311
4. **Build and test**

---

**Which project would you like to build?**

