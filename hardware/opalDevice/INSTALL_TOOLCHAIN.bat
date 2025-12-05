@echo off
echo ========================================
echo Installing ESP32-S3 Toolchain
echo ========================================
echo.

echo Setting up ESP-IDF environment...
call "C:\Users\huber\esp\v5.5.1\esp-idf\export.bat"

echo.
echo Installing all required tools for ESP32-S3...
python "%IDF_PATH%\tools\idf_tools.py" install --targets=esp32s3

echo.
echo Installing Python environment...
python "%IDF_PATH%\tools\idf_tools.py" install-python-env

echo.
echo ========================================
echo Toolchain Installation Complete
echo ========================================
echo.
echo Next: Run build_esp32s3_fixed.bat
pause
