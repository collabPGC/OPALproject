# ESP32-S3-Touch-AMOLED-1.75 Project

This project is a minimal setup for the Waveshare ESP32-S3-Touch-AMOLED-1.75 board using the official Board Support Package (BSP).

## Hardware
- **Board**: Waveshare ESP32-S3-Touch-AMOLED-1.75
- **Display**: 1.75" AMOLED (CO5300/SH8601)
- **Touch**: CST9217
- **PMU**: AXP2101

## Prerequisites
- ESP-IDF v5.3 or later (Tested with v5.5.1)

## Build and Flash

1.  **Build**
    ```bash
    idf.py build
    ```
    *Note: Dependencies (Waveshare BSP) will be automatically downloaded via the component manager.*

2.  **Flash and Monitor**
    ```bash
    idf.py -p COMx flash monitor
    ```
    *(Replace COMx with your device's port, e.g., COM8)*

## Project Structure
- `main/main.c`: Application entry point (Pure C). Initializes BSP and LVGL.
- `sdkconfig.defaults`: Default configuration (Partition table, PSRAM).
- `partitions.csv`: Custom partition table.

## Notes
- This project uses **Pure C** (`main.c`) to avoid C++ header conflicts present in some ESP-IDF 5.x versions.
- The BSP handles all hardware initialization (PMU, Display, Touch).
