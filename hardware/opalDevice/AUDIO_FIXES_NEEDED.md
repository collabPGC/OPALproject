# Audio System Fixes Needed

## Critical Finding: Factory Firmware vs Pinout Table Discrepancy

### **Factory Firmware** (`ESP-IDF/01_factory/components/esp_bsp/bsp_es8311.c`):
```c
#define I2S_DOUT_PIN     23   // GPIO23 = DOUT (C6 -> ES8311)
#define I2S_DIN_PIN      21   // GPIO21 = DIN (ES8311 -> C6)
```

### **Pinout Table**:
- GPIO21 = I2S_ASDOUT (Audio Serial Data Out / DOUT)
- GPIO23 = I2S_DSDIN (Audio Serial Data In / DIN)

### **Our Current Code**:
```c
#define I2S_DOUT_PIN     GPIO_NUM_21  // Matches pinout table
#define I2S_DIN_PIN      GPIO_NUM_23  // Matches pinout table
```

**ANALYSIS**: 
- Factory firmware has DOUT=23, DIN=21 (SWAPPED from pinout table)
- Our code has DOUT=21, DIN=23 (matches pinout table)
- **We should TRUST the factory firmware** since it's what Waveshare provided and presumably works

**DECISION**: Change our code to match factory firmware (DOUT=23, DIN=21)

---

## Differences Found Between Factory Firmware and Our Code

### 1. I2S Pin Assignments (CRITICAL)

| Pin | Factory Firmware | Our Code | Pinout Table | Action |
|-----|------------------|----------|-------------|--------|
| DOUT | GPIO23 | GPIO21 | GPIO21 | **CHANGE to GPIO23** |
| DIN | GPIO21 | GPIO23 | GPIO23 | **CHANGE to GPIO21** |

**Fix**: Swap DOUT and DIN to match factory firmware

---

### 2. I2C Configuration

#### **Factory Firmware**:
```c
static audio_codec_i2c_cfg_t i2c_cfg = {};
i2c_cfg.addr = ES8311_CODEC_DEFAULT_ADDR;
i2c_cfg.bus_handle = bus_handle;
// No .port field
```

#### **Our Code**:
```c
audio_codec_i2c_cfg_t i2c_cfg = {
    .addr = AUDIO_I2C_ADDR,
    .port = I2C_MASTER_PORT,  // Extra field
    .bus_handle = i2c_bus_handle,
};
```

**Action**: Remove `.port` field (not needed when using `.bus_handle`)

---

### 3. Sample Format Configuration

#### **Factory Firmware**:
```c
esp_codec_dev_sample_info_t fs = {};
fs.sample_rate = 16000;
fs.channel = 1;              // Mono
fs.bits_per_sample = 16;
fs.channel_mask = 0;
fs.mclk_multiple = 0;        // Auto
```

#### **Our Code**:
```c
esp_codec_dev_sample_info_t fs = {
    .sample_rate = AUDIO_SAMPLE_RATE,  // 16000
    .channel = AUDIO_CHANNELS,         // 2 (stereo) - WRONG!
    .bits_per_sample = AUDIO_BIT_WIDTH, // 16
};
// Missing .channel_mask and .mclk_multiple
```

**Issues**:
1. Our code uses `AUDIO_CHANNELS = 2` (stereo), but factory uses `1` (mono)
2. Missing `.channel_mask = 0`
3. Missing `.mclk_multiple = 0`

**Action**: 
- Change `AUDIO_CHANNELS` to `1` (mono) OR keep stereo but verify it works
- Add `.channel_mask = 0`
- Add `.mclk_multiple = 0`

---

### 4. PA Pin Configuration

#### **Factory Firmware**:
```c
es8311_cfg.pa_pin = GPIO_NUM_NC;  // No power amplifier
```

#### **Our Code**:
```c
es8311_cfg.pa_pin = AUDIO_PA_PIN;  // GPIO_NUM_NC (same)
```

**Status**: ✅ Already correct (both use `GPIO_NUM_NC`)

---

### 5. Error Handling

#### **Factory Firmware**:
```c
esp_codec_dev_open(output_dev, &fs);  // No error check
esp_codec_dev_open(input_dev, &fs);   // No error check
```

#### **Our Code**:
```c
ret = esp_codec_dev_open(output_dev, &fs);
if (ret != ESP_OK) {
    ESP_LOGE(TAG, "Failed to open output device: %s", esp_err_to_name(ret));
    return ret;
}
```

**Status**: ✅ Our error handling is better - keep it

---

## Required Fixes

### **Fix 1: Swap I2S DOUT/DIN Pins** (CRITICAL)
```c
// In hardware_config.h
#define I2S_DOUT_PIN     GPIO_NUM_23  // FIXED: Match factory firmware (was GPIO21)
#define I2S_DIN_PIN      GPIO_NUM_21  // FIXED: Match factory firmware (was GPIO23)
```

### **Fix 2: Remove I2C Port Field** (MINOR)
```c
// In audio_system.c
audio_codec_i2c_cfg_t i2c_cfg = {
    .addr = AUDIO_I2C_ADDR,
    // .port = I2C_MASTER_PORT,  // REMOVE - not needed with bus_handle
    .bus_handle = i2c_bus_handle,
};
```

### **Fix 3: Update Sample Format** (IMPORTANT)
```c
// In audio_system.c
esp_codec_dev_sample_info_t fs = {
    .sample_rate = AUDIO_SAMPLE_RATE,
    .channel = 1,              // FIXED: Use 1 (mono) like factory, or keep 2 if stereo works
    .bits_per_sample = AUDIO_BIT_WIDTH,
    .channel_mask = 0,         // ADD THIS
    .mclk_multiple = 0,        // ADD THIS (auto)
};
```

### **Fix 4: Verify Audio Channels** (DECISION NEEDED)
- Option A: Use mono (1 channel) like factory firmware
- Option B: Keep stereo (2 channels) if ES8311 supports it

**Recommendation**: Start with mono (1 channel) to match factory firmware, then test stereo if needed.

---

## Implementation Plan

1. **Fix I2S pins** in `hardware_config.h` (DOUT=23, DIN=21)
2. **Update sample format** in `audio_system.c` (add missing fields, consider mono)
3. **Remove I2C port field** in `audio_system.c` (optional, shouldn't break)
4. **Rebuild and test** audio functionality
5. **If I2C still fails**, it's a hardware issue (pull-up resistors)

---

## Note on Pinout Table Discrepancy

The pinout table says GPIO21=DOUT, GPIO23=DIN, but the factory firmware uses GPIO23=DOUT, GPIO21=DIN. 

**We should trust the factory firmware** since:
- It's what Waveshare provided
- It presumably works on their hardware
- The pinout table might be a general reference, not board-specific

**After fixing**, if audio still doesn't work, the issue is likely:
- I2C communication failure (hardware - missing pull-ups)
- Not the I2S pin assignments

---

**Priority**: Fix I2S pins first (most likely cause of audio issues)

