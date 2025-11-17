/**
 * @file rtp_handler.h
 * @brief RTP/SRTP Audio Handler for Healthcare VoIP
 *
 * Real-time Transport Protocol implementation with SRTP encryption
 * for secure healthcare audio communications.
 *
 * Features:
 * - RTP packet encoding/decoding
 * - SRTP encryption (HIPAA-compliant)
 * - Multiple codec support (G.711, G.722, Opus)
 * - Jitter buffer management
 * - Packet loss concealment
 * - RTCP statistics
 * - QoS monitoring
 *
 * @version 1.0
 * @date 2025-11-17
 * @author OPAL Project Team
 *
 * SPDX-License-Identifier: MIT
 */

#ifndef RTP_HANDLER_H
#define RTP_HANDLER_H

#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/* ========================================================================
 * RTP Configuration
 * ======================================================================== */

#define RTP_VERSION             2
#define RTP_HEADER_SIZE         12
#define RTP_MAX_PAYLOAD_SIZE    1200
#define RTP_MAX_PACKET_SIZE     (RTP_HEADER_SIZE + RTP_MAX_PAYLOAD_SIZE)

/**
 * @brief RTP payload types (RFC 3551)
 */
typedef enum {
    RTP_PT_PCMU = 0,            ///< G.711 µ-law
    RTP_PT_PCMA = 8,            ///< G.711 A-law
    RTP_PT_G722 = 9,            ///< G.722 (wideband)
    RTP_PT_L16_STEREO = 10,     ///< Linear PCM 16-bit stereo
    RTP_PT_L16_MONO = 11,       ///< Linear PCM 16-bit mono
    RTP_PT_OPUS = 111,          ///< Opus (dynamic)
} rtp_payload_type_t;

/**
 * @brief Audio codec types
 */
typedef enum {
    CODEC_G711_ULAW,            ///< G.711 µ-law (8kHz, 64kbps)
    CODEC_G711_ALAW,            ///< G.711 A-law (8kHz, 64kbps)
    CODEC_G722,                 ///< G.722 wideband (16kHz, 64kbps)
    CODEC_OPUS,                 ///< Opus (8-48kHz, variable bitrate)
    CODEC_L16,                  ///< Linear PCM 16-bit
} audio_codec_type_t;

/**
 * @brief SRTP encryption profiles (RFC 5764)
 */
typedef enum {
    SRTP_PROFILE_NONE = 0,
    SRTP_PROFILE_AES128_CM_SHA1_80,     ///< AES-128, SHA-1 HMAC 80-bit
    SRTP_PROFILE_AES128_CM_SHA1_32,     ///< AES-128, SHA-1 HMAC 32-bit
    SRTP_PROFILE_AES256_CM_SHA1_80,     ///< AES-256, SHA-1 HMAC 80-bit (HIPAA preferred)
} srtp_profile_t;

/* ========================================================================
 * RTP Packet Structure
 * ======================================================================== */

/**
 * @brief RTP header (RFC 3550)
 */
typedef struct __attribute__((packed)) {
    // Byte 0
    uint8_t cc:4;               ///< CSRC count
    uint8_t x:1;                ///< Extension bit
    uint8_t p:1;                ///< Padding bit
    uint8_t v:2;                ///< Version (always 2)

    // Byte 1
    uint8_t pt:7;               ///< Payload type
    uint8_t m:1;                ///< Marker bit

    // Bytes 2-3
    uint16_t seq;               ///< Sequence number

    // Bytes 4-7
    uint32_t timestamp;         ///< Timestamp

    // Bytes 8-11
    uint32_t ssrc;              ///< Synchronization source identifier
} rtp_header_t;

/**
 * @brief RTP packet structure
 */
typedef struct {
    rtp_header_t header;
    uint8_t payload[RTP_MAX_PAYLOAD_SIZE];
    uint16_t payload_len;
} rtp_packet_t;

/**
 * @brief RTCP statistics
 */
typedef struct {
    uint32_t packets_sent;
    uint32_t packets_received;
    uint32_t packets_lost;
    uint32_t packets_discarded;
    uint32_t bytes_sent;
    uint32_t bytes_received;
    float jitter_ms;
    float avg_latency_ms;
    float packet_loss_percent;
} rtcp_stats_t;

/* ========================================================================
 * RTP Session Configuration
 * ======================================================================== */

/**
 * @brief RTP session configuration
 */
