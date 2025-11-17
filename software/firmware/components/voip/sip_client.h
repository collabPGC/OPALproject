/**
 * @file sip_client.h
 * @brief SIP Client for Healthcare VoIP Integration
 *
 * Session Initiation Protocol client for hospital PBX integration,
 * nurse call systems, and healthcare voice communications.
 *
 * Features:
 * - SIP registration with hospital PBX
 * - Call initiation and termination
 * - DTMF support for keypad entry
 * - Call transfer and hold
 * - Presence and status updates
 * - Emergency call prioritization
 * - Hospital directory integration
 *
 * @version 1.0
 * @date 2025-11-17
 * @author OPAL Project Team
 *
 * SPDX-License-Identifier: MIT
 */

#ifndef SIP_CLIENT_H
#define SIP_CLIENT_H

#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/* ========================================================================
 * SIP Constants
 * ======================================================================== */

#define SIP_MAX_URI_LEN         256
#define SIP_MAX_DISPLAYNAME_LEN 64
#define SIP_MAX_USERNAME_LEN    64
#define SIP_MAX_PASSWORD_LEN    64
#define SIP_MAX_REALM_LEN       128
#define SIP_MAX_CALLID_LEN      128

/* ========================================================================
 * Type Definitions
 * ======================================================================== */

/**
 * @brief SIP call states
 */
typedef enum {
    SIP_STATE_IDLE,
    SIP_STATE_REGISTERING,
    SIP_STATE_REGISTERED,
    SIP_STATE_CALLING,
    SIP_STATE_RINGING,
    SIP_STATE_IN_CALL,
    SIP_STATE_HOLD,
    SIP_STATE_TRANSFERRING,
    SIP_STATE_DISCONNECTING,
    SIP_STATE_ERROR,
} sip_state_t;

/**
 * @brief SIP priority levels for healthcare
 */
typedef enum {
    SIP_PRIORITY_NORMAL = 0,
    SIP_PRIORITY_URGENT = 1,
    SIP_PRIORITY_EMERGENCY = 2,
    SIP_PRIORITY_CODE_BLUE = 3,
} sip_priority_t;

/**
 * @brief SIP user presence status
 */
typedef enum {
    SIP_PRESENCE_OFFLINE,
    SIP_PRESENCE_ONLINE,
    SIP_PRESENCE_BUSY,
    SIP_PRESENCE_IN_CALL,
    SIP_PRESENCE_DO_NOT_DISTURB,
    SIP_PRESENCE_EMERGENCY_MODE,
} sip_presence_t;

/**
 * @brief SIP call direction
 */
typedef enum {
    SIP_DIR_INCOMING,
    SIP_DIR_OUTGOING,
} sip_call_dir_t;

/**
 * @brief SIP call information
 */
typedef struct {
    char call_id[SIP_MAX_CALLID_LEN];
    char remote_uri[SIP_MAX_URI_LEN];
    char remote_name[SIP_MAX_DISPLAYNAME_LEN];
    sip_call_dir_t direction;
    sip_priority_t priority;
    uint32_t duration_sec;
    sip_state_t state;
} sip_call_info_t;

/**
 * @brief SIP account configuration
 */
typedef struct {
    // Server
    char server_host[256];      ///< SIP server hostname/IP
    uint16_t server_port;       ///< SIP server port (usually 5060)
    bool use_tls;               ///< Use SIP over TLS (SIPS)

    // Account
    char username[SIP_MAX_USERNAME_LEN];
    char password[SIP_MAX_PASSWORD_LEN];
    char display_name[SIP_MAX_DISPLAYNAME_LEN];
    char domain[128];

    // Registration
    uint32_t reg_timeout_sec;   ///< Registration timeout (seconds)
    bool auto_reregister;       ///< Auto re-register on expiry

    // Audio
    bool enable_srtp;           ///< Require SRTP encryption
    uint16_t rtp_port_start;    ///< RTP port range start
    uint16_t rtp_port_end;      ///< RTP port range end

    // Healthcare-specific
    sip_priority_t default_priority;
    char hospital_id[64];       ///< Hospital identifier
    char department[64];        ///< Department/unit
    char role[32];              ///< User role (nurse, doctor, etc.)
} sip_config_t;

/**
 * @brief SIP event types
 */
typedef enum {
    SIP_EVENT_REGISTERED,
    SIP_EVENT_UNREGISTERED,
    SIP_EVENT_REGISTRATION_FAILED,
    SIP_EVENT_INCOMING_CALL,
    SIP_EVENT_CALL_CONNECTED,
    SIP_EVENT_CALL_DISCONNECTED,
    SIP_EVENT_CALL_FAILED,
    SIP_EVENT_CALL_HOLD,
    SIP_EVENT_CALL_RESUME,
    SIP_EVENT_DTMF_RECEIVED,
    SIP_EVENT_TRANSFER_STARTED,
    SIP_EVENT_TRANSFER_COMPLETED,
} sip_event_t;

