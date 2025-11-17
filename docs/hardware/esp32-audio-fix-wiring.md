# ESP32-S3 Waveshare Audio Fix - Complete Wiring Guide

## Overview
This document provides detailed wiring instructions to fix the NS4150B amplifier on the Waveshare ESP32-S3-LCD-1.28 board.

## Problem Statement
The NS4150B amplifier chip requires proper control signals on its CTRL (Pin 1) and Bypass (Pin 2) pins. Without these connections, the amplifier remains in shutdown mode, preventing audio output despite receiving I2S signals.

## Required Materials

### Components
- **2× 10kΩ resistors** (1/4W through-hole OR 0603 SMD)
  - Purpose: Pull-up/pull-down resistors for amplifier control
  - Tolerance: 5% or better
  - Power rating: 1/4W minimum

- **30-36 AWG wire** (magnet wire or wire-wrap wire)
  - Length needed: ~6 inches total
  - Type: Insulated magnet wire (preferred) or Kynar wire-wrap wire

- **Optional: 2× 100nF ceramic capacitors** (0603 SMD)
  - Purpose: Filter noise on control lines
  - Voltage rating: 16V minimum

### Tools
- Soldering iron with fine tip (0.5mm or smaller recommended)
- Solder (60/40 or lead-free)
- Multimeter for continuity testing
- Magnifying glass or microscope (helpful for SMD work)
- Flux pen (recommended)
- Desoldering wick or solder sucker (for corrections)
- Wire strippers (for 30-36 AWG)
- Tweezers (for holding small components)

## NS4150B Pinout Reference

```
NS4150B (TSSOP-8 Package) - Top View
     ┌─────────┐
CTRL │1      8│ VDD
 BYP │2      7│ GND
OUTN │3      6│ OUTP
 INN │4      5│ INP
     └─────────┘
```

### Pin Functions
- **Pin 1 (CTRL)**: Shutdown control
  - HIGH (3.3V): Amplifier enabled
  - LOW (GND): Amplifier in shutdown mode

- **Pin 2 (BYP)**: Bypass mode control
  - HIGH (3.3V): Bypass mode (direct coupling)
  - LOW (GND): Normal mode with internal coupling capacitors

- **Pin 3 (OUTN)**: Negative speaker output
- **Pin 4 (INN)**: Negative I2S audio input (from ESP32)
- **Pin 5 (INP)**: Positive I2S audio input (from ESP32)
- **Pin 6 (OUTP)**: Positive speaker output
- **Pin 7 (GND)**: Ground
- **Pin 8 (VDD)**: Power supply (3.3V from ESP32)

## Wiring Diagram - Method 1: GPIO Control (Recommended)

This method uses ESP32 GPIO pins for software-controlled amplifier enable/disable.

```
ESP32-S3 Connections:
┌──────────────────────────────────────────────────────┐
│                                                      │
│  GPIO 48 (Available) ────[10kΩ]──── NS4150B Pin 1  │
│                                      (CTRL Enable)  │
│                                                      │
│  GPIO 47 (Available) ────[10kΩ]──── NS4150B Pin 2  │
│                                      (BYP Control)  │
│                                                      │
│  Optional: Add 100nF caps to GND on each pin        │
│                                                      │
└──────────────────────────────────────────────────────┘

Pin Configuration:
  GPIO 48 → CTRL:   Set HIGH to enable amplifier
  GPIO 47 → BYP:    Set LOW for normal mode
                    Set HIGH for bypass mode
```

### Step-by-Step Wiring (GPIO Method)

#### Step 1: Identify NS4150B Location
1. Locate the NS4150B chip on the back of the Waveshare board
2. It's a small 8-pin TSSOP package near the speaker connector
3. Use multimeter to verify Pin 8 (VDD) has 3.3V when powered on
4. Verify Pin 7 (GND) is connected to ground

#### Step 2: Identify Available GPIO Pins
1. **GPIO 48** - Available on pin header (Row 1, Pin 10)
2. **GPIO 47** - Available on pin header (Row 1, Pin 9)
3. Verify these pins are not used in your current configuration

