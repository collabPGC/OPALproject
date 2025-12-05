# Pinout Table Analysis - Waveshare ESP32-C6 Touch LCD 1.69"

## Pinout Table Summary

| GPIO | LCD      | RTC      | CODEC       | IMU      | Other    | Pin_Out |
|------|----------|----------|-------------|----------|----------|---------|
| GPIO0 |          |          |             |          | BAT_ADC  |         |
| GPIO1 | LCD_SCLK |          |             |          |          |         |
| GPIO2 | LCD_MOSI |          |             |          |          |         |
| GPIO3 | LCD_DC   |          |             |          |          |         |
| GPIO4 | LCD_RST  |          |             |          |          |         |
| GPIO5 | LCD_CS   |          |             |          |          |         |
| GPIO6 | LCD_BL   |          |             |          |          |         |
| GPIO7 | TP_SCL   | RTC_SCL  | CODEC_SCL   | IMU_SCL  |          | SCL     |
| GPIO8 | TP_SDA   | RTC_SDA  | CODEC_SDA   | IMU_SDA  |          | SDA     |
| GPIO9 |          |          |             | IMU_INT  | BOOT     | GPIO9   |
| GPIO10|          | RTC_INT  |             |          |          |         |
| GPIO11| TP_INT   |          |             |          |          |         |
| GPIO12|          |          |             |          | USB_N    | USB_N   |
| GPIO13|          |          |             |          | USB_P    | USB_P   |
| GPIO14|          |          |             |          |          |         |
| GPIO15|          |          |             |          | BAT_EN   |         |
| GPIO16|          |          |             |          | ESP_TXD  | ESP_TXD |
| GPIO17|          |          |             |          | ESP_RXD  | ESP_RXD |
| GPIO18|          |          |             |          | PWR_KEY  | GPIO18  |
| GPIO19|          |          | I2S_MCLK    |          |          |         |
| GPIO20|          |          | I2S_SCLK    |          |          |         |
| GPIO21|          |          | I2S_ASDOUT  |          |          |         |
| GPIO22|          |          | I2S_LRCK    |          |          |         |
| GPIO23|          |          | I2S_DSDIN   |          |          |         |

---

## Key Findings

### ✅ **I2C Bus (CONFIRMED CORRECT)**
- **GPIO7 = SCL** (shared by TP, RTC, CODEC, IMU) ✓
- **GPIO8 = SDA** (shared by TP, RTC, CODEC, IMU) ✓
- **Status:** Our firmware configuration matches pinout table

### ✅ **Touch Controller (CST816S)**
- **GPIO7 = TP_SCL** (I2C SCL) ✓
- **GPIO8 = TP_SDA** (I2C SDA) ✓
- **GPIO11 = TP_INT** (Interrupt) ✓
- **TP_RST = Not listed** (confirms GPIO_NUM_NC) ✓
- **Status:** Our firmware configuration matches pinout table

### ❌ **LCD (ST7789V2) - CONFIGURATION IS WRONG!**

**Pinout Table & Factory Firmware:**
- GPIO1 = LCD_SCLK (SPI Clock) ✓
- GPIO2 = LCD_MOSI (SPI Data) ✓
- GPIO3 = LCD_DC (Data/Command) ✓
- GPIO4 = LCD_RST (Reset) ✓
- GPIO5 = LCD_CS (Chip Select) ✓
- GPIO6 = LCD_BL (Backlight) ✓

**Our Current Configuration (WRONG):**
- GPIO1 = LCD_PIN_BL (Backlight) ❌ **Should be GPIO6**
- GPIO2 = LCD_PIN_RST (Reset) ❌ **Should be GPIO4**
- GPIO3 = LCD_PIN_DC (Data/Command) ✓ **CORRECT**
- GPIO4 = LCD_PIN_CS (Chip Select) ❌ **Should be GPIO5**
- GPIO5 = LCD_PIN_SCK (Clock) ❌ **Should be GPIO1**
- GPIO6 = LCD_PIN_MOSI (Data) ❌ **Should be GPIO2**

**Status:** ❌ **OUR LCD PINS ARE INCORRECT!** Factory firmware matches pinout table. If LCD appears to work, it may be failing silently or displaying incorrectly.