typedef struct {
    // Network
    char remote_ip[16];         ///< Remote IP address
    uint16_t remote_port;       ///< Remote RTP port
    uint16_t local_port;        ///< Local RTP port

    // Audio
    audio_codec_type_t codec;   ///< Audio codec
    uint32_t sample_rate;       ///< Sample rate (Hz)
    uint16_t ptime;             ///< Packetization time (ms)

    // RTP
    uint32_t ssrc;              ///< Local SSRC
    rtp_payload_type_t payload_type;

    // SRTP encryption
    bool enable_srtp;
    srtp_profile_t srtp_profile;
    uint8_t srtp_key[32];       ///< Master key
    uint8_t srtp_salt[14];      ///< Salt

    // Jitter buffer
    uint16_t jitter_min_ms;     ///< Minimum jitter buffer (ms)
    uint16_t jitter_max_ms;     ///< Maximum jitter buffer (ms)
    bool enable_plc;            ///< Packet loss concealment

    // QoS
    uint8_t dscp;               ///< Differentiated Services Code Point
    uint8_t priority;           ///< Priority level (0-7)
} rtp_config_t;

/**
 * @brief RTP event types
 */
typedef enum {
    RTP_EVENT_PACKET_RECEIVED,
    RTP_EVENT_PACKET_LOST,
    RTP_EVENT_JITTER_OVERFLOW,
    RTP_EVENT_CODEC_ERROR,
    RTP_EVENT_ENCRYPTION_ERROR,
} rtp_event_t;

/**
 * @brief RTP event callback
 */
typedef void (*rtp_event_cb_t)(rtp_event_t event, void* data, void* user_ctx);

/* ========================================================================
 * Public API Functions
 * ======================================================================== */

/**
 * @brief Initialize RTP handler
 *
 * @param config RTP configuration
 * @return ESP_OK on success
 */
esp_err_t rtp_init(const rtp_config_t* config);

/**
 * @brief Deinitialize RTP handler
 *
 * @return ESP_OK on success
 */
esp_err_t rtp_deinit(void);

/**
 * @brief Send RTP packet with audio payload
 *
 * @param audio_data Raw audio samples
 * @param len Length of audio data in bytes
 * @return ESP_OK on success
 */
esp_err_t rtp_send(const uint8_t* audio_data, size_t len);

/**
 * @brief Receive and decode RTP packet
 *
 * @param audio_data Buffer for decoded audio
 * @param max_len Maximum buffer size
 * @param actual_len Actual bytes written
 * @param timeout_ms Timeout in milliseconds
 * @return ESP_OK on success
 */
esp_err_t rtp_receive(uint8_t* audio_data, size_t max_len, size_t* actual_len, uint32_t timeout_ms);

/**
 * @brief Get RTCP statistics
 *
 * @param stats Pointer to statistics structure
 * @return ESP_OK on success
 */
esp_err_t rtp_get_stats(rtcp_stats_t* stats);

/**
 * @brief Reset RTCP statistics
 *
 * @return ESP_OK on success
 */
esp_err_t rtp_reset_stats(void);

/**
 * @brief Register event callback
 *
 * @param callback Callback function
 * @param user_ctx User context
 * @return ESP_OK on success
 */
esp_err_t rtp_register_callback(rtp_event_cb_t callback, void* user_ctx);

/* ========================================================================
 * Codec Functions
 * ======================================================================== */

/**
 * @brief Encode audio to G.711 µ-law
 *
 * @param pcm_data Input PCM samples (16-bit)
 * @param pcm_len Number of PCM samples
 * @param ulaw_data Output µ-law data (8-bit)
 * @return Number of bytes encoded
 */
size_t codec_encode_g711_ulaw(const int16_t* pcm_data, size_t pcm_len, uint8_t* ulaw_data);

/**
 * @brief Decode G.711 µ-law to PCM
 *
 * @param ulaw_data Input µ-law data (8-bit)
 * @param ulaw_len Number of µ-law samples
 * @param pcm_data Output PCM samples (16-bit)
 * @return Number of samples decoded
 */
size_t codec_decode_g711_ulaw(const uint8_t* ulaw_data, size_t ulaw_len, int16_t* pcm_data);

/**
 * @brief Encode audio to G.711 A-law
 *
 * @param pcm_data Input PCM samples (16-bit)
 * @param pcm_len Number of PCM samples
 * @param alaw_data Output A-law data (8-bit)
 * @return Number of bytes encoded
 */
