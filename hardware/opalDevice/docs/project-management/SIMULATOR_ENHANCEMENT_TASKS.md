# Simulator Enhancement Tasks Summary

**Date:** 2025-11-19  
**Status:** Tasks Created and Ready for Backlog

---

## Overview

These tasks capture the simulator enhancements based on Vocera analysis. The enhancements transform the simulator from a passive network visualizer into an interactive tool that demonstrates sophisticated clinical workflows.

---

## Created Tasks

### **SCRUM-40: Role-Based & Group Communication System (Phase 1)** 📋 TO DO
- **Epic:** Demo & Pilot Programs (SCRUM-34)
- **Status:** To Do
- **Priority:** High
- **Labels:** `opal`, `simulator`, `dashboard`, `communication`, `backend`, `ui`

**Core Concept:**
Clinicians don't always know specific person names or devices. They need to contact:
- **Roles**: "Call the charge nurse for the ICU"
- **Groups**: "Broadcast to the Code Blue Team"
- **Specific People**: "Call Dr. Smith"

**Scope:**

**Data Model Extension:**
- User model: `{id, name, role}` (e.g., "Dr. Adams, Cardiologist")
- Group model: `{name, members[]}` (e.g., "ICU Nurses", "Code Blue Team")
- Device-User association: Simulate "logging in" by associating User with Device
- Device becomes: "Room 101 (used by Dr. Adams, Cardiologist)" instead of just "Room 101"

**Backend/Server:**
- User management system
- Group management system
- Device-User association tracking
- Role-based lookup service
- Group membership management

**Simulator/Dashboard UI:**
- "Call Control" panel:
  - Select Initiator: Choose any online user/device
  - Select Target (key feature):
    - Specific person (e.g., "Dr. Smith")
    - Role (e.g., "Charge Nurse") - System finds correct person/device
    - Group (e.g., "ICU Nurses") - For broadcasting
  - Action buttons: "Place Call" and "Broadcast Message"
- Visual updates:
  - Network Participants list shows User and Role, not just device name
  - Hover over device shows both device and logged-in user info
  - Visual distinction between role-based and direct calls

**Deliverables:**
- User and Group data models
- Backend services for role/group management
- Call Control panel UI
- Enhanced network visualization
- Role-based call routing (basic)

**Dependencies:**
- Dashboard UI Implementation (SCRUM-39) - Base dashboard must exist
- Communication Infrastructure (Epic 3) - Basic communication must work

**Success Criteria:**
- Can make calls by role (e.g., "Call Charge Nurse")
- Can make calls by group (e.g., "Broadcast to ICU Nurses")
- Can make calls to specific people
- UI clearly shows user roles and groups
- Simulator demonstrates role-based routing

**View:** https://pgconsulting.atlassian.net/browse/SCRUM-40

---

### **SCRUM-41: Intelligent Routing & Emergency Call System (Phase 2)** 📋 TO DO
- **Epic:** Demo & Pilot Programs (SCRUM-34)
- **Status:** To Do
- **Priority:** High
- **Labels:** `opal`, `simulator`, `dashboard`, `communication`, `emergency`, `ai`, `routing`

**Core Concept:**
The "Genie" is the intelligent dispatcher that maps roles and names to physical devices. When a user says "Call Dr. Smith," the system knows who Dr. Smith is, finds their currently active device, and routes the call.

**Scope:**

**Intelligent Routing ("Genie"):**
- Name-to-device mapping service
- Role-to-person mapping service
- Active device lookup (finds currently active device for a user)
- Smart routing logic:
  - "Call Dr. Smith" → Finds Dr. Smith's active device → Routes call
  - "Call Charge Nurse" → Finds charge nurse role → Finds active device → Routes call
  - Handles multiple devices per user (routes to active one)
- Routing decision logging (for visualization)

**Emergency/Panic Call System:**
- New event type: "Panic Call" (highest priority)
- Pre-defined emergency groups (e.g., "Rapid Response Team")
- Panic call behavior:
  - Instant connection to emergency group
  - Automatic hold/termination of non-critical calls involving team members
  - Override capability for critical situations
