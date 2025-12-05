set pagination off
set confirm off
file build/opalDevice.elf
target extended-remote localhost:3333
monitor reset halt
thb app_main
continue
