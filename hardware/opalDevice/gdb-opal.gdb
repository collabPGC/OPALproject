# --- gdb-opal.gdb ---
set pagination off
set confirm off
set breakpoint pending on
set print pretty on

# file build/<APP_ELF>   # injected by start-gdb.ps1

target extended-remote localhost:3333
monitor reset halt
# monitor esp rtos off   # uncomment if RTOS awareness gets noisy

# Entry points
thb app_main
thb main

# Your code
b init_i2c_bus
b opal_task_main

# I2C
b i2c_param_config
b i2c_driver_install
b i2c_master_write_to_device
b i2c_master_read_from_device

# SPI/LCD (comment if unused)
b spi_bus_initialize
b spi_bus_add_device
b spi_device_polling_transmit
b st7789_init
b st7735_init
b ili9341_init

# Wi-Fi
b esp_wifi_init
b esp_wifi_set_mode
b esp_wifi_start
b esp_wifi_connect
b esp_event_handler_instance_register

# Audio (I2S)
b i2s_new_channel
b i2s_channel_init_std_mode
b i2s_channel_enable
b i2s_channel_write
b i2s_channel_read

# Safety nets
b abort
b __assert_func
b esp_restart
# b esp_log_write   # enable if you want to break on every log

thb app_main
continue
