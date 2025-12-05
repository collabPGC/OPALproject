# Quick COM Port Unlocker for ESP32-C6
# Run this before flashing if COM port is busy
# Includes Device Manager disable/enable and Handle.exe check

param(
    [string]$Port = "COM4"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Unlocking COM Port: $Port" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Kill common serial port applications
Write-Host "Step 1: Closing applications that might lock $Port..." -ForegroundColor Yellow
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
}

Write-Host ""

# Step 2: Check for Handle.exe (Sysinternals)
Write-Host "Step 2: Checking for Handle.exe (Sysinternals)..." -ForegroundColor Yellow
$handlePath = Get-Command handle.exe -ErrorAction SilentlyContinue
if ($handlePath) {
    Write-Host "  Found Handle.exe - checking for handles on $Port..." -ForegroundColor Cyan
    $handleOutput = & handle.exe -a $Port 2>&1
    if ($handleOutput -match "pid:") {
        Write-Host "  Found processes holding $Port:" -ForegroundColor Yellow
        Write-Host $handleOutput -ForegroundColor White
        Write-Host "  Kill these PIDs manually if needed" -ForegroundColor Yellow
    } else {
        Write-Host "  No handles found on $Port" -ForegroundColor Green
    }
} else {
    Write-Host "  Handle.exe not found (optional - install from Sysinternals)" -ForegroundColor Yellow
    Write-Host "  Download: https://learn.microsoft.com/en-us/sysinternals/downloads/handle" -ForegroundColor Gray
}

Write-Host ""

# Step 3: Device Manager instructions
Write-Host "Step 3: Device Manager steps (manual):" -ForegroundColor Yellow
Write-Host "  1. Open Device Manager (devmgmt.msc)" -ForegroundColor White
Write-Host "  2. Expand 'Ports (COM & LPT)'" -ForegroundColor White
Write-Host "  3. Look for TWO entries:" -ForegroundColor White
Write-Host "     - USB JTAG/Serial (ignore this)" -ForegroundColor Gray
Write-Host "     - USB Serial ($Port) ← USE THIS ONE" -ForegroundColor Green
Write-Host "  4. Right-click $Port → Disable" -ForegroundColor White
Write-Host "  5. Wait 2 seconds" -ForegroundColor White
Write-Host "  6. Right-click $Port → Enable" -ForegroundColor White
Write-Host ""

# Step 4: Power supply reminder
Write-Host "Step 4: Power supply check:" -ForegroundColor Yellow
Write-Host "  ⚠ IMPORTANT: Unplug battery while flashing!" -ForegroundColor Red
Write-Host "  - Battery attached can cause port handle issues" -ForegroundColor White
Write-Host "  - Use USB-only power during flash" -ForegroundColor White
Write-Host "  - Use short, data-rated USB-C cable (avoid hubs)" -ForegroundColor White
Write-Host ""

# Check if port exists
Write-Host "Checking for $Port..." -ForegroundColor Yellow
$ports = Get-PnpDevice -Class Ports | Where-Object { $_.FriendlyName -like "*$Port*" }
if ($ports) {
    Write-Host "  Found: $($ports.FriendlyName)" -ForegroundColor Green
    
    # Try to test port access with Python if available
    Write-Host "  Testing port access..." -ForegroundColor Yellow
    try {
        $result = python -c "import serial; s=serial.Serial('$Port', 115200, timeout=1); print('OK'); s.close()" 2>&1
        if ($result -match "OK") {
            Write-Host "  Port is accessible!" -ForegroundColor Green
        } else {
            Write-Host "  Port may be locked: $result" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  Python/pyserial not available for testing" -ForegroundColor Yellow
    }
} else {
    Write-Host "  Port $Port not found!" -ForegroundColor Red
    Write-Host "  Available ports:" -ForegroundColor Yellow
    Get-PnpDevice -Class Ports | Where-Object { $_.FriendlyName -like "*COM*" } | ForEach-Object {
        Write-Host "    $($_.FriendlyName)" -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Unplug USB cable, wait 2 seconds, plug back in" -ForegroundColor White
Write-Host "  2. Check Device Manager for actual COM port number" -ForegroundColor White
Write-Host "  3. Try flashing with lower baud rate:" -ForegroundColor White
Write-Host "     idf.py -p $Port -b 115200 flash" -ForegroundColor Green
Write-Host "  4. Or use the flash script with port override" -ForegroundColor White
Write-Host ""

