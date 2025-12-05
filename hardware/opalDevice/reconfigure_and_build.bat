@echo off
echo ========================================
echo Reconfiguring for ESP32-C6 and Building
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
echo Step 1: Setting target to ESP32-C6...
cd /d G:\Projects\OPALproject\ProjectWork\hardware\opalDevice
idf.py set-target esp32c6
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
echo Step 2: Building firmware...
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
