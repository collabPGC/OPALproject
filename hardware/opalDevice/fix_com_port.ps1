# COM Port Troubleshooting Helper for ESP32-C6
# Run this script if you get "COMx is busy" or "not functioning" errors

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ESP32-C6 COM Port Troubleshooting" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Kill common serial port applications
Write-Host "Step 1: Closing applications that might lock COM ports..." -ForegroundColor Yellow
$processes = @("putty", "teraterm", "arduino", "code", "platformio", "coolterm")
foreach ($proc in $processes) {
    $found = Get-Process -Name $proc -ErrorAction SilentlyContinue
    if ($found) {
        Write-Host "  Killing $proc..." -ForegroundColor Red
        Stop-Process -Name $proc -Force -ErrorAction SilentlyContinue
    }
}
Write-Host "  Done." -ForegroundColor Green
Write-Host ""

# Step 2: List available COM ports
Write-Host "Step 2: Available COM ports:" -ForegroundColor Yellow
Get-PnpDevice -Class Ports | Where-Object { $_.FriendlyName -like "*COM*" } | ForEach-Object {
    Write-Host "  $($_.FriendlyName)" -ForegroundColor Cyan
}
Write-Host ""

# Step 3: Check if Python/pyserial is available
Write-Host "Step 3: Testing COM port access..." -ForegroundColor Yellow
$comPorts = @("COM6", "COM5", "COM7", "COM3", "COM4")
foreach ($port in $comPorts) {
    $exists = Get-PnpDevice -Class Ports | Where-Object { $_.FriendlyName -like "*$port*" }
    if ($exists) {
        Write-Host "  Found $port - testing access..." -ForegroundColor Cyan
        try {
            python -c "import serial; s=serial.Serial('$port', 115200, timeout=1); print('    OK - port is accessible'); s.close()" 2>&1
        } catch {
            Write-Host "    Port exists but may be locked" -ForegroundColor Yellow
        }
    }
}
Write-Host ""

# Step 4: Instructions
Write-Host "Step 4: Next steps:" -ForegroundColor Yellow
Write-Host "  1. Unplug and replug USB cable" -ForegroundColor White
Write-Host "  2. Check Device Manager (devmgmt.msc) for actual COM port number" -ForegroundColor White
Write-Host "  3. Try flashing with lower baud rate:" -ForegroundColor White
Write-Host "     idf.py -p COM6 -b 115200 flash" -ForegroundColor Green
Write-Host "  4. If auto-boot fails, manually enter bootloader:" -ForegroundColor White
Write-Host "     - Hold BOOT button" -ForegroundColor White
Write-Host "     - Press and release RESET" -ForegroundColor White
Write-Host "     - Release BOOT when esptool says 'Connecting...'" -ForegroundColor White
Write-Host ""

# Step 5: Test esptool if available
Write-Host "Step 5: Testing esptool (if available)..." -ForegroundColor Yellow
$testPort = "COM6"
try {
    esptool.py --port $testPort --chip auto --baud 115200 chip_id 2>&1 | Select-Object -First 3
} catch {
    Write-Host "  esptool not found or port not accessible" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "Done! Try flashing again." -ForegroundColor Green

