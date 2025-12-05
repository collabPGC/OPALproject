# Test AEC Project Build for ESP32-C6 OPAL
# This script tests if the AEC project builds correctly with our custom board configuration

Write-Host "========================================"
Write-Host "Testing AEC Project Build"
Write-Host "ESP32-C6 OPAL Device"
Write-Host "========================================"
Write-Host ""

# Set paths
$ADF_PATH = "$PSScriptRoot\esp-adf-temp"
$IDF_PATH = "C:\Users\huber\esp\v5.5.1\esp-idf"
$AEC_DIR = "$ADF_PATH\examples\advanced_examples\aec"

# Check if directories exist
if (-not (Test-Path $AEC_DIR)) {
    Write-Host "[ERROR] AEC project not found at: $AEC_DIR" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $IDF_PATH)) {
    Write-Host "[ERROR] ESP-IDF not found at: $IDF_PATH" -ForegroundColor Red
    Write-Host "Please update IDF_PATH in this script" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] AEC project found: $AEC_DIR"
Write-Host "[OK] ESP-IDF found: $IDF_PATH"
Write-Host ""

# Check board configuration
$BOARD_DIR = "$ADF_PATH\components\audio_board\esp32c6_opal"
if (Test-Path $BOARD_DIR) {
    Write-Host "[OK] Board configuration found: $BOARD_DIR"
    
    # Check required files
    $requiredFiles = @(
        "board_pins_config.c",
        "board_pins_config.h",
        "board.c",
        "board.h",
        "board_def.h"
    )
    
    $allFilesExist = $true
    foreach ($file in $requiredFiles) {
        if (Test-Path "$BOARD_DIR\$file") {
            Write-Host "  [OK] $file exists"
        } else {
            Write-Host "  [FAIL] $file missing" -ForegroundColor Red
            $allFilesExist = $false
        }
    }
    
    if (-not $allFilesExist) {
        Write-Host ""
        Write-Host "[ERROR] Board configuration incomplete" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[ERROR] Board configuration not found: $BOARD_DIR" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================"
Write-Host "Environment Setup"
Write-Host "========================================"

# Set environment variables
$env:ADF_PATH = $ADF_PATH
$env:IDF_PATH = $IDF_PATH

Write-Host "ADF_PATH = $env:ADF_PATH"
Write-Host "IDF_PATH = $env:IDF_PATH"
Write-Host ""

# Check if ESP-IDF environment is available
$idfPyPath = "$IDF_PATH\tools\idf.py"
if (-not (Test-Path $idfPyPath)) {
    Write-Host "[WARNING] idf.py not found at: $idfPyPath" -ForegroundColor Yellow
    Write-Host "You may need to activate ESP-IDF environment first:" -ForegroundColor Yellow
    Write-Host "  . $IDF_PATH\export.ps1" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "========================================"
Write-Host "Build Test Instructions"
Write-Host "========================================"
Write-Host ""
Write-Host "To test the build, run these commands:"
Write-Host ""
Write-Host "1. Activate ESP-IDF environment:"
Write-Host "   . $IDF_PATH\export.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Navigate to AEC project:"
Write-Host "   cd `"$AEC_DIR`"" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Set target:"
Write-Host "   idf.py set-target esp32c6" -ForegroundColor Cyan
Write-Host ""
Write-Host "4. Configure (IMPORTANT - Select ESP32-C6-OPAL board):"
Write-Host "   idf.py menuconfig" -ForegroundColor Cyan
Write-Host "   Navigate to: Audio HAL -> Audio board"
Write-Host "   Select: ESP32-C6-OPAL (Waveshare Touch LCD 1.69 with ES8311)"
Write-Host ""
Write-Host "5. Build:"
Write-Host "   idf.py build" -ForegroundColor Cyan
Write-Host ""
Write-Host "6. Flash and monitor:"
Write-Host "   idf.py -p COM4 flash monitor" -ForegroundColor Cyan
Write-Host ""
Write-Host "========================================"
Write-Host "Verification Checklist"
Write-Host "========================================"
Write-Host ""
Write-Host "After building, verify in serial monitor:"
Write-Host "  [OK] Board pins configured correctly"
Write-Host "  [OK] I2S pins: GPIO19/20/21/22/23"
Write-Host "  [OK] I2C pins: GPIO7/8"
Write-Host "  [OK] ES8311 codec initialized"
Write-Host "  [OK] Audio stream started"
Write-Host ""
Write-Host "If I2C devices not detected, see HARDWARE_MODIFICATIONS.md"
Write-Host ""

