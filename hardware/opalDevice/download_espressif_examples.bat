@echo off
REM Download Espressif Official Examples for ESP32-C6
REM This script clones the official ESP-IDF repository and extracts relevant examples

echo ========================================
echo Downloading Espressif Official Examples
echo ========================================
echo.

REM Set directory for examples
set EXAMPLES_DIR=espressif_examples
if not exist "%EXAMPLES_DIR%" mkdir "%EXAMPLES_DIR%"
cd "%EXAMPLES_DIR%"

echo Step 1: Cloning ESP-IDF repository...
echo.
if not exist "esp-idf" (
    echo Cloning ESP-IDF (this may take a few minutes)...
    git clone --recursive https://github.com/espressif/esp-idf.git
    if errorlevel 1 (
        echo ERROR: Failed to clone ESP-IDF
        cd ..
        exit /b 1
    )
) else (
    echo ESP-IDF already cloned, updating...
    cd esp-idf
    git pull
    git submodule update --recursive
    cd ..
)

echo.
echo Step 2: Checking out ESP32-C6 compatible version (v5.5.1)...
cd esp-idf
git checkout v5.5.1
if errorlevel 1 (
    echo WARNING: v5.5.1 not found, using latest
    git checkout master
)
cd ..

echo.
echo Step 3: Copying relevant examples...
echo.

REM Create examples directory
if not exist "examples" mkdir "examples"

REM Copy I2S examples
if exist "esp-idf\examples\peripherals\i2s" (
    echo Copying I2S examples...
    xcopy /E /I /Y "esp-idf\examples\peripherals\i2s" "examples\i2s"
)

REM Copy network protocol examples
if exist "esp-idf\examples\protocols" (
    echo Copying network protocol examples...
    xcopy /E /I /Y "esp-idf\examples\protocols" "examples\protocols"
)

echo.
echo Step 4: Extracting ES8311 codec driver...
echo.

REM Copy codec device component
if exist "esp-idf\components\esp_codec_dev" (
    echo Copying esp_codec_dev component...
    xcopy /E /I /Y "esp-idf\components\esp_codec_dev" "examples\esp_codec_dev"
)

echo.
echo ========================================
echo Download Complete!
echo ========================================
echo.
echo Examples are in: %CD%\examples
echo.
echo Key directories:
echo   - examples\i2s\          - I2S audio examples
echo   - examples\protocols\   - Network protocol examples (MQTT, HTTP, etc.)
echo   - examples\esp_codec_dev\ - Audio codec device driver (includes ES8311)
echo.
echo You can now review these examples and adapt them for your project.
echo.
cd ..
pause

