/**
 * @file audio_codec.c
 * @brief ES8311 Audio Codec Driver Implementation
 *
 * Complete implementation of ES8311 codec control for healthcare VoIP.
 *
 * @version 1.0
 * @date 2025-11-17
 * @author OPAL Project Team
 *
 * SPDX-License-Identifier: MIT
 */

#include "audio_codec.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include <string.h>
#include <math.h>

static const char* TAG = "audio_codec";

/* ========================================================================
 * ES8311 Register Definitions
 * ======================================================================== */

#define ES8311_REG00_RESET          0x00
#define ES8311_REG01_CLK_MANAGER    0x01
#define ES8311_REG02_CLK_MANAGER    0x02
#define ES8311_REG03_CLK_MANAGER    0x03
#define ES8311_REG04_CLK_MANAGER    0x04
#define ES8311_REG05_SYSTEM_CTRL1   0x05
#define ES8311_REG06_SYSTEM_CTRL2   0x06
#define ES8311_REG07_SYSTEM_CTRL3   0x07
#define ES8311_REG08_SYSTEM_CTRL4   0x08
#define ES8311_REG09_SDP_IN         0x09
#define ES8311_REG0A_SDP_OUT        0x0A
#define ES8311_REG0B_SYSTEM_CTRL5   0x0B
#define ES8311_REG0C_SYSTEM_CTRL6   0x0C
#define ES8311_REG0D_SYSTEM_CTRL7   0x0D
#define ES8311_REG0E_SYSTEM_CTRL8   0x0E
#define ES8311_REG0F_SYSTEM_CTRL9   0x0F
#define ES8311_REG10_SYSTEM_CTRL10  0x10
#define ES8311_REG11_SYSTEM_CTRL11  0x11
#define ES8311_REG12_SYSTEM_CTRL12  0x12
#define ES8311_REG13_SYSTEM_CTRL13  0x13
#define ES8311_REG14_SYSTEM_CTRL14  0x14
#define ES8311_REG15_ADC_CTRL1      0x15
#define ES8311_REG16_ADC_CTRL2      0x16
#define ES8311_REG17_ADC_CTRL3      0x17
#define ES8311_REG18_ADC_CTRL4      0x18
#define ES8311_REG19_ADC_CTRL5      0x19
#define ES8311_REG1A_ADC_CTRL6      0x1A
#define ES8311_REG1B_ADC_CTRL7      0x1B
#define ES8311_REG1C_ADC_CTRL8      0x1C
#define ES8311_REG1D_ADC_CTRL9      0x1D
#define ES8311_REG1E_ADC_CTRL10     0x1E
#define ES8311_REG1F_ADC_CTRL11     0x1F
#define ES8311_REG20_ADC_CTRL12     0x20
#define ES8311_REG21_ADC_CTRL13     0x21
#define ES8311_REG22_ADC_CTRL14     0x22
#define ES8311_REG23_DAC_CTRL1      0x23
#define ES8311_REG24_DAC_CTRL2      0x24
#define ES8311_REG25_DAC_CTRL3      0x25
#define ES8311_REG26_DAC_CTRL4      0x26
#define ES8311_REG27_DAC_CTRL5      0x27
#define ES8311_REG28_DAC_CTRL6      0x28
#define ES8311_REG29_DAC_CTRL7      0x29
#define ES8311_REG2A_DAC_CTRL8      0x2A
#define ES8311_REG2B_DAC_CTRL9      0x2B
#define ES8311_REG2C_DAC_CTRL10     0x2C
#define ES8311_REG2D_DAC_CTRL11     0x2D
#define ES8311_REG2E_DAC_CTRL12     0x2E
#define ES8311_REG2F_DAC_CTRL13     0x2F
#define ES8311_REG30_DAC_CTRL14     0x30
#define ES8311_REG31_DAC_CTRL15     0x31
#define ES8311_REG32_DAC_CTRL16     0x32
#define ES8311_REG33_DAC_CTRL17     0x33
#define ES8311_REG34_CHIP_ID1       0x34
#define ES8311_REG35_CHIP_ID2       0x35

/* ========================================================================
 * Internal State
 * ======================================================================== */

typedef struct {
    bool initialized;
    audio_mode_t mode;
    audio_profile_t profile;
    audio_codec_config_t config;
    audio_stats_t stats;
    audio_event_cb_t event_callback;
    void* event_user_ctx;
    bool amp_enabled;
    bool muted;
    bool mic_muted;
    uint8_t priority_level;
    SemaphoreHandle_t mutex;
} audio_state_t;

