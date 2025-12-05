# Waveshare ESP32-C6-Touch-LCD-1.69 Documentation

## Official Resources

### Wiki Page
**URL:** https://www.waveshare.com/wiki/ESP32-C6-Touch-LCD-1.69

This page includes:
- Pinout definitions
- Hardware description
- Schematic diagrams
- Example code
- Firmware downloads

### Datasheet
**URL:** https://files.waveshare.com/wiki/ESP32-C6-LCD-1.47/ESP32-C6_Series_Datasheet.pdf

## Factory Firmware GPIO Configuration

From `ESP-IDF/01_factory/components/esp_bsp/`:

### I2C Pins
- **SDA:** GPIO 8 (`EXAMPLE_PIN_I2C_SDA`)
- **SCL:** GPIO 7 (`EXAMPLE_PIN_I2C_SCL`)

### I2S Audio Pins (ES8311)
- **MCLK:** GPIO 19 (`I2S_MCK_PIN`)
- **BCLK:** GPIO 20 (`I2S_BCK_PIN`)
- **LRCK:** GPIO 22 (`I2S_LRCK_PIN`)
- **DOUT:** GPIO 23 (`I2S_DOUT_PIN`)
- **DIN:** GPIO 21 (`I2S_DIN_PIN`)

**Note:** The factory firmware uses `audio_codec_new_gpio()` which handles the Codec CE pin internally through the ESP codec driver. It does NOT manually configure a GPIO for CE.

### SPI LCD Pins (ST7789V2)
- **MOSI:** GPIO 2 (`EXAMPLE_PIN_MOSI`)
- **SCLK:** GPIO 1 (`EXAMPLE_PIN_SCLK`)
- **CS:** GPIO 5 (`EXAMPLE_PIN_LCD_CS`)
- **DC:** GPIO 3 (`EXAMPLE_PIN_LCD_DC`)
- **RST:** GPIO 4 (`EXAMPLE_PIN_LCD_RST`)
- **Backlight:** GPIO 6 (`EXAMPLE_PIN_LCD_BL`)

### Touch Controller (CST816S)
- **INT:** GPIO 11 (`EXAMPLE_PIN_TP_INT`)
- **RST:** GPIO_NUM_NC (`EXAMPLE_PIN_TP_RST` - not connected)

### Power Management
- **Power Key:** GPIO 18 (`PWR_KEY_PIN`)
- **Battery Enable:** GPIO 15 (`BAT_EN_PIN`)

## Critical Finding: GPIO13 Issue

**Problem:** GPIO13 is reserved for USB-JTAG functionality on ESP32-C6 and **cannot be used as a regular GPIO**.

**Evidence:**
- Device crashes immediately when trying to configure GPIO13
- ESP-IDF documentation confirms GPIO13 is USB-JTAG
- Factory firmware does NOT use GPIO13 for Codec CE

## Codec CE Pin Status

**Current Status:** UNKNOWN - Need to check schematic PDF

**Temporary Fix:** Changed to GPIO10 for testing

**Next Steps:**
1. Check schematic PDF: `ESP32-C6-Touch-LCD-1.69-Schematic.pdf`
2. Find ES8311 pin 20 (Codec_CE) → Which GPIO does it connect to?
3. Update `main/hardware_config.h` with correct GPIO
4. Test GPIO10, GPIO11, or GPIO12 if schematic unavailable

## Available GPIOs for Codec CE

Based on current pin usage:
- ✅ GPIO10 - Available (currently set as test)
- ✅ GPIO11 - Used for Touch INT (but could check if shareable)
- ✅ GPIO12 - Available
- ❌ GPIO13 - USB-JTAG (cannot use)
- ❌ GPIO8 - I2C SDA
- ❌ GPIO9 - I2C SCL (per our config, but factory uses GPIO7)
- ❌ GPIO1-6 - LCD/SPI pins
- ❌ GPIO7 - I2C SCL (factory)
- ❌ GPIO15 - Battery Enable
- ❌ GPIO18 - Power Key
- ❌ GPIO19-23 - I2S pins

## Recommendation

1. **Check the schematic PDF** to find the exact GPIO for Codec_CE
2. **If schematic unavailable**, test GPIO10, GPIO11, GPIO12 systematically
3. **Verify** by checking if ES8311 responds on I2C when CE is HIGH