### ⚠️ **I2S Audio (MAJOR DISCREPANCY!)**

**Pinout Table Says:**
- GPIO19 = I2S_MCLK (Master Clock)
- GPIO20 = I2S_SCLK (Bit Clock / BCLK)
- GPIO21 = I2S_ASDOUT (Audio Serial Data Out / DOUT)
- GPIO22 = I2S_LRCK (Left/Right Clock / Word Select)
- GPIO23 = I2S_DSDIN (Audio Serial Data In / DIN)

**Our Current Configuration:**
- GPIO20 = I2S_MCK_PIN (Master Clock) ❌ **WRONG - should be GPIO19**
- GPIO18 = I2S_BCK_PIN (Bit Clock) ❌ **WRONG - should be GPIO20**
- GPIO19 = I2S_LRCK_PIN (Word Select) ❌ **WRONG - should be GPIO22**
- GPIO17 = I2S_DOUT_PIN (Data Out) ❌ **WRONG - should be GPIO21**
- GPIO16 = I2S_DIN_PIN (Data In) ❌ **WRONG - should be GPIO23**

**Factory Firmware Uses:**
- GPIO19 = I2S_MCK_PIN ✓
- GPIO20 = I2S_BCK_PIN ✓
- GPIO22 = I2S_LRCK_PIN ✓
- GPIO23 = I2S_DOUT_PIN ✓
- GPIO21 = I2S_DIN_PIN ✓

**Status:** ❌ **OUR I2S PINS ARE INCORRECT!** Factory firmware matches pinout table, but our config is wrong.

### ✅ **RTC (PCF85063)**
- **GPIO7 = RTC_SCL** (I2C SCL) ✓
- **GPIO8 = RTC_SDA** (I2C SDA) ✓
- **GPIO10 = RTC_INT** (Interrupt)
- **Status:** I2C pins correct. RTC_INT not configured (GPIO_NUM_NC) - OK if not needed

### ✅ **IMU (QMI8658)**
- **GPIO7 = IMU_SCL** (I2C SCL) ✓
- **GPIO8 = IMU_SDA** (I2C SDA) ✓
- **GPIO9 = IMU_INT** (Interrupt)
- **Status:** I2C pins correct. IMU_INT not configured (GPIO_NUM_NC) - OK if not needed

### ✅ **Other Pins**
- **GPIO0 = BAT_ADC** (Battery ADC) - Not configured (OK)
- **GPIO9 = BOOT** (Boot button) - Not configured (OK, handled by hardware)
- **GPIO12 = USB_N** (USB negative) - Reserved for USB
- **GPIO13 = USB_P** (USB positive) - Reserved for USB (we correctly avoid this)
- **GPIO14 = Unused** - Available
- **GPIO15 = BAT_EN** (Battery Enable) - Not configured (OK)
- **GPIO16 = ESP_TXD** (UART TX) - Used for I2S_DIN in our config (conflict?)
- **GPIO17 = ESP_RXD** (UART RX) - Used for I2S_DOUT in our config (conflict?)
- **GPIO18 = PWR_KEY** (Power Key) - Used for I2S_BCK in our config (conflict?)

---

## Critical Issues to Fix

### 1. **I2S Pin Configuration is WRONG**

Our current I2S configuration does NOT match the pinout table or factory firmware.

**Required Changes:**
```c
// Current (WRONG):
#define I2S_MCK_PIN             GPIO_NUM_20  // Should be GPIO19
#define I2S_BCK_PIN             GPIO_NUM_18  // Should be GPIO20
#define I2S_LRCK_PIN            GPIO_NUM_19  // Should be GPIO22
#define I2S_DOUT_PIN            GPIO_NUM_17  // Should be GPIO21
#define I2S_DIN_PIN             GPIO_NUM_16   // Should be GPIO23

// Correct (per pinout table and factory firmware):
#define I2S_MCK_PIN             GPIO_NUM_19  // I2S_MCLK
#define I2S_BCK_PIN             GPIO_NUM_20  // I2S_SCLK
#define I2S_LRCK_PIN            GPIO_NUM_22  // I2S_LRCK
#define I2S_DOUT_PIN            GPIO_NUM_21  // I2S_ASDOUT
#define I2S_DIN_PIN             GPIO_NUM_23  // I2S_DSDIN
```