static audio_state_t g_audio_state = {0};

/* ========================================================================
 * I2C Communication Functions
 * ======================================================================== */

/**
 * @brief Write single byte to ES8311 register
 */
static esp_err_t es8311_write_reg(uint8_t reg, uint8_t value) {
    i2c_cmd_handle_t cmd = i2c_cmd_link_create();
    i2c_master_start(cmd);
    i2c_master_write_byte(cmd, (CODEC_I2C_ADDR << 1) | I2C_MASTER_WRITE, true);
    i2c_master_write_byte(cmd, reg, true);
    i2c_master_write_byte(cmd, value, true);
    i2c_master_stop(cmd);
    esp_err_t ret = i2c_master_cmd_begin(CODEC_I2C_PORT, cmd, pdMS_TO_TICKS(1000));
    i2c_cmd_link_delete(cmd);

    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to write register 0x%02x: %s", reg, esp_err_to_name(ret));
    }
    return ret;
}

/**
 * @brief Read single byte from ES8311 register
 */
static esp_err_t es8311_read_reg(uint8_t reg, uint8_t* value) {
    i2c_cmd_handle_t cmd = i2c_cmd_link_create();
    i2c_master_start(cmd);
    i2c_master_write_byte(cmd, (CODEC_I2C_ADDR << 1) | I2C_MASTER_WRITE, true);
    i2c_master_write_byte(cmd, reg, true);
    i2c_master_start(cmd);
    i2c_master_write_byte(cmd, (CODEC_I2C_ADDR << 1) | I2C_MASTER_READ, true);
    i2c_master_read_byte(cmd, value, I2C_MASTER_NACK);
    i2c_master_stop(cmd);
    esp_err_t ret = i2c_master_cmd_begin(CODEC_I2C_PORT, cmd, pdMS_TO_TICKS(1000));
    i2c_cmd_link_delete(cmd);

    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to read register 0x%02x: %s", reg, esp_err_to_name(ret));
    }
    return ret;
}

/**
 * @brief Update specific bits in ES8311 register
 */
static esp_err_t es8311_update_bits(uint8_t reg, uint8_t mask, uint8_t value) {
    uint8_t old_value;
    esp_err_t ret = es8311_read_reg(reg, &old_value);
    if (ret != ESP_OK) {
        return ret;
    }

    uint8_t new_value = (old_value & ~mask) | (value & mask);
    if (new_value != old_value) {
        return es8311_write_reg(reg, new_value);
    }

    return ESP_OK;
}

/* ========================================================================
 * I2C Bus Initialization
 * ======================================================================== */

static esp_err_t i2c_bus_init(void) {
    i2c_config_t i2c_config = {
        .mode = I2C_MODE_MASTER,
        .sda_io_num = CODEC_I2C_SDA_PIN,
        .scl_io_num = CODEC_I2C_SCL_PIN,
        .sda_pullup_en = GPIO_PULLUP_ENABLE,
        .scl_pullup_en = GPIO_PULLUP_ENABLE,
        .master.clk_speed = CODEC_I2C_FREQ_HZ,
    };

    esp_err_t ret = i2c_param_config(CODEC_I2C_PORT, &i2c_config);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "I2C param config failed: %s", esp_err_to_name(ret));
        return ret;
    }

    ret = i2c_driver_install(CODEC_I2C_PORT, I2C_MODE_MASTER, 0, 0, 0);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "I2C driver install failed: %s", esp_err_to_name(ret));
        return ret;
    }

    ESP_LOGI(TAG, "I2C bus initialized (SCL=%d, SDA=%d)", CODEC_I2C_SCL_PIN, CODEC_I2C_SDA_PIN);
    return ESP_OK;
}

/* ========================================================================
 * I2S Bus Initialization
 * ======================================================================== */