/**
 * @brief SIP event callback
 */
typedef void (*sip_event_cb_t)(sip_event_t event, const sip_call_info_t* call_info, void* user_ctx);

/* ========================================================================
 * Public API Functions
 * ======================================================================== */

/**
 * @brief Initialize SIP client
 *
 * @param config SIP configuration
 * @return ESP_OK on success
 */
esp_err_t sip_init(const sip_config_t* config);

/**
 * @brief Deinitialize SIP client
 *
 * @return ESP_OK on success
 */
esp_err_t sip_deinit(void);

/**
 * @brief Register with SIP server
 *
 * @return ESP_OK on success
 */
esp_err_t sip_register(void);

/**
 * @brief Unregister from SIP server
 *
 * @return ESP_OK on success
 */
esp_err_t sip_unregister(void);

/**
 * @brief Make outgoing call
 *
 * @param uri SIP URI to call (e.g., "sip:5001@hospital.local")
 * @param priority Call priority
 * @return ESP_OK on success
 */
esp_err_t sip_make_call(const char* uri, sip_priority_t priority);

/**
 * @brief Answer incoming call
 *
 * @return ESP_OK on success
 */
esp_err_t sip_answer_call(void);

/**
 * @brief Hang up active call
 *
 * @return ESP_OK on success
 */
esp_err_t sip_hangup_call(void);

/**
 * @brief Hold active call
 *
 * @return ESP_OK on success
 */
esp_err_t sip_hold_call(void);

/**
 * @brief Resume held call
 *
 * @return ESP_OK on success
 */
esp_err_t sip_resume_call(void);

/**
 * @brief Transfer call to another extension
 *
 * @param target_uri Target SIP URI
 * @return ESP_OK on success
 */
esp_err_t sip_transfer_call(const char* target_uri);

/**
 * @brief Send DTMF tone
 *
 * @param digit DTMF digit ('0'-'9', '*', '#', 'A'-'D')
 * @return ESP_OK on success
 */
esp_err_t sip_send_dtmf(char digit);

/**
 * @brief Get current call state
 *
 * @return Current SIP state
 */
sip_state_t sip_get_state(void);

/**
 * @brief Get current call information
 *
 * @param call_info Pointer to call info structure
 * @return ESP_OK on success
 */
esp_err_t sip_get_call_info(sip_call_info_t* call_info);

/**
 * @brief Set user presence status
 *
 * @param presence Presence status
 * @return ESP_OK on success
 */
esp_err_t sip_set_presence(sip_presence_t presence);

/**
 * @brief Register event callback
 *
 * @param callback Callback function
 * @param user_ctx User context
 * @return ESP_OK on success
 */
esp_err_t sip_register_callback(sip_event_cb_t callback, void* user_ctx);

/* ========================================================================
 * Healthcare-Specific Functions
 * ======================================================================== */

/**
 * @brief Make emergency call (Code Blue)
 *
 * Automatically sets highest priority and alerts emergency team.
 *
 * @param location Location description
 * @return ESP_OK on success
 */
esp_err_t sip_emergency_call(const char* location);

/**
 * @brief Call nurse station
 *
 * Quick dial to assigned nurse station.
 *
 * @param station_number Station number
 * @return ESP_OK on success
 */
esp_err_t sip_call_nurse_station(uint16_t station_number);

/**
 * @brief Page specific department
 *
 * Sends audio page to department overhead speakers.
 *
 * @param department Department name
 * @param message Message to page
 * @return ESP_OK on success
 */
esp_err_t sip_page_department(const char* department, const char* message);

/**
 * @brief Look up extension by name
 *
 * Searches hospital directory for staff member.
 *
 * @param name Staff member name
 * @param uri Output buffer for SIP URI
 * @param uri_len Buffer length
 * @return ESP_OK on success
 */
esp_err_t sip_lookup_by_name(const char* name, char* uri, size_t uri_len);

/**
 * @brief Get default SIP configuration
 *
 * @return Default configuration for healthcare environment
 */
static inline sip_config_t sip_get_default_config(void) {
    sip_config_t config = {
        .server_host = "sip.hospital.local",
        .server_port = 5060,
        .use_tls = true,
        .username = "",
        .password = "",
        .display_name = "OPAL Nurse Device",
        .domain = "hospital.local",
        .reg_timeout_sec = 300,
        .auto_reregister = true,
        .enable_srtp = true,
        .rtp_port_start = 10000,
        .rtp_port_end = 10100,
        .default_priority = SIP_PRIORITY_NORMAL,
        .hospital_id = "",
        .department = "",
        .role = "nurse",
    };
    return config;
}

#ifdef __cplusplus
}
#endif

#endif /* SIP_CLIENT_H */
