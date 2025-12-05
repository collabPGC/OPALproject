# OPAL UX/UI Documentation

This directory contains user experience and interface design documentation for the OPAL device.

---

## Documents

### **[opal-ui-wireframes.md](opal-ui-wireframes.md)**
Initial wireframe documentation covering:
- Device UI wireframes (small touch screen)
- Dashboard UI wireframes (control center/simulation)
- Design principles and implementation notes

### **[opal-design-system.md](opal-design-system.md)**
Complete design system specification:
- Color palette (device and dashboard)
- Typography system
- Spacing system
- Component specifications
- Icon system
- Animation & transitions
- Accessibility guidelines

### **[opal-interaction-flows.md](opal-interaction-flows.md)**
Detailed interaction flow documentation:
- 8 complete user journeys
- Step-by-step flow diagrams
- Error handling
- Edge cases
- State transitions

### **[opal-screen-designs.md](opal-screen-designs.md)**
High-fidelity screen designs:
- Pixel-perfect specifications
- Component dimensions and spacing
- Responsive breakpoints
- Animation specifications
- Accessibility requirements

---

## Key Design Requirements

### **Device UI (Critical):**
- **Mode Switching UX**: CRITICAL - Must clearly show targeted vs broadcast mode
- **Large Touch Targets**: Minimum 44x44px for gloved hands
- **Simple, Clear Interface**: Clinical staff are not tech-savvy
- **Voice-First Design**: Primary interaction is voice, UI is secondary

### **Dashboard UI:**
- **Real-time System Status**: Live device and workflow monitoring
- **AI Visualization**: Shows "Intelligent Node" capabilities
- **Demo Mode**: Can simulate scenarios for sales presentations
- **Performance Metrics**: Demonstrates value vs Vocera

---

## Related Epics

- **SCRUM-33**: User Experience & Interface
- **SCRUM-34**: Demo & Pilot Programs (dashboard visualization)

---

## Implementation Files

### **[implementation/](implementation/)**
Ready-to-use implementation files:
- `html-mockups/` - HTML/CSS visual mockups
- `html-prototype/` - Interactive HTML prototype
- `lvgl-theme/` - LVGL theme for device UI
- `react-dashboard/` - React dashboard structure

### **[design-tokens.json](design-tokens.json)**
Complete design tokens in JSON format for multi-platform use.

### **[IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md)**
Detailed implementation roadmap with phases and tasks.

---

**Last Updated:** 2025-11-19