static esp_err_t i2s_bus_init(const audio_codec_config_t* config) {
    i2s_config_t i2s_config = {
        .mode = I2S_MODE_MASTER | I2S_MODE_TX | I2S_MODE_RX,
        .sample_rate = config->sample_rate,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
        .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
        .communication_format = I2S_COMM_FORMAT_STAND_I2S,
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = DMA_BUF_COUNT,
        .dma_buf_len = DMA_BUF_LEN,
        .use_apll = true,
        .tx_desc_auto_clear = true,
        .fixed_mclk = 0,
        .mclk_multiple = I2S_MCLK_MULTIPLE_256,
        .bits_per_chan = I2S_BITS_PER_CHAN_16BIT,
    };

    esp_err_t ret = i2s_driver_install(CODEC_I2S_PORT, &i2s_config, 0, NULL);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "I2S driver install failed: %s", esp_err_to_name(ret));
        return ret;
    }

    i2s_pin_config_t pin_config = {
        .mck_io_num = CODEC_I2S_MCLK_PIN,
        .bck_io_num = CODEC_I2S_BCK_PIN,
        .ws_io_num = CODEC_I2S_WS_PIN,
        .data_out_num = CODEC_I2S_DOUT_PIN,
        .data_in_num = CODEC_I2S_DIN_PIN,
    };

    ret = i2s_set_pin(CODEC_I2S_PORT, &pin_config);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "I2S set pin failed: %s", esp_err_to_name(ret));
        i2s_driver_uninstall(CODEC_I2S_PORT);
        return ret;
    }

    ESP_LOGI(TAG, "I2S bus initialized (SR=%d, BPS=%d, CH=%d)",
             config->sample_rate, config->bits_per_sample, config->channels);
    return ESP_OK;
}

/* ========================================================================
 * ES8311 Codec Configuration
 * ======================================================================== */

/**
 * @brief Reset ES8311 codec
 */
static esp_err_t es8311_reset(void) {
    ESP_LOGI(TAG, "Resetting ES8311 codec");
    esp_err_t ret = es8311_write_reg(ES8311_REG00_RESET, 0x1F);
    vTaskDelay(pdMS_TO_TICKS(100));
    ret |= es8311_write_reg(ES8311_REG00_RESET, 0x00);
    vTaskDelay(pdMS_TO_TICKS(10));
    return ret;
}

/**
 * @brief Configure ES8311 clock management
 */
static esp_err_t es8311_config_clock(uint32_t sample_rate) {
    esp_err_t ret = ESP_OK;

    // Master clock from MCLK pin, internal clock divider
    ret |= es8311_write_reg(ES8311_REG01_CLK_MANAGER, 0x30);

    // Configure sample rate dependent registers
    switch (sample_rate) {
        case SAMPLE_RATE_8KHZ:
            ret |= es8311_write_reg(ES8311_REG02_CLK_MANAGER, 0x00);
            ret |= es8311_write_reg(ES8311_REG03_CLK_MANAGER, 0x10);
            ret |= es8311_write_reg(ES8311_REG04_CLK_MANAGER, 0x10);
            break;

        case SAMPLE_RATE_16KHZ:
            ret |= es8311_write_reg(ES8311_REG02_CLK_MANAGER, 0x00);
            ret |= es8311_write_reg(ES8311_REG03_CLK_MANAGER, 0x08);
            ret |= es8311_write_reg(ES8311_REG04_CLK_MANAGER, 0x08);
            break;

        case SAMPLE_RATE_32KHZ:
            ret |= es8311_write_reg(ES8311_REG02_CLK_MANAGER, 0x00);
            ret |= es8311_write_reg(ES8311_REG03_CLK_MANAGER, 0x04);
            ret |= es8311_write_reg(ES8311_REG04_CLK_MANAGER, 0x04);
            break;

        case SAMPLE_RATE_48KHZ:
        default:
            ret |= es8311_write_reg(ES8311_REG02_CLK_MANAGER, 0x00);
            ret |= es8311_write_reg(ES8311_REG03_CLK_MANAGER, 0x02);
            ret |= es8311_write_reg(ES8311_REG04_CLK_MANAGER, 0x02);
            break;
    }

    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "Clock configured for %d Hz", sample_rate);
    }
    return ret;
}

/**
 * @brief Configure ES8311 system control
 */
