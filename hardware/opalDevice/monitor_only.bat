@echo off
echo ========================================
echo Opening Serial Monitor on COM4
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
echo Opening monitor on COM4 @ 115200 baud...
echo Press CTRL+] to exit monitor
echo.
cd /d G:\Projects\OPALproject\ProjectWork\hardware\opalDevice
idf.py -p COM4 monitor
