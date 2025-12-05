# OPAL Screen Designs - High-Fidelity Specifications

**Date:** 2025-11-19  
**Purpose:** Pixel-perfect screen designs with detailed specifications

---

## Device UI Screen Designs

### **Screen 1: Home Screen (Idle State)**

**Dimensions:** 240x320px (typical small touch screen)  
**Orientation:** Portrait  
**Background:** #FFFFFF

```
┌─────────────────────────────┐ ← 0px
│ [🔊] OPAL        [📶] [🔋] │ ← Status Bar (32px height)
│                             │
│ ┌─────────────────────────┐ │
│ │                         │ │
│ │      👤 Sarah M.        │ │ ← User Info Card (80px height)
│ │      Nurse - MedSurg    │ │
│ │                         │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │                         │ │
│ │      🎤 TALK            │ │ ← Primary Action Button
│ │                         │ │    (96px height, full width)
│ │                         │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │ Mode: [👤 TARGETED ▼]  │ │ ← Mode Indicator (48px height)
│ └─────────────────────────┘ │
│                             │
│ [📞] [🌐] [⚙️]              │ ← Quick Actions (48px height)
│                             │
└─────────────────────────────┘
```

**Component Specifications:**

**Status Bar (Top):**
- Height: 32px
- Background: #F9FAFB
- Padding: 8px 16px
- Elements:
  - Audio icon (🔊): 20x20px, left aligned
  - Device name ("OPAL"): 14px, Medium, center
  - WiFi icon (📶): 20x20px, right aligned
  - Battery icon (🔋): 20x20px, right aligned, 8px from WiFi

**User Info Card:**
- Height: 80px
- Background: #F9FAFB
- Border Radius: 12px
- Padding: 16px
- Margin: 16px 0
- Content:
  - User name: 18px, Semi-Bold, #111827
  - Role/Department: 14px, Regular, #6B7280
  - Centered alignment

**Primary Action Button (TALK):**
- Height: 96px
- Width: Full width (224px with 16px margins)
- Background: #2563EB (Primary Blue)
- Border Radius: 16px
- Text: "TALK", 24px, Semi-Bold, #FFFFFF
- Icon: 🎤, 32x32px, centered above text
- Touch Target: Full button area (96x224px)
- Shadow: 0 4px 12px rgba(37, 99, 235, 0.3)

**Mode Indicator:**
- Height: 48px
- Background: #EFF6FF (Light Blue for Targeted)
- Border: 2px solid #2563EB
- Border Radius: 12px
- Padding: 12px 16px
- Content:
  - Label: "Mode:", 14px, Medium, #6B7280
  - Mode: "TARGETED", 16px, Semi-Bold, #2563EB
  - Icon: 👤, 20x20px
  - Dropdown arrow: ▼, 16x16px
- Touch Target: Full area (48px height)

**Quick Actions:**
- Height: 48px each
- Width: 64px each (3 buttons, 16px spacing)
- Background: #F9FAFB
- Border Radius: 12px
- Icons: 24x24px, centered
- Touch Target: 48x64px each

**Spacing:**
- Screen padding: 16px
- Element spacing: 12px vertical
- Card margins: 16px top/bottom

---

### **Screen 2: Mode Selection Screen**

**Dimensions:** 240x320px  
**Background:** #FFFFFF

```
┌─────────────────────────────┐
│ ← Back              [⚙️]    │ ← Header (48px height)
├─────────────────────────────┤
│                             │
│   Select Message Mode       │ ← Title (24px, Bold)
│                             │
│ ┌─────────────────────────┐ │
│ │                         │ │
│ │  👤 TARGETED            │ │ ← Mode Option 1
│ │                         │ │    (80px height)
│ │  Private message        │ │
│ │                         │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │                         │ │
│ │  📢 BROADCAST           │ │ ← Mode Option 2
│ │                         │ │    (80px height)
│ │  Group message          │ │
│ │                         │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │  Selected: TARGETED     │ │ ← Selection Indicator
│ └─────────────────────────┘ │    (48px height)
│                             │
└─────────────────────────────┘
```

**Component Specifications:**

**Header:**
- Height: 48px
- Background: #FFFFFF
- Padding: 12px 16px
- Back button: 24x24px, left aligned
- Settings icon: 24x24px, right aligned

**Title:**
- Font: 20px, Bold, #111827
- Padding: 16px 0
- Centered alignment

**Mode Option (TARGETED):**
- Height: 80px
- Width: Full width (224px with 16px margins)
- Background: #EFF6FF (Light Blue)
- Border: 2px solid #2563EB (when selected)
- Border Radius: 12px
- Padding: 16px
- Content:
  - Icon: 👤, 32x32px, left aligned
  - Title: "TARGETED", 18px, Semi-Bold, #2563EB
  - Description: "Private message", 14px, Regular, #6B7280