static esp_err_t es8311_config_system(void) {
    esp_err_t ret = ESP_OK;

    // Power up analog, enable bias, enable ADC/DAC
    ret |= es8311_write_reg(ES8311_REG0D_SYSTEM_CTRL7, 0x01);
    ret |= es8311_write_reg(ES8311_REG0E_SYSTEM_CTRL8, 0x02);
    ret |= es8311_write_reg(ES8311_REG0F_SYSTEM_CTRL9, 0x44);
    ret |= es8311_write_reg(ES8311_REG10_SYSTEM_CTRL10, 0x00);
    ret |= es8311_write_reg(ES8311_REG11_SYSTEM_CTRL11, 0x02);
    ret |= es8311_write_reg(ES8311_REG12_SYSTEM_CTRL12, 0x00);
    ret |= es8311_write_reg(ES8311_REG13_SYSTEM_CTRL13, 0x10);
    ret |= es8311_write_reg(ES8311_REG14_SYSTEM_CTRL14, 0x1A);

    return ret;
}

/**
 * @brief Configure ES8311 ADC (microphone input)
 */
static esp_err_t es8311_config_adc(void) {
    esp_err_t ret = ESP_OK;

    // ADC input: Differential, PGA gain = 18dB
    ret |= es8311_write_reg(ES8311_REG16_ADC_CTRL2, 0x03);
    ret |= es8311_write_reg(ES8311_REG17_ADC_CTRL3, 0x18);  // PGA gain
    ret |= es8311_write_reg(ES8311_REG18_ADC_CTRL4, 0x00);
    ret |= es8311_write_reg(ES8311_REG19_ADC_CTRL5, 0xC0);
    ret |= es8311_write_reg(ES8311_REG1A_ADC_CTRL6, 0x00);

    // ADC digital volume
    ret |= es8311_write_reg(ES8311_REG16_ADC_CTRL2, 0x00);  // 0dB digital gain

    return ret;
}

/**
 * @brief Configure ES8311 DAC (speaker output)
 */
static esp_err_t es8311_config_dac(void) {
    esp_err_t ret = ESP_OK;

    // DAC enable, unmute
    ret |= es8311_write_reg(ES8311_REG31_DAC_CTRL15, 0x00);
    ret |= es8311_write_reg(ES8311_REG32_DAC_CTRL16, 0xBF);

    // DAC volume (0dB)
    ret |= es8311_write_reg(ES8311_REG32_DAC_CTRL16, 0x00);

    return ret;
}

/**
 * @brief Configure ES8311 I2S format
 */
static esp_err_t es8311_config_format(void) {
    esp_err_t ret = ESP_OK;

    // I2S format, 16-bit, left justified
    ret |= es8311_write_reg(ES8311_REG09_SDP_IN, 0x00);   // Slave mode, I2S
    ret |= es8311_write_reg(ES8311_REG0A_SDP_OUT, 0x00);  // I2S output format

    return ret;
}

/**
 * @brief Initialize ES8311 codec with full configuration
 */
static esp_err_t es8311_codec_init(const audio_codec_config_t* config) {
    esp_err_t ret = ESP_OK;

    // Reset codec
    ret = es8311_reset();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "ES8311 reset failed");
        return ret;
    }

    // Configure clocks
    ret = es8311_config_clock(config->sample_rate);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "ES8311 clock config failed");
        return ret;
    }

    // Configure system
    ret = es8311_config_system();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "ES8311 system config failed");
        return ret;
    }

    // Configure I2S format
    ret = es8311_config_format();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "ES8311 format config failed");
        return ret;
    }

    // Configure ADC
    ret = es8311_config_adc();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "ES8311 ADC config failed");
        return ret;
    }

    // Configure DAC
    ret = es8311_config_dac();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "ES8311 DAC config failed");
        return ret;
    }

    ESP_LOGI(TAG, "ES8311 codec initialized successfully");
    return ESP_OK;
}

/* ========================================================================
 * GPIO Initialization for Amplifier Control
 * ======================================================================== */

static esp_err_t amp_gpio_init(void) {
    // Configure CTRL pin (enable/shutdown)
    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << AMP_CTRL_PIN),
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    esp_err_t ret = gpio_config(&io_conf);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to configure AMP_CTRL_PIN");
        return ret;
    }

    // Configure BYPASS pin (normal/bypass mode)
    io_conf.pin_bit_mask = (1ULL << AMP_BYPASS_PIN);
    ret = gpio_config(&io_conf);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to configure AMP_BYPASS_PIN");
        return ret;
    }

    // Initial state: Amplifier disabled, normal mode
    gpio_set_level(AMP_CTRL_PIN, 0);
    gpio_set_level(AMP_BYPASS_PIN, 0);

    ESP_LOGI(TAG, "Amplifier GPIO initialized (CTRL=%d, BYP=%d)",
             AMP_CTRL_PIN, AMP_BYPASS_PIN);
    return ESP_OK;
}

