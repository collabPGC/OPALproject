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
 */
#ifndef _VOIP_APP_OPAL_H
#define _VOIP_APP_OPAL_H

#include "esp_rtc.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief External SIP handle (for making calls, answering, etc.)
 * 
 * This handle is available after WiFi connects and SIP service starts
 * Use it with esp_rtc_call(), esp_rtc_answer(), esp_rtc_bye()
 */
extern esp_rtc_handle_t esp_sip;

/**
 * @brief Make an outgoing call
 * 
 * @param extension_number Extension number to call (e.g., "1002")
 * 
 * Example:
 *   esp_rtc_call(esp_sip, "1002");
 */
void voip_make_call(const char *extension_number);

/**
 * @brief Answer an incoming call
 * 
 * Example:
 *   esp_rtc_answer(esp_sip);
 */
void voip_answer_call(void);

/**
 * @brief Hang up current call
 * 
 * Example:
 *   esp_rtc_bye(esp_sip);
 */
void voip_hangup(void);

#ifdef __cplusplus
}
#endif

#endif /* _VOIP_APP_OPAL_H */

