# Audio System Comparison: Factory Firmware vs Our Code

## Critical Finding: I2S Pin Assignment Error!

### **Factory Firmware (`ESP-IDF/01_factory/components/esp_bsp/bsp_es8311.c`)**:
```c
#define I2S_DOUT_PIN     23   // Audio Serial Data Out (C6 -> ES8311 speaker)
#define I2S_DIN_PIN      21   // Audio Serial Data In (ES8311 -> C6 mic)
```

### **Our Current Code (`main/hardware_config.h`)**:
```c
#define I2S_DOUT_PIN     GPIO_NUM_21  // WRONG! Should be GPIO23
#define I2S_DIN_PIN      GPIO_NUM_23  // WRONG! Should be GPIO21
```

**STATUS**: ❌ **I2S DOUT and DIN pins are SWAPPED!**

This explains why audio isn't working - the microphone and speaker data lines are reversed!

---

## Detailed Comparison

### 1. I2S Pin Assignments

| Pin | Factory Firmware | Our Code | Status |
|-----|------------------|----------|--------|
| MCLK | GPIO19 | GPIO19 | ✅ CORRECT |
| BCK (SCLK) | GPIO20 | GPIO20 | ✅ CORRECT |
| LRCK | GPIO22 | GPIO22 | ✅ CORRECT |
| DOUT (ASDOUT) | GPIO23 | GPIO21 | ❌ **SWAPPED** |
| DIN (DSDIN) | GPIO21 | GPIO23 | ❌ **SWAPPED** |

**Fix Required**: Swap DOUT and DIN in `hardware_config.h`

---

### 2. I2C Configuration

#### **Factory Firmware**:
```c
static audio_codec_i2c_cfg_t i2c_cfg = {};
i2c_cfg.addr = ES8311_CODEC_DEFAULT_ADDR;
i2c_cfg.bus_handle = bus_handle;
// NOTE: No .port field set
```

#### **Our Code**:
```c
audio_codec_i2c_cfg_t i2c_cfg = {
    .addr = AUDIO_I2C_ADDR,
    .port = I2C_MASTER_PORT,  // Extra field - may not be needed
    .bus_handle = i2c_bus_handle,
};
```

**Analysis**: The `.port` field might not be needed when using `.bus_handle`. However, this shouldn't cause issues if the field is ignored.

---

### 3. PA Pin Configuration

#### **Factory Firmware**:
```c
es8311_cfg.pa_pin = GPIO_NUM_NC;  // No power amplifier pin
```

#### **Our Code**:
```c
es8311_cfg.pa_pin = AUDIO_PA_PIN;  // Uses AUDIO_PA_PIN from hardware_config.h
```

**Analysis**: Need to check what `AUDIO_PA_PIN` is set to. If it's `GPIO_NUM_NC`, they're the same. If it's a real GPIO, we might need to verify it's correct.

---

### 4. Error Handling

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
// ... similar for input_dev
```

**Analysis**: Our error handling is better, but the factory firmware might work because it assumes success.

---

### 5. Sample Format Configuration

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
    .sample_rate = AUDIO_SAMPLE_RATE,  // Should be 16000
    .channel = AUDIO_CHANNELS,         // Should be 1
    .bits_per_sample = AUDIO_BIT_WIDTH, // Should be 16
};
// NOTE: Missing .channel_mask and .mclk_multiple
```

**Analysis**: Our code might be missing some fields. Need to check `AUDIO_SAMPLE_RATE`, `AUDIO_CHANNELS`, and `AUDIO_BIT_WIDTH` definitions.

---

### 6. I2S Configuration Details

#### **Factory Firmware**:
```c
std_cfg.slot_cfg.data_bit_width = 16;  // Direct value
std_cfg.slot_cfg.slot_mode = I2S_SLOT_MODE_STEREO;  // Stereo mode
```

#### **Our Code**:
```c
.slot_cfg = {
    .data_bit_width = I2S_DATA_BIT_WIDTH_16BIT,  // Enum value
    .slot_mode = I2S_SLOT_MODE_STEREO,           // Same
    // ... more fields
}
```

**Analysis**: Both should work, but factory uses direct value `16` while we use enum `I2S_DATA_BIT_WIDTH_16BIT`.

---

## Critical Issues to Fix

### **1. I2S DOUT/DIN Pin Swap** (CRITICAL)
- **Problem**: DOUT and DIN are swapped
- **Impact**: Microphone and speaker data lines are reversed
- **Fix**: Swap `I2S_DOUT_PIN` and `I2S_DIN_PIN` in `hardware_config.h`

### **2. Missing Sample Format Fields** (POTENTIAL)
- **Problem**: Missing `.channel_mask` and `.mclk_multiple` in sample info
- **Impact**: May cause codec configuration issues
- **Fix**: Add these fields to match factory firmware

### **3. PA Pin Configuration** (VERIFY)
- **Problem**: Need to verify `AUDIO_PA_PIN` is correct
- **Impact**: Power amplifier might not be enabled
- **Fix**: Check if `AUDIO_PA_PIN` should be `GPIO_NUM_NC` or a real GPIO

---

## Recommended Fixes

1. **Fix I2S Pin Swap** (HIGH PRIORITY):
   ```c
   // In hardware_config.h
   #define I2S_DOUT_PIN     GPIO_NUM_23  // FIXED: Was GPIO21
   #define I2S_DIN_PIN      GPIO_NUM_21  // FIXED: Was GPIO23
   ```

2. **Update Sample Format** (MEDIUM PRIORITY):
   ```c
   esp_codec_dev_sample_info_t fs = {
       .sample_rate = AUDIO_SAMPLE_RATE,
       .channel = AUDIO_CHANNELS,
       .bits_per_sample = AUDIO_BIT_WIDTH,
       .channel_mask = 0,        // ADD THIS
       .mclk_multiple = 0,       // ADD THIS (auto)
   };
   ```

3. **Verify PA Pin** (LOW PRIORITY):
   - Check if `AUDIO_PA_PIN` is defined correctly
   - If no external PA, set to `GPIO_NUM_NC`

---

## Next Steps

1. **Fix I2S pin swap** in `hardware_config.h`
2. **Rebuild and test** audio functionality
3. **If still not working**, check I2C communication (hardware issue - pull-up resistors)
4. **Extract SIP/RTP code** from ESP-ADF for VoIP implementation

---

**The I2S pin swap is likely the main reason audio isn't working!**

