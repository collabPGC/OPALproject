# OPAL Design System

**Date:** 2025-11-19  
**Purpose:** Complete design system specification for OPAL device and dashboard

---

## Design Philosophy

**Core Principle:** "Intelligent Node" vs "Dumb Radio"
- **Vocera** = Simple audio pipe (dumb radio)
- **Opal** = Smart, context-aware, actionable (intelligent node)

**Design Goals:**
1. **Clarity Over Complexity**: Every screen must be immediately understandable
2. **Mode Transparency**: Users must always know if they're in targeted or broadcast mode
3. **Voice-First**: UI supports voice, doesn't compete with it
4. **Clinical Context**: Designed for busy, stressed clinical staff
5. **Trust Through Transparency**: Show AI decision-making when relevant

---

## Color Palette

### **Primary Colors**

**Device UI (Small Screen):**
```
Primary Blue:     #2563EB  (RGB: 37, 99, 235)   - Targeted mode, primary actions
Primary Orange:   #F97316  (RGB: 249, 115, 22)  - Broadcast mode, alerts
Background:       #FFFFFF  (RGB: 255, 255, 255)  - Main background
Surface:          #F9FAFB  (RGB: 249, 250, 251) - Card backgrounds
Text Primary:     #111827  (RGB: 17, 24, 39)    - Main text
Text Secondary:   #6B7280  (RGB: 107, 114, 128) - Secondary text
Success:          #10B981  (RGB: 16, 185, 129)  - Success states
Warning:          #F59E0B  (RGB: 245, 158, 11)  - Warnings
Error:            #EF4444  (RGB: 239, 68, 68)   - Errors, critical alerts
```

**Dashboard UI (Web):**
```
Primary Blue:     #2563EB  (RGB: 37, 99, 235)   - Primary actions, links
Primary Orange:   #F97316  (RGB: 249, 115, 22)  - Broadcast indicators
Background:       #F3F4F6  (RGB: 243, 244, 246) - Main background
Surface:          #FFFFFF  (RGB: 255, 255, 255) - Card backgrounds
Text Primary:     #111827  (RGB: 17, 24, 39)    - Main text
Text Secondary:   #6B7280  (RGB: 107, 114, 128) - Secondary text
Border:           #E5E7EB  (RGB: 229, 231, 235) - Borders, dividers
Success:          #10B981  (RGB: 16, 185, 129)  - Success states
Warning:          #F59E0B  (RGB: 245, 158, 11)  - Warnings
Error:            #EF4444  (RGB: 239, 68, 68)   - Errors
Info:             #3B82F6  (RGB: 59, 130, 246)  - Information
```

### **Mode-Specific Colors**

**Targeted Mode (Private Messages):**
```
Primary:    #2563EB  (Blue) - Trust, professional, private
Background: #EFF6FF  (Light blue) - Subtle mode indicator
Border:     #3B82F6  (Medium blue) - Mode boundaries
```

**Broadcast Mode (Group Messages):**
```
Primary:    #F97316  (Orange) - Attention, urgency, group
Background: #FFF7ED  (Light orange) - Subtle mode indicator
Border:     #FB923C  (Medium orange) - Mode boundaries
```

### **Status Colors**

```
Online:     #10B981  (Green) - Device online, active
Offline:    #9CA3AF  (Gray) - Device offline
Low Battery: #F59E0B  (Amber) - Battery warning
Critical:   #EF4444  (Red) - Critical alerts, errors
Processing: #3B82F6  (Blue) - AI processing, loading
```

---

## Typography

### **Device UI (Small Screen)**

**Font Family:** System default (sans-serif, high readability)

**Headings:**
```
H1: 24px, Bold (600), Line Height: 32px
H2: 20px, Bold (600), Line Height: 28px
H3: 18px, Semi-Bold (500), Line Height: 24px
```

**Body Text:**
```
Body Large:  16px, Regular (400), Line Height: 24px
Body:        14px, Regular (400), Line Height: 20px
Body Small:  12px, Regular (400), Line Height: 16px
```

**Labels:**
```
Label:       12px, Medium (500), Line Height: 16px
Label Small: 10px, Medium (500), Line Height: 14px
```

