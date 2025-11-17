/**
 * @file audio_codec.h
 * @brief ES8311 Audio Codec Driver for Healthcare VoIP System
 *
 * Complete audio codec configuration for OPAL wearable medical assistant.
 * Supports real-time voice calls, alerts, and audio playback with
 * healthcare-specific optimizations.
 *
 * Features:
 * - ES8311 I2C/I2S configuration
 * - NS4150B amplifier control
 * - Voice-optimized audio profiles
 * - Echo cancellation support
 * - Noise suppression for hospital environments
 * - Low-power modes for wearable devices
 *
 * @version 1.0
 * @date 2025-11-17
 * @author OPAL Project Team
 *
 * SPDX-License-Identifier: MIT
 */

#ifndef AUDIO_CODEC_H
#define AUDIO_CODEC_H

#include <stdint.h>
#include <stdbool.h>
#include "driver/i2s.h"
#include "driver/i2c.h"
#include "driver/gpio.h"
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/* ========================================================================
 * Configuration Constants
 * ======================================================================== */

/**
 * @brief I2C Configuration for ES8311
 */
#define CODEC_I2C_PORT          I2C_NUM_0
#define CODEC_I2C_ADDR          0x18        ///< ES8311 I2C address (7-bit)
#define CODEC_I2C_SCL_PIN       GPIO_NUM_9  ///< I2C clock pin
#define CODEC_I2C_SDA_PIN       GPIO_NUM_8  ///< I2C data pin
#define CODEC_I2C_FREQ_HZ       100000      ///< 100 kHz (safe for ES8311)

/**
 * @brief I2S Configuration for Audio Data
 */
#define CODEC_I2S_PORT          I2S_NUM_0
#define CODEC_I2S_BCK_PIN       GPIO_NUM_45 ///< Bit clock (SCLK)
#define CODEC_I2S_WS_PIN        GPIO_NUM_46 ///< Word select (LRCK)
#define CODEC_I2S_DOUT_PIN      GPIO_NUM_15 ///< Data out (to codec ADC)
#define CODEC_I2S_DIN_PIN       GPIO_NUM_16 ///< Data in (from codec DAC)
#define CODEC_I2S_MCLK_PIN      GPIO_NUM_0  ///< Master clock (256*Fs)

/**
 * @brief Amplifier Control Pins (NS4150B)
 */
#define AMP_CTRL_PIN            GPIO_NUM_48 ///< Amplifier enable/shutdown
#define AMP_BYPASS_PIN          GPIO_NUM_47 ///< Bypass mode control

/**
 * @brief Audio Sample Rates (Healthcare VoIP Standard)
 */
#define SAMPLE_RATE_8KHZ        8000        ///< Narrowband telephony
#define SAMPLE_RATE_16KHZ       16000       ///< Wideband (HD voice)
#define SAMPLE_RATE_32KHZ       32000       ///< Super wideband
#define SAMPLE_RATE_48KHZ       48000       ///< Full bandwidth audio

/**
 * @brief Default Audio Configuration
 */
#define DEFAULT_SAMPLE_RATE     SAMPLE_RATE_16KHZ
#define DEFAULT_BITS_PER_SAMPLE 16
#define DEFAULT_CHANNELS        1           ///< Mono for VoIP
#define DEFAULT_VOLUME          75          ///< 0-100 scale

/**
 * @brief DMA Buffer Configuration
 */
#define DMA_BUF_COUNT           8           ///< Number of DMA buffers
#define DMA_BUF_LEN             512         ///< Samples per buffer (32ms @ 16kHz)

/* ========================================================================
 * Type Definitions
 * ======================================================================== */

/**
 * @brief Audio codec operating modes
 */
typedef enum {
    AUDIO_MODE_IDLE = 0,        ///< No audio activity
    AUDIO_MODE_PLAYBACK,        ///< Playing audio (speaker only)
    AUDIO_MODE_RECORD,          ///< Recording audio (microphone only)
    AUDIO_MODE_DUPLEX,          ///< Full-duplex (call mode)
} audio_mode_t;

/**
 * @brief Audio profiles for different use cases
 */
typedef enum {
    AUDIO_PROFILE_VOICE_CALL,   ///< Optimized for voice calls
    AUDIO_PROFILE_ALERT,        ///< High-priority alerts
    AUDIO_PROFILE_MUSIC,        ///< Music playback
    AUDIO_PROFILE_LOW_POWER,    ///< Power-saving mode
} audio_profile_t;

/**
 * @brief Sample rate options
 */
typedef enum {
    SAMPLE_RATE_8K = SAMPLE_RATE_8KHZ,
    SAMPLE_RATE_16K = SAMPLE_RATE_16KHZ,
    SAMPLE_RATE_32K = SAMPLE_RATE_32KHZ,
    SAMPLE_RATE_48K = SAMPLE_RATE_48KHZ,
} sample_rate_t;

