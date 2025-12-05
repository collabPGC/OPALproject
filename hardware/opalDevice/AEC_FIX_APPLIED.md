# AEC Sample Rate Fix - Applied

## Problem
The AEC library only supports 16kHz sample rate, but the I2S stream was configured for 8kHz, causing a crash:

```
E (1026) AEC: Only support 16K sample rate
Guru Meditation Error: Core 0 panic'ed (Load access fault)
```

## Fix Applied

**File**: `esp-adf-temp/examples/advanced_examples/aec/main/aec_examples.c`

**Change**:
- Line 35: Changed `I2S_SAMPLE_RATE` from `8000` to `16000`

**Impact**:
- I2S streams (playback and recording) now use 16kHz
- ES8311 codec will be configured for 16kHz
- Resample filter already configured correctly (src=16kHz, dest=I2S_SAMPLE_RATE)
- AEC library will receive 16kHz audio as required

## Next Steps

1. Rebuild the project
2. Flash to device
3. Test - AEC should initialize successfully

---

**Status**: ✅ Fix applied, ready to rebuild and test