/* ========================================================================
 * Public API Implementation
 * ======================================================================== */

esp_err_t audio_codec_init(const audio_codec_config_t* config) {
    if (g_audio_state.initialized) {
        ESP_LOGW(TAG, "Audio codec already initialized");
        return ESP_OK;
    }

    ESP_LOGI(TAG, "Initializing audio codec system");

    // Create mutex
    g_audio_state.mutex = xSemaphoreCreateMutex();
    if (g_audio_state.mutex == NULL) {
        ESP_LOGE(TAG, "Failed to create mutex");
        return ESP_ERR_NO_MEM;
    }

    // Initialize I2C bus
    esp_err_t ret = i2c_bus_init();
    if (ret != ESP_OK) {
        vSemaphoreDelete(g_audio_state.mutex);
        return ret;
    }

    // Initialize amplifier GPIO
    ret = amp_gpio_init();
    if (ret != ESP_OK) {
        i2c_driver_delete(CODEC_I2C_PORT);
        vSemaphoreDelete(g_audio_state.mutex);
        return ret;
    }

    // Initialize I2S bus
    ret = i2s_bus_init(config);
    if (ret != ESP_OK) {
        i2c_driver_delete(CODEC_I2C_PORT);
        vSemaphoreDelete(g_audio_state.mutex);
        return ret;
    }

    // Initialize ES8311 codec
    ret = es8311_codec_init(config);
    if (ret != ESP_OK) {
        i2s_driver_uninstall(CODEC_I2S_PORT);
        i2c_driver_delete(CODEC_I2C_PORT);
        vSemaphoreDelete(g_audio_state.mutex);
        return ret;
    }

    // Save configuration
    memcpy(&g_audio_state.config, config, sizeof(audio_codec_config_t));
    g_audio_state.mode = AUDIO_MODE_IDLE;
    g_audio_state.profile = config->profile;
    g_audio_state.initialized = true;
    g_audio_state.amp_enabled = false;
    g_audio_state.muted = false;
    g_audio_state.mic_muted = false;
    g_audio_state.priority_level = 0;
    memset(&g_audio_state.stats, 0, sizeof(audio_stats_t));

    // Set initial volume
    audio_codec_set_volume(config->volume);

    ESP_LOGI(TAG, "Audio codec system initialized successfully");
    return ESP_OK;
}

esp_err_t audio_codec_deinit(void) {
    if (!g_audio_state.initialized) {
        return ESP_OK;
    }

    ESP_LOGI(TAG, "Deinitializing audio codec system");

    // Stop any active streams
    audio_codec_stop_playback();
    audio_codec_stop_record();

    // Disable amplifier
    audio_amp_disable();

    // Shutdown codec
    es8311_write_reg(ES8311_REG00_RESET, 0x1F);

    // Uninstall drivers
    i2s_driver_uninstall(CODEC_I2S_PORT);
    i2c_driver_delete(CODEC_I2C_PORT);

    // Delete mutex
    vSemaphoreDelete(g_audio_state.mutex);

    memset(&g_audio_state, 0, sizeof(audio_state_t));

    ESP_LOGI(TAG, "Audio codec system deinitialized");
    return ESP_OK;
}

esp_err_t audio_codec_set_mode(audio_mode_t mode) {
    if (!g_audio_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }

    xSemaphoreTake(g_audio_state.mutex, portMAX_DELAY);

    ESP_LOGI(TAG, "Setting audio mode: %d", mode);
    g_audio_state.mode = mode;

    // Configure codec based on mode
    switch (mode) {
        case AUDIO_MODE_PLAYBACK:
            // Enable DAC, disable ADC
            es8311_write_reg(ES8311_REG0F_SYSTEM_CTRL9, 0x40);
            break;

        case AUDIO_MODE_RECORD:
            // Enable ADC, disable DAC
            es8311_write_reg(ES8311_REG0F_SYSTEM_CTRL9, 0x04);
            break;

        case AUDIO_MODE_DUPLEX:
            // Enable both ADC and DAC
            es8311_write_reg(ES8311_REG0F_SYSTEM_CTRL9, 0x44);
            break;

        case AUDIO_MODE_IDLE:
        default:
            // Disable both
            es8311_write_reg(ES8311_REG0F_SYSTEM_CTRL9, 0x00);
            break;
    }

    xSemaphoreGive(g_audio_state.mutex);
    return ESP_OK;
}