/**
 * @brief Audio codec configuration structure
 */
typedef struct {
    sample_rate_t sample_rate;      ///< Sample rate (8k/16k/32k/48k Hz)
    uint8_t bits_per_sample;        ///< Bits per sample (16/24/32)
    uint8_t channels;               ///< Number of channels (1=mono, 2=stereo)
    uint8_t volume;                 ///< Volume level (0-100)
    audio_profile_t profile;        ///< Audio profile
    bool enable_aec;                ///< Enable acoustic echo cancellation
    bool enable_ns;                 ///< Enable noise suppression
    bool enable_agc;                ///< Enable automatic gain control
} audio_codec_config_t;

/**
 * @brief Audio statistics structure
 */
typedef struct {
    uint32_t samples_played;        ///< Total samples played
    uint32_t samples_recorded;      ///< Total samples recorded
    uint32_t buffer_underruns;      ///< DMA buffer underruns
    uint32_t buffer_overruns;       ///< DMA buffer overruns
    uint32_t i2s_errors;            ///< I2S communication errors
    float cpu_usage_percent;        ///< Audio processing CPU usage
} audio_stats_t;

/**
 * @brief Audio event types
 */
typedef enum {
    AUDIO_EVENT_STARTED,            ///< Audio stream started
    AUDIO_EVENT_STOPPED,            ///< Audio stream stopped
    AUDIO_EVENT_UNDERRUN,           ///< Buffer underrun detected
    AUDIO_EVENT_OVERRUN,            ///< Buffer overrun detected
    AUDIO_EVENT_ERROR,              ///< Error occurred
} audio_event_t;

/**
 * @brief Audio event callback function type
 *
 * @param event Event type
 * @param data Event-specific data
 * @param user_ctx User context pointer
 */
typedef void (*audio_event_cb_t)(audio_event_t event, void* data, void* user_ctx);

/* ========================================================================
 * Public API Functions
 * ======================================================================== */

/**
 * @brief Initialize audio codec system
 *
 * Initializes I2C, I2S, GPIO, and configures ES8311 codec and NS4150B amplifier.
 * Must be called before any other audio functions.
 *
 * @param config Pointer to audio configuration structure
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_codec_init(const audio_codec_config_t* config);

/**
 * @brief Deinitialize audio codec system
 *
 * Stops audio streams, powers down codec and amplifier, releases resources.
 *
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_codec_deinit(void);

/**
 * @brief Set audio operating mode
 *
 * Configures codec for playback, record, or full-duplex operation.
 *
 * @param mode Desired audio mode
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_codec_set_mode(audio_mode_t mode);

/**
 * @brief Get current audio operating mode
 *
 * @return Current audio mode
 */
audio_mode_t audio_codec_get_mode(void);

/**
 * @brief Set audio profile
 *
 * Applies profile-specific optimizations for different use cases.
 *
 * @param profile Desired audio profile
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_codec_set_profile(audio_profile_t profile);

/* ========================================================================
 * Volume and Gain Control
 * ======================================================================== */

/**
 * @brief Set speaker volume
 *
 * @param volume Volume level (0-100)
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_codec_set_volume(uint8_t volume);

/**
 * @brief Get current speaker volume
 *
 * @param volume Pointer to store volume level
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_codec_get_volume(uint8_t* volume);

/**
 * @brief Set microphone gain
 *
 * @param gain Gain level (0-100)
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_codec_set_mic_gain(uint8_t gain);

/**
 * @brief Mute/unmute speaker
 *
 * @param mute true to mute, false to unmute
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_codec_mute(bool mute);

/**
 * @brief Mute/unmute microphone
 *
 * @param mute true to mute, false to unmute
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_codec_mic_mute(bool mute);

/* ========================================================================
 * Audio Stream Control
 * ======================================================================== */

/**
 * @brief Start audio playback
 *
 * Begins playing audio from the TX DMA buffer.
 *
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_codec_start_playback(void);

/**
 * @brief Stop audio playback
 *
 * Stops playing audio and disables amplifier.
 *
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_codec_stop_playback(void);

/**
 * @brief Start audio recording
 *
 * Begins capturing audio from microphone to RX DMA buffer.
 *
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_codec_start_record(void);

/**
 * @brief Stop audio recording
 *
 * Stops capturing audio from microphone.
 *
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_codec_stop_record(void);

/* ========================================================================
 * Audio Data I/O
 * ======================================================================== */

/**
 * @brief Write audio samples for playback
 *
 * Writes audio data to I2S TX buffer. Blocks if buffer is full.
 *
 * @param data Pointer to audio sample buffer
 * @param size Number of bytes to write
 * @param bytes_written Pointer to store actual bytes written
 * @param timeout_ms Timeout in milliseconds (portMAX_DELAY for infinite)
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_codec_write(const void* data, size_t size, size_t* bytes_written, uint32_t timeout_ms);

/**
 * @brief Read audio samples from microphone
 *
 * Reads audio data from I2S RX buffer. Blocks if no data available.
 *
 * @param data Pointer to buffer for received samples
 * @param size Number of bytes to read
 * @param bytes_read Pointer to store actual bytes read
 * @param timeout_ms Timeout in milliseconds (portMAX_DELAY for infinite)
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_codec_read(void* data, size_t size, size_t* bytes_read, uint32_t timeout_ms);

/* ========================================================================
 * Amplifier Control
 * ======================================================================== */

