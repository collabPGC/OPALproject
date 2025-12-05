#include "esp_log.h"
#include "esp_err.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "lvgl.h"
#include "bsp/esp32_s3_touch_amoled_1_75.h"

static const char *TAG = "APP";

void app_main(void)
{
    ESP_LOGI(TAG, "Initializing Waveshare 1.75\" AMOLED BSP...");

    // Start LVGL, display, and touch via the BSP
    lv_display_t *disp = bsp_display_start();
    if (!disp) {
        ESP_LOGE(TAG, "bsp_display_start() failed");
        return;
    }

    // (Optional) get the LVGL input device (touch)
    lv_indev_t *indev = bsp_display_get_input_dev();
    (void)indev; // silence unused for now

    // Create a simple LVGL label as a smoke test
    if (bsp_display_lock(portMAX_DELAY)) {
        lv_obj_t *label = lv_label_create(lv_scr_act());
        lv_label_set_text(label, "Hello from LINA!");
        lv_obj_center(label);
        bsp_display_unlock();
    }

    ESP_LOGI(TAG, "Board init done. Display + Touch initialized.");

    // Let LVGL's internal task/tick handling do its thing
    while (1) {
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