audio_mode_t audio_codec_get_mode(void) {
    return g_audio_state.mode;
}

esp_err_t audio_codec_set_profile(audio_profile_t profile) {
    if (!g_audio_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }

    ESP_LOGI(TAG, "Setting audio profile: %d", profile);
    g_audio_state.profile = profile;

    // Apply profile-specific settings
    switch (profile) {
        case AUDIO_PROFILE_VOICE_CALL:
            // Voice optimization: boost mid-range, reduce bass/treble
            audio_codec_set_agc(true);
            audio_codec_set_ns(true);
            audio_codec_set_aec(true);
            break;

        case AUDIO_PROFILE_ALERT:
            // Maximum volume, no processing
            audio_codec_set_volume(100);
            audio_codec_set_agc(false);
            break;

        case AUDIO_PROFILE_MUSIC:
            // Full bandwidth, minimal processing
            audio_codec_set_agc(false);
            audio_codec_set_ns(false);
            audio_codec_set_aec(false);
            break;

        case AUDIO_PROFILE_LOW_POWER:
            // Reduce sample rate, lower volume
            // Note: Sample rate change requires full reinit
            audio_codec_set_volume(50);
            break;
    }

    return ESP_OK;
}

/* ========================================================================
 * Volume and Gain Control
 * ======================================================================== */

esp_err_t audio_codec_set_volume(uint8_t volume) {
    if (!g_audio_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }

    if (volume > 100) {
        volume = 100;
    }

    // Convert 0-100 to ES8311 DAC volume (0x00 = 0dB, 0xBF = -95.5dB)
    // Invert: 100% = 0x00 (0dB), 0% = 0xBF (-95.5dB)
    uint8_t dac_vol = (uint8_t)(0xBF * (100 - volume) / 100);

    esp_err_t ret = es8311_write_reg(ES8311_REG32_DAC_CTRL16, dac_vol);
    if (ret == ESP_OK) {
        g_audio_state.config.volume = volume;
        ESP_LOGI(TAG, "Volume set to %d%%", volume);
    }

    return ret;
}

esp_err_t audio_codec_get_volume(uint8_t* volume) {
    if (!g_audio_state.initialized || volume == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    *volume = g_audio_state.config.volume;
    return ESP_OK;
}

esp_err_t audio_codec_set_mic_gain(uint8_t gain) {
    if (!g_audio_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }

    if (gain > 100) {
        gain = 100;
    }

    // Convert 0-100 to PGA gain (0-24dB)
    uint8_t pga_gain = (uint8_t)(24 * gain / 100);

    esp_err_t ret = es8311_write_reg(ES8311_REG17_ADC_CTRL3, pga_gain);
    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "Microphone gain set to %d dB", pga_gain);
    }

    return ret;
}

esp_err_t audio_codec_mute(bool mute) {
    if (!g_audio_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }

    g_audio_state.muted = mute;

    // Fast hardware mute via amplifier disable
    if (mute) {
        return audio_amp_disable();
    } else {
        return audio_amp_enable();
    }
}

esp_err_t audio_codec_mic_mute(bool mute) {
    if (!g_audio_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }

    g_audio_state.mic_muted = mute;

    // Mute ADC
    uint8_t value = mute ? 0x80 : 0x00;
    return es8311_write_reg(ES8311_REG16_ADC_CTRL2, value);
}

/* ========================================================================
 * Audio Stream Control
 * ======================================================================== */

esp_err_t audio_codec_start_playback(void) {
    if (!g_audio_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }

    ESP_LOGI(TAG, "Starting audio playback");

    // Enable amplifier first
    audio_amp_enable();

    // Enable DAC
    audio_codec_set_mode(AUDIO_MODE_PLAYBACK);

    // Start I2S
    i2s_start(CODEC_I2S_PORT);

    return ESP_OK;
}

esp_err_t audio_codec_stop_playback(void) {
    if (!g_audio_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }

    ESP_LOGI(TAG, "Stopping audio playback");

    // Stop I2S
    i2s_stop(CODEC_I2S_PORT);

    // Disable amplifier to save power
    audio_amp_disable();

    return ESP_OK;
}

