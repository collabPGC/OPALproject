/* VoIP Application for ESP32-C6 OPAL Device
 *
 * This example demonstrates VoIP functionality using SIP/RTP protocol
 * Adapted from ESP-ADF VoIP example for ESP32-C6 OPAL device
 * Uses exact datasheet pinout values via ESP-ADF board configuration
 *
 * Features:
 * - SIP registration and call handling
 * - Full-duplex audio (G.711 A-law codec)
 * - Uses ESP32-C6 OPAL board configuration (datasheet pinout)
 * - ES8311 codec support
 */

#include <string.h>
#include "esp_system.h"
#include "esp_wifi.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "audio_mem.h"
#include "esp_peripherals.h"
#include "wifi_service.h"
#include "smart_config.h"
#include "sip_service_opal.h"
#include "esp_rtc.h"
#include "av_stream.h"
#include "audio_sys.h"
#include "algorithm_stream.h"
#include "audio_idf_version.h"
#include "board.h"

#if (ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(4, 1, 0))
#include "esp_netif.h"
#else
#include "tcpip_adapter.h"
#endif

static const char *TAG = "VOIP_OPAL";

// Configuration - set these via menuconfig or define here
#define WIFI_SSID   CONFIG_WIFI_SSID
#define WIFI_PWD    CONFIG_WIFI_PASSWORD
#define SIP_URI     CONFIG_SIP_URI

// Audio configuration for VoIP
#define AUDIO_CODEC_SAMPLE_RATE    8000   // G.711 uses 8kHz
#define AUDIO_HAL_SAMPLE_RATE      16000  // I2S sample rate (can be different)
#define PCM_FRAME_SIZE             320    // Frame size for 8kHz
#define I2S_CHANNELS               1      // Mono (1 channel)
#define I2S_DEFAULT_BITS           16     // 16-bit audio

// External SIP handle (can be accessed from other modules)
esp_rtc_handle_t esp_sip = NULL;
static bool is_smart_config = false;
static av_stream_handle_t av_stream = NULL;
static periph_service_handle_t wifi_serv = NULL;

/**
 * @brief WiFi service event callback
 * 
 * Handles WiFi connection/disconnection events
 * Starts SIP service when WiFi is connected
 */
static esp_err_t wifi_service_cb(periph_service_handle_t handle, periph_service_event_t *evt, void *ctx)
{
    ESP_LOGD(TAG, "WiFi event type:%d, source:%p, data:%p, len:%d, ctx:%p",
             evt->type, evt->source, evt->data, evt->len, ctx);
             
    if (evt->type == WIFI_SERV_EVENT_CONNECTED) {
        ESP_LOGI(TAG, "WiFi connected - Starting SIP service");
        is_smart_config = false;
        
        // Start SIP service when WiFi is connected
        ESP_LOGI(TAG, "Creating SIP service with URI: %s", SIP_URI);
        esp_sip = sip_service_start(av_stream, SIP_URI);
        
        if (esp_sip == NULL) {
            ESP_LOGE(TAG, "Failed to start SIP service");
        } else {
            ESP_LOGI(TAG, "SIP service started successfully");
        }
        
    } else if (evt->type == WIFI_SERV_EVENT_DISCONNECTED) {
        ESP_LOGI(TAG, "WiFi disconnected");
        
        // Stop SIP service when WiFi disconnects
        if (esp_sip != NULL) {
            ESP_LOGI(TAG, "Stopping SIP service due to WiFi disconnect");
            sip_service_stop(esp_sip);
            esp_sip = NULL;
        }
        
        if (is_smart_config == false) {
            ESP_LOGW(TAG, "WiFi disconnected - please reconnect");
        }
        
    } else if (evt->type == WIFI_SERV_EVENT_SETTING_TIMEOUT) {
        ESP_LOGW(TAG, "WiFi setting timeout");
        is_smart_config = false;
    }

    return ESP_OK;
}

/**
 * @brief Setup WiFi service
 * 
 * Configures and starts WiFi service with smart config support
 * 
 * @return WiFi service handle
 */
static periph_service_handle_t setup_wifi()
{
    int reg_idx = 0;
    
    // Configure WiFi service
    wifi_service_config_t cfg = WIFI_SERVICE_DEFAULT_CONFIG();
    cfg.evt_cb = wifi_service_cb;
    cfg.setting_timeout_s = 300;  // 5 minutes timeout
    cfg.max_retry_time = 2;
    periph_service_handle_t wifi_serv = wifi_service_create(&cfg);

    // Setup smart config (for easy WiFi configuration)
    smart_config_info_t info = SMART_CONFIG_INFO_DEFAULT();
    esp_wifi_setting_handle_t h = smart_config_create(&info);
    esp_wifi_setting_register_notify_handle(h, (void *)wifi_serv);
    wifi_service_register_setting_handle(wifi_serv, h, &reg_idx);

    // Configure WiFi credentials
    wifi_config_t sta_cfg = {0};
    if (strlen(WIFI_SSID) > 0 && strlen(WIFI_PWD) > 0) {
        strncpy((char *)&sta_cfg.sta.ssid, WIFI_SSID, sizeof(sta_cfg.sta.ssid));
        strncpy((char *)&sta_cfg.sta.password, WIFI_PWD, sizeof(sta_cfg.sta.password));
        wifi_service_set_sta_info(wifi_serv, &sta_cfg);
        wifi_service_connect(wifi_serv);
        ESP_LOGI(TAG, "Connecting to WiFi: %s", WIFI_SSID);
    } else {
        ESP_LOGW(TAG, "WiFi SSID/Password not configured - use smart config");
    }

    return wifi_serv;
}

