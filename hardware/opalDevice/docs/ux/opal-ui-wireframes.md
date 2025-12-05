# OPAL UI Wireframes & Design Specifications

**Date:** 2025-11-19  
**Purpose:** Comprehensive wireframe documentation for OPAL device UI and dashboard

---

## Device Specifications

**Hardware:**
- ESP32-C6 microcontroller
- CST816S touch screen controller (I2C)
- Small touch screen display (exact size TBD, but likely 1.69" or similar)
- ES8311 audio codec (speaker + microphone)
- Battery-powered, wearable device

**Constraints:**
- Small screen real estate
- Must be usable with gloves
- Must work in noisy clinical environments
- Simple, clear UI (clinical staff are not tech-savvy)
- Mode switching UX is CRITICAL

---

## Part 1: Device UI Wireframes (Small Touch Screen)

### **Screen 1: Idle/Home Screen**

```
┌─────────────────────────┐
│  [🔊]  OPAL    [📶]     │  ← Status bar (audio, WiFi)
├─────────────────────────┤
│                         │
│      👤 Sarah M.        │  ← User name/ID
│      Nurse - MedSurg    │  ← Role/Department
│                         │
│   ┌───────────────┐    │
│   │  🎤 TALK      │    │  ← Primary action (large, easy tap)
│   └───────────────┘    │
│                         │
│   Mode: [TARGETED ▼]   │  ← Mode indicator (critical!)
│                         │
│   [📞] [🌐] [⚙️]        │  ← Quick actions (calls, settings)
└─────────────────────────┘
```

**Key Elements:**
- **Status Bar**: Audio status, WiFi signal, battery (if visible)
- **User Identity**: Clear name and role
- **Primary Action**: Large "TALK" button (voice command)
- **Mode Indicator**: CRITICAL - Shows targeted vs broadcast mode
- **Quick Actions**: Calls, interpreter mode, settings

**Design Notes:**
- Large touch targets (minimum 44x44px for gloved hands)
- High contrast colors
- Clear typography
- Visual mode indicator (color-coded: blue=targeted, orange=broadcast)

---

### **Screen 2: Mode Selection Screen**

```
┌─────────────────────────┐
│  ← Back                 │
├─────────────────────────┤
│                         │
│   Select Message Mode   │
│                         │
│   ┌───────────────┐    │
│   │  👤 TARGETED  │    │  ← Private message
│   │               │    │
│   │  Send to:     │    │
│   │  [Select...]  │    │  ← Choose recipient
│   └───────────────┘    │
│                         │
│   ┌───────────────┐    │
│   │  📢 BROADCAST │    │  ← Group message
│   │               │    │
│   │  Send to:     │    │
│   │  [All Nurses]│    │  ← Predefined groups
│   └───────────────┘    │
│                         │
└─────────────────────────┘
```

**Key Elements:**
- **Clear Mode Options**: Targeted (private) vs Broadcast (group)
- **Recipient Selection**: For targeted mode
- **Group Selection**: For broadcast mode (predefined groups)
- **Visual Distinction**: Different colors/icons for each mode

**Design Notes:**
- Must be obvious which mode is selected
- Large tap targets
- Can be accessed from home screen via mode indicator

---

### **Screen 3: Active Call Screen**

```
┌─────────────────────────┐
│  ← End Call    [⚙️]     │
├─────────────────────────┤
│                         │
│   📞 Calling...        │  ← Call status
│                         │
│      👤 Dr. Lee         │  ← Caller/recipient
│      Cardiology         │  ← Department/role
│                         │
│   ┌───────────────┐    │
│   │  🎤 MUTE      │    │  ← Mute button
│   └───────────────┘    │
│                         │
│   ┌───────────────┐    │
│   │  📞 SPEAKER  │    │  ← Speaker toggle
│   └───────────────┘    │
│                         │
│   Mode: TARGETED        │  ← Current mode
│                         │
└─────────────────────────┘
```

**Key Elements:**
- **Call Status**: Connecting, active, ended
- **Participant Info**: Name, role, department
- **Call Controls**: Mute, speaker, end call
- **Mode Indicator**: Shows if call is targeted or broadcast

**Design Notes:**
- Large, easy-to-tap controls
- Clear visual feedback for active call
- Can switch to speaker mode for hands-free

---

### **Screen 4: Voice Command Screen**

```
┌─────────────────────────┐
│  ← Cancel               │
├─────────────────────────┤
│                         │
│   🎤 Listening...       │  ← Voice status
│                         │
│   ┌───────────────┐    │
│   │               │    │
│   │   [🎤]        │    │  ← Large mic icon
│   │               │    │
│   └───────────────┘    │
│                         │
│   "Call Dr. Lee"        │  ← Voice command text
│                         │
│   ┌───────────────┐    │
│   │  ✓ Processing │    │  ← AI processing
│   └───────────────┘    │
│                         │
│   Mode: TARGETED        │
│                         │
└─────────────────────────┘
```

**Key Elements:**
- **Visual Feedback**: Large mic icon, listening animation
- **Command Display**: Shows recognized command
- **Processing Status**: Shows AI is analyzing intent
- **Mode Context**: Shows current mode

**Design Notes:**
- Clear visual feedback for voice input
- Shows AI processing (builds trust)
- Can cancel at any time

---

### **Screen 5: Interpreter Mode Screen**

```
┌─────────────────────────┐
│  ← Back    [🌐] OFF     │
├─────────────────────────┤
│                         │
│   🌐 Interpreter Mode   │
│                         │
│   ┌───────────────┐    │
│   │  English      │    │  ← Your language
│   │  [🎤]         │    │
│   └───────────────┘    │
│                         │
│   ┌───────────────┐    │
│   │  Spanish      │    │  ← Patient language
│   │  [🔊]         │    │
│   └───────────────┘    │
│                         │
│   [Select Language ▼]  │  ← Language selector
│                         │
│   Status: Active        │
│                         │
└─────────────────────────┘
```

**Key Elements:**
- **Language Selection**: Choose target language
- **Dual Audio Channels**: Your speech vs translated speech
- **Visual Feedback**: Shows which side is speaking
- **Toggle Control**: Easy on/off

**Design Notes:**
- Clear visual distinction between languages
- Large controls for quick activation
- Shows real-time translation status

---

### **Screen 6: Settings Screen**

```
┌─────────────────────────┐
│  ← Back                 │
├─────────────────────────┤
│                         │
│   ⚙️ Settings           │
│                         │
│   ┌───────────────┐    │
│   │  Volume       │    │
│   │  [━━━━━━━━]   │    │  ← Volume slider
│   └───────────────┘    │
│                         │
│   ┌───────────────┐    │
│   │  Notifications│    │
│   │  [✓] Enabled  │    │  ← Toggle
│   └───────────────┘    │
│                         │
│   ┌───────────────┐    │
│   │  WiFi         │    │
│   │  Connected ✓  │    │  ← Status
│   └───────────────┘    │
│                         │
│   [About] [Logout]      │
│                         │
└─────────────────────────┘
```

**Key Elements:**
- **Volume Control**: Slider for audio volume
- **Notification Settings**: Enable/disable alerts
- **Network Status**: WiFi connection status
- **Account Info**: User info, logout

**Design Notes:**
- Simple, essential settings only
- Large controls
- Clear status indicators

---

### **Screen 7: Notification/Alert Screen**

```
┌─────────────────────────┐
│  [📢] Alert              │
├─────────────────────────┤
│                         │
│   🚨 URGENT              │  ← Priority indicator
│                         │
│   Blood Loss Alert       │  ← Alert type
│   Room 302               │  ← Location
│                         │
│   Patient: John D.       │  ← Patient info
│   Status: Critical       │  ← Status
│                         │
│   ┌───────────────┐    │
│   │  ✓ Acknowledge│    │  ← Action button
│   └───────────────┘    │
│                         │
│   [View Details →]      │
│                         │
└─────────────────────────┘
```

**Key Elements:**
- **Priority Indicator**: Visual urgency (color-coded)
- **Alert Information**: Type, location, patient
- **Action Button**: Acknowledge or respond
- **Details Link**: More information

**Design Notes:**
- High contrast for visibility
- Large action buttons
- Clear priority indication

---

## Part 2: Dashboard UI Wireframes (Control Center/Simulation)

### **Dashboard Overview: System Status**

```
┌─────────────────────────────────────────────────────────────┐
│  OPAL Control Center                    [User] [Settings]    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  Devices    │  │  Active     │  │  Messages   │          │
│  │  Online     │  │  Calls      │  │  Today      │          │
│  │  24/30     │  │  8          │  │  142        │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  System Health                                       │    │
│  │  [████████░░] 80%                                   │    │
│  │  • All systems operational                           │    │
│  │  • 2 devices offline (battery)                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Active Workflows                                     │    │
│  │  • Patient Blood Loss - Room 302 (Critical)          │    │
│  │  • STEMI Alert - Cath Lab (Active)                   │    │
│  │  • Pharmacy Call - MedSurg (Pending)                │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Key Elements:**
- **System Metrics**: Devices online, active calls, messages
- **System Health**: Overall status, alerts
- **Active Workflows**: Current clinical workflows in progress
- **Quick Status**: At-a-glance system overview

---

### **Dashboard View 1: Device Map/Status**

```
┌─────────────────────────────────────────────────────────────┐
│  Device Status                          [Refresh] [Filter]   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Floor Map (Interactive)                              │    │
│  │                                                       │    │
│  │    [Room 301] [Room 302] [Room 303]                 │    │
│  │      🟢 Sarah    🔴 John     🟢 Mary                 │    │
│  │                                                       │    │
│  │    [Room 304] [Room 305] [Room 306]                 │    │
│  │      ⚪ Offline   🟢 Tom     🟡 Battery              │    │
│  │                                                       │    │
│  │  Legend: 🟢 Online  🟡 Low Battery  🔴 Alert        │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Device List                                          │    │
│  │  • Sarah M. (MedSurg) - Online - Room 302            │    │
│  │  • John D. (ER) - Alert Active - Room 301           │    │
│  │  • Mary K. (Pharmacy) - Online - Room 303           │    │
│  │  • Tom L. (MedSurg) - Online - Room 305            │    │
│  │  • [2 more devices...]                              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Key Elements:**
- **Visual Map**: Floor plan with device locations
- **Status Indicators**: Color-coded device status
- **Device List**: Detailed device information
- **Filtering**: Filter by department, status, location

**Design Notes:**
- Interactive map (click to see device details)
- Real-time status updates
- Color coding for quick recognition

---

### **Dashboard View 2: Message Flow Visualization**

```
┌─────────────────────────────────────────────────────────────┐
│  Message Flow                          [Time Range ▼] [Export]│
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Message Timeline                                     │    │
│  │                                                       │    │
│  │  10:00  Sarah → Dr. Lee (Targeted)    ✓ Delivered   │    │
│  │  10:05  Dr. Lee → Sarah (Targeted)    ✓ Delivered   │    │
│  │  10:10  Sarah → All Nurses (Broadcast) ✓ Sent       │    │
│  │  10:15  System → Room 302 (Alert)     ✓ Active     │    │
│  │                                                       │    │
│  │  [Show more...]                                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Message Flow Diagram                                 │    │
│  │                                                       │    │
│  │    Sarah ──→ Dr. Lee                                  │    │
│  │      │         │                                       │    │
│  │      │         └──→ EMR (Order Drafted)              │    │
│  │      │                                                 │    │
│  │      └──→ All Nurses (Broadcast)                      │    │
│  │                                                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Statistics                                           │    │
│  │  • Targeted Messages: 45 (68%)                        │    │
│  │  • Broadcast Messages: 21 (32%)                      │    │
│  │  • Average Response Time: 12 seconds                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Key Elements:**
- **Message Timeline**: Chronological message history
- **Flow Diagram**: Visual representation of message routing
- **Statistics**: Message type breakdown, response times
- **Filtering**: Time range, message type, participants

**Design Notes:**
- Visual flow diagram shows AI routing logic
- Demonstrates "Intelligent Node" vs "Dumb Radio"
- Real-time updates

---

### **Dashboard View 3: AI Intelligence Visualization**

```
┌─────────────────────────────────────────────────────────────┐
│  AI Intelligence Dashboard              [Refresh] [Settings] │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Contextual Router Activity                         │    │
│  │                                                       │    │
│  │  Request: "Need signature for Heparin"              │    │
│  │  Analysis:                                           │    │
│  │    • Attending (Dr. Lee) - In Surgery ❌          │    │
│  │    • Resident (Dr. Jay) - Available ✓              │    │
│  │  Action: Routed to Dr. Jay                          │    │
│  │  Result: Connected in 8 seconds                     │    │
│  │                                                       │    │
│  │  [View more examples...]                            │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  AI Feature Usage                                    │    │
│  │                                                       │    │
│  │  Contextual Router: ████████░░ 80%                  │    │
│  │  Actionable Voice:  ██████░░░░ 60%                  │    │
│  │  Universal Translator: ████░░░░░░ 40%                │    │
│  │  Clinical Oracle:   ██░░░░░░░░ 20%                  │    │
│  │  Sentiment Sentinel: █░░░░░░░░░ 10%                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  AI Success Metrics                                  │    │
│  │  • Call Success Rate: 92% (vs 65% Vocera baseline)  │    │
│  │  • Average Routing Time: 3.2 seconds                │    │
│  │  • Voice-to-EMR Orders: 18 today                    │    │
│  │  • Translation Sessions: 12 today                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Key Elements:**
- **AI Activity Log**: Shows AI decision-making process
- **Feature Usage**: Which AI features are being used
- **Success Metrics**: Performance vs baseline (Vocera)
- **Real-time Examples**: Live AI routing decisions

**Design Notes:**
- Demonstrates "Intelligent Node" capabilities
- Shows AI transparency (builds trust)
- Compares performance to Vocera baseline

---

### **Dashboard View 4: Clinical Workflow Monitor**

```
┌─────────────────────────────────────────────────────────────┐
│  Clinical Workflow Monitor            [Filter] [Export]     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Active Workflows                                     │    │
│  │                                                       │    │
│  │  🚨 Patient Blood Loss - Room 302                    │    │
│  │     Status: Critical                                 │    │
│  │     Participants: Sarah, Dr. Lee, Charge Nurse       │    │
│  │     Started: 10:15 AM                               │    │
│  │     [View Details →]                                 │    │
│  │                                                       │    │
│  │  ⚡ STEMI Alert - Cath Lab                            │    │
│  │     Status: Active                                   │    │
│  │     Participants: ER Team, Cath Lab Team            │    │
│  │     Started: 10:30 AM                               │    │
│  │     Door-to-Balloon: 8 minutes (Target: <90 min)     │    │
│  │     [View Details →]                                 │    │
│  │                                                       │    │
│  │  📋 Pharmacy Call - MedSurg                          │    │
│  │     Status: Pending                                 │    │
│  │     Participants: Mary, Pharmacy                    │    │
│  │     Started: 10:45 AM                               │    │
│  │     [View Details →]                                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Workflow Statistics                                 │    │
│  │  • Total Workflows Today: 23                         │    │
│  │  • Average Completion Time: 12 minutes                │    │
│  │  • Workflows Using AI Routing: 18 (78%)              │    │
│  │  • Time Saved vs Vocera: 45 minutes                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Key Elements:**
- **Active Workflows**: Current clinical workflows in progress
- **Workflow Details**: Status, participants, timeline
- **Statistics**: Performance metrics, time savings
- **Filtering**: By department, workflow type, status

**Design Notes:**
- Shows real clinical workflows in action
- Demonstrates time savings vs Vocera
- Visual workflow progression

---

### **Dashboard View 5: Simulation/Demo Mode**

```
┌─────────────────────────────────────────────────────────────┐
│  Demo Mode - Closed Loop Pilot              [Start] [Reset]  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Scenario: STEMI Alert                               │    │
│  │                                                       │    │
│  │  Step 1: Nurse says "Code STEMI, Room 4"            │    │
│  │          [✓] Voice command received                  │    │
│  │          [✓] AI analyzing intent...                  │    │
│  │                                                       │    │
│  │  Step 2: AI Actions (Simultaneous)                 │    │
│  │          [✓] Blasted entire STEMI team               │    │
│  │          [✓] Opened dedicated voice channel          │    │
│  │          [✓] Drafted "Code Start Time" in EMR        │    │
│  │          [✓] Alerted Cath Lab to warm up            │    │
│  │                                                       │    │
│  │  Step 3: Results                                     │    │
│  │          • Time to Team Alert: 2 seconds            │    │
│  │          • Time to EMR Entry: 3 seconds             │    │
│  │          • Time to Cath Lab Alert: 3 seconds         │    │
│  │          • Total Time: 8 seconds                      │    │
│  │          • Vocera Equivalent: ~3 minutes              │    │
│  │          • Time Saved: 2 minutes 52 seconds         │    │
│  │                                                       │    │
│  │  [Replay] [Export Results]                           │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Comparison: Opal vs Vocera                          │    │
│  │                                                       │    │
│  │  Opal:    [████████] 8 seconds                       │    │
│  │  Vocera:  [████████████████████] 3 minutes          │    │
│  │                                                       │    │
│  │  Advantage: Opal is 22.5x faster                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Key Elements:**
- **Step-by-Step Demo**: Shows each action in sequence
- **Real-time Visualization**: Shows AI actions as they happen
- **Performance Comparison**: Opal vs Vocera side-by-side
- **Exportable Results**: Can export demo results

**Design Notes:**
- Perfect for sales demos
- Shows "Intelligent Node" in action
- Clear time savings visualization
- Can replay scenarios

---

## Design Principles

### **Device UI Principles:**
1. **Simplicity**: Minimal screens, clear actions
2. **Large Touch Targets**: 44x44px minimum for gloved hands
3. **High Contrast**: Readable in various lighting conditions
4. **Mode Clarity**: CRITICAL - Always show current mode
5. **Voice-First**: Primary interaction is voice, UI is secondary
6. **Visual Feedback**: Clear status for all actions

### **Dashboard Principles:**
1. **Real-time Updates**: Live system status
2. **Visual Storytelling**: Shows "Intelligent Node" in action
3. **Performance Metrics**: Demonstrates value vs Vocera
4. **Transparency**: Shows AI decision-making process
5. **Demo-Ready**: Can simulate scenarios for sales
6. **Exportable**: Can export data for reports

---

## Implementation Notes

### **Device UI:**
- Use LVGL or similar embedded graphics library
- Touch screen driver (CST816S) must be functional
- Mode switching must be instant and obvious
- Voice feedback should accompany UI actions

### **Dashboard:**
- Web-based (React/Vue) for flexibility
- Real-time updates via WebSocket
- Can run on tablet/laptop for demos
- Export to PDF/CSV for reports

---

## Next Steps

1. **Validate Wireframes**: Review with clinical staff
2. **Create High-Fidelity Mockups**: Based on approved wireframes
3. **Prototype Device UI**: Build basic LVGL interface
4. **Build Dashboard MVP**: Start with system status view
5. **User Testing**: Test with actual clinical workflows

---

**Last Updated:** 2025-11-19