- Touch Target: Full area (80px height)

**Mode Option (BROADCAST):**
- Same as TARGETED but:
  - Background: #FFF7ED (Light Orange)
  - Border: 2px solid #F97316 (when selected)
  - Icon: 📢
  - Title color: #F97316

**Selection Indicator:**
- Height: 48px
- Background: #F9FAFB
- Border Radius: 8px
- Padding: 12px 16px
- Text: "Selected: TARGETED", 14px, Medium, #6B7280

---

### **Screen 3: Active Call Screen**

**Dimensions:** 240x320px  
**Background:** #FFFFFF

```
┌─────────────────────────────┐
│ ← End Call          [⚙️]     │ ← Header (48px)
├─────────────────────────────┤
│                             │
│      📞 Active Call         │ ← Call Status (32px)
│                             │
│ ┌─────────────────────────┐ │
│ │                         │ │
│ │      👤 Dr. Lee         │ │ ← Participant Info
│ │      Cardiology         │ │    (80px height)
│ │                         │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │      🎤 MUTE            │ │ ← Mute Button
│ └─────────────────────────┘ │    (64px height)
│                             │
│ ┌─────────────────────────┐ │
│ │      📞 SPEAKER         │ │ ← Speaker Button
│ └─────────────────────────┘ │    (64px height)
│                             │
│ Mode: TARGETED              │ ← Mode Indicator (32px)
│                             │
└─────────────────────────────┘
```

**Component Specifications:**

**Call Status:**
- Height: 32px
- Text: "📞 Active Call", 16px, Semi-Bold, #2563EB
- Centered alignment
- Padding: 8px 0

**Participant Info Card:**
- Height: 80px
- Background: #F9FAFB
- Border Radius: 12px
- Padding: 16px
- Content:
  - Avatar/Icon: 👤, 40x40px, centered
  - Name: "Dr. Lee", 18px, Semi-Bold, #111827
  - Department: "Cardiology", 14px, Regular, #6B7280
  - Centered alignment

**Mute Button:**
- Height: 64px
- Width: Full width (224px)
- Background: #F9FAFB
- Border: 1px solid #E5E7EB
- Border Radius: 12px
- Icon: 🎤, 24x24px, centered
- Text: "MUTE", 16px, Medium, #111827
- Touch Target: Full area

**Speaker Button:**
- Same as Mute Button but:
  - Icon: 📞
  - Text: "SPEAKER"

**Mode Indicator:**
- Height: 32px
- Text: "Mode: TARGETED", 14px, Medium, #6B7280
- Background: #EFF6FF
- Border Radius: 8px
- Padding: 8px 16px
- Centered alignment

---

### **Screen 4: Voice Command Screen**

**Dimensions:** 240x320px  
**Background:** #FFFFFF

```
┌─────────────────────────────┐
│ ← Cancel                     │ ← Header (48px)
├─────────────────────────────┤
│                             │
│      🎤 Listening...         │ ← Status (32px)
│                             │
│ ┌─────────────────────────┐ │
│ │                         │ │
│ │                         │ │
│ │      [🎤]               │ │ ← Mic Icon (96x96px)
│ │                         │ │
│ │                         │ │
│ └─────────────────────────┘ │
│                             │
│ "Call Dr. Lee"              │ ← Command Text (48px)
│                             │
│ ┌─────────────────────────┐ │
│ │  ✓ Processing...        │ │ ← Processing Status
│ └─────────────────────────┘ │    (48px height)
│                             │
│ Mode: TARGETED              │ ← Mode Indicator (32px)
│                             │
└─────────────────────────────┘
```

**Component Specifications:**

**Status Text:**
- Height: 32px
- Text: "🎤 Listening...", 16px, Semi-Bold, #2563EB
- Centered alignment
- Animation: Pulsing opacity (1s ease-in-out infinite)

**Microphone Icon:**
- Size: 96x96px
- Centered horizontally
- Color: #2563EB
- Animation: Scale pulse (1s ease-in-out infinite, scale 1.0 to 1.1)

**Command Text:**
- Height: 48px
- Text: User's spoken command, 16px, Regular, #111827
- Centered alignment
- Background: #F9FAFB
- Border Radius: 8px
- Padding: 12px 16px
- Margin: 16px 0

**Processing Status:**
- Height: 48px
- Background: #EFF6FF
- Border: 1px solid #2563EB
- Border Radius: 8px
- Padding: 12px 16px
- Text: "✓ Processing...", 14px, Medium, #2563EB
- Icon: Spinner animation (1s linear infinite)

**Mode Indicator:**
- Same as previous screens

---

