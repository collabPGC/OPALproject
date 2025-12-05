@echo off
echo ========================================
echo REBUILDING FOR ESP32-C6
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
echo Building firmware for ESP32-C6...
cd /d G:\Projects\OPALproject\ProjectWork\hardware\opalDevice
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
echo Run: flash_and_monitor_esp32c6.bat
echo.
pause
