@echo off
echo ========================================
echo Flash OPAL Device - Manual Bootloader Mode
echo ========================================
echo.
echo INSTRUCTIONS:
echo   1. Hold BOOT button on ESP32-C6
echo   2. While holding BOOT, press and release RST button
echo   3. Keep holding BOOT until you see "Connecting..."
echo   4. Release BOOT button
echo.
echo Press any key when ready (after entering bootloader mode)...
pause >nul
echo.

echo Setting up ESP-IDF environment...
call C:\Users\huber\esp\v5.5.1\esp-idf\export.bat

cd /d G:\Projects\OPALproject\ProjectWork\hardware\opalDevice

echo.
echo Flashing to COM4 (manual bootloader mode)...
echo Using --before no_reset --after no_reset for manual entry
echo.

REM Use esptool directly with no_reset flags for manual bootloader entry
esptool.py --chip esp32c6 --port COM4 --baud 115200 --before no_reset --after no_reset write_flash --flash_mode dio --flash_freq 80m --flash_size 16MB 0x0 build/bootloader/bootloader.bin 0x10000 build/opalDevice.bin 0x8000 build/partition_table/partition-table.bin

if %ERRORLEVEL% equ 0 (
    echo.
    echo ========================================
    echo Flash successful!
    echo ========================================
    echo.
    echo Starting serial monitor...
    echo Press Ctrl+] to exit monitor
    echo.
    idf.py -p COM4 monitor
) else (
    echo.
    echo Flash failed!
    echo.
    echo Troubleshooting:
    echo   - Make sure you entered bootloader mode correctly
    echo   - Try Device Manager: Disable/Enable COM4
    echo   - Try unplugging and replugging USB cable
    echo   - Check if COM4 exists: mode COM4
    pause
)

