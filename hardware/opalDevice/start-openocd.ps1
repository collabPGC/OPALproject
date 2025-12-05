# --- start-openocd.ps1 ---
# Kill any stragglers quietly
taskkill /IM openocd.exe /F 2>$null | Out-Null

# Try to find the bundled OpenOCD
$guess = Get-ChildItem "$env:USERPROFILE\.espressif\tools\openocd-esp32\*\openocd-esp32\bin\openocd.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
$openocd = if ($guess) { $guess.FullName } else { "openocd.exe" }

# Start OpenOCD with GDB-friendly settings (non-deprecated)
& $openocd -f board/esp32c6-builtin.cfg `
  -c "gdb memory_map disable" `
  -c "gdb flash_program enable"
