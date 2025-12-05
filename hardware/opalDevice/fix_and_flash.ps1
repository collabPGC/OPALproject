# Comprehensive COM Port Fix and Flash Script
# Automates troubleshooting steps for ESP32-C6 flashing issues
# Usage: .\fix_and_flash.ps1 [COM_PORT] [BAUD_RATE]

param(
    [string]$Port = "COM4",
    [int]$BaudRate = 460800
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ESP32-C6 Fix & Flash" -ForegroundColor Cyan
Write-Host "Port: $Port, Baud: $BaudRate" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set location
Set-Location "G:\Projects\OPALproject\ProjectWork\hardware\opalDevice"

# Check if ESP-IDF is already loaded (check for idf.py command)
Write-Host "Checking ESP-IDF environment..." -ForegroundColor Yellow
$idfLoaded = $false

# Check if idf.py is available (means ESP-IDF is loaded)
try {
    $null = Get-Command idf.py -ErrorAction Stop
    $idfLoaded = $true
    Write-Host "  ESP-IDF environment already loaded" -ForegroundColor Green
} catch {
    Write-Host "  ESP-IDF not loaded, loading now..." -ForegroundColor Yellow
    # Try to load ESP-IDF
    if (Test-Path "C:\Users\huber\esp\v5.5.1\esp-idf\export.ps1") {
        & "C:\Users\huber\esp\v5.5.1\esp-idf\export.ps1"
        # Verify it loaded
        try {
            $null = Get-Command idf.py -ErrorAction Stop
            Write-Host "  ESP-IDF loaded successfully" -ForegroundColor Green
            $idfLoaded = $true
        } catch {
            Write-Host "  WARNING: ESP-IDF may not have loaded correctly" -ForegroundColor Yellow
            Write-Host "  Make sure you're running this in ESP-IDF terminal or run export.ps1 manually" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ERROR: ESP-IDF export.ps1 not found" -ForegroundColor Red
        Write-Host "  Please run this script from ESP-IDF terminal or set up ESP-IDF path" -ForegroundColor Yellow
        exit 1
    }
}

# ========================================================================
# STEP 1: Free the Port
# ========================================================================
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "STEP 1: Freeing COM Port" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

# Kill processes
Write-Host "Killing processes that might lock $Port..." -ForegroundColor Cyan
$processes = @(
    "putty", "teraterm", "teraterm64", "teraterm32",
    "arduino", "code", "platformio", "coolterm",
    "idf_monitor", "monitor", "esptool", "python"
)

$killed = $false
foreach ($proc in $processes) {
    $found = Get-Process -Name $proc -ErrorAction SilentlyContinue
    if ($found) {
        Write-Host "  Killing $proc..." -ForegroundColor Red
        Stop-Process -Name $proc -Force -ErrorAction SilentlyContinue
        $killed = $true
        Start-Sleep -Milliseconds 200
    }
}

if (-not $killed) {
    Write-Host "  No blocking processes found" -ForegroundColor Green
} else {
    Write-Host "  Processes killed. Waiting 2 seconds..." -ForegroundColor Green
    Start-Sleep -Seconds 2
}

Write-Host ""

# Check for Handle.exe
Write-Host "Checking for Handle.exe (Sysinternals)..." -ForegroundColor Cyan
$handlePath = Get-Command handle.exe -ErrorAction SilentlyContinue
if ($handlePath) {
    Write-Host "  Found Handle.exe - checking for handles on $Port..." -ForegroundColor Green
    $handleOutput = & handle.exe -a $Port 2>&1
    if ($handleOutput -match "pid:") {
        Write-Host "  Found processes holding $Port:" -ForegroundColor Yellow
        Write-Host $handleOutput -ForegroundColor White
        Write-Host "  Note: Kill these PIDs manually if needed" -ForegroundColor Yellow
    } else {
        Write-Host "  No handles found on $Port" -ForegroundColor Green
    }
} else {
    Write-Host "  Handle.exe not found (optional tool)" -ForegroundColor Gray
}

Write-Host ""

# Device Manager instructions
Write-Host "Device Manager Steps (manual - cannot automate):" -ForegroundColor Yellow
Write-Host "  1. Open Device Manager (devmgmt.msc)" -ForegroundColor White
Write-Host "  2. Expand 'Ports (COM & LPT)'" -ForegroundColor White
Write-Host "  3. Look for TWO entries:" -ForegroundColor White
Write-Host "     - USB JTAG/Serial (ignore this)" -ForegroundColor Gray
Write-Host "     - USB Serial ($Port) ← USE THIS ONE" -ForegroundColor Green
Write-Host "  4. Right-click $Port → Disable" -ForegroundColor White
Write-Host "  5. Wait 2 seconds" -ForegroundColor White
Write-Host "  6. Right-click $Port → Enable" -ForegroundColor White
Write-Host ""
$continue = Read-Host "Press Enter after completing Device Manager steps (or 's' to skip)"

# Power reminder
Write-Host ""
Write-Host "⚠ POWER CHECK:" -ForegroundColor Red
Write-Host "  - Battery unplugged? (CRITICAL for flashing)" -ForegroundColor Yellow
Write-Host "  - Using short, data-rated USB-C cable?" -ForegroundColor Yellow
Write-Host "  - Connected directly to PC (not hub)?" -ForegroundColor Yellow
Write-Host ""
$continue = Read-Host "Press Enter to continue (or 'q' to quit)"

if ($continue -eq 'q') {
    Write-Host "Exiting..." -ForegroundColor Yellow
    exit 0
}

# ========================================================================
# STEP 2: Verify Chip Connection
# ========================================================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "STEP 2: Verifying Chip Connection" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

Write-Host "Probing chip at conservative speed (115200)..." -ForegroundColor Cyan
Write-Host "Command: esptool.py --chip esp32c6 --port $Port --baud 115200 chip_id" -ForegroundColor Gray
Write-Host ""

$chipVerified = $false
$retryCount = 0
$maxRetries = 3

while (-not $chipVerified -and $retryCount -lt $maxRetries) {
    $retryCount++
    if ($retryCount -gt 1) {
        Write-Host "Retry attempt $retryCount of $maxRetries..." -ForegroundColor Yellow
        Write-Host "  - Check Device Manager: Disable/Enable $Port" -ForegroundColor White
        Write-Host "  - Try manual bootloader: Hold BOOT, tap RST, release BOOT" -ForegroundColor White
        Write-Host ""
        $continue = Read-Host "Press Enter after trying manual bootloader"
    }
    
    esptool.py --chip esp32c6 --port $Port --baud 115200 chip_id
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Chip verified! Connection is good." -ForegroundColor Green
        $chipVerified = $true
    } else {
        Write-Host ""
        Write-Host "✗ Chip verification failed (attempt $retryCount)" -ForegroundColor Red
        
        if ($retryCount -lt $maxRetries) {
            Write-Host ""
            Write-Host "Troubleshooting:" -ForegroundColor Yellow
            Write-Host "  1. Check Device Manager - use USB Serial port (not USB JTAG)" -ForegroundColor White
            Write-Host "  2. Disable/Enable $Port in Device Manager" -ForegroundColor White
            Write-Host "  3. Try manual bootloader entry:" -ForegroundColor White
            Write-Host "     - Hold BOOT button" -ForegroundColor Gray
            Write-Host "     - Tap RST button" -ForegroundColor Gray
            Write-Host "     - Release BOOT when you see 'Connecting...'" -ForegroundColor Gray
            Write-Host ""
        }
    }
}

if (-not $chipVerified) {
    Write-Host ""
    Write-Host "Failed to verify chip after $maxRetries attempts" -ForegroundColor Red
    Write-Host ""
    Write-Host "Manual steps:" -ForegroundColor Yellow
    Write-Host "  1. Check Device Manager screenshot" -ForegroundColor White
    Write-Host "  2. Run: handle.exe -a $Port" -ForegroundColor White
    Write-Host "  3. Try different USB port/cable" -ForegroundColor White
    Write-Host "  4. Check driver installation (CP210x/CH34x)" -ForegroundColor White
    exit 1
}

# ========================================================================
# STEP 3: Flash Firmware
# ========================================================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "STEP 3: Flashing Firmware" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

$flashSuccess = $false

# Try 1: High baud rate
Write-Host "Attempt 1: Flashing at $BaudRate baud..." -ForegroundColor Cyan
Write-Host "Command: idf.py -p $Port -b $BaudRate flash monitor" -ForegroundColor Gray
Write-Host ""

idf.py -p $Port -b $BaudRate flash monitor

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Flash successful at $BaudRate baud!" -ForegroundColor Green
    $flashSuccess = $true
} else {
    Write-Host ""
    Write-Host "✗ Flash failed at $BaudRate baud. Trying fallbacks..." -ForegroundColor Yellow
    Write-Host ""
    
    # Try 2: Lower baud rate
    if ($BaudRate -gt 115200) {
        Write-Host "Attempt 2: Flashing at 115200 baud..." -ForegroundColor Cyan
        Write-Host "Command: idf.py -p $Port -b 115200 flash monitor" -ForegroundColor Gray
        Write-Host ""
        
        idf.py -p $Port -b 115200 flash monitor
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✓ Flash successful at 115200 baud!" -ForegroundColor Green
            $flashSuccess = $true
        } else {
            Write-Host ""
            Write-Host "✗ Flash failed at 115200 baud. Trying no-stub mode..." -ForegroundColor Yellow
            Write-Host ""
        }
    }
    
    # Try 3: No-stub mode
    if (-not $flashSuccess) {
        Write-Host "Attempt 3: Flashing with --no-stub (more tolerant)..." -ForegroundColor Cyan
        Write-Host "Command: idf.py -p $Port -b 115200 flash --no-stub" -ForegroundColor Gray
        Write-Host ""
        
        idf.py -p $Port -b 115200 flash --no-stub
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✓ Flash successful with --no-stub!" -ForegroundColor Green
            Write-Host "Starting monitor..." -ForegroundColor Yellow
            idf.py -p $Port monitor
            $flashSuccess = $true
        } else {
            Write-Host ""
            Write-Host "✗ Flash failed with --no-stub. Manual bootloader needed." -ForegroundColor Red
            Write-Host ""
        }
    }
}

