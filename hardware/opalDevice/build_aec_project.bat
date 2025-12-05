@echo off
REM Build ESP-ADF AEC Project for ESP32-C6 OPAL Device
REM Uses exact datasheet pinout values

echo ========================================
echo Building ESP-ADF AEC Project
echo ESP32-C6 OPAL Device (Datasheet Pinout)
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

echo Setting environment variables...
set ADF_PATH=%CD%\esp-adf-temp
set IDF_PATH=C:\Users\huber\esp\v5.5.1\esp-idf

echo ADF_PATH = %ADF_PATH%
echo IDF_PATH = %IDF_PATH%
echo.

REM Navigate to AEC project
cd /d %AEC_DIR%

echo ========================================
echo Configuring for ESP32-C6
echo ========================================
idf.py set-target esp32c6
if errorlevel 1 (
    echo ERROR: Failed to set target
    pause
    exit /b 1
)

echo.
echo ========================================
echo Opening menuconfig
echo ========================================
echo IMPORTANT: Select "ESP32-C6-OPAL" board in menuconfig:
echo   Audio HAL -> Audio board -> ESP32-C6-OPAL
echo.
echo Press any key to open menuconfig...
pause >nul

idf.py menuconfig

echo.
echo ========================================
echo Building AEC Project
echo ========================================
idf.py build
if errorlevel 1 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo Build Complete!
echo ========================================
echo.
echo To flash and monitor:
echo   idf.py -p COM4 flash monitor
echo.
pause

