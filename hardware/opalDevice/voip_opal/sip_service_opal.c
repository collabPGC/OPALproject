/*
 * ESPRESSIF MIT License
 *
 * Copyright (c) 2023 <ESPRESSIF SYSTEMS (SHANGHAI) CO., LTD>
 *
 * Permission is hereby granted for use on all ESPRESSIF SYSTEMS products, in which case,
 * it is free of charge, to any person obtaining a copy of this software and associated
 * documentation files (the "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software is furnished
 * to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * 
 * SIP Service for ESP32-C6 OPAL Device
 * 
 * Adapted from ESP-ADF VoIP example
 * Uses exact datasheet pinout values for I2S/I2C
 * Compatible with ESP32-C6 and ES8311 codec
 */

#include "string.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "sip_service_opal.h"
#include "media_lib_adapter.h"
#include "media_lib_netif.h"
#include "audio_error.h"

static const char *TAG = "SIP_SERVICE_OPAL";

/**
 * @brief Get local network IP address for RTP
 * 
 * Returns the IP address of the WiFi station interface
 * This is used as the local address for RTP communication
 * 
 * @return Local IP address as string (static buffer)
 */
static char *_get_network_ip()
{
    media_lib_ipv4_info_t ip_info;
    media_lib_netif_get_ipv4_info(MEDIA_LIB_NET_TYPE_STA, &ip_info);
    return media_lib_ipv4_ntoa(&ip_info.ip);
}

/**
 * @brief SIP event handler
 * 
 * Handles all SIP events from the esp_rtc library:
 * - Registration events
 * - Call events (incoming/outgoing)
 * - Audio session events
 * - Error events
 * 
 * @param event SIP event type
 * @param ctx Context (av_stream_handle_t)
 * @return ESP_OK on success
 */
static int _esp_sip_event_handler(esp_rtc_event_t event, void *ctx)
{
    av_stream_handle_t av_stream = (av_stream_handle_t) ctx;
    ESP_LOGD(TAG, "_esp_sip_event_handler event %d", event);
    
    switch ((int)event) {
        case ESP_RTC_EVENT_REGISTERED:
            ESP_LOGI(TAG, "ESP_RTC_EVENT_REGISTERED - Successfully registered with SIP server");
            audio_player_int_tone_play(tone_uri[TONE_TYPE_SERVER_CONNECT]);
            break;
            
        case ESP_RTC_EVENT_UNREGISTERED:
            ESP_LOGI(TAG, "ESP_RTC_EVENT_UNREGISTERED - Unregistered from SIP server");
            break;
            
        case ESP_RTC_EVENT_CALLING:
            ESP_LOGI(TAG, "ESP_RTC_EVENT_CALLING - Outgoing call in progress (Remote Ring...)");
            break;
            
        case ESP_RTC_EVENT_INCOMING:
            ESP_LOGI(TAG, "ESP_RTC_EVENT_INCOMING - Incoming call received");
            audio_player_int_tone_play(tone_uri[TONE_TYPE_ALARM]);
            break;
            
        case ESP_RTC_EVENT_AUDIO_SESSION_BEGIN:
            ESP_LOGI(TAG, "ESP_RTC_EVENT_AUDIO_SESSION_BEGIN - Starting audio session");
            // Start audio encoding (microphone -> RTP)
            av_audio_enc_start(av_stream);
            // Start audio decoding (RTP -> speaker)
            av_audio_dec_start(av_stream);
            break;
            
        case ESP_RTC_EVENT_AUDIO_SESSION_END:
            ESP_LOGI(TAG, "ESP_RTC_EVENT_AUDIO_SESSION_END - Ending audio session");
            // Stop audio encoding
            av_audio_enc_stop(av_stream);
            // Stop audio decoding
            av_audio_dec_stop(av_stream);
            break;
            
        case ESP_RTC_EVENT_CALL_ANSWERED:
            ESP_LOGI(TAG, "ESP_RTC_EVENT_CALL_ANSWERED - Call answered");
            break;
            
        case ESP_RTC_EVENT_HANGUP:
            ESP_LOGI(TAG, "ESP_RTC_EVENT_HANGUP - Call ended");
            break;
            
        case ESP_RTC_EVENT_ERROR:
            ESP_LOGE(TAG, "ESP_RTC_EVENT_ERROR - SIP/RTP error occurred");
            break;
            
        default:
            ESP_LOGW(TAG, "Unknown SIP event: %d", event);
            break;
    }

    return ESP_OK;
}

/**
 * @brief Send audio data callback (Microphone -> RTP)
 * 
 * Called by esp_rtc library when it needs audio data to send via RTP
 * Reads encoded audio from av_stream and returns it
 * 
 * @param data Buffer to fill with audio data
 * @param len Maximum length of data to return
 * @param ctx Context (av_stream_handle_t)
 * @return Number of bytes written to data buffer
 */
