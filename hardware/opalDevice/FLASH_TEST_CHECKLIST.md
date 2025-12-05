# Flash and Test Checklist - AEC Project

## Expected Behavior

### **Initial Boot Sequence**
1. **Bootloader**: Should see bootloader messages
2. **App Start**: Application should start and show:
   ```
   ========================================
   AEC Example - Adapted for OPAL Device
   ESP32-C6 + ES8311 Codec
   ========================================
   ```

### **Initialization Steps**
Look for these log messages in order:

1. **SD Card** (disabled):
   ```
   [1.0] SD card disabled (not available on OPAL device)
   ```

2. **Codec Initialization**:
   ```
   [2.0] Initialize codec chip
   Using datasheet pinout (via ESP-ADF board config):
     I2S: MCLK=GPIO19, BCK=GPIO20, LRCK=GPIO22, DOUT=GPIO21, DIN=GPIO23
     I2C: SDA=GPIO8, SCL=GPIO7
   ```

3. **Board Initialization**:
   ```
   I2S pins configured for ESP32-C6 OPAL (port 0):
     MCLK=GPIO19, BCK=GPIO20, LRCK=GPIO22, DOUT=GPIO21, DIN=GPIO23
   I2C pins configured for ESP32-C6 OPAL (port 0):
     SDA=GPIO8, SCL=GPIO7
   ```

4. **I2S Stream Configuration**:
   ```
   [2.1] Configure I2S stream for playback
   [2.1.1] I2S pins configured via ESP-ADF board config (GPIO19/20/21/22/23)
   [2.2] Configure I2S stream for recording
   [2.2.1] I2S RX pins configured via ESP-ADF board config (GPIO19/20/22/23)
   ```

5. **AEC Pipeline**:
   ```
   [3.0] Create audio pipeline_rec for recording
   [3.1] Create algorithm stream for AEC
   [3.2] Create wav encoder to encode wav format
   ```

6. **Playback Pipeline**:
   ```
   [4.0] Create audio pipeline_play for playing
   [4.1] Create mp3 decoder to decode mp3 file
   [4.2] Create resample filter to resample mp3
   ```

### **Success Indicators**
- ✅ No crash/reboot loops
- ✅ All initialization steps complete
- ✅ AEC stream starts processing
- ✅ Audio pipelines linked successfully
- ✅ No I2C timeout errors (if hardware is fixed)
- ✅ No I2S configuration errors

### **Potential Issues to Watch For**

1. **I2C Errors** (if hardware not fixed):
   ```
   I2C timeout
   Failed to detect device
   ```
   **Solution**: Install external pull-up resistors (see HARDWARE_MODIFICATIONS.md)

2. **I2S Errors**:
   ```
   I2S configuration failed
   Invalid pin assignment
   ```
   **Solution**: Verify pin assignments match datasheet

3. **Codec Errors**:
   ```
   Failed to initialize codec
   ES8311 not responding
   ```
   **Solution**: Check I2C connection and power supply

4. **Memory Errors**:
   ```
   Out of memory
   Heap corruption
   ```
   **Solution**: Reduce buffer sizes or optimize memory usage

### **Testing Steps**

1. **Listen for Audio Output**:
   - MP3 playback should start automatically
   - Check if audio is playing through speakers/headphones

2. **Test Recording**:
   - Speak into microphone
   - AEC should process the audio
   - Check for echo cancellation working

3. **Monitor Serial Output**:
   - Watch for any error messages
   - Check memory usage statistics
   - Verify AEC processing is active

### **Expected Log Output**

After successful initialization, you should see:
- AEC stream processing messages
- Audio pipeline running status
- Memory statistics (if enabled)
- No error messages

---

## Troubleshooting

If the device crashes or reboots:
1. Check serial monitor for crash dump
2. Verify power supply is stable
3. Check for hardware issues (I2C pull-ups, connections)
4. Review error messages in serial output

If audio doesn't work:
1. Verify I2S pins are correctly connected
2. Check ES8311 codec initialization
3. Verify sample rate and format settings
4. Check audio pipeline configuration

---

## Success Criteria

✅ **Build**: Project builds successfully  
✅ **Flash**: Firmware flashes without errors  
✅ **Boot**: Device boots and initializes  
✅ **Codec**: ES8311 codec initializes  
✅ **I2S**: I2S streams configured  
✅ **AEC**: AEC pipeline starts  
✅ **Audio**: Audio processing active  

---

**Status**: Ready for testing

