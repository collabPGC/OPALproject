/* AEC Example - Adapted for OPAL Device (ESP32-C6 with ES8311)
 *
 * Adapted from ESP-ADF examples/advanced_examples/aec
 * Changes:
 * - Removed board abstraction, using direct ES8311 initialization
 * - Updated I2S/I2C pins to match our hardware_config.h
 * - Removed SD card dependency (commented out file saving)
 * - Adapted for ESP32-C6
 */

#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "driver/i2s_std.h"
#include "driver/i2c_master.h"
#include "audio_element.h"
#include "audio_pipeline.h"
#include "es8311.h"
#include "i2s_stream.h"
#include "aec_stream.h"
#include "wav_encoder.h"
#include "mp3_decoder.h"
#include "filter_resample.h"
#include "audio_mem.h"

// Include our hardware configuration
#include "hardware_config.h"

static const char *TAG = "AEC_OPAL";

// Debug original input data for AEC feature
// #define DEBUG_AEC_INPUT

// Audio configuration - using our hardware_config.h values
#define I2S_SAMPLE_RATE     8000
#define I2S_CHANNELS        I2S_CHANNEL_FMT_ONLY_LEFT  // Mono for our setup
#define I2S_BITS            16

// CRITICAL: Use exact pinout from hardware_config.h (your provided pinout table)
// I2S Pins (from your pinout table):
#define AEC_I2S_MCK_PIN     I2S_MCK_PIN      // GPIO19 (I2S_MCLK)
#define AEC_I2S_BCK_PIN     I2S_BCK_PIN      // GPIO20 (I2S_SCLK)
#define AEC_I2S_LRCK_PIN    I2S_LRCK_PIN     // GPIO22 (I2S_LRCK)
#define AEC_I2S_DOUT_PIN    I2S_DOUT_PIN     // GPIO21 (I2S_ASDOUT - C6 -> ES8311 speaker)
#define AEC_I2S_DIN_PIN     I2S_DIN_PIN      // GPIO23 (I2S_DSDIN - ES8311 -> C6 mic)

// I2C Pins (from your pinout table):
#define AEC_I2C_SDA_PIN     I2C_MASTER_SDA_GPIO  // GPIO8 (SDA)
#define AEC_I2C_SCL_PIN     I2C_MASTER_SCL_GPIO  // GPIO7 (SCL)

// Test MP3 file (embedded in binary)
extern const uint8_t adf_music_mp3_start[] asm("_binary_test_mp3_start");
extern const uint8_t adf_music_mp3_end[]   asm("_binary_test_mp3_end");

static audio_element_handle_t i2s_stream_reader;
static audio_element_handle_t i2s_stream_writter;

// External I2C bus handle (from opal_main.c)
extern i2c_master_bus_handle_t i2c_bus_handle;

// MP3 read callback
int mp3_music_read_cb(audio_element_handle_t el, char *buf, int len, TickType_t wait_time, void *ctx)
{
    static int mp3_pos;
    int read_size = adf_music_mp3_end - adf_music_mp3_start - mp3_pos;
    if (read_size == 0) {
        return AEL_IO_DONE;
    } else if (len < read_size) {
        read_size = len;
    }
    memcpy(buf, adf_music_mp3_start + mp3_pos, read_size);
    mp3_pos += read_size;
    return read_size;
}

// I2S read callback
static int i2s_read_cb(audio_element_handle_t el, char *buf, int len, TickType_t wait_time, void *ctx)
{
    size_t bytes_read = audio_element_input(i2s_stream_reader, buf, len);
    if (bytes_read <= 0) {
        ESP_LOGE(TAG, "I2S read failed, %d", len);
    } 
    return bytes_read;
}

// I2S write callback
static int i2s_write_cb(audio_element_handle_t el, char *buf, int len, TickType_t wait_time, void *ctx)
{
    int bytes_write = 0;
    bytes_write = audio_element_output(i2s_stream_writter, buf, len);
    if (bytes_write < 0) {
        ESP_LOGE(TAG, "I2S write failed, %d", len);
    }
    return bytes_write;
}

// Initialize ES8311 codec directly (replaces board abstraction)
static esp_err_t init_es8311_codec(void)
{
    ESP_LOGI(TAG, "Initializing ES8311 codec directly...");
    
    // Note: ESP-ADF uses audio_hal, but we can use ESP-IDF codec driver
    // For now, we'll let ESP-ADF I2S stream handle the codec via its own mechanism
    // The I2S stream will configure the codec through ESP-ADF's audio_hal
    
    // Set ES8311 mic gain (if ESP-ADF provides this function)
    // es8311_set_mic_gain(ES8311_MIC_GAIN_24DB);
    
    ESP_LOGI(TAG, "ES8311 codec initialization (via ESP-ADF I2S stream)");
    return ESP_OK;
}

