#include <stdio.h>

#include "esp_err.h"
#include "esp_log.h"
#include "esp_check.h"


#include "esp_lvgl_port.h"

#include "bsp_display.h"
#include "bsp_touch.h"
#include "bsp_i2c.h"

#include "demos/lv_demos.h"

#include "bsp_pwr.h"

#define EXAMPLE_DISPLAY_ROTATION 0

#if EXAMPLE_DISPLAY_ROTATION == 90 || EXAMPLE_DISPLAY_ROTATION == 270
#define EXAMPLE_LCD_H_RES (280)
#define EXAMPLE_LCD_V_RES (240)
#else
#define EXAMPLE_LCD_H_RES (240)
#define EXAMPLE_LCD_V_RES (280)
#endif

#define EXAMPLE_LCD_DRAW_BUFF_HEIGHT (50)
#define EXAMPLE_LCD_DRAW_BUFF_DOUBLE (1)

static char *TAG = "lvgl_example_v9";

/* LCD IO and panel */
static esp_lcd_panel_io_handle_t io_handle = NULL;
static esp_lcd_panel_handle_t panel_handle = NULL;
static esp_lcd_touch_handle_t touch_handle = NULL;

/* LVGL display and touch */
static lv_display_t *lvgl_disp = NULL;
static lv_indev_t *lvgl_touch_indev = NULL;

SemaphoreHandle_t touch_int_BinarySemaphore;

static esp_err_t app_lvgl_init(void);


void esp_lcd_touch_interrupt_callback(esp_lcd_touch_handle_t tp)
{
    lv_indev_t *indev = (lv_indev_t *) tp->config.user_data;;
    /* Wake LVGL task, if needed */
    lvgl_port_task_wake(LVGL_PORT_EVENT_TOUCH, indev);
}


void app_main(void)
{
    i2c_master_bus_handle_t i2c_bus_handle;
    bsp_pwr_init();

    bsp_display_brightness_init();
    bsp_display_set_brightness(100);

    i2c_bus_handle = bsp_i2c_init();

    bsp_display_init(&io_handle, &panel_handle, EXAMPLE_LCD_H_RES * EXAMPLE_LCD_DRAW_BUFF_HEIGHT);
    bsp_touch_init(&touch_handle, i2c_bus_handle, EXAMPLE_LCD_H_RES, EXAMPLE_LCD_V_RES, EXAMPLE_DISPLAY_ROTATION, NULL);
    ESP_ERROR_CHECK(app_lvgl_init());

    touch_int_BinarySemaphore = xSemaphoreCreateBinary();

    if (lvgl_port_lock(0))
    {
        // lv_demo_benchmark();
        // lv_demo_widgets_start_slideshow();
        // lv_demo_music();
        lv_demo_widgets();
        lvgl_port_unlock();
    }
}

static void lvgl_port_touchpad_read(lv_indev_t *indev_drv, lv_indev_data_t *data)
{
    assert(indev_drv);
    esp_lcd_touch_handle_t handle = (esp_lcd_touch_handle_t)lv_indev_get_driver_data(indev_drv);
    assert(handle);

    uint16_t touchpad_x[1] = {0};
    uint16_t touchpad_y[1] = {0};
    uint8_t touchpad_cnt = 0;

    /* Read data from touch controller into memory */
    esp_lcd_touch_read_data(handle);

    /* Read data from touch controller */
    bool touchpad_pressed = esp_lcd_touch_get_coordinates(handle, touchpad_x, touchpad_y, NULL, &touchpad_cnt, 1);
    if (touchpad_pressed && touchpad_cnt > 0 && touchpad_x[0] < 280 && touchpad_y[0] < 280)
    {
        data->point.x = touchpad_x[0];
        data->point.y = touchpad_y[0];
        data->state = LV_INDEV_STATE_PRESSED;
    }
    else
    {
        data->state = LV_INDEV_STATE_RELEASED;
    }
}

static esp_err_t app_lvgl_init(void)
{
    /* Initialize LVGL */
    const lvgl_port_cfg_t lvgl_cfg = {
        .task_priority = 4,       /* LVGL task priority */
        .task_stack = 1024 * 10,       /* LVGL task stack size */
        .task_affinity = -1,      /* LVGL task pinned to core (-1 is no affinity) */
        .task_max_sleep_ms = 500, /* Maximum sleep in LVGL task */
        .timer_period_ms = 5      /* LVGL timer tick period in ms */
    };
    ESP_RETURN_ON_ERROR(lvgl_port_init(&lvgl_cfg), TAG, "LVGL port initialization failed");

    /* Add LCD screen */
    ESP_LOGD(TAG, "Add LCD screen");
    lvgl_port_display_cfg_t disp_cfg = {
        .io_handle = io_handle,
        .panel_handle = panel_handle,
        .buffer_size = EXAMPLE_LCD_H_RES * EXAMPLE_LCD_DRAW_BUFF_HEIGHT,
        .double_buffer = EXAMPLE_LCD_DRAW_BUFF_DOUBLE,
        .hres = EXAMPLE_LCD_H_RES,
        .vres = EXAMPLE_LCD_V_RES,
        .monochrome = false,
        /* Rotation values must be same as used in esp_lcd for initial settings of the screen */
        .rotation = {
            .swap_xy = false,
            .mirror_x = false,
            .mirror_y = false,
        },
        .flags = {
            .buff_dma = true,
#if LVGL_VERSION_MAJOR >= 9
            .swap_bytes = true,
#endif
        }};
#if EXAMPLE_DISPLAY_ROTATION == 90
    disp_cfg.rotation.swap_xy = true;
    disp_cfg.rotation.mirror_x = true;
    disp_cfg.rotation.mirror_y = false;
    ESP_ERROR_CHECK(esp_lcd_panel_set_gap(panel_handle, 20, 0));
#elif EXAMPLE_DISPLAY_ROTATION == 180
    disp_cfg.rotation.swap_xy = false;
    disp_cfg.rotation.mirror_x = true;
    disp_cfg.rotation.mirror_y = true;
    ESP_ERROR_CHECK(esp_lcd_panel_set_gap(panel_handle, 0, 20));
#elif EXAMPLE_DISPLAY_ROTATION == 270
    disp_cfg.rotation.swap_xy = true;
    disp_cfg.rotation.mirror_x = false;
    disp_cfg.rotation.mirror_y = true;
    ESP_ERROR_CHECK(esp_lcd_panel_set_gap(panel_handle, 20, 0));
#else
    ESP_ERROR_CHECK(esp_lcd_panel_set_gap(panel_handle, 0, 20));
#endif
    lvgl_disp = lvgl_port_add_disp(&disp_cfg);


    lvgl_port_lock(0);
    lvgl_touch_indev = lv_indev_create();

    if (touch_handle->config.int_gpio_num != GPIO_NUM_NC) {
        /* Register touch interrupt callback */
       esp_lcd_touch_register_interrupt_callback_with_data(touch_handle, esp_lcd_touch_interrupt_callback, lvgl_touch_indev);
    }

    lv_indev_set_type(lvgl_touch_indev, LV_INDEV_TYPE_POINTER);
    if (touch_handle->config.int_gpio_num != GPIO_NUM_NC) {
        lv_indev_set_mode(lvgl_touch_indev, LV_INDEV_MODE_EVENT);
    }
    lv_indev_set_read_cb(lvgl_touch_indev, lvgl_port_touchpad_read);
    lv_indev_set_disp(lvgl_touch_indev, lvgl_disp);
    lv_indev_set_driver_data(lvgl_touch_indev, touch_handle);
    lvgl_port_unlock();

    return ESP_OK;
}