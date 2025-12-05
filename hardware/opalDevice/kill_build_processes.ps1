# Kill processes that might interfere with ESP-IDF builds
# This prevents file locking issues on Windows

Write-Host "========================================"
Write-Host "Killing Build-Interfering Processes"
Write-Host "========================================"
Write-Host ""

$killedCount = 0

# Kill Python processes (idf.py, esptool, etc.)
Write-Host "Checking for Python processes..."
$pythonProcs = Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*espressif*" -or $_.CommandLine -like "*idf.py*" -or $_.CommandLine -like "*esptool*" }
if ($pythonProcs) {
    foreach ($proc in $pythonProcs) {
        Write-Host "  Killing Python process: $($proc.Id) - $($proc.ProcessName)"
        try {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            $killedCount++
        } catch {
            Write-Host "    (Already terminated)"
        }
    }
} else {
    Write-Host "  [OK] No Python processes found"
}

# Kill ninja build processes
Write-Host "Checking for ninja processes..."
$ninjaProcs = Get-Process ninja -ErrorAction SilentlyContinue
if ($ninjaProcs) {
    foreach ($proc in $ninjaProcs) {
        Write-Host "  Killing ninja process: $($proc.Id)"
        try {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            $killedCount++
        } catch {
            Write-Host "    (Already terminated)"
        }
    }
} else {
    Write-Host "  [OK] No ninja processes found"
}

# Kill cmake processes
Write-Host "Checking for cmake processes..."
$cmakeProcs = Get-Process cmake -ErrorAction SilentlyContinue
if ($cmakeProcs) {
    foreach ($proc in $cmakeProcs) {
        Write-Host "  Killing cmake process: $($proc.Id)"
        try {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            $killedCount++
        } catch {
            Write-Host "    (Already terminated)"
        }
    }
} else {
    Write-Host "  [OK] No cmake processes found"
}

# Kill any processes using COM ports (serial monitor, etc.)
Write-Host "Checking for serial port processes..."
$comProcs = Get-Process | Where-Object { 
    $_.Path -like "*putty*" -or 
    $_.Path -like "*teraterm*" -or 
    $_.Path -like "*minicom*" -or
    $_.ProcessName -like "*serial*" -or
    $_.CommandLine -like "*COM*"
} -ErrorAction SilentlyContinue
if ($comProcs) {
    foreach ($proc in $comProcs) {
        Write-Host "  Killing serial process: $($proc.Id) - $($proc.ProcessName)"
        try {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            $killedCount++
        } catch {
            Write-Host "    (Already terminated)"
        }
    }
} else {
    Write-Host "  [OK] No serial port processes found"
}

# Kill any processes that might have build files open
Write-Host "Checking for processes with build files open..."
$buildDir = "esp-adf-temp\examples\advanced_examples\aec\build"
if (Test-Path $buildDir) {
    # Try to get processes that might have files in build directory
    # This is a best-effort check
    Write-Host "  [INFO] Build directory exists - files may be locked"
} else {
    Write-Host "  [OK] Build directory doesn't exist yet"
}

Write-Host ""
Write-Host "========================================"
Write-Host "Summary: Killed $killedCount process(es)"
Write-Host "========================================"
Write-Host ""

# Wait a moment for processes to fully release
Write-Host "Waiting 2 seconds for processes to release files..."
Start-Sleep -Seconds 2

Write-Host "[OK] Ready to build"
Write-Host ""