- Priority system:
  - Panic/Emergency (highest)
  - Urgent
  - Normal
  - Low

**Targeted Broadcasts:**
- Enhanced broadcast system (currently random)
- Targeted broadcasts:
  - "Broadcast to Emergency Department"
  - "Broadcast to all available nurses"
  - "Broadcast to Code Blue Team"
- Group-based broadcast routing

**Visual Enhancements:**
- Red "Panic" button next to each device in participant list
- Panic calls generate unique, flashing red packets (faster movement)
- Devices involved in panic calls have pulsing red "emergency" glow
- Event log highlights panic events in bright red
- Visual distinction for priority levels

**Deliverables:**
- Intelligent routing service ("Genie")
- Emergency/panic call system
- Priority call management
- Targeted broadcast system
- Enhanced visualizations (panic indicators, priority colors)
- Emergency group management

**Dependencies:**
- SCRUM-40 (Phase 1) - Foundation must exist
- AI-Enhanced Communications (Epic 4) - Intelligent routing may leverage AI

**Success Criteria:**
- "Genie" successfully routes calls by name and role
- Panic calls instantly connect to emergency groups
- Panic calls override non-critical communications
- Visual indicators clearly show emergency situations
- Simulator demonstrates life-saving emergency workflows

**Clinical Value:**
This transforms the simulator from a passive network visualizer into an interactive tool that demonstrates sophisticated clinical workflows and directly competes with Vocera's intelligent routing capabilities.

**View:** https://pgconsulting.atlassian.net/browse/SCRUM-41

---

## Key Features Captured

### **Phase 1 Features:**
1. ✅ Role-based communication: "Call Charge Nurse" → system finds the right person
2. ✅ Group communication: "Broadcast to Code Blue Team" → targeted group messaging
3. ✅ User/Group data models
4. ✅ Call Control panel UI
5. ✅ Enhanced visualization showing users and roles

### **Phase 2 Features:**
1. ✅ Intelligent routing ("Genie"): Maps names/roles to active devices
2. ✅ Emergency/panic calls: Highest priority, overrides other calls
3. ✅ Priority system: Panic > Urgent > Normal > Low
4. ✅ Targeted broadcasts: Department/group-specific, not random
5. ✅ Visual enhancements: Panic indicators, priority colors, emergency glow

---

## Task Dependencies

```
SCRUM-39 (Dashboard UI)
    ↓
SCRUM-40 (Phase 1: Role-Based Communication)
    ↓
SCRUM-41 (Phase 2: Intelligent Routing & Emergency)
```

---

## Implementation Phases

### **Phase 1: Foundation (SCRUM-40)**
- Data models (User, Group)
- Basic role/group calling
- Call Control panel
- Enhanced visualization

### **Phase 2: Advanced Features (SCRUM-41)**
- Intelligent routing ("Genie")
- Emergency/panic calls
- Priority management
- Advanced visualizations

---

## Success Metrics

### **Phase 1:**
- ✅ Can make calls by role
- ✅ Can make calls by group
- ✅ UI shows user roles and groups
- ✅ Simulator demonstrates role-based routing

### **Phase 2:**
- ✅ "Genie" routes calls successfully
- ✅ Panic calls work instantly
- ✅ Panic calls override other calls
- ✅ Visual indicators are clear
- ✅ Simulator demonstrates life-saving workflows

---

## Related Tasks

- **SCRUM-39**: Dashboard UI Implementation (React) - Base dashboard
- **SCRUM-34**: Demo & Pilot Programs - Epic containing these tasks
- **SCRUM-29**: Communication Infrastructure - Basic communication
- **SCRUM-30**: AI-Enhanced Communications - May leverage AI for routing

---

## Next Steps

1. **Review tasks in Jira** - Verify scope and requirements
2. **Link to epics manually** - If needed (custom field IDs vary)
3. **Prioritize based on demo timeline** - When do we need this?
4. **Start Phase 1** - When dashboard base (SCRUM-39) is ready

---

**Last Updated:** 2025-11-19

