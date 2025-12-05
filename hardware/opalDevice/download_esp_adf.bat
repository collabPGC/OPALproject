@echo off
REM Download ESP-ADF (Espressif Audio Development Framework) VoIP Examples
REM This is the official Espressif advanced audio framework with VoIP support

echo ========================================
echo Downloading ESP-ADF (Espressif Audio Development Framework)
echo ========================================
echo.
echo ESP-ADF includes official VoIP example with SIP + RTP
echo.

set ADF_DIR=esp-adf
if not exist "%ADF_DIR%" (
    echo Cloning ESP-ADF repository (this may take several minutes)...
    echo Repository size: ~500MB+
    echo.
    git clone --recursive https://github.com/espressif/esp-adf.git %ADF_DIR%
    if errorlevel 1 (
        echo ERROR: Failed to clone ESP-ADF
        exit /b 1
    )
) else (
    echo ESP-ADF already exists, updating...
    cd %ADF_DIR%
    git pull
    git submodule update --recursive
    cd ..
)

echo.
echo ========================================
echo ESP-ADF Download Complete!
echo ========================================
echo.
echo Key locations:
echo   - %ADF_DIR%\examples\advanced_examples\voip\  - Official VoIP example
echo   - %ADF_DIR%\examples\advanced_examples\pipeline_duplex_app\  - Full-duplex audio
echo   - %ADF_DIR%\components\audio_pipeline\  - Audio pipeline framework
echo   - %ADF_DIR%\components\audio_codec\  - Codec drivers (ES8311 supported)
echo.
echo Next steps:
echo   1. Review VoIP example: %ADF_DIR%\examples\advanced_examples\voip\
echo   2. Check documentation: https://docs.espressif.com/projects/esp-adf/
echo   3. Adapt for ESP32-C6 with your hardware pinout
echo.
pause

