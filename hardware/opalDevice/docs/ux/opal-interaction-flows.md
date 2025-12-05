# OPAL Interaction Flows

**Date:** 2025-11-19  
**Purpose:** Detailed interaction flow documentation for all OPAL user journeys

---

## Flow 1: Making a Targeted Call

### **User Goal:** Send a private message to a specific person

### **Flow Diagram:**

```
[Home Screen]
    │
    ├─ Tap "TALK" button
    │
[Voice Command Screen]
    │
    ├─ Say "Call Dr. Lee"
    │
[AI Processing]
    │
    ├─ AI analyzes intent
    ├─ Checks Dr. Lee's availability
    ├─ Determines this is targeted mode
    │
[Call Connecting Screen]
    │
    ├─ Shows "Connecting to Dr. Lee..."
    ├─ Mode indicator: TARGETED (blue)
    │
[Active Call Screen]
    │
    ├─ Call connected
    ├─ Shows participant info
    ├─ Mute/Speaker controls
    │
[Call Ends]
    │
    └─ Return to Home Screen
```

### **Detailed Steps:**

1. **Home Screen State:**
   - User sees home screen
   - Mode indicator shows current mode (TARGETED or BROADCAST)
   - Large "TALK" button visible

2. **Initiate Voice Command:**
   - User taps "TALK" button
   - Screen transitions to Voice Command Screen (200ms)
   - Microphone icon animates (listening state)
   - Audio: "Listening..."

3. **Voice Input:**
   - User says: "Call Dr. Lee"
   - Device captures audio
   - Visual feedback: Waveform animation
   - Audio: "Processing..."

4. **AI Processing:**
   - Audio sent to backend for speech-to-text
   - LLM analyzes intent: "Call" + "Dr. Lee"
   - Contextual Router checks:
     - Who is Dr. Lee? (attending, resident, etc.)
     - Is Dr. Lee available? (check EMR schedule)
     - What is Dr. Lee's current status? (in surgery, available, etc.)
   - Determines mode: TARGETED (single recipient)
   - Visual feedback: "Analyzing..." with spinner

5. **Call Routing:**
   - If Dr. Lee is available:
     - Initiate SIP call to Dr. Lee's device
     - Show "Connecting..." screen
     - Mode indicator: TARGETED (blue)
   - If Dr. Lee is unavailable:
     - Show "Dr. Lee is in surgery. Connect to Dr. Jay instead?"
     - User can confirm or cancel
     - If confirmed, route to Dr. Jay

6. **Active Call:**
   - Call connected
   - Transition to Active Call Screen
   - Show participant info (name, role, department)
   - Display call controls (Mute, Speaker, End)
   - Mode indicator remains visible (TARGETED)

7. **During Call:**
   - User can mute/unmute
   - User can toggle speaker mode
   - User can end call
   - Real-time audio feedback

8. **Call End:**
   - User taps "End Call" or call ends naturally
   - Brief confirmation: "Call ended"
   - Return to Home Screen (200ms transition)

### **Error Handling:**

- **No Network:** Show "No connection. Please check WiFi."
- **Person Not Found:** Show "Dr. Lee not found. Did you mean Dr. Jay?"
- **Person Unavailable:** Show "Dr. Lee is unavailable. Connect to Dr. Jay?"
- **Call Failed:** Show "Call failed. Please try again."

---

## Flow 2: Making a Broadcast Message

### **User Goal:** Send a message to a group (all nurses, charge nurse, etc.)

### **Flow Diagram:**

```
[Home Screen]
    │
    ├─ Tap Mode Indicator
    │
[Mode Selection Screen]
    │
    ├─ Select "BROADCAST"
    ├─ Choose group (e.g., "All Nurses")
    │
[Return to Home Screen]
    │ Mode indicator now shows BROADCAST (orange)
    │
    ├─ Tap "TALK" button
    │
[Voice Command Screen]
    │
    ├─ Say "Need help in Room 302"
    │
[AI Processing]
    │
    ├─ AI analyzes intent
    ├─ Determines this is broadcast mode
    ├─ Identifies target group
    │
[Message Sending]
    │
    ├─ Shows "Sending to All Nurses..."
    ├─ Mode indicator: BROADCAST (orange)
    │
[Message Sent]
    │
    └─ Return to Home Screen
```

