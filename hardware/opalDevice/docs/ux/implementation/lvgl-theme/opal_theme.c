/**
 * OPAL LVGL Theme Implementation
 */

#include "opal_theme.h"
#include "lvgl.h"

void opal_theme_init(void)
{
    // Theme initialization
    // This can be called after lv_init()
}

void opal_theme_apply_default(lv_style_t *style)
{
    lv_style_init(style);
    lv_style_set_bg_color(style, OPAL_COLOR_BACKGROUND);
    lv_style_set_text_color(style, OPAL_COLOR_TEXT_PRIMARY);
    lv_style_set_text_font(style, OPAL_FONT_BODY);
}

void opal_theme_create_primary_button_style(lv_style_t *style)
{
    lv_style_init(style);
    
    // Background
    lv_style_set_bg_color(style, OPAL_COLOR_PRIMARY_BLUE);
    lv_style_set_bg_opa(style, LV_OPA_COVER);
    
    // Border
    lv_style_set_border_width(style, 0);
    lv_style_set_radius(style, OPAL_RADIUS_LG);
    
    // Text
    lv_style_set_text_color(style, LV_COLOR_WHITE);
    lv_style_set_text_font(style, OPAL_FONT_BUTTON);
    
    // Padding
    lv_style_set_pad_all(style, OPAL_SPACE_LG);
    
    // Size
    lv_style_set_min_height(style, OPAL_BUTTON_PRIMARY_HEIGHT);
    
    // Shadow (if supported)
    // lv_style_set_shadow_width(style, 4);
    // lv_style_set_shadow_color(style, OPAL_COLOR_PRIMARY_BLUE);
    // lv_style_set_shadow_opa(style, LV_OPA_30);
}

void opal_theme_create_broadcast_button_style(lv_style_t *style)
{
    lv_style_init(style);
    
    // Background
    lv_style_set_bg_color(style, OPAL_COLOR_PRIMARY_ORANGE);
    lv_style_set_bg_opa(style, LV_OPA_COVER);
    
    // Border
    lv_style_set_border_width(style, 0);
    lv_style_set_radius(style, OPAL_RADIUS_LG);
    
    // Text
    lv_style_set_text_color(style, LV_COLOR_WHITE);
    lv_style_set_text_font(style, OPAL_FONT_BUTTON);
    
    // Padding
    lv_style_set_pad_all(style, OPAL_SPACE_LG);
    
    // Size
    lv_style_set_min_height(style, OPAL_BUTTON_PRIMARY_HEIGHT);
}

void opal_theme_create_card_style(lv_style_t *style)
{
    lv_style_init(style);
    
    // Background
    lv_style_set_bg_color(style, OPAL_COLOR_SURFACE);
    lv_style_set_bg_opa(style, LV_OPA_COVER);
    
    // Border
    lv_style_set_border_width(style, 0);
    lv_style_set_radius(style, OPAL_RADIUS_MD);
    
    // Padding
    lv_style_set_pad_all(style, OPAL_SPACE_LG);
    
    // Text
    lv_style_set_text_color(style, OPAL_COLOR_TEXT_PRIMARY);
    lv_style_set_text_font(style, OPAL_FONT_BODY);
}

void opal_theme_create_mode_indicator_style(lv_style_t *style, bool is_targeted)
{
    lv_style_init(style);
    
    // Background (different for targeted vs broadcast)
    if (is_targeted) {
        lv_style_set_bg_color(style, OPAL_COLOR_TARGETED_BG);
        lv_style_set_border_color(style, OPAL_COLOR_PRIMARY_BLUE);
    } else {
        lv_style_set_bg_color(style, OPAL_COLOR_BROADCAST_BG);
        lv_style_set_border_color(style, OPAL_COLOR_PRIMARY_ORANGE);
    }
    
    lv_style_set_bg_opa(style, LV_OPA_COVER);
    
    // Border
    lv_style_set_border_width(style, 2);
    lv_style_set_radius(style, OPAL_RADIUS_MD);
    
    // Padding
    lv_style_set_pad_all(style, OPAL_SPACE_MD);
    
    // Text
    lv_style_set_text_color(style, is_targeted ? OPAL_COLOR_PRIMARY_BLUE : OPAL_COLOR_PRIMARY_ORANGE);
    lv_style_set_text_font(style, OPAL_FONT_BODY);
    
    // Size
    lv_style_set_min_height(style, OPAL_TOUCH_TARGET_MIN);
}

void opal_theme_create_text_style(lv_style_t *style, bool is_primary)
{
    lv_style_init(style);
    
    // Text color
    lv_style_set_text_color(style, is_primary ? OPAL_COLOR_TEXT_PRIMARY : OPAL_COLOR_TEXT_SECONDARY);
    lv_style_set_text_font(style, OPAL_FONT_BODY);
}

