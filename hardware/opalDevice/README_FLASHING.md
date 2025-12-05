# ESP32-C6 Flashing Guide

## Quick Start

### Current Port: COM4

**⚠ IMPORTANT: Run scripts from ESP-IDF terminal!**

The scripts will detect if ESP-IDF is already loaded, or try to load it automatically.

**Fastest way to flash + monitor:**
```powershell
idf.py -p COM4 -b 460800 flash monitor
```

**If that fails, try lower baud:**
```powershell
idf.py -p COM4 -b 115200 flash monitor
```

## Helper Scripts

### 1. Fix & Flash (Recommended - Most Comprehensive)
```powershell
# Run from ESP-IDF terminal
.\fix_and_flash.ps1
```
- **Automates all troubleshooting steps**
- Detects if ESP-IDF is already loaded (works in ESP-IDF terminal)
- Kills blocking processes
- Checks Handle.exe for port locks
- Verifies chip connection (with retries)
- Flashes with automatic fallbacks:
  - High baud → Low baud → No-stub → Manual bootloader
- Guides through Device Manager steps
- **Best for persistent COM port issues**

### 2. Quick Flash (Simple)
```powershell
# Run from ESP-IDF terminal
.\quick_flash.ps1
```
- Detects if ESP-IDF is already loaded
- Verifies chip connection first
- Flashes and monitors automatically
- Falls back to lower baud if needed
- **Use when port is already working**

### 3. Quick Fix (Port Only - No Flash)
```powershell
# Run from ESP-IDF terminal
.\quick_fix.ps1
```
- Detects if ESP-IDF is already loaded
- Just fixes port issues
- Kills processes, checks handles
- Tests port accessibility
- **Use before flashing if port is busy**

### 4. Verify Chip First
```powershell
# Run from ESP-IDF terminal
.\verify_chip.ps1
```
- Detects if ESP-IDF is already loaded
- Checks if chip is reachable before flashing
- Helps diagnose connection issues

### 5. Unlock COM Port
```powershell
.\unlock_com_port.ps1
```
- Kills processes that might lock COM4
- Lists available ports
- Shows Device Manager instructions

## Troubleshooting

### COM Port Issues - "Port is busy or doesn't exist"

**99% fix rate with these steps:**

#### 1) Free the Port

**Close everything that might hold COM4:**
- VS Code Serial/Monitor
- Arduino IDE
- PuTTY/TeraTerm
- Another `idf.py monitor` session
- PlatformIO
- Any other serial terminal

**Run unlock script:**
```powershell
.\unlock_com_port.ps1
```

**Device Manager steps:**
1. Open Device Manager (`devmgmt.msc`)
2. Expand **Ports (COM & LPT)**
3. You may see **TWO entries**:
   - `USB JTAG/Serial` ← **IGNORE THIS**
   - `USB Serial (COM4)` ← **USE THIS ONE**
4. Right-click COM4 → **Disable**
5. Wait 2 seconds
6. Right-click COM4 → **Enable** (releases stale handles)

**Optional - Use Handle.exe (Sysinternals):**
```powershell
# Download from: https://learn.microsoft.com/en-us/sysinternals/downloads/handle
handle.exe -a COM4
# Kill any PIDs that show a handle on COM4
```

#### 2) Simplify Power During Flashing

⚠ **CRITICAL: Unplug battery while flashing!**

- Battery attached can cause port handle issues
- Board stays powered during USB resets → Windows loses port
- Use **USB-only power** during flash
- Use **short, data-rated USB-C cable** directly to PC (avoid hubs)

#### 3) Probe the Link, Then Flash

**Try these in order (stop at first that works):**

**Step 1: Sanity probe at conservative speed**
```powershell
esptool.py --chip esp32c6 --port COM4 --baud 115200 chip_id
```
If this prints a chip ID, proceed to flash.

**Step 2: Flash at 115200**
```powershell
idf.py -p COM4 -b 115200 flash monitor
```

**Step 3: If still "busy", try no-stub mode**
```powershell
idf.py -p COM4 -b 115200 flash --no-stub
```
Less fancy but more tolerant of reset issues.

