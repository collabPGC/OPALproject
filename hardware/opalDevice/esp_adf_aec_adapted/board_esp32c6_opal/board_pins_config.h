/**
 * @file board_pins_config.h
 * @brief Board pin configuration for ESP32-C6 OPAL Device
 * 
 * This board configuration uses EXACT pinout values from the device datasheet.
 * All pins match hardware_config.h which is based on the official pinout table.
 */

#ifndef _BOARD_PINS_CONFIG_H_
#define _BOARD_PINS_CONFIG_H_

#include "driver/gpio.h"
#include "board_def.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Get I2S pin configuration for ESP32-C6 OPAL Device
 * 
 * Uses EXACT pinout from datasheet (via hardware_config.h):
 * - MCLK = GPIO19 (I2S_MCLK)
 * - BCK = GPIO20 (I2S_SCLK)
 * - LRCK = GPIO22 (I2S_LRCK)
 * - DOUT = GPIO21 (I2S_ASDOUT)
 * - DIN = GPIO23 (I2S_DSDIN)
 * 
 * @param port I2S port number (0 or 1)
 * @param i2s_config Pointer to board_i2s_pin_t structure to fill
 * @return ESP_OK on success
 */
esp_err_t get_i2s_pins(int port, board_i2s_pin_t *i2s_config);

/**
 * @brief Get I2C pin configuration for ESP32-C6 OPAL Device
 * 
 * Uses EXACT pinout from datasheet:
 * - SDA = GPIO8
 * - SCL = GPIO7
 * 
 * @param port I2C port number (i2c_port_t)
 * @param i2c_config Pointer to i2c_config_t structure to fill
 * @return ESP_OK on success
 */
esp_err_t get_i2c_pins(i2c_port_t port, i2c_config_t *i2c_config);

#ifdef __cplusplus
}
#endif

#endif /* _BOARD_PINS_CONFIG_H_ */

