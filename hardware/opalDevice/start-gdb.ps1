# --- start-gdb.ps1 ---
$proj = "G:\Projects\OPALproject\ProjectWork\hardware\opalDevice"
Set-Location $proj

# Pick APP ELF (skip bootloader)
$elf = (Get-ChildItem .\build\*.elf | Where-Object { $_.Name -notmatch "bootloader" } | Select-Object -First 1).Name
if (-not $elf) { Write-Error "No app ELF found in build\"; exit 1 }

# Build an effective script that injects the correct ELF
$gdbUser = Join-Path $proj "gdb-opal.gdb"
$gdbTemp = Join-Path $proj "gdb-opal-effective.gdb"
@("file build/$elf"; Get-Content $gdbUser) | Set-Content -Encoding ASCII $gdbTemp

# Find esp-gdb
$gdb = "$env:USERPROFILE\.espressif\tools\riscv32-esp-elf-gdb\16.2_20250324\bin\riscv32-esp-elf-gdb.exe"
if (-not (Test-Path $gdb)) {
  $cmd = Get-Command riscv32-esp-elf-gdb.exe -ErrorAction SilentlyContinue
  if ($cmd) { $gdb = $cmd.Source } else { Write-Error "esp-gdb not found"; exit 1 }
}

chcp 65001 | Out-Null
& $gdb -x $gdbTemp