**Step 4: Manual bootloader entry (if auto-reset fails)**
```powershell
# Start flashing but don't reset automatically
esptool.py --chip esp32c6 --port COM4 --before no_reset --after no_reset write_flash ^
  0x0 build/bootloader/bootloader.bin ^
  0x10000 build/opalDevice.bin ^
  0x8000 build/partition_table/partition-table.bin
```

**Button sequence:**
1. Hold **BOOT** button
2. Tap **RST** button (press and release)
3. Keep **BOOT** held until esptool prints "Connecting..."
4. Release **BOOT**

This is most reliable if USB bridge doesn't wiggle DTR/RTS correctly.

#### 4) Driver Sanity

**If using CP210x or CH34x/CH9102:**
- (Re)install latest Windows driver from Silicon Labs / WCH

**If using native USB-CDC (no bridge chip):**
```powershell
esptool.py --chip esp32c6 --port COM4 --before usb_reset chip_id
```

#### 5) Baud + Cable Fallbacks

- Keep baud at **115200** for flashing (can monitor faster later)
- Swap cable if anything seems intermittent
- Try different USB port (avoid hubs)

#### 6) Last Resort - Erase Flash

If nothing else works:
```powershell
idf.py -p COM4 erase-flash
idf.py -p COM4 flash
```

### Flash Hangs

**Problem:** Flasher stub hangs or times out

**Solutions:**
1. Try no-stub mode:
   ```powershell
   idf.py -p COM4 -b 115200 flash --no-stub
   ```

2. Erase flash first:
   ```powershell
   idf.py -p COM4 erase-flash
   idf.py -p COM4 flash
   ```

3. Manual bootloader entry:
   - Hold **BOOT** button
   - Tap **RST** button (press and release)
   - Keep **BOOT** pressed until you see "Connecting..."
   - Release **BOOT**

### Verify Chip Connection

Before flashing, verify the chip is reachable:
```powershell
esptool.py --chip esp32c6 --port COM4 --baud 115200 chip_id
```

Should show chip ID if connection is good.

## Power Supply Testing

After successful flash, test I²C with different power sources:

1. **USB-only** (battery unplugged):
   ```powershell
   idf.py -p COM4 monitor
   ```
   Watch I²C scan results

2. **Battery-only** (USB unplugged):
   Repeat monitor and watch scan results

**If scans behave differently:**
- Power path/enable sequencing may be the issue
- Check if I²C pull-ups go to VBAT (~4.2V) instead of 3.3V
- Verify SDA/SCL idle at ~3.3V (not ~4.2V) with multimeter

## Hardware Verification Checklist

After flashing, verify with multimeter:

**Power & Pull-ups:**
- [ ] SDA/SCL idle ≈ **3.3V** (not ~4.2V → would mean pull-ups to VBAT)
- [ ] If pull-ups are to VBAT, peripherals will be unhappy and ESP pads at risk

**Enable/Reset Signals:**
- [ ] Touch RST = HIGH after init (at chip pin, not just MCU GPIO)
- [ ] Codec CE/EN = ACTIVE level at chip pin (not just at MCU GPIO)
- [ ] Verify continuity through FETs/jumpers if schematic routes through them

**I²C Continuity:**
- [ ] GPIO8 → CST816S TP_SDA continuity
- [ ] GPIO9 → CST816S TP_SCL continuity
- [ ] GPIO8 → ES8311 CODEC_SDA continuity
- [ ] GPIO9 → ES8311 CODEC_SCL continuity
- [ ] GPIO21 → ES8311 pin 20 (CE) continuity

**Power Domain Check:**
- [ ] Flash with battery removed, then check SDA/SCL idle at ~3.3V
- [ ] Reset/enable sequencing: Verify signals reach chip pins, not just MCU pads

## Port Changes

If Windows assigns a different COM port after replugging:

1. Check Device Manager for new port number
2. Update scripts or use port parameter:
   ```powershell
   .\quick_flash.ps1 -Port COM5
   ```

Or update default in scripts (currently COM4).

## If COM4 Still Claims It's Busy

Send these diagnostics:

1. **Screenshot of Device Manager's Ports list**
2. **Output of Handle.exe:**
   ```powershell
   handle.exe -a COM4
   ```
3. **Result of chip_id probe:**
   ```powershell
   esptool.py --chip esp32c6 --port COM4 --baud 115200 chip_id
   ```

This will help zero in on the exact issue.

