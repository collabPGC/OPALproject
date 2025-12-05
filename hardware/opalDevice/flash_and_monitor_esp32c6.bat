@echo off
REM ========================================
REM Flashing ESP32-C6 Firmware
REM ========================================
REM Usage: flash_and_monitor_esp32c6.bat [COM_PORT] [BAUD_RATE]
REM Example: flash_and_monitor_esp32c6.bat COM4 115200

setlocal enabledelayedexpansion

REM Get COM port from argument or default to COM4
set "COM_PORT=%~1"
if "%COM_PORT%"=="" set "COM_PORT=COM4"

REM Get baud rate from argument or default to 115200 (more reliable than 460800)
set "BAUD_RATE=%~2"
if "%BAUD_RATE%"=="" set "BAUD_RATE=115200"

echo ========================================
echo Flashing ESP32-C6 Firmware
echo Port: %COM_PORT%, Baud: %BAUD_RATE%
echo ========================================
echo.

REM Kill processes that might lock the port
echo Closing processes that might lock %COM_PORT%...
taskkill /F /IM putty.exe /IM teraterm.exe /IM teraterm64.exe /IM teraterm32.exe 2>nul
taskkill /F /IM arduino.exe /IM code.exe 2>nul
timeout /t 1 /nobreak >nul

echo Setting up ESP-IDF environment...
call C:\Users\huber\esp\v5.5.1\esp-idf\export.bat
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to setup ESP-IDF environment
    pause
    exit /b 1
)

echo.
echo Flashing to %COM_PORT% at %BAUD_RATE% baud...
cd /d G:\Projects\OPALproject\ProjectWork\hardware\opalDevice

REM Try flashing with specified baud rate
idf.py -p %COM_PORT% -b %BAUD_RATE% flash monitor
set FLASH_RESULT=%ERRORLEVEL%

if %FLASH_RESULT% neq 0 (
    echo.
    echo ========================================
    echo FLASH FAILED! Trying fallback options...
    echo ========================================
    echo.
    
    REM Try lower baud rate if high baud failed
    if %BAUD_RATE% gtr 115200 (
        echo Trying lower baud rate (115200)...
        idf.py -p %COM_PORT% -b 115200 flash monitor
        set FLASH_RESULT=!ERRORLEVEL!
    )
    
    if !FLASH_RESULT! neq 0 (
        echo.
        echo Still failing. Try these manual steps:
        echo   1. Verify chip: esptool.py --chip esp32c6 --port %COM_PORT% --baud 115200 chip_id
        echo   2. Try no-stub: idf.py -p %COM_PORT% -b 115200 flash --no-stub
        echo   3. Or erase first: idf.py -p %COM_PORT% erase-flash
        echo   4. Then flash: idf.py -p %COM_PORT% flash
        echo   5. Check Device Manager - use USB Serial port (not USB JTAG)
        echo   6. Manual bootloader: Hold BOOT, tap RST, release BOOT when "Connecting..."
        echo.
        pause
    )
)