## Dashboard Screen Designs

### **Dashboard 1: System Status Overview**

**Dimensions:** 1920x1080px (Desktop)  
**Background:** #F3F4F6

```
┌─────────────────────────────────────────────────────────────────────┐
│ OPAL Control Center                    [User] [Settings] [Logout]   │ ← Header (64px)
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐│
│ │ Devices     │  │ Active      │  │ Messages   │  │ AI Success ││
│ │ Online      │  │ Calls       │  │ Today      │  │ Rate        ││
│ │             │  │             │  │             │  │             ││
│ │   24/30     │  │     8        │  │    142     │  │    92%      ││
│ │   🟢        │  │   📞         │  │   📨        │  │   ✓         ││
│ └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘│
│                                                                       │
│ ┌─────────────────────────────────────────────────────────────────┐  │
│ │ System Health                                                  │  │
│ │ [████████░░] 80%                                               │  │
│ │ • All systems operational                                      │  │
│ │ • 2 devices offline (battery)                                  │  │
│ └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│ ┌─────────────────────────────────────────────────────────────────┐  │
│ │ Active Workflows                                               │  │
│ │ • 🚨 Patient Blood Loss - Room 302 (Critical)                 │  │
│ │ • ⚡ STEMI Alert - Cath Lab (Active)                          │  │
│ │ • 📋 Pharmacy Call - MedSurg (Pending)                        │  │
│ └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Component Specifications:**

**Header:**
- Height: 64px
- Background: #FFFFFF
- Border Bottom: 1px solid #E5E7EB
- Padding: 16px 24px
- Logo/Title: "OPAL Control Center", 24px, Bold, #111827
- User Menu: Right aligned, 14px, Medium

**Metric Cards:**
- Width: 280px each (4 cards, 16px spacing)
- Height: 120px
- Background: #FFFFFF
- Border: 1px solid #E5E7EB
- Border Radius: 12px
- Padding: 20px
- Shadow: 0 1px 3px rgba(0, 0, 0, 0.1)
- Content:
  - Label: 14px, Medium, #6B7280
  - Value: 32px, Bold, #111827
  - Icon: 32x32px, right aligned

**System Health Card:**
- Width: Full width (1872px with 24px margins)
- Height: 120px
- Background: #FFFFFF
- Border: 1px solid #E5E7EB
- Border Radius: 12px
- Padding: 24px
- Progress Bar:
  - Height: 8px
  - Background: #E5E7EB
  - Fill: #10B981 (Green)
  - Border Radius: 4px

**Active Workflows Card:**
- Same as System Health Card
- List Items:
  - Height: 48px each
  - Padding: 12px 0
  - Icon: 24x24px, left aligned
  - Text: 14px, Regular, #111827
  - Status Badge: Right aligned

---

### **Dashboard 2: Device Map View**

**Dimensions:** 1920x1080px  
**Background:** #F3F4F6

```
┌─────────────────────────────────────────────────────────────────────┐
│ Device Status                    [Refresh] [Filter ▼] [Export]      │ ← Header (64px)
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Floor Map (Interactive)                                        │ │
│ │                                                                 │ │
│ │    [Room 301]  [Room 302]  [Room 303]                          │ │
│ │      🟢 Sarah    🔴 John     🟢 Mary                            │ │
│ │                                                                 │ │
│ │    [Room 304]  [Room 305]  [Room 306]                          │ │
│ │      ⚪ Offline  🟢 Tom     🟡 Battery                          │ │
│ │                                                                 │ │
│ │  Legend: 🟢 Online  🟡 Low Battery  🔴 Alert  ⚪ Offline        │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Device List                                                     │ │
│ │ • Sarah M. (MedSurg) - 🟢 Online - Room 302                    │ │
│ │ • John D. (ER) - 🔴 Alert Active - Room 301                   │ │
│ │ • Mary K. (Pharmacy) - 🟢 Online - Room 303                   │ │
│ │ • Tom L. (MedSurg) - 🟢 Online - Room 305                     │ │
│ │ • [2 more devices...]                                         │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Component Specifications:**

**Floor Map Card:**
- Width: Full width (1872px)
- Height: 400px
- Background: #FFFFFF
- Border: 1px solid #E5E7EB
- Border Radius: 12px
- Padding: 24px
- Interactive Elements:
  - Room boxes: 120x80px
  - Clickable areas
  - Hover state: Border highlight
  - Status icons: 32x32px

**Device List Card:**
- Width: Full width (1872px)
- Height: Auto (min 200px)
- Background: #FFFFFF
- Border: 1px solid #E5E7EB
- Border Radius: 12px
- Padding: 24px
- List Items:
  - Height: 48px
  - Padding: 12px 0
  - Border Bottom: 1px solid #E5E7EB (last item: none)
  - Hover: Background #F9FAFB

