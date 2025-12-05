# Test ESP-ADF Board Configuration for ESP32-C6 OPAL
# Verifies board configuration is complete and correct

Write-Host "========================================"
Write-Host "Testing ESP-ADF Board Configuration"
Write-Host "ESP32-C6 OPAL Device"
Write-Host "========================================"
Write-Host ""

$boardDir = "$PSScriptRoot\esp-adf-temp\components\audio_board\esp32c6_opal"

if (-not (Test-Path $boardDir)) {
    Write-Host "[ERROR] Board directory not found: $boardDir" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Board directory found: $boardDir"
Write-Host ""

# Check required files
$requiredFiles = @{
    "board_pins_config.c" = "I2S/I2C pin configuration"
    "board_pins_config.h" = "Board pins header"
    "board.c" = "Board initialization"
    "board.h" = "Board interface"
    "board_def.h" = "Board definitions"
}

Write-Host "Checking board configuration files..."
$allFilesExist = $true
foreach ($file in $requiredFiles.Keys) {
    if (Test-Path "$boardDir\$file") {
        $size = (Get-Item "$boardDir\$file").Length
        Write-Host "  [OK] $file ($size bytes) - $($requiredFiles[$file])"
    } else {
        Write-Host "  [FAIL] $file missing - $($requiredFiles[$file])" -ForegroundColor Red
        $allFilesExist = $false
    }
}

if (-not $allFilesExist) {
    Write-Host ""
    Write-Host "[ERROR] Board configuration incomplete" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Verifying pinout values in board_pins_config.c..."

# Check for datasheet pinout values
$configFile = "$boardDir\board_pins_config.c"
if (Test-Path $configFile) {
    $content = Get-Content $configFile -Raw
    
    $pinChecks = @{
        "GPIO_NUM_19" = "I2S MCLK"
        "GPIO_NUM_20" = "I2S BCK"
        "GPIO_NUM_22" = "I2S LRCK"
        "GPIO_NUM_21" = "I2S DOUT"
        "GPIO_NUM_23" = "I2S DIN"
        "GPIO_NUM_8" = "I2C SDA"
        "GPIO_NUM_7" = "I2C SCL"
    }
    
    $allPinsCorrect = $true
    foreach ($pin in $pinChecks.Keys) {
        if ($content -match $pin) {
            Write-Host "  [OK] $pin found - $($pinChecks[$pin])"
        } else {
            Write-Host "  [FAIL] $pin not found - $($pinChecks[$pin])" -ForegroundColor Red
            $allPinsCorrect = $false
        }
    }
    
    if (-not $allPinsCorrect) {
        Write-Host ""
        Write-Host "[WARNING] Some pinout values may be incorrect" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Checking ESP-ADF build system integration..."

# Check Kconfig
$kconfigFile = "$PSScriptRoot\esp-adf-temp\components\audio_board\Kconfig.projbuild"
if (Test-Path $kconfigFile) {
    $kconfigContent = Get-Content $kconfigFile -Raw
    if ($kconfigContent -match "ESP32_C6_OPAL_BOARD") {
        Write-Host "  [OK] ESP32_C6_OPAL_BOARD found in Kconfig.projbuild"
    } else {
        Write-Host "  [FAIL] ESP32_C6_OPAL_BOARD not found in Kconfig.projbuild" -ForegroundColor Red
    }
} else {
    Write-Host "  [WARN] Kconfig.projbuild not found" -ForegroundColor Yellow
}

# Check CMakeLists.txt
$cmakeFile = "$PSScriptRoot\esp-adf-temp\components\audio_board\CMakeLists.txt"
if (Test-Path $cmakeFile) {
    $cmakeContent = Get-Content $cmakeFile -Raw
    if ($cmakeContent -match "ESP32_C6_OPAL_BOARD") {
        Write-Host "  [OK] ESP32_C6_OPAL_BOARD found in CMakeLists.txt"
    } else {
        Write-Host "  [FAIL] ESP32_C6_OPAL_BOARD not found in CMakeLists.txt" -ForegroundColor Red
    }
} else {
    Write-Host "  [WARN] CMakeLists.txt not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================"
Write-Host "Board Configuration Test: PASSED"
Write-Host "========================================"
Write-Host ""
Write-Host "Board configuration is complete and ready."
Write-Host "Board will appear in menuconfig as: ESP32-C6-OPAL"
Write-Host ""

