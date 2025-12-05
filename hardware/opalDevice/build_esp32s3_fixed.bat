@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Building for ESP32-S3
echo ========================================
echo.

:: Change to project directory first
cd /d "%~dp0"
echo Working directory: %CD%

echo.
echo Step 1: Setting up ESP-IDF environment...
if not exist "C:\Users\huber\esp\v5.5.1\esp-idf\export.bat" (
    echo ERROR: ESP-IDF not found at C:\Users\huber\esp\v5.5.1\esp-idf\
    pause
    exit /b 1
)

:: Call export.bat to set up environment
call "C:\Users\huber\esp\v5.5.1\esp-idf\export.bat"
if errorlevel 1 (
    echo ERROR: Failed to setup ESP-IDF environment
    pause
    exit /b 1
)

echo.
echo Step 2: Verifying toolchain...
where xtensa-esp32s3-elf-gcc >nul 2>&1
if errorlevel 1 (
    echo ERROR: ESP32-S3 toolchain not found in PATH
    echo.
    echo Attempting to install toolchain...
    python "%IDF_PATH%\tools\idf_tools.py" install xtensa-esp32s3-elf
    python "%IDF_PATH%\tools\idf_tools.py" install-python-env

    :: Re-export environment
    call "C:\Users\huber\esp\v5.5.1\esp-idf\export.bat"
)

:: Verify again
where xtensa-esp32s3-elf-gcc >nul 2>&1
if errorlevel 1 (
    echo ERROR: Toolchain still not available after installation attempt
    echo Please run: python %IDF_PATH%\tools\idf_tools.py install-python-env
    pause
    exit /b 1
)

echo ✓ Toolchain found:
xtensa-esp32s3-elf-gcc --version | findstr "gcc"

echo.
echo Step 3: Cleaning build directory...
if exist build (
    rmdir /s /q build
    echo ✓ Build directory cleaned
)

echo.
echo Step 4: Setting target to ESP32-S3...
idf.py set-target esp32s3
if errorlevel 1 (
    echo ERROR: Failed to set target
    pause
    exit /b 1
)

echo.
echo Step 5: Building firmware...
idf.py build
if errorlevel 1 (
    echo.
    echo ========================================
    echo BUILD FAILED! Check errors above.
    echo ========================================
    pause
    exit /b 1
)

echo.
echo ========================================
echo BUILD SUCCESSFUL!
echo ========================================
echo.
echo Next: Run flash_and_monitor_esp32s3.bat
pause
