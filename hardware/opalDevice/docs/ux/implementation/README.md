# OPAL UI Implementation

This directory contains implementation files for OPAL device UI and dashboard.

## Structure

```
implementation/
├── html-mockups/          # HTML/CSS visual mockups
│   ├── device-home.html
│   ├── dashboard-overview.html
│   └── ...
├── lvgl-theme/           # LVGL theme for device UI
│   ├── opal_theme.h
│   ├── opal_theme.c
│   └── README.md
├── react-dashboard/      # React dashboard implementation
│   ├── src/
│   ├── package.json
│   └── README.md
└── README.md
```

## Implementation Options

### 1. Visual Mockups (HTML/CSS)
- **Location:** `html-mockups/`
- **Purpose:** Quick visual reference and prototyping
- **Files:**
  - `device-home.html` - Device home screen mockup
  - `dashboard-overview.html` - Dashboard overview mockup

### 2. Device UI (LVGL)
- **Location:** `lvgl-theme/`
- **Purpose:** ESP32-C6 device UI implementation
- **Files:**
  - `opal_theme.h` - Theme header
  - `opal_theme.c` - Theme implementation
- **Usage:** Integrate with ESP-IDF project

### 3. Dashboard (React)
- **Location:** `react-dashboard/`
- **Purpose:** Web dashboard implementation
- **Setup:** See `react-dashboard/README.md`

## Design Tokens

Design tokens are defined in `../design-tokens.json` and used across all implementations.

## Next Steps

1. **Review HTML Mockups** - Open in browser to see visual designs
2. **Integrate LVGL Theme** - Add to ESP-IDF project
3. **Set up React Dashboard** - Follow `react-dashboard/README.md`
4. **Test Implementations** - Verify design system consistency

## Resources

- [LVGL Documentation](https://docs.lvgl.io/)
- [React Documentation](https://react.dev/)
- [OPAL Design System](../opal-design-system.md)

