# ESP-ADF Project Selection Guide

## Available ESP-ADF Example Categories

### 1. **get-started/** - Simple Examples (Good for Testing)
- Basic audio playback examples
- Good for initial testing
- Usually simpler configuration

### 2. **player/** - Audio Playback
- Various audio playback examples
- MP3, WAV, HTTP streaming
- Good for testing speaker output

### 3. **recorder/** - Audio Recording
- Audio recording examples
- Good for testing microphone input
- May include file saving

### 4. **advanced_examples/** - Complex Examples
- Full-duplex audio
- VoIP examples
- More complex audio pipelines

---

## Recommended Projects for Our Hardware

### **Option 1: Simple Playback (Best for Initial Test)**
**Location**: `examples/get-started/play_mp3` or similar
- **Pros**: Simple, tests basic audio output
- **Cons**: May need file system or network
- **Use Case**: Test ES8311 speaker output

### **Option 2: Full-Duplex Audio (Best for VoIP Prep)**
**Location**: `examples/advanced_examples/pipeline_duplex_app`
- **Pros**: Tests both mic and speaker, similar to VoIP needs
- **Cons**: More complex
- **Use Case**: Test complete audio system, prepare for VoIP

### **Option 3: Recorder (Test Microphone)**
**Location**: `examples/recorder/` (various)
- **Pros**: Tests microphone input
- **Cons**: May need file system
- **Use Case**: Test ES8311 microphone input

### **Option 4: VoIP Example (Ultimate Goal)**
**Location**: `examples/advanced_examples/voip` or `examples/voip/sip`
- **Pros**: Complete VoIP implementation
- **Cons**: Most complex, may need SIP server
- **Use Case**: Full VoIP functionality

---

## Selection Criteria

1. **Hardware Compatibility**: Must work with ES8311 codec
2. **Complexity**: Start simple, then move to complex
3. **Goal**: Test audio system vs. Extract VoIP code
4. **Dependencies**: File system, network, etc.

---

## Next Steps

1. **List available examples** in each category
2. **Check which ones use ES8311** (our codec)
3. **Select one** based on your goal
4. **Adapt pinout** to match our hardware_config.h

---

**Status**: Exploring ESP-ADF examples to find best match for our hardware