/**
 * @brief Enable amplifier
 *
 * Powers on the NS4150B amplifier. Includes anti-pop delay.
 *
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_amp_enable(void);

/**
 * @brief Disable amplifier
 *
 * Powers off the NS4150B amplifier to save power.
 *
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_amp_disable(void);

/**
 * @brief Check if amplifier is enabled
 *
 * @return true if enabled, false otherwise
 */
bool audio_amp_is_enabled(void);

/* ========================================================================
 * Advanced Features
 * ======================================================================== */

/**
 * @brief Enable/disable acoustic echo cancellation
 *
 * @param enable true to enable AEC, false to disable
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_codec_set_aec(bool enable);

/**
 * @brief Enable/disable noise suppression
 *
 * @param enable true to enable NS, false to disable
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_codec_set_ns(bool enable);

/**
 * @brief Enable/disable automatic gain control
 *
 * @param enable true to enable AGC, false to disable
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_codec_set_agc(bool enable);

/**
 * @brief Register event callback
 *
 * Registers a callback function to receive audio events.
 *
 * @param callback Callback function pointer
 * @param user_ctx User context pointer (passed to callback)
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_codec_register_event_callback(audio_event_cb_t callback, void* user_ctx);

/**
 * @brief Get audio statistics
 *
 * Retrieves current audio system statistics.
 *
 * @param stats Pointer to statistics structure
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_codec_get_stats(audio_stats_t* stats);

/**
 * @brief Reset audio statistics
 *
 * Clears all audio statistics counters.
 *
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_codec_reset_stats(void);

/* ========================================================================
 * Power Management
 * ======================================================================== */

/**
 * @brief Enter low-power mode
 *
 * Puts codec and amplifier into sleep mode. Maintains configuration.
 * Wake-up time: ~50ms.
 *
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_codec_sleep(void);

/**
 * @brief Wake from low-power mode
 *
 * Restores codec and amplifier to active state.
 *
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_codec_wake(void);

/* ========================================================================
 * Healthcare-Specific Functions
 * ======================================================================== */

/**
 * @brief Play emergency alert tone
 *
 * Plays high-priority alert tone at maximum volume, overriding current audio.
 *
 * @param frequency_hz Tone frequency (500-4000 Hz)
 * @param duration_ms Duration in milliseconds
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_play_emergency_tone(uint16_t frequency_hz, uint32_t duration_ms);

/**
 * @brief Enable hospital environment mode
 *
 * Applies aggressive noise suppression and echo cancellation optimized
 * for noisy hospital environments.
 *
 * @param enable true to enable, false for normal mode
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_set_hospital_mode(bool enable);

/**
 * @brief Set priority audio mode
 *
 * Allows priority audio (e.g., code blue alerts) to override normal calls.
 *
 * @param priority_level 0=normal, 1-3=increasing priority
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_set_priority(uint8_t priority_level);

/* ========================================================================
 * Diagnostics
 * ======================================================================== */

/**
 * @brief Run audio loopback test
 *
 * Connects microphone input directly to speaker output for testing.
 * WARNING: May produce loud feedback - use headphones or low volume.
 *
 * @param duration_ms Test duration in milliseconds
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_run_loopback_test(uint32_t duration_ms);

/**
 * @brief Test amplifier functionality
 *
 * Plays test tone to verify amplifier is working.
 *
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_test_amplifier(void);

/**
 * @brief Get codec chip information
 *
 * Reads ES8311 chip ID and version.
 *
 * @param chip_id Pointer to store chip ID
 * @param version Pointer to store version
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t audio_get_chip_info(uint8_t* chip_id, uint8_t* version);

/* ========================================================================
 * Default Configuration Helper
 * ======================================================================== */

/**
 * @brief Get default audio configuration
 *
 * Returns a configuration structure with sensible defaults for
 * healthcare VoIP applications.
 *
 * @return Default configuration structure
 */
static inline audio_codec_config_t audio_get_default_config(void) {
    audio_codec_config_t config = {
        .sample_rate = SAMPLE_RATE_16K,
        .bits_per_sample = 16,
        .channels = 1,
        .volume = DEFAULT_VOLUME,
        .profile = AUDIO_PROFILE_VOICE_CALL,
        .enable_aec = true,
        .enable_ns = true,
        .enable_agc = true,
    };
    return config;
}

#ifdef __cplusplus
}
#endif

#endif /* AUDIO_CODEC_H */
