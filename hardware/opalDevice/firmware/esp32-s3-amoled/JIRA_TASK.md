# Jira Task: Setup ESP32-S3-Touch-AMOLED-1.75 BSP

**Summary:** Initialize and configure ESP-IDF project for Waveshare ESP32-S3-Touch-AMOLED-1.75 board using official BSP.

**Description:**
Set up the development environment and base project for the Waveshare ESP32-S3-Touch-AMOLED-1.75. The project needs to correctly initialize the PMU (AXP2101), AMOLED Display (CO5300/SH8601), and Touch Controller (CST9217).

**Acceptance Criteria:**
- [x] Project compiles with ESP-IDF 5.5.1 without errors.
- [x] Official Waveshare BSP (`waveshare/esp32_s3_touch_amoled_1_75`) is integrated.
- [x] Project is configured as Pure C to avoid C++ header conflicts in ESP-IDF 5.x.
- [x] Firmware flashes successfully to the device.
- [x] Device boots and displays "Hello from LINA!" on the screen.
- [x] Serial logs show successful driver initialization.

**Technical Implementation Details:**
- **BSP**: Used `waveshare/esp32_s3_touch_amoled_1_75^1.0.2`.
- **Build System**: CMake configured for `main.c`.
- **Workarounds**: Converted `main.cpp` to `main.c` to resolve `esp_lcd_io_i2c.h` inline function conflicts in ESP-IDF 5.5.1.
- **Configuration**: Custom partition table enabled in `sdkconfig.defaults`.

**Status:** DONE
**Assignee:** AntiGravity
**Fix Version:** 1.0.0
