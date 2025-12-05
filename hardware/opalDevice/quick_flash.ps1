# Quick Flash Helper for ESP32-C6
# Verifies chip connection before flashing
# Usage: .\quick_flash.ps1 [COM_PORT] [BAUD_RATE]
# IMPORTANT: Unplug battery before flashing!

param(
    [string]$Port = "COM4",
    [int]$BaudRate = 460800
)

# Check if battery is mentioned (user reminder)
Write-Host "⚠ REMINDER: Unplug battery before flashing!" -ForegroundColor Yellow
Write-Host "  Battery attached can cause port handle issues" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ESP32-C6 Quick Flash" -ForegroundColor Cyan
Write-Host "Port: $Port, Baud: $BaudRate" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set location
Set-Location "G:\Projects\OPALproject\ProjectWork\hardware\opalDevice"

# Check if ESP-IDF is already loaded
Write-Host "Checking ESP-IDF environment..." -ForegroundColor Yellow
try {
    $null = Get-Command idf.py -ErrorAction Stop
    Write-Host "  ESP-IDF environment already loaded" -ForegroundColor Green
} catch {
    Write-Host "  ESP-IDF not loaded, loading now..." -ForegroundColor Yellow
    if (Test-Path "C:\Users\huber\esp\v5.5.1\esp-idf\export.ps1") {
        & "C:\Users\huber\esp\v5.5.1\esp-idf\export.ps1"
        # Verify
        try {
            $null = Get-Command idf.py -ErrorAction Stop
            Write-Host "  ESP-IDF loaded successfully" -ForegroundColor Green
        } catch {
            Write-Host "  WARNING: Please run this from ESP-IDF terminal" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ERROR: Please run this script from ESP-IDF terminal" -ForegroundColor Red
        exit 1
    }
}

# Step 1: Verify chip connection
Write-Host ""
Write-Host "Step 1: Verifying chip connection..." -ForegroundColor Yellow
Write-Host "Running: esptool.py --chip esp32c6 --port $Port --baud 115200 chip_id" -ForegroundColor Cyan

esptool.py --chip esp32c6 --port $Port --baud 115200 chip_id

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Chip verification failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Check Device Manager - use USB Serial port (not USB JTAG)" -ForegroundColor White
    Write-Host "  2. Close all serial monitors (VS Code, PuTTY, etc.)" -ForegroundColor White
    Write-Host "  3. Try manual bootloader: Hold BOOT, tap RST, release BOOT when 'Connecting...'" -ForegroundColor White
    Write-Host "  4. Try lower baud: .\quick_flash.ps1 -Port $Port -BaudRate 115200" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "Chip verified! Proceeding to flash..." -ForegroundColor Green
Write-Host ""

# Step 2: Flash
Write-Host "Step 2: Flashing firmware..." -ForegroundColor Yellow
Write-Host "Running: idf.py -p $Port -b $BaudRate flash monitor" -ForegroundColor Cyan
Write-Host ""

idf.py -p $Port -b $BaudRate flash monitor

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Flash failed! Trying fallback options..." -ForegroundColor Yellow
    Write-Host ""
    
    # Try lower baud rate
    if ($BaudRate -gt 115200) {
        Write-Host "Fallback 1: Trying lower baud rate (115200)..." -ForegroundColor Yellow
        idf.py -p $Port -b 115200 flash monitor
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Fallback 2: Trying no-stub mode..." -ForegroundColor Yellow
        Write-Host "  (Less fancy but more tolerant of reset issues)" -ForegroundColor Gray
        idf.py -p $Port -b 115200 flash --no-stub
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "Flash successful with --no-stub! Starting monitor..." -ForegroundColor Green
            idf.py -p $Port monitor
        }
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Still failing. Try manual bootloader entry:" -ForegroundColor Red
        Write-Host ""
        Write-Host "Manual Bootloader Sequence:" -ForegroundColor Yellow
        Write-Host "  1. Hold BOOT button" -ForegroundColor White
        Write-Host "  2. Tap RST button (press and release)" -ForegroundColor White
        Write-Host "  3. Keep BOOT held until you see 'Connecting...'" -ForegroundColor White
        Write-Host "  4. Release BOOT" -ForegroundColor White
        Write-Host ""
        Write-Host "Then run:" -ForegroundColor Yellow
        Write-Host "  esptool.py --chip esp32c6 --port $Port --before no_reset --after no_reset write_flash ^" -ForegroundColor Cyan
        Write-Host "    0x0 build/bootloader/bootloader.bin ^" -ForegroundColor Cyan
        Write-Host "    0x10000 build/opalDevice.bin ^" -ForegroundColor Cyan
        Write-Host "    0x8000 build/partition_table/partition-table.bin" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Or erase flash first:" -ForegroundColor Yellow
        Write-Host "  idf.py -p $Port erase-flash" -ForegroundColor Cyan
        Write-Host "  idf.py -p $Port flash" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Check Device Manager - use USB Serial port (not USB JTAG)" -ForegroundColor Yellow
    }
}

