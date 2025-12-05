@echo off
echo ========================================
echo Changing Target to ESP32-C6
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
echo Changing target to ESP32-C6...
cd /d G:\Projects\OPALproject\ProjectWork\hardware\opalDevice
idf.py set-target esp32c6
set RESULT=%ERRORLEVEL%

if %RESULT% neq 0 (
    echo.
    echo ========================================
    echo SET-TARGET FAILED! Check errors above.
    echo ========================================
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Target changed to ESP32-C6 successfully!
echo ========================================
echo.
pause
