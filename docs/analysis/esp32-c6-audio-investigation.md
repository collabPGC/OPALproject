ESP32-C6 Touch LCD 1.69" Audio System Investigation Report
Executive Summary
Date: November 2025
Board: Waveshare ESP32-C6-Touch-LCD-1.69
Issue: No audio output - only clicking sound
Root Cause: NS4150B amplifier control pins floating (hardware design flaw)
Hardware Architecture
Audio Signal Path
ES8311 Codec → NS4150B Amplifier → Speaker
    ↓              ↓
  I2S Data    Control Pins
   (Working)   (FLOATING!)
Component Analysis
ES8311 Audio Codec (Working ✅)

Status: Properly configured and functional
I2C Communication: Working at address 0x18
I2S Interface: Data transmitting correctly
Output Pins:

OUTP (Pin 12) → 100nF → 150K → NS4150B IN+
OUTN (Pin 13) → 100nF → 150K → NS4150B IN-



NS4150B Class-D Amplifier (Not Working ❌)

Issue: Control pins are floating/unconnected
Pin 1 (CTRL): No connection - Should be HIGH to enable
Pin 2 (Bypass): No connection - Should be LOW for normal operation
Result: Amplifier in undefined state, producing only power-on click

Problem Details
Symptoms

Single click sound when powered on
No audio output despite:

Codec properly configured
I2S data transmitting (800+ buffers)
Volume at 100%
DAC enabled and unmuted



Root Cause Analysis
The NS4150B amplifier control pins are completely floating in the schematic:

No GPIO connections
No pull-up/pull-down resistors
No test points provided
Apparent design oversight

Why Only a Click?
When power is applied, the floating control pins momentarily pick up charge (causing the click), then settle to an undefined state that disables the amplifier.
Solutions
Solution 1: Hardware Modification (Immediate Fix)
Add external pull resistors to force proper logic levels:
NS4150B Pin 1 (CTRL) → 10KΩ → 3.3V (Enable amplifier)
NS4150B Pin 2 (Bypass) → 10KΩ → GND (Normal operation)
Implementation:

Use 30-36 AWG magnet wire
Solder directly to NS4150B pins (likely MSOP-8 package)
Add 10KΩ resistors to appropriate rails

Solution 2: GPIO Control (Permanent Fix)

Find two unused GPIOs on ESP32-C6
Solder wires from GPIOs to NS4150B control pins
Control amplifier in software:

cpp#define PA_CTRL_PIN    GPIO_NUM_XX  // Choose free GPIO
#define PA_BYPASS_PIN  GPIO_NUM_XX  // Choose free GPIO

void init_amplifier() {
    gpio_config_t io_conf = {};
    io_conf.pin_bit_mask = (1ULL << PA_CTRL_PIN) | (1ULL << PA_BYPASS_PIN);
    io_conf.mode = GPIO_MODE_OUTPUT;
    io_conf.pull_up_en = GPIO_PULLUP_DISABLE;
    io_conf.pull_down_en = GPIO_PULLDOWN_DISABLE;
    gpio_config(&io_conf);

    gpio_set_level(PA_CTRL_PIN, 1);    // Enable amplifier
    gpio_set_level(PA_BYPASS_PIN, 0);  // Normal operation
}
Solution 3: Alternative Hardware
Recommended Alternative Boards
Direct Replacements (ESP32 + Audio + Display)
1. ESP32-S3-BOX-3 (Espressif Official) ⭐⭐⭐⭐⭐

Price: ~$45
Audio: ES8311 + DPA17211 (properly wired!)
Display: 2.4" capacitive touch
Why Better: Same codec, working amplifier control

2. M5Stack CoreS3

Price: ~$65
Audio: AW88298 amplifier with proper control
Display: 2.0" capacitive touch
Why Better: Everything integrated and tested

3. LILYGO T-Display-S3 Pro

Price: ~$35
Audio: MAX98357A (auto-enable)
Display: 2.33" IPS touch
Why Better: Modern design, proven audio

Modular Solutions
4. Seeed XIAO ESP32-C6 + Modules

Price: $5 + $15 display + $10 audio
Why: Same C6 chip, modular approach ensures working audio
Components:

XIAO ESP32-C6 base
Round Display for XIAO
Grove Speaker module



5. Adafruit Feather ESP32-S3 + Wings

Price: ~$20 + $8 audio + display
Why: Well-documented, reliable modules
Components:

ESP32-S3 Feather
MAX98357 or UDA1334A audio wing
TFT FeatherWing



Key Selection Criteria for Alternatives
Must Have:

✅ Amplifier enable pins connected to GPIOs
✅ Documented audio signal path
✅ Working example code
✅ Proper analog/digital power separation

Nice to Have:

Speaker included or specified
Integrated IMU/RTC like original
Similar form factor
WiFi 6 support (for C6 variants)

Verification Checklist
Before Hardware Modification:

 Measure NS4150B Pin 1 & 2 voltages
 Check for unpopulated resistor pads
 Look for solder jumpers on PCB bottom
 Verify speaker connection continuity

After Modification:

 NS4150B Pin 1 = 3.3V (enabled)
 NS4150B Pin 2 = 0V (not bypassed)
 Audio output verified with tone generator
 No excessive current draw

Test Code
cpp// Simple tone generator to verify audio after fix
#include "driver/i2s.h"
#include <math.h>

#define SAMPLE_RATE 48000
#define FREQUENCY   440  // A4 note

void generate_tone() {
    int16_t samples[256];

    for(int i = 0; i < 256; i++) {
        float sample = sin(2.0 * M_PI * FREQUENCY * i / SAMPLE_RATE);
        samples[i] = (int16_t)(sample * 32767);
    }

    size_t bytes_written;
    while(1) {
        i2s_write(I2S_NUM_0, samples, sizeof(samples),
                  &bytes_written, portMAX_DELAY);
    }
}
Lessons Learned
Design Review Points:

Always verify amplifier control pins are properly connected
Check for floating pins in audio signal path
Ensure test points for critical signals
Review reference designs from chip manufacturers

Red Flags in Schematics:

Unconnected amplifier control pins
Missing pull-up/pull-down resistors
No GPIO assignments for enable signals
Lack of test points for debugging

Conclusion
The Waveshare ESP32-C6-Touch-LCD-1.69 board has a fundamental design flaw where the NS4150B amplifier control pins are left floating. This renders the audio system non-functional despite the codec being properly configured.
Immediate Action: Add pull resistors to NS4150B control pins
Long-term Solution: Consider alternative hardware with properly designed audio systems
References
Datasheets:

ES8311 Low Power Audio Codec
NS4150B Class-D Audio Amplifier
ESP32-C6 Series Datasheet

Related Documentation:

ESP32-C6-Touch-LCD-1.69 Schematic
I2S Driver Documentation
ESP-IDF Audio Framework
