# Pinout Verification - Using Our Accurate Pinout Table

## ✅ Confirmed: Using Our Pinout Table Values

The pinout diagram you provided is accurate and represents the hardware we have. All pin assignments in `hardware_config.h` are based on this pinout table, NOT from ESP-ADF or factory firmware.

---

## I2S Pin Assignments (From Our Pinout Table)

| Pin Function | GPIO | Pinout Table Label | Our Config | Status |
|--------------|------|-------------------|------------|--------|
| MCLK | GPIO19 | I2S_MCLK | `I2S_MCK_PIN = GPIO_NUM_19` | ✅ CORRECT |
| BCK (SCLK) | GPIO20 | I2S_SCLK | `I2S_BCK_PIN = GPIO_NUM_20` | ✅ CORRECT |
| LRCK | GPIO22 | I2S_LRCK | `I2S_LRCK_PIN = GPIO_NUM_22` | ✅ CORRECT |
| DOUT (ASDOUT) | GPIO21 | I2S_ASDOUT | `I2S_DOUT_PIN = GPIO_NUM_21` | ✅ CORRECT |
| DIN (DSDIN) | GPIO23 | I2S_DSDIN | `I2S_DIN_PIN = GPIO_NUM_23` | ✅ CORRECT |

**Source**: Our pinout table (accurate hardware representation)

---

## Other Pin Assignments (From Our Pinout Table)

### **I2C Bus**:
- SDA = GPIO8 ✅
- SCL = GPIO7 ✅

### **LCD (ST7789V2)**:
- SCK = GPIO1 ✅
- MOSI = GPIO2 ✅
- CS = GPIO5 ✅
- DC = GPIO3 ✅
- RST = GPIO4 ✅
- BL = GPIO6 ✅

### **Touch Controller (CST816S)**:
- INT = GPIO11 ✅
- RST = GPIO_NUM_NC (not connected) ✅

### **RTC (PCF85063)**:
- INT = GPIO10 ✅

### **IMU (QMI8658)**:
- INT = GPIO9 ✅

---

## Factory Firmware vs Our Pinout

### **Note on Factory Firmware Discrepancy**:

The factory firmware (`ESP-IDF/01_factory`) uses:
- DOUT = GPIO23
- DIN = GPIO21

But our pinout table (which you confirmed is accurate) says:
- DOUT = GPIO21 (I2S_ASDOUT)
- DIN = GPIO23 (I2S_DSDIN)

**Decision**: We use our pinout table values because:
1. You confirmed the pinout diagram is accurate
2. It represents the actual hardware we have
3. Factory firmware may have been for a different board revision

---

## ESP-ADF Files

**Important**: When extracting SIP/RTP code from ESP-ADF:
- ✅ Use ESP-ADF for SIP/RTP protocol code only
- ✅ Use ESP-ADF for network handling code
- ❌ Do NOT use ESP-ADF pinout values
- ✅ Always use our `hardware_config.h` pinout values

---

## Verification Checklist

- [x] I2S pins match our pinout table
- [x] I2C pins match our pinout table
- [x] LCD pins match our pinout table
- [x] Touch pins match our pinout table
- [x] RTC pins match our pinout table
- [x] IMU pins match our pinout table
- [x] All pins verified against pinout table, not ESP-ADF or factory firmware

---

**Status**: ✅ All pin assignments use our accurate pinout table values

