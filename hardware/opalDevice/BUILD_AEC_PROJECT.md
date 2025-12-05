# Building ESP-ADF AEC Project for OPAL Device

## Project Overview

**Selected Project**: `aec` (Acoustic Echo Cancellation)
**Location**: `esp-adf-temp/examples/advanced_examples/aec`

**What It Does**:
- Plays MP3 file from flash
- Records audio from microphone
- Performs Acoustic Echo Cancellation (AEC)
- Saves recorded audio to SD card (we'll adapt this)

---

## Setup Steps

### Step 1: Set Environment Variables

ESP-ADF requires `ADF_PATH` environment variable:

```bash
# In PowerShell
$env:ADF_PATH = "G:\Projects\OPALproject\ProjectWork\hardware\opalDevice\esp-adf-temp"
$env:IDF_PATH = "C:\Users\huber\esp\v5.5.1\esp-idf"
```

### Step 2: Navigate to AEC Project

```bash
cd esp-adf-temp\examples\advanced_examples\aec
```

### Step 3: Configure for ESP32-C6

```bash
idf.py set-target esp32c6
```

### Step 4: Configure Project (menuconfig)

```bash
idf.py menuconfig
```

**Key Settings to Change**:
1. **Audio Board**: Select or configure for ES8311
2. **I2S Pins**: Update to match our pinout:
   - MCLK = GPIO19
   - BCK = GPIO20
   - LRCK = GPIO22
   - DOUT = GPIO21
   - DIN = GPIO23
3. **I2C Pins**: Update to match our pinout:
   - SDA = GPIO8
   - SCL = GPIO7
4. **SD Card**: Disable or adapt (we may not have SD card)

### Step 5: Build

```bash
idf.py build
```

### Step 6: Flash and Monitor

```bash
idf.py -p COM4 flash monitor
```

---

## Required Adaptations

### 1. **Update Pinout Configuration**
- I2S pins to match our `hardware_config.h`
- I2C pins to match our `hardware_config.h`

### 2. **Update Codec Configuration**
- Change from default board codec to ES8311
- Update codec initialization code

### 3. **Remove/Adapt SD Card Dependency**
- AEC example saves to SD card
- Options:
  - Remove file saving (just test AEC)
  - Save to flash instead
  - Use our MQTT system to stream

### 4. **ESP32-C6 Compatibility**
- Check if ESP-ADF fully supports ESP32-C6
- May need to adapt some components

---

## Next Steps

1. **Examine source code** to understand structure
2. **Create adapted version** with our pinout
3. **Remove SD card dependency** (or adapt)
4. **Build and test**

---

**Status**: Setting up AEC project for our hardware