**Button Text:**
```
Button Large: 18px, Semi-Bold (500), Line Height: 24px
Button:        16px, Semi-Bold (500), Line Height: 20px
Button Small:  14px, Medium (500), Line Height: 18px
```

### **Dashboard UI (Web)**

**Font Family:** Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif

**Headings:**
```
H1: 32px, Bold (700), Line Height: 40px
H2: 24px, Bold (700), Line Height: 32px
H3: 20px, Semi-Bold (600), Line Height: 28px
H4: 18px, Semi-Bold (600), Line Height: 24px
```

**Body Text:**
```
Body Large:  16px, Regular (400), Line Height: 24px
Body:        14px, Regular (400), Line Height: 20px
Body Small:  12px, Regular (400), Line Height: 16px
```

---

## Spacing System

### **Device UI (Small Screen)**
```
XS:  4px   - Tight spacing, icon padding
SM:  8px   - Small gaps, compact layouts
MD:  12px  - Standard spacing
LG:  16px  - Section spacing
XL:  24px  - Large gaps, screen margins
XXL: 32px  - Screen padding
```

### **Dashboard UI (Web)**
```
XS:  4px   - Tight spacing
SM:  8px   - Small gaps
MD:  12px  - Standard spacing
LG:  16px  - Section spacing
XL:  24px  - Large gaps
XXL: 32px  - Screen padding
XXXL: 48px - Major section spacing
```

---

## Component Specifications

### **Buttons**

**Device UI:**
```
Primary Button:
  - Height: 56px (minimum for gloved hands)
  - Padding: 16px 24px
  - Border Radius: 12px
  - Font: 18px, Semi-Bold
  - Touch Target: Minimum 44x44px

Secondary Button:
  - Height: 48px
  - Padding: 12px 20px
  - Border Radius: 8px
  - Font: 16px, Medium
  - Touch Target: Minimum 44x44px

Icon Button:
  - Size: 48x48px (minimum)
  - Border Radius: 12px
  - Icon Size: 24x24px
```

**Dashboard UI:**
```
Primary Button:
  - Height: 40px
  - Padding: 12px 24px
  - Border Radius: 8px
  - Font: 14px, Semi-Bold

Secondary Button:
  - Height: 40px
  - Padding: 12px 24px
  - Border Radius: 8px
  - Font: 14px, Medium
  - Border: 1px solid #E5E7EB
```

### **Cards**

**Device UI:**
```
Card:
  - Padding: 16px
  - Border Radius: 12px
  - Background: #F9FAFB
  - Shadow: None (flat design for small screen)
  - Margin: 12px 0
```

**Dashboard UI:**
```
Card:
  - Padding: 24px
  - Border Radius: 12px
  - Background: #FFFFFF
  - Shadow: 0 1px 3px rgba(0, 0, 0, 0.1)
  - Border: 1px solid #E5E7EB
  - Margin: 16px 0
```

### **Input Fields**

**Device UI:**
```
Input:
  - Height: 48px
  - Padding: 12px 16px
  - Border Radius: 8px
  - Border: 1px solid #D1D5DB
  - Font: 16px, Regular
  - Background: #FFFFFF
```

### **Status Indicators**

**Device UI:**
```
Status Badge:
  - Height: 24px
  - Padding: 4px 12px
  - Border Radius: 12px
  - Font: 12px, Medium
  - Icon Size: 16x16px
```

**Dashboard UI:**
```
Status Badge:
  - Height: 28px
  - Padding: 6px 12px
  - Border Radius: 14px
  - Font: 12px, Medium
  - Icon Size: 16x16px
```

---

## Icon System

### **Icon Specifications**

**Device UI:**
```
Icon Size: 24x24px (standard)
Icon Size Large: 32x32px (primary actions)
Icon Stroke: 2px
Icon Color: Inherit from parent (or #6B7280)
```

**Dashboard UI:**
```
Icon Size: 20x20px (standard)
Icon Size Large: 24x24px (primary actions)
Icon Stroke: 1.5px
Icon Color: #6B7280 (default)
```

### **Icon Library**