#### Step 3: Solder CTRL Connection (Pin 1)
```
Connection Path:
GPIO 48 Pin Header → 10kΩ Resistor → NS4150B Pin 1 (CTRL)

Detailed Steps:
1. Cut 3-inch length of 30 AWG wire
2. Strip 2mm from each end
3. Tin both ends with solder
4. Solder one resistor lead to GPIO 48 pin header
5. Solder wire to other resistor lead
6. Carefully solder wire to NS4150B Pin 1 (use flux!)
   - Apply flux to pin
   - Tin the pin lightly
   - Touch wire to pin while applying heat
   - Remove iron, let cool for 3 seconds
7. Test continuity: GPIO 48 header → NS4150B Pin 1 (should read ~10kΩ)
```

#### Step 4: Solder BYP Connection (Pin 2)
```
For Normal Mode (Recommended):
NS4150B Pin 2 (BYP) → 10kΩ Resistor → GND

Detailed Steps:
1. Cut 3-inch length of 30 AWG wire
2. Strip and tin ends
3. Solder one resistor lead to NS4150B Pin 2
4. Solder wire to other resistor lead
5. Solder wire end to nearby GND point (Pin 7 of NS4150B or any GND pad)
6. Test continuity: Pin 2 → GND (should read ~10kΩ)

For GPIO-Controlled Bypass (Advanced):
GPIO 47 Pin Header → 10kΩ Resistor → NS4150B Pin 2 (BYP)
(Follow same steps as CTRL connection)
```

#### Step 5: Optional Noise Filtering
```
Add 100nF capacitors for cleaner signals:

CTRL Line Filter:
  NS4150B Pin 1 → [100nF capacitor] → GND

BYP Line Filter:
  NS4150B Pin 2 → [100nF capacitor] → GND

Placement:
  - Solder capacitors as close to NS4150B pins as possible
  - Ensures high-frequency noise doesn't trigger false states
```

## Wiring Diagram - Method 2: Simple Hardware Enable

This is the quickest fix - no GPIO control, amplifier always enabled.

```
Hardwired Connections:
┌──────────────────────────────────────────────────────┐
│                                                      │
│  3.3V Rail ──────[10kΩ]──── NS4150B Pin 1 (CTRL)   │
│                              ↳ Amplifier ENABLED    │
│                                                      │
│  GND Rail ───────[10kΩ]──── NS4150B Pin 2 (BYP)    │
│                              ↳ Normal Mode          │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Step-by-Step Wiring (Hardware Method)

#### Step 1: Enable Amplifier (CTRL → 3.3V)
```
1. Identify 3.3V source:
   - NS4150B Pin 8 (VDD) is already connected to 3.3V
   - OR any 3.3V pin on the pin headers

2. Solder 10kΩ resistor:
   - One lead to 3.3V source
   - Other lead to NS4150B Pin 1 (CTRL)

3. Test with multimeter:
   - Measure voltage at Pin 1: Should read 3.3V
   - If lower (e.g., 1.6V), check for shorts
```

#### Step 2: Set Normal Mode (BYP → GND)
```
1. Identify GND source:
   - NS4150B Pin 7 (GND)
   - OR any GND pin on pin headers

2. Solder 10kΩ resistor:
   - One lead to GND
   - Other lead to NS4150B Pin 2 (BYP)

3. Test with multimeter:
   - Measure voltage at Pin 2: Should read 0V
   - Continuity test to GND: Should read ~10kΩ
```

## Comparison: GPIO vs Hardware Method

| Feature | GPIO Control (Method 1) | Hardware Enable (Method 2) |
|---------|------------------------|---------------------------|
| **Complexity** | Moderate | Simple |
| **Wire Count** | 2-4 wires + resistors | 2 wires + resistors |
| **Software Control** | Yes - enable/disable in code | No - always on |
| **Power Saving** | Yes - can shutdown amp | No - always powered |
| **Flexibility** | High | Low |
| **Debug Ease** | Can toggle in software | Requires hardware changes |
| **Best For** | Production devices | Quick testing |
| **Time to Complete** | 20-30 minutes | 10-15 minutes |

**Recommendation for OPAL Project:** Use **Method 1 (GPIO Control)** for:
- Power management in nurse wearable devices
- Software-controlled mute functionality
- Better integration with sleep modes
- Diagnostic capabilities (can test amp enable/disable)

## Verification Procedure

### Test 1: Visual Inspection
```
✓ Check all solder joints are shiny and smooth (not cold/cracked)
✓ Verify no solder bridges between adjacent NS4150B pins
✓ Confirm resistors are securely soldered
✓ Check wire insulation is not melted/damaged
```

### Test 2: Continuity Testing (Power OFF)
```
Using Multimeter in Continuity/Resistance Mode:

1. CTRL Line (Pin 1):
   - Method 1: GPIO 48 header to Pin 1 = ~10kΩ
   - Method 2: 3.3V source to Pin 1 = ~10kΩ

2. BYP Line (Pin 2):
   - GND to Pin 2 = ~10kΩ

3. No shorts:
   - Pin 1 to Pin 2 = Open circuit (OL)
   - Pin 1 to GND = High resistance (>100kΩ for Method 2, OL for Method 1)
```

### Test 3: Voltage Testing (Power ON)
```
Using Multimeter in DC Voltage Mode:

1. Power on the ESP32-S3 board

2. CTRL Pin (Pin 1):
   - Method 1: Should read 3.3V (if GPIO 48 set HIGH in code)
                Should read 0V (if GPIO 48 set LOW)
   - Method 2: Should read 3.3V (always)

3. BYP Pin (Pin 2):
   - Should read 0V (normal mode)

4. VDD Pin (Pin 8):
   - Should read 3.3V

5. GND Pin (Pin 7):
   - Should read 0V
```

### Test 4: Audio Output Test
```
1. Load the example audio test code (see software section below)

2. Method 1 GPIO Control:
   - Set GPIO 48 HIGH
   - Set GPIO 47 LOW
   - Run I2S audio test (sine wave or WAV file)

3. Method 2 Hardware:
   - Run I2S audio test immediately

4. Expected Results:
   ✓ Clear audio from speaker (no distortion)
   ✓ No clicking or popping (except on first enable)
   ✓ Volume adjustable via ES8311 codec
   ✓ No audio when amplifier disabled (Method 1 with GPIO LOW)

5. If still no audio:
   - Check ES8311 codec I2S configuration
   - Verify I2S data is reaching NS4150B pins 4 & 5
   - Check speaker connection
   - Review software configuration (next section)
```

## Troubleshooting Guide

### Problem: Still No Audio After Wiring

**Possible Causes:**
1. **Software not configured**
   - Solution: Add GPIO initialization code (see next document)
   ```c
   gpio_set_direction(GPIO_NUM_48, GPIO_MODE_OUTPUT);
   gpio_set_level(GPIO_NUM_48, 1);  // Enable amplifier
   ```

2. **Cold solder joint**
   - Solution: Reheat joint with fresh flux until solder flows smoothly

3. **Wrong pin identified**
   - Solution: Use datasheet pin numbering, verify with multimeter

4. **Resistor value too high**
   - Solution: Verify 10kΩ (not 10MΩ or 100kΩ)

### Problem: Distorted Audio

**Possible Causes:**
1. **Bypass mode enabled incorrectly**
   - Solution: Ensure Pin 2 (BYP) is connected to GND, not floating

2. **Insufficient power supply**
   - Solution: Check 3.3V rail can provide 300mA+ for speaker

3. **I2S data issues**
   - Solution: Check ES8311 codec configuration (next document)

### Problem: Audio Works Then Stops

**Possible Causes:**
1. **Thermal shutdown**
   - Solution: NS4150B overheating - check speaker impedance (should be 8Ω)

2. **Loose connection**
   - Solution: Re-solder weak joints

3. **Power supply brownout**
   - Solution: Add 100µF capacitor near NS4150B VDD pin

### Problem: Clicking/Popping Sounds

**Possible Causes:**
1. **No pop suppression**
   - Solution: Add 100nF capacitors on CTRL/BYP lines

2. **Amplifier enabling too fast**
   - Solution: In software, ramp up volume after enable delay
   ```c
   gpio_set_level(GPIO_NUM_48, 1);  // Enable
   vTaskDelay(pdMS_TO_TICKS(50));   // Wait 50ms
   es8311_set_volume(target_volume); // Then set volume
   ```

## Advanced Configuration

### Software-Controlled Mute Function
```c
// Fast mute without stopping I2S
void audio_mute(bool mute) {
    if (mute) {
        gpio_set_level(GPIO_NUM_48, 0);  // Disable amp (instant mute)
    } else {
        gpio_set_level(GPIO_NUM_48, 1);  // Enable amp
        vTaskDelay(pdMS_TO_TICKS(10));   // Anti-pop delay
    }
}
```

### Power-Saving Mode
```c
// Sleep mode for nurse wearable device
void audio_sleep_mode(void) {
    // Disable amplifier to save power
    gpio_set_level(GPIO_NUM_48, 0);  // ~50mA savings

    // Optional: Put ES8311 codec in low-power mode
    es8311_suspend();
}

