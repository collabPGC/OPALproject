@echo off
REM Setup ESP-ADF AEC Project for OPAL Device (ESP32-C6)
REM This script sets up the AEC project with our hardware configuration

echo ========================================
echo Setting up ESP-ADF AEC Project
echo ========================================
echo.

set AEC_DIR=esp-adf-temp\examples\advanced_examples\aec
set ADF_PATH=%CD%\esp-adf-temp
set IDF_PATH=C:\Users\huber\esp\v5.5.1\esp-idf

if not exist "%AEC_DIR%" (
    echo ERROR: AEC project not found at %AEC_DIR%
    echo Please ensure ESP-ADF is cloned.
    pause
    exit /b 1
)

echo AEC project found at: %AEC_DIR%
echo.

REM Set environment variables
echo Setting environment variables...
set ADF_PATH=%CD%\esp-adf-temp
set IDF_PATH=C:\Users\huber\esp\v5.5.1\esp-idf

echo ADF_PATH = %ADF_PATH%
echo IDF_PATH = %IDF_PATH%
echo.

REM Navigate to AEC project
cd /d %AEC_DIR%

echo ========================================
echo AEC Project Setup Complete
echo ========================================
echo.
echo Next steps:
echo   1. Set target: idf.py set-target esp32c6
echo   2. Configure: idf.py menuconfig
echo      - Select audio board (or configure ES8311 manually)
echo      - Update I2S pins to match our hardware_config.h
echo      - Update I2C pins to match our hardware_config.h
echo      - Disable SD card if not available
echo   3. Build: idf.py build
echo   4. Flash: idf.py -p COM4 flash monitor
echo.
echo IMPORTANT: This project uses ESP-ADF board abstraction.
echo You may need to create a custom board configuration for ESP32-C6.
echo.
pause