size_t codec_encode_g711_alaw(const int16_t* pcm_data, size_t pcm_len, uint8_t* alaw_data);

/**
 * @brief Decode G.711 A-law to PCM
 *
 * @param alaw_data Input A-law data (8-bit)
 * @param alaw_len Number of A-law samples
 * @param pcm_data Output PCM samples (16-bit)
 * @return Number of samples decoded
 */
size_t codec_decode_g711_alaw(const uint8_t* alaw_data, size_t alaw_len, int16_t* pcm_data);

/* ========================================================================
 * SRTP Encryption Functions
 * ======================================================================== */

/**
 * @brief Encrypt RTP packet (SRTP)
 *
 * @param packet RTP packet to encrypt
 * @param encrypted_packet Output encrypted packet
 * @return ESP_OK on success
 */
esp_err_t srtp_encrypt(const rtp_packet_t* packet, rtp_packet_t* encrypted_packet);

/**
 * @brief Decrypt SRTP packet
 *
 * @param encrypted_packet Encrypted RTP packet
 * @param packet Output decrypted packet
 * @return ESP_OK on success
 */
esp_err_t srtp_decrypt(const rtp_packet_t* encrypted_packet, rtp_packet_t* packet);

/**
 * @brief Set SRTP master key and salt
 *
 * @param key Master key (16/32 bytes depending on profile)
 * @param key_len Key length
 * @param salt Salt (14 bytes)
 * @return ESP_OK on success
 */
esp_err_t srtp_set_keys(const uint8_t* key, size_t key_len, const uint8_t* salt);

/* ========================================================================
 * Jitter Buffer Functions
 * ======================================================================== */

/**
 * @brief Add packet to jitter buffer
 *
 * @param packet RTP packet
 * @return ESP_OK on success
 */
esp_err_t jitter_buffer_add(const rtp_packet_t* packet);

/**
 * @brief Get packet from jitter buffer
 *
 * @param packet Output packet
 * @param timeout_ms Timeout in milliseconds
 * @return ESP_OK on success
 */
esp_err_t jitter_buffer_get(rtp_packet_t* packet, uint32_t timeout_ms);

/**
 * @brief Clear jitter buffer
 *
 * @return ESP_OK on success
 */
esp_err_t jitter_buffer_clear(void);

/**
 * @brief Get jitter buffer statistics
 *
 * @param current_size Current number of packets
 * @param max_size Maximum capacity
 * @param overflow_count Number of overflows
 * @return ESP_OK on success
 */
esp_err_t jitter_buffer_stats(uint16_t* current_size, uint16_t* max_size, uint32_t* overflow_count);

/* ========================================================================
 * Utility Functions
 * ======================================================================== */

/**
 * @brief Get default RTP configuration
 *
 * @return Default configuration for healthcare VoIP
 */
static inline rtp_config_t rtp_get_default_config(void) {
    rtp_config_t config = {
        .remote_ip = "0.0.0.0",
        .remote_port = 5004,
        .local_port = 5004,
        .codec = CODEC_G711_ULAW,
        .sample_rate = 8000,
        .ptime = 20,
        .ssrc = 0,  // Will be generated randomly
        .payload_type = RTP_PT_PCMU,
        .enable_srtp = true,
        .srtp_profile = SRTP_PROFILE_AES256_CM_SHA1_80,
        .jitter_min_ms = 20,
        .jitter_max_ms = 200,
        .enable_plc = true,
        .dscp = 46,  // EF (Expedited Forwarding) for voice
        .priority = 6,  // High priority for healthcare
    };
    return config;
}

/**
 * @brief Calculate recommended ptime for codec
 *
 * @param codec Codec type
 * @return Recommended ptime in milliseconds
 */
static inline uint16_t rtp_get_recommended_ptime(audio_codec_type_t codec) {
    switch (codec) {
        case CODEC_G711_ULAW:
        case CODEC_G711_ALAW:
            return 20;  // 160 samples @ 8kHz

        case CODEC_G722:
            return 20;  // 320 samples @ 16kHz

        case CODEC_OPUS:
            return 20;  // Variable, 20ms is standard

        case CODEC_L16:
            return 20;

        default:
            return 20;
    }
}

#ifdef __cplusplus
}
#endif

#endif /* RTP_HANDLER_H */
