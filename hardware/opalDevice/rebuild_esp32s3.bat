@echo off
echo ========================================
echo Reconfiguring and Building for ESP32-S3
echo ========================================
echo.

echo Setting up ESP-IDF environment...
call C:\Users\huber\esp\v5.5.1\esp-idf\export.bat
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to setup ESP-IDF environment
    pause
    exit /b 1
)

echo.
echo Step 1: Cleaning build directory...
cd /d G:\Projects\OPALproject\ProjectWork\hardware\opalDevice
rmdir /s /q build 2>nul
echo Build directory cleaned.

echo.
echo Step 2: Setting target to ESP32-S3...
idf.py set-target esp32s3
set TARGET_RESULT=%ERRORLEVEL%

if %TARGET_RESULT% neq 0 (
    echo.
    echo ========================================
    echo SET-TARGET FAILED! Check errors above.
    echo ========================================
    echo.
    pause
    exit /b 1
)

echo.
echo Step 3: Building firmware...
idf.py build
set BUILD_RESULT=%ERRORLEVEL%

if %BUILD_RESULT% neq 0 (
    echo.
    echo ========================================
    echo BUILD FAILED! Check errors above.
    echo ========================================
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo BUILD SUCCESSFUL!
echo ========================================
echo.
echo Next step: Flash to device
echo Run: flash_and_monitor_esp32s3.bat
echo.
pause