esp_err_t audio_codec_start_record(void) {
    if (!g_audio_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }

    ESP_LOGI(TAG, "Starting audio recording");

    // Enable ADC
    audio_codec_set_mode(AUDIO_MODE_RECORD);

    // Start I2S
    i2s_start(CODEC_I2S_PORT);

    return ESP_OK;
}

esp_err_t audio_codec_stop_record(void) {
    if (!g_audio_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }

    ESP_LOGI(TAG, "Stopping audio recording");

    // Stop I2S
    i2s_stop(CODEC_I2S_PORT);

    return ESP_OK;
}

/* ========================================================================
 * Audio Data I/O
 * ======================================================================== */

esp_err_t audio_codec_write(const void* data, size_t size, size_t* bytes_written, uint32_t timeout_ms) {
    if (!g_audio_state.initialized || data == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    return i2s_write(CODEC_I2S_PORT, data, size, bytes_written, pdMS_TO_TICKS(timeout_ms));
}

esp_err_t audio_codec_read(void* data, size_t size, size_t* bytes_read, uint32_t timeout_ms) {
    if (!g_audio_state.initialized || data == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    return i2s_read(CODEC_I2S_PORT, data, size, bytes_read, pdMS_TO_TICKS(timeout_ms));
}

/* ========================================================================
 * Amplifier Control
 * ======================================================================== */

esp_err_t audio_amp_enable(void) {
    if (g_audio_state.amp_enabled) {
        return ESP_OK;
    }

    ESP_LOGI(TAG, "Enabling amplifier");

    // Enable amplifier
    gpio_set_level(AMP_CTRL_PIN, 1);

    // Anti-pop delay
    vTaskDelay(pdMS_TO_TICKS(50));

    g_audio_state.amp_enabled = true;
    return ESP_OK;
}

esp_err_t audio_amp_disable(void) {
    if (!g_audio_state.amp_enabled) {
        return ESP_OK;
    }

    ESP_LOGI(TAG, "Disabling amplifier");

    // Disable amplifier
    gpio_set_level(AMP_CTRL_PIN, 0);

    g_audio_state.amp_enabled = false;
    return ESP_OK;
}

bool audio_amp_is_enabled(void) {
    return g_audio_state.amp_enabled;
}

/* ========================================================================
 * Advanced Features (Stubs - Require ESP-ADF)
 * ======================================================================== */

esp_err_t audio_codec_set_aec(bool enable) {
    g_audio_state.config.enable_aec = enable;
    ESP_LOGI(TAG, "AEC %s", enable ? "enabled" : "disabled");
    // TODO: Integrate ESP-ADF AEC
    return ESP_OK;
}

esp_err_t audio_codec_set_ns(bool enable) {
    g_audio_state.config.enable_ns = enable;
    ESP_LOGI(TAG, "NS %s", enable ? "enabled" : "disabled");
    // TODO: Integrate ESP-ADF NS
    return ESP_OK;
}

esp_err_t audio_codec_set_agc(bool enable) {
    g_audio_state.config.enable_agc = enable;
    ESP_LOGI(TAG, "AGC %s", enable ? "enabled" : "disabled");
    // TODO: Integrate ESP-ADF AGC
    return ESP_OK;
}

/* ========================================================================
 * Event Handling
 * ======================================================================== */

esp_err_t audio_codec_register_event_callback(audio_event_cb_t callback, void* user_ctx) {
    g_audio_state.event_callback = callback;
    g_audio_state.event_user_ctx = user_ctx;
    return ESP_OK;
}

/* ========================================================================
 * Statistics
 * ======================================================================== */

esp_err_t audio_codec_get_stats(audio_stats_t* stats) {
    if (!g_audio_state.initialized || stats == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    memcpy(stats, &g_audio_state.stats, sizeof(audio_stats_t));
    return ESP_OK;
}

esp_err_t audio_codec_reset_stats(void) {
    memset(&g_audio_state.stats, 0, sizeof(audio_stats_t));
    return ESP_OK;
}

/* ========================================================================
 * Power Management
 * ======================================================================== */

esp_err_t audio_codec_sleep(void) {
    if (!g_audio_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }

    ESP_LOGI(TAG, "Entering sleep mode");

    // Disable amplifier
    audio_amp_disable();

    // Put codec in low-power mode
    es8311_write_reg(ES8311_REG00_RESET, 0x80);

    return ESP_OK;
}

esp_err_t audio_codec_wake(void) {
    if (!g_audio_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }

    ESP_LOGI(TAG, "Waking from sleep mode");

    // Wake codec
    es8311_codec_init(&g_audio_state.config);

    // Restore volume
    audio_codec_set_volume(g_audio_state.config.volume);

    return ESP_OK;
}

/* ========================================================================
 * Healthcare-Specific Functions
 * ======================================================================== */

esp_err_t audio_play_emergency_tone(uint16_t frequency_hz, uint32_t duration_ms) {
    ESP_LOGI(TAG, "Playing emergency tone: %d Hz for %d ms", frequency_hz, duration_ms);

    // Save current volume
    uint8_t saved_volume = g_audio_state.config.volume;

    // Set maximum volume
    audio_codec_set_volume(100);
    audio_codec_set_priority(3);

    // Enable amplifier
    audio_amp_enable();

    // Generate sine wave
    size_t samples = (g_audio_state.config.sample_rate * duration_ms) / 1000;
    int16_t* buffer = (int16_t*)malloc(samples * sizeof(int16_t));

    if (buffer) {
        for (size_t i = 0; i < samples; i++) {
            float t = (float)i / g_audio_state.config.sample_rate;
            buffer[i] = (int16_t)(sin(2.0 * M_PI * frequency_hz * t) * 32767 * 0.5);
        }

        size_t written;
        audio_codec_write(buffer, samples * sizeof(int16_t), &written, portMAX_DELAY);

        free(buffer);
    }

    // Restore volume
    audio_codec_set_volume(saved_volume);
    audio_codec_set_priority(0);

    return ESP_OK;
}

esp_err_t audio_set_hospital_mode(bool enable) {
    ESP_LOGI(TAG, "Hospital mode %s", enable ? "enabled" : "disabled");

    if (enable) {
        // Aggressive noise suppression
        audio_codec_set_ns(true);
        audio_codec_set_aec(true);
        audio_codec_set_agc(true);

        // Increase microphone gain for noisy environments
        audio_codec_set_mic_gain(80);
    } else {
        // Normal mode
        audio_codec_set_ns(false);
        audio_codec_set_aec(false);
        audio_codec_set_agc(false);
        audio_codec_set_mic_gain(50);
    }

    return ESP_OK;
}

esp_err_t audio_set_priority(uint8_t priority_level) {
    if (priority_level > 3) {
        priority_level = 3;
    }

    g_audio_state.priority_level = priority_level;
    ESP_LOGI(TAG, "Audio priority set to %d", priority_level);

    return ESP_OK;
}

/* ========================================================================
 * Diagnostics
 * ======================================================================== */

esp_err_t audio_run_loopback_test(uint32_t duration_ms) {
    ESP_LOGW(TAG, "Running loopback test for %d ms - USE LOW VOLUME!", duration_ms);

    // Set low volume to prevent feedback
    audio_codec_set_volume(20);

    // Enable duplex mode
    audio_codec_set_mode(AUDIO_MODE_DUPLEX);
    audio_amp_enable();

    // Simple loopback: read from mic, write to speaker
    int16_t buffer[256];
    size_t bytes_read, bytes_written;
    uint32_t start_time = xTaskGetTickCount();

    while ((xTaskGetTickCount() - start_time) < pdMS_TO_TICKS(duration_ms)) {
        audio_codec_read(buffer, sizeof(buffer), &bytes_read, 100);
        audio_codec_write(buffer, bytes_read, &bytes_written, 100);
    }

    // Stop loopback
    audio_codec_stop_playback();
    audio_codec_stop_record();

    ESP_LOGI(TAG, "Loopback test completed");
    return ESP_OK;
}

esp_err_t audio_test_amplifier(void) {
    ESP_LOGI(TAG, "Testing amplifier with 1kHz tone");
    return audio_play_emergency_tone(1000, 1000);
}

esp_err_t audio_get_chip_info(uint8_t* chip_id, uint8_t* version) {
    if (chip_id == NULL || version == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    esp_err_t ret = es8311_read_reg(ES8311_REG34_CHIP_ID1, chip_id);
    ret |= es8311_read_reg(ES8311_REG35_CHIP_ID2, version);

    ESP_LOGI(TAG, "ES8311 Chip ID: 0x%02X, Version: 0x%02X", *chip_id, *version);

    return ret;
}