### 2. **Potential Pin Conflicts**

- **GPIO16 (ESP_TXD)**: We're using for I2S_DIN, but pinout says it's UART TX
- **GPIO17 (ESP_RXD)**: We're using for I2S_DOUT, but pinout says it's UART RX
- **GPIO18 (PWR_KEY)**: We're using for I2S_BCK, but pinout says it's Power Key

**Note:** These may not be actual conflicts if:
- UART is not used (USB Serial/JTAG is used instead)
- Power key is not needed
- But we should verify these don't interfere

---

## Verified Correct Configurations

### ✅ I2C Configuration
```c
#define I2C_MASTER_SDA_GPIO     GPIO_NUM_8   // ✓ CORRECT
#define I2C_MASTER_SCL_GPIO     GPIO_NUM_7   // ✓ CORRECT
```

### ✅ Touch Configuration
```c
#define TOUCH_INT_GPIO          GPIO_NUM_11  // ✓ CORRECT
#define TOUCH_RST_GPIO          GPIO_NUM_NC  // ✓ CORRECT (not connected)
```

### ❌ LCD Configuration (WRONG)
```c
// Current (WRONG):
#define LCD_PIN_BL              GPIO_NUM_1   // ❌ Should be GPIO6
#define LCD_PIN_RST             GPIO_NUM_2   // ❌ Should be GPIO4
#define LCD_PIN_DC              GPIO_NUM_3   // ✓ CORRECT
#define LCD_PIN_CS              GPIO_NUM_4   // ❌ Should be GPIO5
#define LCD_PIN_SCK             GPIO_NUM_5   // ❌ Should be GPIO1
#define LCD_PIN_MOSI            GPIO_NUM_6   // ❌ Should be GPIO2

// Correct (per pinout table and factory firmware):
#define LCD_PIN_SCK             GPIO_NUM_1   // LCD_SCLK
#define LCD_PIN_MOSI            GPIO_NUM_2   // LCD_MOSI
#define LCD_PIN_DC              GPIO_NUM_3   // LCD_DC
#define LCD_PIN_RST             GPIO_NUM_4   // LCD_RST
#define LCD_PIN_CS              GPIO_NUM_5   // LCD_CS
#define LCD_PIN_BL              GPIO_NUM_6   // LCD_BL
```

---

## Summary of Required Fixes

### **HIGH PRIORITY - I2S Pins (Audio won't work without this)**
1. Change I2S_MCK_PIN from GPIO20 → GPIO19
2. Change I2S_BCK_PIN from GPIO18 → GPIO20
3. Change I2S_LRCK_PIN from GPIO19 → GPIO22
4. Change I2S_DOUT_PIN from GPIO17 → GPIO21
5. Change I2S_DIN_PIN from GPIO16 → GPIO23

### **HIGH PRIORITY - LCD Pins (Display won't work correctly)**
1. Change LCD_PIN_BL from GPIO1 → GPIO6
2. Change LCD_PIN_RST from GPIO2 → GPIO4
3. Change LCD_PIN_DC from GPIO3 → GPIO3 (already correct)
4. Change LCD_PIN_CS from GPIO4 → GPIO5
5. Change LCD_PIN_SCK from GPIO5 → GPIO1
6. Change LCD_PIN_MOSI from GPIO6 → GPIO2

### **MEDIUM PRIORITY - Optional Pins**
- RTC_INT on GPIO10 (if RTC interrupt needed)
- IMU_INT on GPIO9 (if IMU interrupt needed)
- BAT_EN on GPIO15 (if battery management needed)
- PWR_KEY on GPIO18 (if power button needed)

---

## Action Items

1. ✅ **I2C pins are correct** - No changes needed
2. ❌ **Fix I2S pin configuration** - Update hardware_config.h
3. ❌ **Fix LCD pin configuration** - Update hardware_config.h
4. ⚠️ **Verify LCD is working** - If LCD works, maybe pinout table is wrong?
5. ⚠️ **Verify I2S is working** - If audio works, maybe pinout table is wrong?

**Note:** If LCD is currently working, the pinout table might be incorrect or refer to a different board revision. Verify against actual hardware behavior.

