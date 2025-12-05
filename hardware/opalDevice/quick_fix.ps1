# Quick COM Port Fix (without flashing)
# Just fixes the port issues, doesn't flash
# Usage: .\quick_fix.ps1 [COM_PORT]

param(
    [string]$Port = "COM4"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Quick COM Port Fix" -ForegroundColor Cyan
Write-Host "Port: $Port" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Kill processes
Write-Host "Killing blocking processes..." -ForegroundColor Yellow
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
    }
}

if ($killed) {
    Write-Host "  Processes killed. Waiting 2 seconds..." -ForegroundColor Green
    Start-Sleep -Seconds 2
} else {
    Write-Host "  No blocking processes found" -ForegroundColor Green
}

Write-Host ""

# Check Handle.exe
$handlePath = Get-Command handle.exe -ErrorAction SilentlyContinue
if ($handlePath) {
    Write-Host "Checking for handles on $Port..." -ForegroundColor Yellow
    $handleOutput = & handle.exe -a $Port 2>&1
    if ($handleOutput -match "pid:") {
        Write-Host "  Found processes holding $Port:" -ForegroundColor Yellow
        Write-Host $handleOutput -ForegroundColor White
    } else {
        Write-Host "  No handles found" -ForegroundColor Green
    }
} else {
    Write-Host "Handle.exe not found (optional)" -ForegroundColor Gray
}

Write-Host ""

# Device Manager instructions
Write-Host "Device Manager Steps:" -ForegroundColor Yellow
Write-Host "  1. Open: devmgmt.msc" -ForegroundColor White
Write-Host "  2. Ports (COM & LPT) → Find USB Serial ($Port)" -ForegroundColor White
Write-Host "  3. Right-click → Disable" -ForegroundColor White
Write-Host "  4. Wait 2 seconds" -ForegroundColor White
Write-Host "  5. Right-click → Enable" -ForegroundColor White
Write-Host ""

# Test port
Write-Host "Testing port access..." -ForegroundColor Yellow
Set-Location "G:\Projects\OPALproject\ProjectWork\hardware\opalDevice"

# Check if ESP-IDF is loaded
try {
    $null = Get-Command esptool.py -ErrorAction Stop
    $idfLoaded = $true
} catch {
    Write-Host "  Loading ESP-IDF environment..." -ForegroundColor Yellow
    if (Test-Path "C:\Users\huber\esp\v5.5.1\esp-idf\export.ps1") {
        & "C:\Users\huber\esp\v5.5.1\esp-idf\export.ps1" | Out-Null
    } else {
        Write-Host "  ERROR: Please run this from ESP-IDF terminal" -ForegroundColor Red
        exit 1
    }
}

esptool.py --chip esp32c6 --port $Port --baud 115200 chip_id 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Port is accessible!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Ready to flash. Run:" -ForegroundColor Cyan
    Write-Host "  .\quick_flash.ps1 -Port $Port" -ForegroundColor White
    Write-Host "  or" -ForegroundColor Gray
    Write-Host "  .\fix_and_flash.ps1 -Port $Port" -ForegroundColor White
} else {
    Write-Host "✗ Port still not accessible" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try:" -ForegroundColor Yellow
    Write-Host "  1. Complete Device Manager steps above" -ForegroundColor White
    Write-Host "  2. Unplug/replug USB cable" -ForegroundColor White
    Write-Host "  3. Check if port changed in Device Manager" -ForegroundColor White
    Write-Host "  4. Try different USB port/cable" -ForegroundColor White
}

