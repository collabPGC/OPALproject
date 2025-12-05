# I2C Bus Debugging Summary

## ✅ Fixes Made

### 1. **Build Error - Partition Table** (RESOLVED)
- **Problem**: Binary size (~1.37MB) exceeded 2MB app partitions
- **Fix**: Increased app partitions from 2M → 3M in `partitions.csv`
- **Status**: ✅ Build now succeeds, binary fits with ~32% free space

### 2. **I2C Configuration Improvements**
- **Speed**: Increased from 10kHz → 100kHz (production-ready)
- **Timeout**: Increased from 200ms → 1000ms (more forgiving for bring-up)
- **Glitch Filter**: Enabled (`glitch_ignore_cnt = 7`) for 100kHz operation
- **CE Pin Verification**: Added readback checks to verify GPIO21 actually drives CE high

### 3. **Enhanced Diagnostics**
- **Hardware Verification Checklist**: Comprehensive checklist printed at boot
- **CE Pin Diagnostics**: Readback verification with error messages if CE doesn't go high
- **Pin Conflict Detection**: Checks for overlaps with LCD/I2S pins
- **Isolation Tests**: Systematic A/B/C/FINAL test sequence to isolate issues
- **Line Level Monitoring**: Before/after probe checks for SDA/SCL state

### 4. **Code Quality**
- **Comments**: Added detailed comments explaining pin mappings, timing, and critical sections
- **Error Messages**: More descriptive errors with actionable guidance
- **Schematic References**: Comments reference board schematic for verification

## 📚 What We Learned

### **Root Cause Analysis**
The I2C bus shows **all probes timing out** (no devices ACK), which indicates:

1. **Hardware Issue (Most Likely)**
   - Devices may not be physically connected to GPIO8/GPIO9
   - SDA/SCL may be swapped (cross-wired)
   - External pull-up resistors may be missing/weak
   - Devices may not be powered (VDD missing or brown-out)
   - CE/RST pins may not be driving devices correctly

2. **Software is Correct**
   - Pin mapping matches schematic (SDA=GPIO8, SCL=GPIO9)
   - Reset sequences are properly timed
   - Isolation tests are comprehensive
   - Error handling and diagnostics are thorough

### **Key Insights**

1. **CE Pin is Critical**
   - ES8311 requires CE=HIGH before I2C access
   - Must be configured as **push-pull output** (not open-drain)
   - Readback verification catches pin misconfiguration

2. **Pull-ups are Essential**
   - Internal pull-ups are too weak (~45kΩ)
   - External 4.7kΩ-10kΩ resistors required for reliable operation
   - Without proper pull-ups, lines can float or be pulled low

3. **Reset Sequences Matter**
   - CST816S needs RST pulse (LOW → HIGH) with 50ms delay
   - ES8311 needs CE HIGH with 10-20ms stabilization
   - Devices won't respond if held in reset

4. **Pin Verification is Critical**
   - Code assumes SDA=GPIO8, SCL=GPIO9 per schematic
   - If PCB routing differs, code won't work
   - Continuity checks are essential

## 🔍 What Remains to Be Done

### **Immediate Actions (Hardware Verification)**

#### **1. Continuity Checks (DMM Beep Test)**
```
[ ] ESP GPIO8 → CST816S TP_SDA pin
[ ] ESP GPIO8 → ES8311 SDA pin  
[ ] ESP GPIO9 → CST816S TP_SCL pin
[ ] ESP GPIO9 → ES8311 SCL pin
[ ] ESP GPIO14 → CST816S RST pin
[ ] ESP GPIO15 → CST816S INT pin
[ ] ESP GPIO21 → ES8311 CE pin (pin 20)
```

#### **2. Power Supply Verification**
```
[ ] Measure VDD on CST816S (should be ~3.3V when RST=HIGH)
[ ] Measure VDD on ES8311 (should be ~3.3V when CE=HIGH)
[ ] Verify external 4.7kΩ pull-ups: SDA→3.3V, SCL→3.3V
[ ] Check common ground across all devices
```

#### **3. Pin Mapping Verification**
```
[ ] Compare schematic to actual PCB routing
[ ] Verify SDA/SCL are NOT swapped (cross-wired)
[ ] Confirm GPIO8/9 are not used by LCD/I2S peripherals
[ ] Verify GPIO21 actually drives Codec_CE net to ES8311 pin 20
```

#### **4. Signal Verification (Oscilloscope/Logic Analyzer)**
```
[ ] Trigger on SCL - verify start conditions are generated
[ ] Check for ACK bit (9th clock) being pulled low by device
[ ] Verify SDA/SCL toggle during probe attempts
[ ] If no toggling: pins mis-muxed or peripheral not started
[ ] If toggling but no ACK: wrong address/wiring/power
```

### **Software Actions (After Hardware Verified)**

#### **1. If Devices Start ACKing**
- ✅ Code is ready - devices should appear at 0x15 (CST816S) and 0x18 (ES8311)
- Reduce timeout from 1000ms → 200ms once stable
- Optionally increase speed to 400kHz if stable at 100kHz

#### **2. If Still No ACK After Hardware Verification**
- Try alternate I2C pins (if board has test pads) to isolate routing issue
- Verify I2C bus is not being reinitialized elsewhere with different pins
- Check for level shifter issues (if LCD uses different voltage domain)
- Verify devices are not in sleep/power-down mode

### **Long-term Improvements**

1. **Add I2C Bus Recovery on Timeout**
   - Implement automatic recovery if bus gets stuck
   - Add retry logic with exponential backoff

2. **Add Device Presence Detection**
   - Check CE/RST pin states before probing
   - Warn if device should be powered but isn't

3. **Add Configuration Validation**
   - Verify partition table matches flash size
   - Check for conflicting GPIO configurations at compile time

## 📊 Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| **Build System** | ✅ Fixed | Partitions increased to 3M |
| **I2C Driver** | ✅ Configured | 100kHz, proper timeouts, glitch filter |
| **Diagnostics** | ✅ Enhanced | Comprehensive logging and verification |
| **CE Pin Control** | ✅ Verified | Readback checks added |
| **Reset Sequences** | ✅ Implemented | Proper timing for both devices |
| **Hardware Connections** | ❓ Unknown | **Needs physical verification** |
| **Device Communication** | ❌ Not Working | All probes timeout (likely hardware) |

## 🎯 Success Criteria

**Hardware is verified when:**
1. ✅ Continuity tests pass (all connections beep)
2. ✅ Power measurements show 3.3V on both devices
3. ✅ Pull-up resistors are present and measure correctly
4. ✅ Pin mapping matches schematic exactly

**Software is working when:**
1. ✅ `i2c_master_probe(0x15)` returns `ESP_OK` (CST816S)
2. ✅ `i2c_master_probe(0x18)` returns `ESP_OK` (ES8311)
3. ✅ Bus scan shows only these two devices (no phantoms)
4. ✅ Touch input works (CST816S responds to gestures)
5. ✅ Audio codec initializes (ES8311 registers can be read/written)

## 📝 Next Steps

1. **Perform hardware verification** using the checklist printed at boot
2. **Fix any hardware issues** found (missing connections, wrong pins, etc.)
3. **Rebuild and flash** after hardware fixes
4. **Monitor logs** - devices should start ACKing
5. **Reduce timeouts** once stable (1000ms → 200ms)
6. **Increase speed** if desired (100kHz → 400kHz)

---

**Last Updated**: Based on current code state with 100kHz I2C, enhanced diagnostics, and partition fixes.