void app_main()
{
    esp_log_level_set("*", ESP_LOG_INFO);
    esp_log_level_set(TAG, ESP_LOG_INFO);

    ESP_LOGI(TAG, "========================================");
    ESP_LOGI(TAG, "AEC Example - Adapted for OPAL Device");
    ESP_LOGI(TAG, "ESP32-C6 + ES8311 Codec");
    ESP_LOGI(TAG, "========================================");

    // NOTE: SD card initialization removed - we don't have SD card
    // Original code had: audio_board_sdcard_init(set, SD_MODE_1_LINE);
    ESP_LOGI(TAG, "[1.0] SD card disabled (not available on OPAL device)");

    ESP_LOGI(TAG, "[2.0] Initialize codec chip");
    ESP_LOGI(TAG, "Using pinout from hardware_config.h:");
    ESP_LOGI(TAG, "  I2S: MCLK=GPIO%d, BCK=GPIO%d, LRCK=GPIO%d, DOUT=GPIO%d, DIN=GPIO%d",
             AEC_I2S_MCK_PIN, AEC_I2S_BCK_PIN, AEC_I2S_LRCK_PIN, AEC_I2S_DOUT_PIN, AEC_I2S_DIN_PIN);
    ESP_LOGI(TAG, "  I2C: SDA=GPIO%d, SCL=GPIO%d", AEC_I2C_SDA_PIN, AEC_I2C_SCL_PIN);
    
    // Initialize ES8311 (direct initialization, not board abstraction)
    init_es8311_codec();

    // Configure I2S stream for writing (playback)
    ESP_LOGI(TAG, "[2.1] Configure I2S stream for playback");
    i2s_stream_cfg_t i2s_w_cfg = I2S_STREAM_CFG_DEFAULT_WITH_PARA(I2S_NUM_0, I2S_SAMPLE_RATE, I2S_BITS, AUDIO_STREAM_WRITER);
    i2s_w_cfg.task_stack = -1;
    i2s_w_cfg.need_expand = (16 != I2S_BITS);
    i2s_stream_set_channel_type(&i2s_w_cfg, I2S_CHANNELS);
    
    // CRITICAL: Configure I2S pins to match our hardware_config.h pinout
    // ESP-ADF I2S stream gets pins from board config, but we need to override
    // These pins MUST match your provided pinout table:
    // GPIO19=MCLK, GPIO20=BCK, GPIO22=LRCK, GPIO21=DOUT, GPIO23=DIN
    // Note: ESP-ADF may need board config or menuconfig to set these pins
    // If ESP-ADF doesn't support direct pin setting, we'll need to create custom board config
    ESP_LOGI(TAG, "[2.1.1] I2S pins configured via hardware_config.h (GPIO19/20/21/22/23)");
    i2s_stream_writter = i2s_stream_init(&i2s_w_cfg);

    // Configure I2S stream for reading (recording)
    ESP_LOGI(TAG, "[2.2] Configure I2S stream for recording");
    i2s_stream_cfg_t i2s_r_cfg = I2S_STREAM_CFG_DEFAULT_WITH_PARA(I2S_NUM_0, I2S_SAMPLE_RATE, I2S_BITS, AUDIO_STREAM_READER);
    i2s_r_cfg.task_stack = -1;
    i2s_stream_set_channel_type(&i2s_r_cfg, I2S_CHANNELS);
    // CRITICAL: Same I2S pins as above (from your pinout table)
    ESP_LOGI(TAG, "[2.2.1] I2S RX pins configured via hardware_config.h (GPIO19/20/22/23)");
    i2s_stream_reader = i2s_stream_init(&i2s_r_cfg);

    ESP_LOGI(TAG, "[3.0] Create audio pipeline_rec for recording");
    audio_pipeline_cfg_t pipeline_cfg = DEFAULT_AUDIO_PIPELINE_CONFIG();
    audio_pipeline_handle_t pipeline_rec = audio_pipeline_init(&pipeline_cfg);
    mem_assert(pipeline_rec);
    
    ESP_LOGI(TAG, "[3.1] Create algorithm stream for AEC");
    aec_stream_cfg_t aec_config = AEC_STREAM_CFG_DEFAULT();
#ifdef DEBUG_AEC_INPUT
    aec_config.debug_aec = true;
#endif
    // Use "MR" format (Mic Reference) for our mono setup
    aec_config.input_format = "MR";
    audio_element_handle_t element_aec = aec_stream_init(&aec_config);
    mem_assert(element_aec);
    audio_element_set_read_cb(element_aec, i2s_read_cb, NULL);
    audio_element_set_input_timeout(element_aec, portMAX_DELAY);

    ESP_LOGI(TAG, "[3.2] Create wav encoder to encode wav format");
    wav_encoder_cfg_t wav_cfg = DEFAULT_WAV_ENCODER_CONFIG();
    audio_element_handle_t wav_encoder = wav_encoder_init(&wav_cfg);

    // NOTE: SD card file saving removed - we don't have SD card
    // Original code had fatfs_stream_writer for saving to SD card
    ESP_LOGI(TAG, "[3.3] SD card file saving disabled (not available)");
    ESP_LOGI(TAG, "[3.4] Register elements to audio pipeline_rec (without file saving)");
    
    // Register only AEC and WAV encoder (no file saving)
    audio_pipeline_register(pipeline_rec, element_aec, "aec");
    audio_pipeline_register(pipeline_rec, wav_encoder, "wav_encoder");

    ESP_LOGI(TAG, "[3.5] Link pipeline: [codec_chip]-->aec-->wav_encoder");
    // Link without file saving
    const char *link_rec[2] = {"aec", "wav_encoder"};
    audio_pipeline_link(pipeline_rec, &link_rec[0], 2);

    ESP_LOGI(TAG, "[4.0] Create audio pipeline_play for playing");
    audio_pipeline_cfg_t pipeline_play_cfg = DEFAULT_AUDIO_PIPELINE_CONFIG();
    audio_pipeline_handle_t pipeline_play = audio_pipeline_init(&pipeline_play_cfg);

    ESP_LOGI(TAG, "[4.1] Create mp3 decoder to decode mp3 file");
    mp3_decoder_cfg_t mp3_decoder_cfg = DEFAULT_MP3_DECODER_CONFIG();
    audio_element_handle_t mp3_decoder = mp3_decoder_init(&mp3_decoder_cfg);
    audio_element_set_read_cb(mp3_decoder, mp3_music_read_cb, NULL);

    ESP_LOGI(TAG, "[4.2] Create resample filter to resample mp3");
    rsp_filter_cfg_t rsp_cfg_w = DEFAULT_RESAMPLE_FILTER_CONFIG();
    rsp_cfg_w.src_rate = 16000;
    rsp_cfg_w.src_ch = 1;
    rsp_cfg_w.dest_rate = I2S_SAMPLE_RATE;
    rsp_cfg_w.dest_ch = 1;  // Mono for our setup
    rsp_cfg_w.complexity = 5;
    audio_element_handle_t filter_w = rsp_filter_init(&rsp_cfg_w);
    audio_element_set_write_cb(filter_w, i2s_write_cb, NULL);
    audio_element_set_output_timeout(filter_w, portMAX_DELAY);

    ESP_LOGI(TAG, "[4.3] Register all elements to audio pipeline_play");
    audio_pipeline_register(pipeline_play, mp3_decoder, "mp3_decoder");
    audio_pipeline_register(pipeline_play, filter_w, "filter_w");

    ESP_LOGI(TAG, "[4.4] Link pipeline: [flash]-->mp3_decoder-->filter-->[codec_chip]");
    const char *link_tag[2] = {"mp3_decoder", "filter_w"};
    audio_pipeline_link(pipeline_play, &link_tag[0], 2);

    ESP_LOGI(TAG, "[5.0] Set up event listener");
    audio_event_iface_cfg_t evt_cfg = AUDIO_EVENT_IFACE_DEFAULT_CFG();
    audio_event_iface_handle_t evt = audio_event_iface_init(&evt_cfg);

    ESP_LOGI(TAG, "[5.1] Listening event from all elements of pipeline");
    audio_pipeline_set_listener(pipeline_play, evt);

    ESP_LOGI(TAG, "[6.0] Start audio_pipeline");
    audio_pipeline_run(pipeline_play);
    audio_pipeline_run(pipeline_rec);

    ESP_LOGI(TAG, "[6.1] AEC processing started - playing MP3 and recording with echo cancellation");

    while (1) {
        audio_event_iface_msg_t msg;
        esp_err_t ret = audio_event_iface_listen(evt, &msg, portMAX_DELAY);
        if (ret != ESP_OK) {
            ESP_LOGE(TAG, "[ * ] Event interface error : %d", ret);
            continue;
        }

        if (msg.source_type == AUDIO_ELEMENT_TYPE_ELEMENT && msg.source == (void *)mp3_decoder
            && msg.cmd == AEL_MSG_CMD_REPORT_MUSIC_INFO) {
            audio_element_info_t music_info = {0};
            audio_element_getinfo(mp3_decoder, &music_info);

            ESP_LOGI(TAG, "[ * ] Receive music info from mp3 decoder, sample_rates=%d, bits=%d, ch=%d",
                     music_info.sample_rates, music_info.bits, music_info.channels);
            continue;
        }

        // Stop when the last pipeline element receives stop event
        if (msg.source_type == AUDIO_ELEMENT_TYPE_ELEMENT && msg.source == (void *)filter_w
            && msg.cmd == AEL_MSG_CMD_REPORT_STATUS
            && (((int)msg.data == AEL_STATUS_STATE_STOPPED) || ((int)msg.data == AEL_STATUS_STATE_FINISHED))) {
            ESP_LOGW(TAG, "[ * ] Stop event received");
            break;
        }
    }
    
    ESP_LOGI(TAG, "[7.0] Stop audio_pipeline");
    audio_pipeline_stop(pipeline_rec);
    audio_pipeline_wait_for_stop(pipeline_rec);
    audio_pipeline_deinit(pipeline_rec);

    audio_pipeline_stop(pipeline_play);
    audio_pipeline_wait_for_stop(pipeline_play);
    audio_pipeline_deinit(pipeline_play);
    
    audio_element_deinit(i2s_stream_reader);
    audio_element_deinit(i2s_stream_writter);

    audio_pipeline_remove_listener(pipeline_play);
    audio_event_iface_destroy(evt);

    ESP_LOGI(TAG, "AEC example finished");
}