---

### **Dashboard 3: AI Intelligence Dashboard**

**Dimensions:** 1920x1080px  
**Background:** #F3F4F6

```
┌─────────────────────────────────────────────────────────────────────┐
│ AI Intelligence Dashboard          [Refresh] [Settings] [Export]    │ ← Header (64px)
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Contextual Router Activity                                     │ │
│ │                                                                 │ │
│ │ Request: "Need signature for Heparin"                         │ │
│ │ Analysis:                                                      │ │
│ │   • Attending (Dr. Lee) - In Surgery ❌                      │ │
│ │   • Resident (Dr. Jay) - Available ✓                        │ │
│ │ Action: Routed to Dr. Jay                                     │ │
│ │ Result: Connected in 8 seconds                                 │ │
│ │                                                                 │ │
│ │ [View more examples...]                                        │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ AI Feature Usage                                                │ │
│ │                                                                 │ │
│ │ Contextual Router:     ████████░░ 80%                          │ │
│ │ Actionable Voice:       ██████░░░░ 60%                         │ │
│ │ Universal Translator:   ████░░░░░░ 40%                         │ │
│ │ Clinical Oracle:        ██░░░░░░░░ 20%                         │ │
│ │ Sentiment Sentinel:     █░░░░░░░░░ 10%                         │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ AI Success Metrics                                              │ │
│ │ • Call Success Rate: 92% (vs 65% Vocera baseline)              │ │
│ │ • Average Routing Time: 3.2 seconds                            │ │
│ │ • Voice-to-EMR Orders: 18 today                                 │ │
│ │ • Translation Sessions: 12 today                                │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Component Specifications:**

**Contextual Router Activity Card:**
- Width: Full width (1872px)
- Height: Auto (min 200px)
- Background: #FFFFFF
- Border: 1px solid #E5E7EB
- Border Radius: 12px
- Padding: 24px
- Content:
  - Request: 16px, Semi-Bold, #111827
  - Analysis items: 14px, Regular, #6B7280
  - Status icons: 20x20px (✓ or ❌)
  - Result: 14px, Medium, #10B981

**AI Feature Usage Card:**
- Same dimensions as above
- Progress Bars:
  - Height: 24px
  - Background: #E5E7EB
  - Fill: #2563EB (Primary Blue)
  - Border Radius: 12px
  - Label: 14px, Medium, #111827
  - Percentage: 14px, Medium, #6B7280, right aligned

**AI Success Metrics Card:**
- Same dimensions as above
- Metric Items:
  - Height: 40px
  - Label: 14px, Medium, #6B7280
  - Value: 18px, Bold, #111827
  - Comparison: 14px, Regular, #10B981 (if positive)

---

## Responsive Breakpoints

### **Device UI:**
- Fixed: 240x320px (small touch screen)
- No responsive breakpoints (hardware constraint)

### **Dashboard UI:**
- **Mobile:** < 640px
  - Single column layout
  - Stacked cards
  - Reduced padding (16px)
- **Tablet:** 640px - 1024px
  - 2-column layout for metrics
  - Full-width cards
  - Standard padding (24px)
- **Desktop:** 1024px - 1440px
  - 4-column layout for metrics
  - Full-width cards
  - Standard padding (24px)
- **Large:** > 1440px
  - 4-column layout
  - Max width: 1920px, centered
  - Standard padding (24px)

---

## Animation Specifications

### **Device UI:**
- **Page Transition:** 200ms ease-in-out
- **Button Press:** 100ms scale (0.95)
- **Mode Switch:** 300ms color transition
- **Loading Spinner:** 1s linear infinite
- **Voice Listening:** 1s ease-in-out infinite (pulse)

### **Dashboard UI:**
- **Page Transition:** 300ms ease-in-out
- **Card Hover:** 200ms transform, shadow increase
- **Data Update:** 400ms fade-in
- **Chart Animation:** 500ms ease-out
- **Real-time Updates:** 200ms slide-in from right

---

## Accessibility Specifications

### **Device UI:**
- **Touch Targets:** Minimum 44x44px (WCAG 2.1 AA)
- **Color Contrast:** Minimum 4.5:1 for text
- **Text Size:** Minimum 12px
- **Voice Feedback:** All actions have audio confirmation
- **Haptic Feedback:** Vibration for important actions

### **Dashboard UI:**
- **Keyboard Navigation:** Full Tab order support
- **Screen Reader:** ARIA labels on all interactive elements
- **Color Contrast:** Minimum 4.5:1 for text
- **Focus Indicators:** 2px solid #2563EB outline
- **Responsive Design:** Works on all screen sizes

---

**Last Updated:** 2025-11-19

