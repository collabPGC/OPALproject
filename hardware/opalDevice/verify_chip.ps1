# Quick chip verification script
# Usage: .\verify_chip.ps1 [COM_PORT]

param(
    [string]$Port = "COM4"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ESP32-C6 Chip Verification" -ForegroundColor Cyan
Write-Host "Port: $Port" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set location
Set-Location "G:\Projects\OPALproject\ProjectWork\hardware\opalDevice"

# Check if ESP-IDF is already loaded
Write-Host "Checking ESP-IDF environment..." -ForegroundColor Yellow
try {
    $null = Get-Command esptool.py -ErrorAction Stop
    Write-Host "  ESP-IDF environment already loaded" -ForegroundColor Green
} catch {
    Write-Host "  ESP-IDF not loaded, loading now..." -ForegroundColor Yellow
    if (Test-Path "C:\Users\huber\esp\v5.5.1\esp-idf\export.ps1") {
        & "C:\Users\huber\esp\v5.5.1\esp-idf\export.ps1"
    } else {
        Write-Host "  ERROR: Please run this from ESP-IDF terminal" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Verifying chip connection..." -ForegroundColor Yellow
Write-Host "Command: esptool.py --chip esp32c6 --port $Port --baud 115200 chip_id" -ForegroundColor Cyan
Write-Host ""

esptool.py --chip esp32c6 --port $Port --baud 115200 chip_id

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Chip verified! Ready to flash." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next step: .\quick_flash.ps1 -Port $Port" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "✗ Chip verification failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Check:" -ForegroundColor Yellow
    Write-Host "  1. Device Manager → Ports → Use USB Serial (not USB JTAG)" -ForegroundColor White
    Write-Host "  2. Close all serial monitors" -ForegroundColor White
    Write-Host "  3. Try manual bootloader: Hold BOOT, tap RST, release BOOT" -ForegroundColor White
    Write-Host "  4. Check if port changed: Get-PnpDevice -Class Ports" -ForegroundColor White
}