### **Detailed Steps:**

1. **Mode Selection:**
   - User taps mode indicator on Home Screen
   - Transition to Mode Selection Screen
   - Show two options: TARGETED and BROADCAST

2. **Select Broadcast Mode:**
   - User taps "BROADCAST" option
   - Show group selection:
     - "All Nurses"
     - "Charge Nurse"
     - "Rapid Response Team"
     - "Department: [Select]"
   - User selects group

3. **Mode Confirmation:**
   - Return to Home Screen
   - Mode indicator changes to BROADCAST (orange)
   - Visual feedback: Brief orange flash
   - Audio: "Broadcast mode active"

4. **Voice Command:**
   - User taps "TALK" button
   - Voice Command Screen appears
   - User says: "Need help in Room 302"
   - Device captures audio

5. **AI Processing:**
   - Speech-to-text conversion
   - LLM analyzes intent:
     - Message: "Need help in Room 302"
     - Mode: BROADCAST (already set)
     - Target: "All Nurses" (from mode selection)
   - Visual feedback: "Sending to All Nurses..."

6. **Message Delivery:**
   - Backend routes message to all nurses in group
   - Each nurse's device receives notification
   - Sender sees: "Message sent to 12 nurses"
   - Mode indicator remains BROADCAST

7. **Confirmation:**
   - Brief success message: "Message sent"
   - Return to Home Screen
   - Mode indicator remains BROADCAST (persistent)

### **Error Handling:**

- **No Group Selected:** Show "Please select a group first"
- **Group Empty:** Show "No nurses available in this group"
- **Message Failed:** Show "Message failed. Please try again."

---

## Flow 3: Using Interpreter Mode

### **User Goal:** Communicate with a non-English speaking patient

### **Flow Diagram:**

```
[Home Screen]
    │
    ├─ Tap Interpreter icon (🌐)
    │
[Interpreter Mode Screen]
    │
    ├─ Select patient language (e.g., Spanish)
    ├─ Tap "Start Interpreter"
    │
[Interpreter Active]
    │
    ├─ Nurse speaks English
    ├─ Device translates to Spanish
    ├─ Patient hears Spanish
    │
    ├─ Patient speaks Spanish
    ├─ Device translates to English
    ├─ Nurse hears English
    │
[Interpreter End]
    │
    └─ Return to Home Screen
```

### **Detailed Steps:**

1. **Activate Interpreter:**
   - User taps 🌐 icon on Home Screen
   - Transition to Interpreter Mode Screen
   - Show language selection dropdown

2. **Select Language:**
   - User selects patient language (e.g., Spanish)
   - Show confirmation: "Interpreter: English ↔ Spanish"
   - User taps "Start Interpreter"

