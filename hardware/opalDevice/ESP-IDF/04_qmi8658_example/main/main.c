#include <stdio.h>

#include "esp_err.h"
#include "esp_log.h"
#include "esp_check.h"


#include "bsp_i2c.h"

#include "bsp_pwr.h"

#include "bsp_qmi8658.h"

static char *TAG = "qmi8658_example";


void app_main(void)
{
    i2c_master_bus_handle_t i2c_bus_handle;
    bsp_pwr_init();
    i2c_bus_handle = bsp_i2c_init();
    bsp_qmi8658_init(i2c_bus_handle);
    bsp_qmi8658_test();
}