/**
 * @brief Main application entry point
 * 
 * Initializes:
 * 1. NVS (Non-Volatile Storage)
 * 2. Network interface
 * 3. Peripherals
 * 4. Audio stream (with AEC)
 * 5. Tone player
 * 6. WiFi service
 * 7. SIP service (when WiFi connects)
 */
void app_main()
{
    esp_log_level_set("*", ESP_LOG_INFO);
    esp_log_level_set("AUDIO_ELEMENT", ESP_LOG_ERROR);
    AUDIO_MEM_SHOW(TAG);

    ESP_LOGI(TAG, "========================================");
    ESP_LOGI(TAG, "VoIP Application - ESP32-C6 OPAL");
    ESP_LOGI(TAG, "Using datasheet pinout via ESP-ADF");
    ESP_LOGI(TAG, "========================================");

    // Initialize NVS
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES) {
        ESP_LOGW(TAG, "NVS partition was truncated - erasing and retrying");
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
    }
    ESP_ERROR_CHECK(err);

    // Initialize network interface
#if (ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(4, 1, 0))
    ESP_ERROR_CHECK(esp_netif_init());
#else
    tcpip_adapter_init();
#endif

    ESP_LOGI(TAG, "[1.0] Initialize peripherals management");
    esp_periph_config_t periph_cfg = DEFAULT_ESP_PERIPH_SET_CONFIG();
    esp_periph_set_handle_t set = esp_periph_set_init(&periph_cfg);

    ESP_LOGI(TAG, "[1.1] Initialize audio board (ESP32-C6 OPAL)");
    ESP_LOGI(TAG, "Using datasheet pinout: I2S GPIO19/20/21/22/23, I2C GPIO7/8");
    
    // Initialize audio board (uses our custom esp32c6_opal board config)
    // This automatically uses exact datasheet pinout values
    audio_board_handle_t board_handle = audio_board_init();
    if (board_handle == NULL) {
        ESP_LOGE(TAG, "Failed to initialize audio board");
        return;
    }
    
    // Start codec in both modes (playback and recording)
    audio_hal_ctrl_codec(board_handle->audio_hal, AUDIO_HAL_CODEC_MODE_BOTH, AUDIO_HAL_CTRL_START);
    audio_hal_set_volume(board_handle->audio_hal, 80);  // Set volume to 80%

    ESP_LOGI(TAG, "[2.0] Initialize audio/video stream");
    ESP_LOGI(TAG, "Audio codec: G.711 A-law (8kHz, mono)");
    ESP_LOGI(TAG, "AEC: Enabled");
    
    // Configure audio/video stream for VoIP
    av_stream_config_t av_stream_config = {
        .enable_aec = true,                    // Enable Acoustic Echo Cancellation
        .acodec_samplerate = AUDIO_CODEC_SAMPLE_RATE,  // 8kHz for G.711
        .acodec_type = AV_ACODEC_G711A,        // G.711 A-law codec
        .vcodec_type = AV_VCODEC_NULL,         // No video
        .hal = {
            .audio_samplerate = AUDIO_HAL_SAMPLE_RATE,  // 16kHz I2S sample rate
            .audio_framesize = PCM_FRAME_SIZE,          // Frame size
        },
    };
    
    av_stream = av_stream_init(&av_stream_config);
    AUDIO_NULL_CHECK(TAG, av_stream, return);

    ESP_LOGI(TAG, "[3.0] Initialize tone player");
    audio_player_int_tone_init(AUDIO_HAL_SAMPLE_RATE, I2S_CHANNELS, I2S_DEFAULT_BITS);

    ESP_LOGI(TAG, "[4.0] Create WiFi service");
    wifi_serv = setup_wifi();

    ESP_LOGI(TAG, "[5.0] VoIP application initialized");
    ESP_LOGI(TAG, "Waiting for WiFi connection...");
    ESP_LOGI(TAG, "SIP service will start automatically when WiFi connects");
    ESP_LOGI(TAG, "");
    ESP_LOGI(TAG, "SIP URI: %s", SIP_URI);
    ESP_LOGI(TAG, "");
    ESP_LOGI(TAG, "To make a call, use: esp_rtc_call(esp_sip, \"extension_number\")");
    ESP_LOGI(TAG, "To answer a call, use: esp_rtc_answer(esp_sip)");
    ESP_LOGI(TAG, "To hang up, use: esp_rtc_bye(esp_sip)");

    // Main loop - monitor system stats
    while (1) {
        audio_sys_get_real_time_stats();
        AUDIO_MEM_SHOW(TAG);
        vTaskDelay(15000 / portTICK_PERIOD_MS);  // Every 15 seconds
    }
}