```
🎤 Microphone - Voice command
📞 Phone - Call
📢 Broadcast - Broadcast mode
👤 User - Targeted mode, user
🔊 Speaker - Speaker mode
🔇 Mute - Mute
🌐 Globe - Interpreter mode
⚙️ Settings - Settings
📶 Signal - WiFi, signal strength
🔋 Battery - Battery status
✓ Check - Success, acknowledge
✕ Close - Cancel, close
← Back - Back navigation
→ Forward - Next, forward
⏸ Pause - Pause
▶ Play - Play
🚨 Alert - Critical alert
⚠ Warning - Warning
ℹ Info - Information
```

---

## Animation & Transitions

### **Device UI**

```
Page Transition: 200ms ease-in-out
Button Press: 100ms scale (0.95)
Loading Spinner: 1s linear infinite
Mode Switch: 300ms color transition
```

### **Dashboard UI**

```
Page Transition: 300ms ease-in-out
Card Hover: 200ms transform, shadow
Data Update: 400ms fade-in
Chart Animation: 500ms ease-out
```

---

## Accessibility

### **Device UI**

- **Touch Targets**: Minimum 44x44px (WCAG 2.1 AA)
- **Color Contrast**: Minimum 4.5:1 for text (WCAG 2.1 AA)
- **Text Size**: Minimum 12px (readable without zoom)
- **Voice Feedback**: All actions have audio confirmation
- **Haptic Feedback**: Vibration for important actions

### **Dashboard UI**

- **Keyboard Navigation**: Full keyboard support
- **Screen Reader**: ARIA labels on all interactive elements
- **Color Contrast**: Minimum 4.5:1 for text
- **Focus Indicators**: Clear focus states
- **Responsive Design**: Works on tablets and desktops

---

## Responsive Breakpoints

### **Dashboard UI**

```
Mobile:    < 640px
Tablet:    640px - 1024px
Desktop:   1024px - 1440px
Large:     > 1440px
```

---

## Mode Indicator Design

### **Visual Design**

**Targeted Mode:**
- Blue accent color (#2563EB)
- Icon: 👤 (user icon)
- Text: "TARGETED" or "PRIVATE"
- Background tint: Light blue (#EFF6FF)

**Broadcast Mode:**
- Orange accent color (#F97316)
- Icon: 📢 (broadcast icon)
- Text: "BROADCAST" or "GROUP"
- Background tint: Light orange (#FFF7ED)

### **Placement**

- **Always Visible**: Top of screen or status bar
- **Persistent**: Does not disappear during interactions
- **Prominent**: Large enough to be noticed but not intrusive
- **Contextual**: Changes color based on current mode

---

## Error States

### **Device UI**

```
Error Message:
  - Background: #FEF2F2 (light red)
  - Border: 1px solid #EF4444
  - Text: #991B1B (dark red)
  - Icon: ⚠ (warning icon)
  - Padding: 12px
  - Border Radius: 8px
```

### **Dashboard UI**

```
Error Message:
  - Background: #FEF2F2
  - Border: 1px solid #EF4444
  - Text: #991B1B
  - Icon: ⚠
  - Padding: 16px
  - Border Radius: 8px
```

---

## Loading States

### **Device UI**

```
Loading Spinner:
  - Size: 32x32px
  - Color: #2563EB (primary blue)
  - Animation: 1s linear infinite
```

### **Dashboard UI**

```
Loading Skeleton:
  - Background: #F3F4F6
  - Animation: Pulse 1.5s ease-in-out infinite
  - Border Radius: 4px
```

---

## Dark Mode (Future Consideration)

### **Device UI**

```
Background: #111827 (dark gray)
Surface: #1F2937 (lighter gray)
Text Primary: #F9FAFB (light text)
Text Secondary: #D1D5DB (medium gray)
```

### **Dashboard UI**

```
Background: #111827
Surface: #1F2937
Text Primary: #F9FAFB
Text Secondary: #D1D5DB
Border: #374151
```

---

## Implementation Notes

### **Device UI (LVGL)**
- Use LVGL 8.x or later
- Custom theme based on color palette
- Touch driver integration (CST816S)
- Font rendering optimization for small screen

### **Dashboard UI (Web)**
- React/Vue component library
- Tailwind CSS for styling (matches design system)
- Responsive grid system
- Real-time updates via WebSocket

---

**Last Updated:** 2025-11-19