# ========================================================================
# STEP 4: Manual Bootloader Entry (if all else fails)
# ========================================================================
if (-not $flashSuccess) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "STEP 4: Manual Bootloader Entry" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "All automatic methods failed. Use manual bootloader entry:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Button Sequence:" -ForegroundColor Cyan
    Write-Host "  1. Hold BOOT button" -ForegroundColor White
    Write-Host "  2. Tap RST button (press and release)" -ForegroundColor White
    Write-Host "  3. Keep BOOT held until you see 'Connecting...'" -ForegroundColor White
    Write-Host "  4. Release BOOT" -ForegroundColor White
    Write-Host ""
    
    $continue = Read-Host "Press Enter when ready (after manual bootloader entry)"
    
    Write-Host ""
    Write-Host "Flashing with manual bootloader (no_reset)..." -ForegroundColor Cyan
    Write-Host ""
    
    # Build paths
    $bootloader = "build/bootloader/bootloader.bin"
    $app = "build/opalDevice.bin"
    $partition = "build/partition_table/partition-table.bin"
    
    if (-not (Test-Path $bootloader)) {
        Write-Host "ERROR: Bootloader not found at $bootloader" -ForegroundColor Red
        Write-Host "Run 'idf.py build' first" -ForegroundColor Yellow
        exit 1
    }
    
    esptool.py --chip esp32c6 --port $Port --before no_reset --after no_reset write_flash `
        0x0 $bootloader `
        0x10000 $app `
        0x8000 $partition
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Flash successful with manual bootloader!" -ForegroundColor Green
        Write-Host "Starting monitor..." -ForegroundColor Yellow
        idf.py -p $Port monitor
        $flashSuccess = $true
    } else {
        Write-Host ""
        Write-Host "✗ Manual bootloader flash also failed" -ForegroundColor Red
        Write-Host ""
        Write-Host "Last resort - Erase flash first:" -ForegroundColor Yellow
        Write-Host "  idf.py -p $Port erase-flash" -ForegroundColor Cyan
        Write-Host "  idf.py -p $Port flash" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Or check:" -ForegroundColor Yellow
        Write-Host "  - Device Manager screenshot" -ForegroundColor White
        Write-Host "  - handle.exe -a $Port output" -ForegroundColor White
        Write-Host "  - Driver installation (CP210x/CH34x)" -ForegroundColor White
        exit 1
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "SUCCESS! Firmware flashed and running." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