3. **Interpreter Active:**
   - Screen shows dual audio channels:
     - Top: English (nurse's language)
     - Bottom: Spanish (patient's language)
   - Visual indicators show which side is speaking
   - Real-time translation active

4. **Nurse Speaks:**
   - Nurse speaks English: "How are you feeling?"
   - Device captures English audio
   - AI translates to Spanish
   - Patient hears: "¿Cómo se siente?"
   - Visual feedback: English side active (blue highlight)

5. **Patient Speaks:**
   - Patient speaks Spanish: "Me duele el pecho"
   - Device captures Spanish audio
   - AI translates to English
   - Nurse hears: "My chest hurts"
   - Visual feedback: Spanish side active (orange highlight)

6. **End Interpreter:**
   - User taps "Stop Interpreter"
   - Confirmation: "Interpreter stopped"
   - Return to Home Screen

### **Error Handling:**

- **Translation Failed:** Show "Translation unavailable. Please try again."
- **Audio Quality Poor:** Show "Audio unclear. Please speak clearly."
- **Language Not Supported:** Show "Language not available. Please select another."

---

## Flow 4: Responding to Critical Alert

### **User Goal:** Acknowledge and respond to a critical patient alert

### **Flow Diagram:**

```
[Home Screen]
    │
    ├─ Critical alert received
    │
[Alert Screen (Full Screen)]
    │
    ├─ Shows alert details
    ├─ Patient info
    ├─ Location
    ├─ Priority level
    │
    ├─ User taps "Acknowledge"
    │
[Acknowledgment Sent]
    │
    ├─ User taps "View Details"
    │
[Alert Details Screen]
    │
    ├─ Full patient information
    ├─ Action options
    │
    └─ Return to Home Screen
```

### **Detailed Steps:**

1. **Alert Received:**
   - Device receives critical alert
   - Screen immediately transitions to Alert Screen (no user action)
   - Haptic feedback: Strong vibration
   - Audio: Alert tone (if not muted)
   - Visual: Red background, pulsing animation

2. **Alert Display:**
   - Show alert type: "Blood Loss Alert"
   - Show location: "Room 302"
   - Show patient: "John D."
   - Show priority: "CRITICAL" (red badge)
   - Show timestamp: "Just now"

3. **User Acknowledgment:**
   - User taps "✓ Acknowledge" button
   - Acknowledgment sent to system
   - Visual feedback: Button changes to "Acknowledged ✓"
   - Brief confirmation: "Alert acknowledged"

4. **View Details (Optional):**
   - User taps "View Details →"
   - Transition to Alert Details Screen
   - Show full patient information:
     - Patient name, ID, room
     - Alert type and severity
     - Vital signs (if available)
     - Action history

5. **Take Action:**
   - User can:
     - Call the room
     - Send message to charge nurse
     - View patient chart (if EMR integrated)
   - User selects action

6. **Return:**
   - User taps back button
   - Return to Home Screen
   - Alert remains in notification history

### **Error Handling:**

- **Alert Expired:** Show "This alert is no longer active"
- **Network Error:** Show "Cannot acknowledge. Please check connection."

---

## Flow 5: Mode Switching (Critical Workflow)

### **User Goal:** Switch between targeted and broadcast messaging modes

### **Flow Diagram:**

```
[Home Screen - Current Mode: TARGETED]
    │
    ├─ Tap Mode Indicator
    │
[Mode Selection Screen]
    │
    ├─ User selects BROADCAST
    ├─ User selects group
    │
[Home Screen - Mode Changed: BROADCAST]
    │
    ├─ Visual confirmation
    ├─ Audio confirmation
    │
[User makes broadcast message]
    │
    ├─ Mode remains BROADCAST
    │
[User wants to switch back]
    │
    ├─ Tap Mode Indicator
    │
[Mode Selection Screen]
    │
    ├─ User selects TARGETED
    │
[Home Screen - Mode Changed: TARGETED]
```

### **Detailed Steps:**

1. **Current State:**
   - Home Screen shows mode indicator
   - Current mode: TARGETED (blue)
   - Indicator shows: "TARGETED" with 👤 icon

2. **Initiate Mode Change:**
   - User taps mode indicator
   - Transition to Mode Selection Screen (200ms)
   - Show two large options:
     - TARGETED (blue, currently selected)
     - BROADCAST (orange, available)

3. **Select New Mode:**
   - User taps "BROADCAST" option
   - If broadcast selected, show group selection:
     - "All Nurses"
     - "Charge Nurse"
     - "Rapid Response Team"
     - "Department: [Select]"
   - User selects group

4. **Mode Confirmation:**
   - Return to Home Screen
   - Mode indicator changes to BROADCAST (orange)
   - Visual feedback:
     - Brief orange flash animation (300ms)
     - Indicator shows: "BROADCAST" with 📢 icon
   - Audio feedback: "Broadcast mode active"
   - Background tint changes to light orange (#FFF7ED)

5. **Mode Persistence:**
   - Mode remains BROADCAST for all subsequent actions
   - All messages sent in broadcast mode
   - Mode indicator always visible
   - User can see current mode at a glance

6. **Switch Back:**
   - User taps mode indicator again
   - Select "TARGETED"
   - Return to Home Screen
   - Mode changes back to TARGETED (blue)
   - Visual and audio confirmation

### **Design Principles:**

- **Always Visible:** Mode indicator never disappears
- **Clear Distinction:** Blue = Targeted, Orange = Broadcast
- **Persistent:** Mode remains until user changes it
- **Contextual:** Mode affects all messaging actions
- **Reversible:** Easy to switch back and forth

---

## Flow 6: Voice-to-EMR Order (Actionable Voice)

### **User Goal:** Create an EMR order via voice command

### **Flow Diagram:**

```
[Home Screen]
    │
    ├─ Tap "TALK" button
    │
[Voice Command Screen]
    │
    ├─ Doctor says: "Start 2 liters of O2 and get a portable chest x-ray"
    │
[AI Processing]
    │
    ├─ Speech-to-text
    ├─ Clinical entity extraction
    ├─ Identifies orders: O2, CXR
    │
[Order Confirmation Screen]
    │
    ├─ Shows extracted orders
    ├─ "I heard an order for O2 and CXR"
    ├─ "Shall I queue these in Epic for signature?"
    │
    ├─ User confirms
    │
[Order Drafted]
    │
    ├─ Orders queued in EMR
    ├─ Confirmation: "Orders drafted in Epic"
    │
    └─ Return to Home Screen
```

### **Detailed Steps:**

1. **Voice Input:**
   - User taps "TALK" button
   - Voice Command Screen appears
   - User says: "Start 2 liters of O2 and get a portable chest x-ray"

2. **AI Processing:**
   - Speech-to-text conversion
   - Clinical entity extraction:
     - Identifies: "2 liters of O2" → Oxygen order
     - Identifies: "portable chest x-ray" → Imaging order
   - Visual feedback: "Processing order..."

3. **Order Confirmation:**
   - Transition to Order Confirmation Screen
   - Show extracted orders:
     - "Oxygen: 2 L/min"
     - "Chest X-ray: Portable"
   - Show confirmation prompt:
     - "I heard an order for O2 and CXR"
     - "Shall I queue these in Epic for signature?"
   - User can:
     - Confirm: "Yes, queue them"
     - Edit: "Edit order"
     - Cancel: "Cancel"

4. **Order Drafting:**
   - If confirmed:
     - Orders sent to EMR system
     - Orders queued for physician signature
     - Visual feedback: "Orders drafted in Epic"
     - Brief success message

5. **Confirmation:**
   - Return to Home Screen
   - User can continue with other tasks
   - Orders are now in EMR system

### **Error Handling:**

- **Order Not Recognized:** Show "I didn't understand. Please repeat the order."
- **EMR Integration Failed:** Show "Cannot connect to Epic. Please try again."
- **Order Invalid:** Show "This order is not valid. Please check and try again."

---

## Flow 7: Contextual Router in Action

### **User Goal:** Get connected to the right person automatically

### **Flow Diagram:**

```
[Home Screen]
    │
    ├─ Tap "TALK" button
    │
[Voice Command Screen]
    │
    ├─ Nurse says: "I need a signature for a Heparin drip in Room 302"
    │
[AI Processing - Contextual Router]
    │
    ├─ AI analyzes intent
    ├─ Identifies need: Heparin signature
    ├─ Identifies location: Room 302
    ├─ Checks EMR for attending: Dr. Lee
    ├─ Checks Dr. Lee's status: "In Surgery" (unavailable)
    ├─ Finds alternative: Dr. Jay (resident, available)
    │
[Smart Routing Screen]
    │
    ├─ Shows: "Dr. Lee is in surgery"
    ├─ Shows: "Connecting to Dr. Jay instead"
    │
[Call Connecting]
    │
    ├─ Connecting to Dr. Jay
    │
[Active Call]
    │
    ├─ Call connected
    ├─ AI whispers: "Nurse Sarah needs a Heparin sign-off for Room 302. Dr. Lee is in surgery."
    │
    └─ Call proceeds normally
```

### **Detailed Steps:**

1. **Voice Command:**
   - User says: "I need a signature for a Heparin drip in Room 302"
   - Device captures audio

2. **AI Analysis:**
   - Speech-to-text conversion
   - LLM analyzes intent:
     - Action: "Need signature"
     - Medication: "Heparin drip"
     - Location: "Room 302"
   - Contextual Router queries:
     - Who is the attending for Room 302? → Dr. Lee
     - What is Dr. Lee's current status? → "In Surgery" (unavailable)
     - Who is the resident? → Dr. Jay
     - What is Dr. Jay's status? → "Available"

3. **Smart Routing Decision:**
   - AI determines: Dr. Lee unavailable, Dr. Jay available
   - AI decides: Route to Dr. Jay
   - Show Smart Routing Screen:
     - "Dr. Lee is in surgery"
     - "Connecting to Dr. Jay instead"
     - User can confirm or cancel

4. **Connection:**
   - If confirmed, initiate call to Dr. Jay
   - Show "Connecting to Dr. Jay..."
   - Call connects

5. **Contextual Whisper:**
   - When call connects, AI provides context:
     - "Nurse Sarah needs a Heparin sign-off for Room 302. Dr. Lee is in surgery."
   - Dr. Jay understands the situation immediately
   - Call proceeds with full context

6. **Success:**
   - Call completes successfully
   - User gets connected to the right person
   - No need to explain context (AI handled it)

### **Key Differentiator:**

This flow demonstrates the "Intelligent Node" vs "Dumb Radio":
- **Vocera:** Would connect to Dr. Lee's voicemail (dumb pipe)
- **Opal:** Analyzes context, finds available person, provides context (intelligent node)

---

## Flow 8: Dashboard - Monitoring System

### **User Goal:** Monitor OPAL system status and activity

### **Flow Diagram:**

```
[Dashboard Home]
    │
    ├─ View System Status
    ├─ View Device Map
    ├─ View Message Flow
    ├─ View AI Intelligence
    ├─ View Workflows
    │
[Select View]
    │
    ├─ View updates in real-time
    ├─ Filter data
    ├─ Export data
    │
[Return to Dashboard]
```

### **Detailed Steps:**

1. **Dashboard Access:**
   - User opens dashboard (web interface)
   - Dashboard loads with system overview
   - Real-time data updates via WebSocket

2. **System Status View:**
   - Shows key metrics:
     - Devices online/offline
     - Active calls
     - Messages today
   - Shows system health
   - Shows active workflows

3. **Device Map View:**
   - Interactive floor map
   - Color-coded device status
   - Click device to see details
   - Filter by department, status

4. **Message Flow View:**
   - Timeline of all messages
   - Visual flow diagrams
   - Filter by time, type, participants
   - Export to CSV/PDF

5. **AI Intelligence View:**
   - AI activity log
   - Feature usage statistics
   - Performance metrics
   - Success rate vs Vocera

6. **Workflow Monitor:**
   - Active clinical workflows
   - Workflow details
   - Performance metrics
   - Time savings analysis

### **Real-time Updates:**

- All views update in real-time
- WebSocket connection for live data
- Visual indicators for new data
- Auto-refresh every 5 seconds

---

## Error States & Edge Cases

### **Network Errors:**
- Show "No connection" message
- Retry button available
- Queue actions for when connection restored

### **Voice Recognition Errors:**
- Show "I didn't understand. Please repeat."
- Allow user to type instead
- Show suggestions based on context

### **AI Processing Errors:**
- Show "Processing error. Please try again."
- Fallback to manual routing
- Log error for system improvement

### **Device Errors:**
- Show error message
- Provide troubleshooting steps
- Contact support option

---

**Last Updated:** 2025-11-19

