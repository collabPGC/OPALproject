set pagination off
set confirm off
file build/opalDevice.elf
# target connect now happens inside the patched build\gdbinit\connect which idf.py gdb sources
monitor reset halt
thb app_main
continue