static int _send_audio(unsigned char *data, int len, void *ctx)
{
    av_stream_handle_t av_stream = (av_stream_handle_t) ctx;
    av_stream_frame_t frame = {0};
    frame.data = data;
    frame.len = len;
    
    // Read encoded audio from av_stream (microphone -> encoder -> RTP)
    if (av_audio_enc_read(&frame, av_stream) < 0) {
        return 0;
    }
    
    return frame.len;
}

/**
 * @brief Receive audio data callback (RTP -> Speaker)
 * 
 * Called by esp_rtc library when it receives audio data via RTP
 * Writes the data to av_stream for decoding and playback
 * 
 * @param data Audio data received from RTP
 * @param len Length of audio data
 * @param ctx Context (av_stream_handle_t)
 * @return Number of bytes processed
 */
static int _receive_audio(unsigned char *data, int len, void *ctx)
{
    // Handle DTMF events (if any)
    if ((len == 6) && !strncasecmp((char *)data, "DTMF-", 5)) {
        ESP_LOGI(TAG, "Receive DTMF Event ID : %d", data[5]);
        return 0;
    }
    
    // Write received audio to decoder (RTP -> decoder -> speaker)
    av_stream_handle_t av_stream = (av_stream_handle_t) ctx;
    av_stream_frame_t frame = {0};
    frame.data = data;
    frame.len = len;
    return av_audio_dec_write(&frame, av_stream);
}

/**
 * @brief Start SIP service for ESP32-C6 OPAL Device
 * 
 * Initializes the SIP/RTP service using esp_rtc library
 * Configures audio codec (G.711 A-law) and callbacks
 * Uses exact datasheet pinout via ESP-ADF board configuration
 * 
 * @param av_stream Audio/video stream handle (from av_stream_init())
 * @param uri SIP URI: "Transport://user:password@server:port"
 *           Example: "tcp://100:100@192.168.1.123:5060"
 * @return SIP handle on success, NULL on error
 */
esp_rtc_handle_t sip_service_start(av_stream_handle_t av_stream, const char *uri)
{
    AUDIO_NULL_CHECK(TAG, uri, return NULL);
    AUDIO_NULL_CHECK(TAG, av_stream, return NULL);
    
    ESP_LOGI(TAG, "Starting SIP service for ESP32-C6 OPAL");
    ESP_LOGI(TAG, "SIP URI: %s", uri);
    
    // Initialize media library network adapter
    media_lib_add_default_adapter();

    // Configure audio data callbacks
    // These callbacks are called by esp_rtc to send/receive audio via RTP
    esp_rtc_data_cb_t data_cb = {
        .send_audio = _send_audio,      // Microphone -> RTP
        .receive_audio = _receive_audio, // RTP -> Speaker
    };
    
    // Configure SIP/RTP service
    esp_rtc_config_t sip_service_config = {
        .uri = uri,                      // SIP URI (user:pass@server:port)
        .ctx = av_stream,                // Audio stream context
        .local_addr = _get_network_ip(), // Local IP for RTP
        .acodec_type = RTC_ACODEC_G711A, // Audio codec: G.711 A-law (8kHz, mono)
        .data_cb = &data_cb,             // Audio data callbacks
        .event_handler = _esp_sip_event_handler, // SIP event handler
    };
    
    ESP_LOGI(TAG, "Local IP address: %s", sip_service_config.local_addr);
    ESP_LOGI(TAG, "Audio codec: G.711 A-law (8kHz, mono)");
    
    // Initialize SIP/RTP service
    esp_rtc_handle_t sip_handle = esp_rtc_service_init(&sip_service_config);
    
    if (sip_handle == NULL) {
        ESP_LOGE(TAG, "Failed to initialize SIP service");
    } else {
        ESP_LOGI(TAG, "SIP service initialized successfully");
    }
    
    return sip_handle;
}

/**
 * @brief Stop SIP service
 * 
 * Deinitializes the SIP/RTP service and releases resources
 * 
 * @param esp_sip SIP handle returned from sip_service_start()
 * @return ESP_OK on success, ESP_FAIL on error
 */
int sip_service_stop(esp_rtc_handle_t esp_sip)
{
    int ret = ESP_FAIL;
    if (esp_sip) {
        ESP_LOGI(TAG, "Stopping SIP service");
        ret = esp_rtc_service_deinit(esp_sip);
        if (ret == ESP_OK) {
            ESP_LOGI(TAG, "SIP service stopped successfully");
        } else {
            ESP_LOGE(TAG, "Failed to stop SIP service");
        }
    } else {
        ESP_LOGW(TAG, "SIP handle is NULL");
    }
    return ret;
}

