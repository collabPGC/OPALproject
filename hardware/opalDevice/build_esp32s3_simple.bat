@echo off
echo ========================================
echo Building for ESP32-S3 (Simple Method)
echo ========================================
echo.

:: Change to project directory
cd /d "%~dp0"

echo Step 1: Setting up ESP-IDF environment...
call "C:\Users\huber\esp\v5.5.1\esp-idf\export.bat"
if errorlevel 1 (
    echo ERROR: Failed to setup ESP-IDF
    pause
    exit /b 1
)

echo.
echo Step 2: Cleaning build directory...
if exist build (
    rmdir /s /q build
    echo Build directory cleaned
)

echo.
echo Step 3: Building firmware (idf.py handles toolchain automatically)...
idf.py set-target esp32s3
if errorlevel 1 (
    echo.
    echo ERROR: Set-target failed
    echo Trying full reconfigure...
    idf.py fullclean
    idf.py set-target esp32s3
)

echo.
echo Step 4: Building...
idf.py build
if errorlevel 1 (
    echo.
    echo ========================================
    echo BUILD FAILED!
    echo ========================================
    pause
    exit /b 1
)

echo.
echo ========================================
echo BUILD SUCCESSFUL!
echo ========================================
echo.
echo Next: flash_and_monitor_esp32s3.bat
pause
