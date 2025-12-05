#include <stdio.h>

#include "esp_err.h"
#include "esp_log.h"
#include "esp_check.h"


#include "bsp_i2c.h"

#include "bsp_pwr.h"

#include "bsp_pcf85063.h"

static char *TAG = "pcf85063_example";


void app_main(void)
{
    i2c_master_bus_handle_t i2c_bus_handle;
    bsp_pwr_init();
    i2c_bus_handle = bsp_i2c_init();
    bsp_pcf85063_init(i2c_bus_handle);
    bsp_pcf85063_test();
}
