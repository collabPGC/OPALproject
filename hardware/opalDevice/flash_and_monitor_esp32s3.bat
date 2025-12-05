@echo off
echo ========================================
echo Flashing ESP32-S3 Firmware
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
echo Flashing to COM4...
cd /d G:\Projects\OPALproject\ProjectWork\hardware\opalDevice
idf.py -p COM4 flash monitor
set FLASH_RESULT=%ERRORLEVEL%

if %FLASH_RESULT% neq 0 (
    echo.
    echo ========================================
    echo FLASH FAILED! Check errors above.
    echo ========================================
    echo.
    pause
)
