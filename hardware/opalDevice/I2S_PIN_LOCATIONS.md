# I2S Pin Physical Locations - ESP32-C6 OPAL Device

## I2S GPIO Assignments

| Signal | GPIO | Function | Direction |
|--------|------|----------|-----------|
| I2S_MCLK | GPIO19 | Master Clock | Output |
| I2S_SCLK | GPIO20 | Bit Clock (BCLK) | Output |
| I2S_LRCK | GPIO22 | Left/Right Clock (Word Select) | Output |
| I2S_ASDOUT | GPIO21 | Audio Serial Data Out | Output (to ES8311) |
| I2S_DSDIN | GPIO23 | Data Serial Data In | Input (from ES8311) |

## Finding Physical Pin Locations

To find which physical pins on the ESP32-C6 correspond to these GPIO numbers:

1. **Check the ESP32-C6 Datasheet:**
   - Look for the "Pin Definitions" section
   - Find the GPIO number (e.g., GPIO19) in the table
   - The table will show the physical pin number (e.g., Pin 19, Pin 20, etc.)

2. **Check the Waveshare Board Documentation:**
   - The Waveshare ESP32-C6-Touch-LCD-1.69 board may have a pinout diagram
   - Look for labels on the board itself
   - Check the schematic PDF if available

3. **Physical Pin Numbering:**
   - ESP32-C6 chips typically have pins numbered starting from 1
   - GPIO numbers (like GPIO19) are logical, not physical pin numbers
   - You need to cross-reference GPIO numbers to physical pin numbers in the datasheet

## Important Notes

- **GPIO21 (I2S_ASDOUT)** is the most critical for audio output - this carries the audio data to the ES8311 codec
- **GPIO19 (I2S_MCLK)** provides the master clock signal
- **GPIO20 (I2S_SCLK)** provides the bit clock for data synchronization
- **GPIO22 (I2S_LRCK)** provides the word select (left/right channel) clock

## Testing I2S Output

To verify I2S is working, you can use an oscilloscope or logic analyzer on:
- **GPIO21 (I2S_ASDOUT)** - Should show serial data when audio is playing
- **GPIO20 (I2S_SCLK)** - Should show a clock signal (typically 16kHz * 32 = 512kHz for 16-bit audio)
- **GPIO19 (I2S_MCLK)** - Should show master clock (typically 256 * sample rate = 4.096MHz for 16kHz)

## Reference

- ESP32-C6 Datasheet: Check Espressif's official documentation
- Waveshare Wiki: https://www.waveshare.com/wiki/ESP32-C6-Touch-LCD-1.69

