/**
 * OPAL LVGL Theme
 * Based on OPAL Design System
 * 
 * This theme implements the OPAL design system for LVGL on ESP32-C6
 * 
 * Colors:
 * - Primary Blue: #2563EB (Targeted mode)
 * - Primary Orange: #F97316 (Broadcast mode)
 * - Background: #FFFFFF
 * - Surface: #F9FAFB
 * - Text Primary: #111827
 * - Text Secondary: #6B7280
 */

#ifndef OPAL_THEME_H
#define OPAL_THEME_H

#include "lvgl.h"

#ifdef __cplusplus
extern "C" {
#endif

// Color definitions (RGB565 format for LVGL)
#define OPAL_COLOR_PRIMARY_BLUE       LV_COLOR_MAKE(0x25, 0x63, 0xEB)  // #2563EB
#define OPAL_COLOR_PRIMARY_ORANGE     LV_COLOR_MAKE(0xF9, 0x73, 0x16)  // #F97316
#define OPAL_COLOR_BACKGROUND         LV_COLOR_MAKE(0xFF, 0xFF, 0xFF)  // #FFFFFF
#define OPAL_COLOR_SURFACE            LV_COLOR_MAKE(0xF9, 0xFA, 0xFB)  // #F9FAFB
#define OPAL_COLOR_TARGETED_BG        LV_COLOR_MAKE(0xEF, 0xF6, 0xFF)  // #EFF6FF
#define OPAL_COLOR_BROADCAST_BG       LV_COLOR_MAKE(0xFF, 0xF7, 0xED)  // #FFF7ED
#define OPAL_COLOR_TEXT_PRIMARY       LV_COLOR_MAKE(0x11, 0x18, 0x27)  // #111827
#define OPAL_COLOR_TEXT_SECONDARY     LV_COLOR_MAKE(0x6B, 0x72, 0x80)  // #6B7280
#define OPAL_COLOR_SUCCESS            LV_COLOR_MAKE(0x10, 0xB9, 0x81)  // #10B981
#define OPAL_COLOR_WARNING            LV_COLOR_MAKE(0xF5, 0x9E, 0x0B)  // #F59E0B
#define OPAL_COLOR_ERROR              LV_COLOR_MAKE(0xEF, 0x44, 0x44)  // #EF4444
#define OPAL_COLOR_BORDER             LV_COLOR_MAKE(0xE5, 0xE7, 0xEB)  // #E5E7EB

// Spacing definitions (in pixels)
#define OPAL_SPACE_XS     4
#define OPAL_SPACE_SM    8
#define OPAL_SPACE_MD    12
#define OPAL_SPACE_LG    16
#define OPAL_SPACE_XL    24
#define OPAL_SPACE_XXL   32

// Touch target minimum size (WCAG 2.1 AA)
#define OPAL_TOUCH_TARGET_MIN    44

// Button heights
#define OPAL_BUTTON_PRIMARY_HEIGHT   96
#define OPAL_BUTTON_SECONDARY_HEIGHT 48
#define OPAL_BUTTON_ICON_SIZE        48

// Border radius
#define OPAL_RADIUS_SM    8
#define OPAL_RADIUS_MD    12
#define OPAL_RADIUS_LG    16

// Font sizes (LVGL font system)
// Note: Actual font sizes depend on loaded fonts
#define OPAL_FONT_H1            LV_FONT_DEFAULT
#define OPAL_FONT_H2            LV_FONT_DEFAULT
#define OPAL_FONT_BODY          LV_FONT_DEFAULT
#define OPAL_FONT_BUTTON         LV_FONT_DEFAULT

/**
 * Initialize OPAL theme
 * Call this after LVGL initialization
 */
void opal_theme_init(void);

/**
 * Apply OPAL theme to default style
 */
void opal_theme_apply_default(lv_style_t *style);

/**
 * Create primary button style (Targeted mode - Blue)
 */
void opal_theme_create_primary_button_style(lv_style_t *style);

/**
 * Create secondary button style (Broadcast mode - Orange)
 */
void opal_theme_create_broadcast_button_style(lv_style_t *style);

/**
 * Create card style
 */
void opal_theme_create_card_style(lv_style_t *style);

/**
 * Create mode indicator style
 * @param style Style object to initialize
 * @param is_targeted true for targeted mode (blue), false for broadcast (orange)
 */
void opal_theme_create_mode_indicator_style(lv_style_t *style, bool is_targeted);

/**
 * Create text style
 * @param style Style object to initialize
 * @param is_primary true for primary text, false for secondary
 */
void opal_theme_create_text_style(lv_style_t *style, bool is_primary);

#ifdef __cplusplus
}
#endif

#endif // OPAL_THEME_H