void audio_wake_mode(void) {
    // Wake codec first
    es8311_resume();
    vTaskDelay(pdMS_TO_TICKS(10));

    // Then enable amplifier
    gpio_set_level(GPIO_NUM_48, 1);
    vTaskDelay(pdMS_TO_TICKS(50));  // Ensure stable startup
}
```

## Healthcare-Specific Considerations

### For OPAL Wearable Devices

1. **Power Efficiency**
   - Use GPIO control method for power savings
   - Disable amplifier when not in active call
   - Expected battery life improvement: 15-20%

2. **Audio Quality Requirements**
   - NS4150B provides sufficient quality for voice calls
   - Use normal mode (BYP = LOW) for best voice clarity
   - Class-D amplifier minimizes electromagnetic interference (important near medical equipment)

3. **Regulatory Compliance**
   - NS4150B is CE/FCC certified
   - Low EMI helps with hospital equipment compatibility
   - No special shielding required for typical use

4. **Reliability**
   - Add noise filtering capacitors (100nF) for hospital RF environment
   - Use hardware pulldown on CTRL if software crashes (prevents unwanted audio)
   - Consider adding ferrite bead on speaker wires if interference occurs

## Bill of Materials (BOM)

### Minimal Fix (Hardware Method)
| Part | Quantity | Specs | Cost (USD) | Supplier |
|------|----------|-------|------------|----------|
| 10kΩ Resistor | 2 | 1/4W, 5% | $0.10 | Mouser/Digikey |
| 30 AWG Wire | 6" | Magnet wire | $0.50 | Any electronics |
| **Total** | | | **$0.60** | |

### Complete Fix (GPIO Method with Filtering)
| Part | Quantity | Specs | Cost (USD) | Supplier |
|------|----------|-------|------------|----------|
| 10kΩ Resistor | 2 | 0603 SMD, 1% | $0.20 | Mouser #71-CRCW0603-10K-E3 |
| 100nF Capacitor | 2 | 0603 SMD, 16V | $0.30 | Mouser #80-C0603C104K4R |
| 30 AWG Wire | 12" | Magnet wire | $1.00 | Mouser #485-5092 |
| **Total** | | | **$1.50** | |

## Next Steps

After completing the hardware fix, proceed to:

1. **Software Configuration** (next document)
   - GPIO initialization code
   - ES8311 codec setup
   - I2S bus configuration
   - Audio test examples

2. **RTP/SIP Integration** (subsequent documents)
   - Real-time audio streaming
   - HIPAA-compliant encryption
   - Hospital VoIP system integration

## References

- NS4150B Datasheet: [Nuvoton NS4150B](https://www.nuvoton.com/products/smart-home-audio/audio-amplifiers/ns4150b/)
- ESP32-S3 Technical Reference: [ESP32-S3 TRM](https://www.espressif.com/sites/default/files/documentation/esp32-s3_technical_reference_manual_en.pdf)
- Waveshare ESP32-S3-LCD-1.28 Wiki: [Waveshare Wiki](https://www.waveshare.com/wiki/ESP32-S3-LCD-1.28)

## Document Version
- **Version:** 1.0
- **Date:** 2025-11-17
- **Author:** OPAL Project Team
- **Status:** Production Ready
