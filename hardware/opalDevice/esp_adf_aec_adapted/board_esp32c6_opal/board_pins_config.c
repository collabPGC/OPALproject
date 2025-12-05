/**
 * @file board_pins_config.c
 * @brief Board pin configuration implementation for ESP32-C6 OPAL Device
 * 
 * CRITICAL: This uses EXACT pinout values from the device datasheet.
 * All pins are defined to match hardware_config.h which is based on the official pinout table.
 * 
 * Pinout from datasheet:
 * - I2S: GPIO19=MCLK, GPIO20=SCLK, GPIO22=LRCK, GPIO21=ASDOUT, GPIO23=DSDIN
 * - I2C: GPIO8=SDA, GPIO7=SCL
 */

#include "board_pins_config.h"
#include "esp_log.h"
#include "audio_error.h"
#include <string.h>

static const char *TAG = "BOARD_PINS_OPAL";

// CRITICAL: These are the EXACT pinout values from the device datasheet
// They match hardware_config.h which is based on the official pinout table
#define OPAL_I2S_MCK_PIN    GPIO_NUM_19  // I2S_MCLK (from datasheet)
#define OPAL_I2S_BCK_PIN    GPIO_NUM_20  // I2S_SCLK (from datasheet)
#define OPAL_I2S_LRCK_PIN   GPIO_NUM_22  // I2S_LRCK (from datasheet)
#define OPAL_I2S_DOUT_PIN   GPIO_NUM_21  // I2S_ASDOUT (from datasheet)
#define OPAL_I2S_DIN_PIN    GPIO_NUM_23  // I2S_DSDIN (from datasheet)

#define OPAL_I2C_SDA_PIN    GPIO_NUM_8   // SDA (from datasheet)
#define OPAL_I2C_SCL_PIN    GPIO_NUM_7   // SCL (from datasheet)

esp_err_t get_i2s_pins(int port, board_i2s_pin_t *i2s_config)
{
    AUDIO_NULL_CHECK(TAG, i2s_config, return ESP_FAIL);

    // ESP32-C6 OPAL Device uses I2S port 0
    if (port == 0) {
        // CRITICAL: Use EXACT pinout from datasheet
        i2s_config->bck_io_num = OPAL_I2S_BCK_PIN;      // GPIO20 (I2S_SCLK)
        i2s_config->ws_io_num = OPAL_I2S_LRCK_PIN;      // GPIO22 (I2S_LRCK)
        i2s_config->data_out_num = OPAL_I2S_DOUT_PIN;   // GPIO21 (I2S_ASDOUT)
        i2s_config->data_in_num = OPAL_I2S_DIN_PIN;     // GPIO23 (I2S_DSDIN)
        i2s_config->mck_io_num = OPAL_I2S_MCK_PIN;      // GPIO19 (I2S_MCLK)
        
        ESP_LOGI(TAG, "I2S pins configured for ESP32-C6 OPAL (port %d):", port);
        ESP_LOGI(TAG, "  MCLK=GPIO%d, BCK=GPIO%d, LRCK=GPIO%d, DOUT=GPIO%d, DIN=GPIO%d",
                 i2s_config->mck_io_num, i2s_config->bck_io_num, i2s_config->ws_io_num,
                 i2s_config->data_out_num, i2s_config->data_in_num);
    } else {
        // Port 1 not used on ESP32-C6 OPAL
        memset(i2s_config, -1, sizeof(board_i2s_pin_t));
        ESP_LOGW(TAG, "I2S port %d is not supported on ESP32-C6 OPAL", port);
        return ESP_ERR_NOT_SUPPORTED;
    }
    
    return ESP_OK;
}

esp_err_t get_i2c_pins(i2c_port_t port, i2c_config_t *i2c_config)
{
    AUDIO_NULL_CHECK(TAG, i2c_config, return ESP_FAIL);

    // ESP32-C6 OPAL Device uses I2C port 0
    if (port == I2C_NUM_0) {
        // CRITICAL: Use EXACT pinout from datasheet
        i2c_config->sda_io_num = OPAL_I2C_SDA_PIN;  // GPIO8 (SDA)
        i2c_config->scl_io_num = OPAL_I2C_SCL_PIN;  // GPIO7 (SCL)
        
        ESP_LOGI(TAG, "I2C pins configured for ESP32-C6 OPAL (port %d):", port);
        ESP_LOGI(TAG, "  SDA=GPIO%d, SCL=GPIO%d", i2c_config->sda_io_num, i2c_config->scl_io_num);
    } else {
        // Port 1 not used on ESP32-C6 OPAL
        i2c_config->sda_io_num = -1;
        i2c_config->scl_io_num = -1;
        ESP_LOGW(TAG, "I2C port %d is not supported on ESP32-C6 OPAL", port);
        return ESP_ERR_NOT_SUPPORTED;
    }
    
    return ESP_OK;
}

