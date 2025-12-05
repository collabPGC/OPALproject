# OPAL System Architecture & Development Epics
## Ultra Thinking Analysis for Device Architecture Planning

**Date:** 2025-11-19  
**Purpose:** Comprehensive system architecture analysis and epic organization for OPAL device development

---

## Executive Summary

The OPAL system is a **multi-layered clinical communications platform** that combines:
- **Hardware Layer**: ESP32-C6 microcontroller with audio codec, touch, sensors
- **Firmware Layer**: Real-time audio processing, VoIP, device management
- **Communication Layer**: SIP/RTP, paging integration, backend APIs
- **AI/Intelligence Layer**: LLM-driven contextual routing, voice-to-EMR, translation
- **Backend Infrastructure**: Authentication, security, monitoring, EMR integration
- **Clinical Workflow Layer**: Department-specific use cases and workflows

This document organizes all backlog items into **architecturally-coherent development epics** that respect dependencies and enable parallel development.

---

## System Architecture Layers

### **Layer 1: Device Hardware Architecture**
**Foundation Layer** - All other layers depend on this

**Components:**
- ESP32-C6 microcontroller (WiFi, Bluetooth, processing)
- ES8311 audio codec (I2S interface: GPIO19/20/21/22/23)
- I2C bus devices (GPIO7/8):
  - CST816S touch screen controller
  - RTC (Real-Time Clock)
  - IMU (Inertial Measurement Unit)
- Power management
- PCB design and production

**Current Status:**
- ✅ ESP-ADF board configuration complete
- ✅ Pinout verified from datasheet
- ⚠️ I2C hardware needs pull-up resistors (hardware fix)
- ⚠️ Audio output debugging needed

**Hardware Constraints:**
- **I2C Pull-up Resistors**: REQUIRED - 4.7kΩ external pull-ups on SDA (GPIO8) and SCL (GPIO7) to 3.3V
  - Internal pull-ups (~45kΩ) are too weak for reliable operation
  - Without proper pull-ups, I2C devices will not respond
  - **Blocking**: All I2C device integration (codec, touch, RTC, IMU)
  
- **ES8311 CE Pin**: Hard-wired HIGH (not controllable via GPIO)
  - Codec is always enabled when powered
  - No software control over codec power state
  - Must ensure power supply is stable
  
- **Touch RST Pin**: Not connected (GPIO_NUM_NC)
  - Touch controller cannot be reset via software
  - Must rely on power-on reset only
  
- **GPIO Pin Conflicts**: Must be avoided
  - I2C pins (GPIO7/8) must not overlap with LCD/I2S pins
  - Pin conflict detection code exists to catch this at runtime
  - All pin mappings must match datasheet exactly
  
- **Partition Table**: 3MB app partition required
  - Binary size ~1.37MB (with 32% free space)
  - 2MB partition insufficient (causes build failures)
  - Must be configured in `partitions.csv`
  
- **I2C Speed**: 100kHz recommended, 400kHz possible
  - 100kHz is production-ready and stable
  - 400kHz can be used if stable at 100kHz
  - Glitch filter enabled for 100kHz operation
  - Timeout: 1000ms (can reduce to 200ms once stable)

**Architecture Dependencies:**
- All firmware layers depend on stable hardware
- Audio system depends on ES8311 codec
- Device UI depends on touch screen
- Time-based features depend on RTC
- **CRITICAL PATH**: I2C hardware fix blocks all device integration

---

### **Layer 2: Firmware Architecture**
**Real-time Processing Layer** - Runs on ESP32-C6

**Components:**
- **Audio Pipeline**:
  - I2S stream management (16kHz sample rate)
  - AEC (Acoustic Echo Cancellation) processing
  - Audio codec interface (ES8311)
  - Full-duplex audio handling
  
- **VoIP Stack**:
  - SIP (Session Initiation Protocol) client
  - RTP (Real-time Transport Protocol) audio transport
  - G.711 A-law codec (8kHz, mono)
  - Call management (call/answer/hangup)
  
- **Device Management**:
  - WiFi connectivity and provisioning
  - Device state management
  - Power management
  - Firmware updates (OTA)
  
- **I2C Device Drivers**:
  - Touch screen driver (CST816S)
  - RTC driver
  - IMU driver

**Current Status:**
- ✅ ESP-ADF board abstraction complete
- ✅ AEC project adapted
- ✅ VoIP service extracted and ready
- ⚠️ Audio output needs debugging
- ⚠️ I2C devices need hardware fix before testing

**Firmware Constraints:**
- **ESP-ADF Board Abstraction**: REQUIRED - Must use ESP-ADF board configuration
  - Custom board config created: `esp32c6_opal`
  - Available in `idf.py menuconfig` as "ESP32-C6-OPAL"
  - Cannot bypass board abstraction (ESP-ADF requirement)
  - All pin configurations come from board config
  
- **AEC Sample Rate**: REQUIRED - 16kHz sample rate
  - AEC library only supports 16kHz (`AFE_TYPE_VC`)
  - I2S stream must be configured for 16kHz
  - ES8311 codec must be set to 16kHz via `audio_hal_codec_iface_config`
  - Cannot use 8kHz (causes AEC error: "Only support 16K sample rate")
  
- **VoIP Codec**: G.711 A-law (8kHz codec, 16kHz I2S)
  - Codec sample rate: 8kHz (G.711 standard)
  - I2S sample rate: 16kHz (can differ from codec)
  - Full-duplex audio required
  - AEC enabled for echo cancellation
  
- **SD Card Dependency**: REMOVED
  - Original AEC example used SD card for recording
  - Adapted version removed SD card dependency
  - Can use flash storage if needed (optional)
  
- **Closed-Source Library**: SIP/RTP uses `esp_rtc` library
  - Library is closed-source (Espressif proprietary)
  - Must use provided API (`esp_rtc_call`, `esp_rtc_answer`, etc.)
  - Cannot modify internal SIP/RTP implementation
  
- **ESP32-C6 Specific**: Not compatible with ESP32-S3
  - Pin mappings are ESP32-C6 specific
  - ESP32-S3 has different GPIO voltage compatibility
  - ESP32-S3 uses different I2C pins (GPIO10/11 vs GPIO7/8)
  - Code is adapted specifically for ESP32-C6 architecture

**Architecture Dependencies:**
- Depends on Layer 1 (hardware) - **BLOCKING**: I2C hardware fix required
- Audio pipeline must be stable before VoIP integration
- Device drivers depend on I2C hardware fix
- AEC must be configured correctly (16kHz) before audio testing

---

### **Layer 3: Communication Architecture**
**Network & Protocol Layer** - Device-to-backend communication

**Components:**
- **Device-to-Backend APIs**:
  - REST API for device registration
  - WebSocket for real-time messaging
  - Device status reporting
  - Command/control interface
  
- **Paging System Integration**:
  - Paging protocol discovery and analysis
  - Message format specification
  - Message generation and transmission
  - Mock paging server (for demos)
  - Production paging integration
  
- **Backend Services**:
  - Device registry and management
  - Message routing service
  - Paging gateway service
  - Status monitoring service

**Current Status:**
- ⚠️ Paging system discovery needed (vendor, protocol, format)
- ⚠️ Backend APIs need design and implementation
- ⚠️ Mock paging server needed for demos

**Communication Constraints:**
- **Paging System Protocol**: UNKNOWN - Must be discovered
  - Exact vendor/product name unknown
  - Protocol type unknown (wired, wireless, dial-up)
  - Message format specification unknown
  - **Risk**: Demo may rely on assumptions rather than production-accurate formats
  - **Mitigation**: Build mock paging server first, then adapt to real protocol
  
- **MVP Requirement**: Generate compatible outputs first
  - Must generate plausibly valid outputs that look like what hospital systems expect
  - Full integration can follow once trust is built
  - Mock paging server allows development without production protocol
  
- **Device Identifiers**: Must fit hospital IT constraints
  - Phone number per device/endpoint for paging/callback
  - Nurse ID code (combination of nurse number + code)
  - Must align with existing identity/directory systems
  - **Risk**: Misalignment with existing identity systems
  
- **Message Formats**: Must replicate hospital paging formats
  - Field structure, encoding, length limits
  - Acknowledgement behavior
  - Transport mechanism (APIs, modems, serial ports, etc.)
  - Lina must output compatible data formats to right endpoints

**Architecture Dependencies:**
- Depends on Layer 2 (firmware) for device communication
- Paging integration depends on protocol discovery (can use mock initially)
- Backend services can be developed in parallel with device firmware
- Device-to-backend APIs can be designed before firmware is complete

---

### **Layer 4: AI/Intelligence Architecture**
**Smart Processing Layer** - LLM-driven features

**Components:**
- **Contextual Router** (Smart Call Routing):
  - LLM integration for intelligent routing
  - EMR schedule integration
  - Availability detection
  - Context-aware call routing
  
- **Actionable Voice** (Voice-to-EMR):
  - Voice transcription
  - Clinical entity extraction
  - EMR order drafting
  - Confirmation workflow
  
- **Universal Translator**:
  - Real-time translation engine
  - Multi-language support
  - Low-latency processing
  - Interpreter mode toggle
  
- **Clinical Oracle** (Protocol Knowledge Base):
  - Hospital protocol database
  - Pharmacy formulary integration
  - Protocol query interface
  - Knowledge base management
  
- **Sentiment Sentinel** (Burnout Detection):
  - Voice tone analysis
  - Stress detection
  - Cognitive overload detection
  - Automatic routing adjustments

**Current Status:**
- ⚠️ LLM integration infrastructure needed
- ⚠️ All AI features need design and implementation
- ⚠️ EMR integration APIs needed

**AI/Intelligence Constraints:**
- **LLM Integration**: Infrastructure needed, role undefined
  - LLM role unclear (recommendations, workflow generation, triage, etc.)
  - **Risk**: Scope creep or misaligned expectations if not clarified early
  - Requires LLM infrastructure setup (backend service)
  - RAG (Retrieval-Augmented Generation) needed for contextual routing
  - Must connect to live schedule and EMR status
  
- **EMR Integration**: Hospital system APIs unknown
  - EMR APIs vary by hospital (Epic, Cerner, etc.)
  - Integration complexity depends on hospital system
  - Voice-to-EMR requires clinical entity extraction
  - Order drafting requires EMR write access (security/compliance)
  
- **Real-Time Translation**: Low-latency requirement
  - Must be real-time (no noticeable delay)
  - Interpreter mode toggle needed
  - Multi-language support required
  - Processing must happen on backend (device lacks compute)
  
- **Clinical Oracle**: Hospital-specific protocols
  - Must query hospital's specific pharmacy formulary
  - Protocol knowledge base must be hospital-specific
  - Requires integration with hospital protocol systems
  - Knowledge base management needed
  
- **Sentiment Analysis**: High technical hurdle
  - Voice tone, cadence, and stress analysis
  - Cognitive overload detection
  - Automatic routing adjustments
  - **Probability**: 50% (high tech hurdle, but massive emotional sales pitch)

**Architecture Dependencies:**
- Depends on Layer 3 (communication) for backend APIs
- Requires LLM infrastructure setup (critical path)
- EMR integration depends on hospital system APIs (varies by hospital)
- Can be developed incrementally (one feature at a time)
- Contextual Router (90% probability) should be developed first

---

### **Layer 5: Backend Infrastructure Architecture**
**Platform Services Layer** - Supporting infrastructure

**Components:**
- **Authentication & Security**:
  - Multi-Factor Authentication (MFA)
  - Device authentication
  - User authentication
  - Session management
  - HIPAA/PHI compliance
  
- **Notification Services**:
  - Email notification system
  - Push notification service
  - Alert management
  
- **Monitoring & Operations**:
  - Device health monitoring
  - System metrics and logging
  - Alerting and incident management
  - Performance monitoring
  
- **Database & Storage**:
  - Device registry database
  - Message history storage
  - User/role management
  - Audit logging

**Current Status:**
- ⚠️ MFA infrastructure needed
- ⚠️ Email notification system needed
- ⚠️ Monitoring infrastructure needed
- ⚠️ Database schema design needed

**Backend Infrastructure Constraints:**
- **HIPAA/PHI Compliance**: REQUIRED for production
  - MFA and email notifications are early steps
  - Broader HIPAA/PHI considerations need explicit design
  - Security infrastructure is critical path
  - Audit logging required
  - Data encryption at rest and in transit
  
- **MFA Infrastructure**: Required for authentication
  - Multi-factor authentication for users
  - Device authentication
  - Session management
  - Must be HIPAA-compliant
  
- **Email Notification System**: Required for alerts
  - Invites, alerts, status updates
  - Must be reliable and secure
  - HIPAA-compliant email handling
  
- **Database Schema**: Must support device registry and messaging
  - Device registry database
  - Message history storage
  - User/role management
  - Audit logging
  - Must be designed early (affects all backend services)

**Architecture Dependencies:**
- Can be developed in parallel with other layers
- Required before production deployment
- Security infrastructure is critical path
- Database schema design should happen early (affects all services)

---

### **Layer 6: Clinical Workflow Architecture**
**Application Layer** - Department-specific use cases

**Components:**
- **Emergency Room Workflows**:
  - Code STEMI workflow
  - Rapid response protocols
  - Critical patient alerts
  
- **Pharmacy Workflows**:
  - Dosage confirmation calls
  - Medication verification
  - Pharmacy paging integration
  
- **MedSurg Floor Workflows**:
  - Shift handover documentation
  - Rounds communication
  - Patient status updates
  
- **Admissions Workflows**:
  - Admission notifications
  - Bed assignment alerts
  - Patient transfer coordination
  
- **Patient Blood Loss Workflow** (Flagship Demo):
  - Structured workflow definition
  - Multi-role communication
  - Escalation protocols
  - Time-bound behaviors

**Current Status:**
- ⚠️ Use case catalog needed (transcribe and tag conversations)
- ⚠️ Workflow definitions needed
- ⚠️ Patient blood loss workflow needs structured definition

**Clinical Workflow Constraints:**
- **Demo-Driven Development**: Patient blood loss workflow is flagship demo
  - Must be defined in structured format (steps, roles, triggers, messages)
  - Multi-role communications (nurse, charge nurse, physician)
  - Time-bound behaviors (how long staff remain in room, when to escalate)
  - Clear procedures and escalation paths
  
- **Messaging Modes**: Must support both targeted and broadcast
  - **Private/Targeted**: Discreet vibrating alert on nurse's device
  - **Broadcast**: "all nurses on this unit," "charge nurse group," "rapid response team"
  - Device UX must support mode switching
  - Clear UI affordances so users know who is being messaged
  
- **Use Case Catalog**: Must be built from conversations
  - Transcribe and tag existing conversations
  - Extract department-specific use cases
  - Identify procedure bundles (low-risk, standard protocols)
  - Identify automatable tasks
  - Frequent notification patterns
  
- **Request Lifecycle**: Must track statuses
  - Pending, waiting, completed, etc.
  - Support both broadcast and targeted notifications
  - Status tracking required for workflow management

**Architecture Dependencies:**
- Depends on Layers 1-4 being functional
- Can be designed in parallel with development
- Workflow definitions inform UI/UX design
- Patient blood loss workflow is critical for demo (high priority)

---

### **Layer 7: User Experience Architecture**
**Interface Layer** - Device UI and interaction design

**Components:**
- **Device UI**:
  - Touch screen interface
  - Mode switching (targeted vs broadcast)
  - Status indicators
  - Visual feedback
  
- **Voice Interface**:
  - Voice command recognition
  - Voice feedback
  - Interpreter mode UI
  - Call interface
  
- **User Testing**:
  - Usability testing
  - Clinical workflow testing
  - Feedback collection
  - Iterative improvement

**Current Status:**
- ⚠️ Mode switching UX needs definition
- ⚠️ Device UI design needed
- ⚠️ Voice interface design needed

**User Experience Constraints:**
- **Mode Switching UX**: CRITICAL for clinical workflows
  - Must support targeted vs broadcast messaging
  - Clear UI affordances so users know who is being messaged
  - Must be intuitive (clinical staff are not tech-savvy)
  - **Priority**: HIGH (required for workflows)
  
- **Device UI**: Depends on touch screen hardware
  - Touch screen (CST816S) must be functional
  - Requires I2C hardware fix (blocking)
  - UI must be simple and clear (clinical environment)
  - Visual feedback required for all actions
  
- **Voice Interface**: Must be hands-free
  - Voice command recognition
  - Voice feedback
  - Interpreter mode toggle
  - Call interface
  - Must work in noisy clinical environments
  
- **User Testing**: Must happen early and often
  - Clinical staff feedback is critical
  - Usability testing in clinical environment
  - Iterative improvement based on feedback
  - Must validate workflows with real users

**Architecture Dependencies:**
- Depends on Layer 1 (touch screen hardware) - **BLOCKING**: I2C fix required
- Depends on Layer 2 (firmware UI framework)
- Informs Layer 6 (workflow design)
- Mode switching UX is critical path for workflows

---

## Development Epic Organization

Based on the architecture layers, here are the **architecturally-coherent development epics**:

### **Epic 1: Device Hardware Foundation** (Layer 1)
**Epic Key:** `OPAL-HW-FOUNDATION`  
**Priority:** CRITICAL (blocks all other work)

**Scope:**
- ESP32-C6 board provisioning (I2C fixes, audio debugging)
- PCB design and production roadmap
- Hardware testing and validation
- Hardware documentation

**Dependencies:** None (foundation layer)

**Sub-Epics:**
- `OPAL-HW-1`: ESP32-C6 Firmware Development
- `OPAL-HW-2`: Audio System (ES8311 Codec, I2S)
- `OPAL-HW-3`: I2C Device Integration (Touch, RTC, IMU)
- `OPAL-HW-4`: PCB Design & Production
- `OPAL-HW-5`: Hardware Testing & Validation

---

### **Epic 2: Firmware Core Services** (Layer 2)
**Epic Key:** `OPAL-FW-CORE`  
**Priority:** CRITICAL (required for all device functionality)

**Scope:**
- Audio pipeline (I2S, AEC, codec interface)
- VoIP stack (SIP/RTP integration)
- Device management (WiFi, state, power)
- I2C device drivers

**Dependencies:** Epic 1 (hardware must be stable)

**Sub-Epics:**
- `OPAL-FW-1`: Audio Pipeline Development
- `OPAL-FW-2`: VoIP Stack Integration
- `OPAL-FW-3`: Device Management Services
- `OPAL-FW-4`: I2C Device Drivers

---

### **Epic 3: Communication Infrastructure** (Layer 3)
**Epic Key:** `OPAL-COMM-INFRA`  
**Priority:** HIGH (required for backend integration)

**Scope:**
- Device-to-backend APIs
- Paging system integration
- Backend services (device registry, routing, gateway)
- Mock paging server (for demos)

**Dependencies:** Epic 2 (firmware must support communication)

**Sub-Epics:**
- `OPAL-COMM-1`: Device-to-Backend API Design & Implementation
- `OPAL-COMM-2`: Paging System Discovery & Integration
- `OPAL-COMM-3`: Backend Services Development
- `OPAL-COMM-4`: Mock Paging Server (Demo)

---

### **Epic 4: AI-Enhanced Communications** (Layer 4)
**Epic Key:** `OPAL-AI-ENHANCED`  
**Priority:** HIGH (competitive differentiator)

**Scope:**
- Contextual Router (smart call routing)
- Actionable Voice (voice-to-EMR)
- Universal Translator (real-time translation)
- Clinical Oracle (protocol knowledge base)
- Sentiment Sentinel (burnout detection)

**Dependencies:** Epic 3 (communication infrastructure), LLM infrastructure

**Sub-Epics:**
- `OPAL-AI-1`: Contextual Router Development
- `OPAL-AI-2`: Actionable Voice Development
- `OPAL-AI-3`: Universal Translator Development
- `OPAL-AI-4`: Clinical Oracle Development
- `OPAL-AI-5`: Sentiment Sentinel Development

---

### **Epic 5: Backend Platform Services** (Layer 5)
**Epic Key:** `OPAL-BACKEND-PLATFORM`  
**Priority:** HIGH (required for production)

**Scope:**
- Authentication & security (MFA, device auth, HIPAA compliance)
- Notification services (email, push)
- Monitoring & operations
- Database & storage

**Dependencies:** Can be developed in parallel with other epics

**Sub-Epics:**
- `OPAL-BACKEND-1`: Authentication & Security Infrastructure
- `OPAL-BACKEND-2`: Notification Services
- `OPAL-BACKEND-3`: Monitoring & Operations
- `OPAL-BACKEND-4`: Database & Storage

---

### **Epic 6: Clinical Workflows** (Layer 6)
**Epic Key:** `OPAL-CLINICAL-WORKFLOWS`  
**Priority:** MEDIUM (application layer, depends on lower layers)

**Scope:**
- Use case catalog development
- Department-specific workflows
- Patient blood loss workflow (flagship demo)
- Workflow implementation

**Dependencies:** Epics 1-4 (all lower layers must be functional)

**Sub-Epics:**
- `OPAL-WORKFLOWS-1`: Emergency Room Workflows
- `OPAL-WORKFLOWS-2`: Pharmacy Dosage Calls
- `OPAL-WORKFLOWS-3`: MedSurg Floor Communications
- `OPAL-WORKFLOWS-4`: Admissions Workflows
- `OPAL-WORKFLOWS-5`: Patient Blood Loss Workflow (Flagship Demo)

---

### **Epic 7: User Experience & Interface** (Layer 7)
**Epic Key:** `OPAL-UX-INTERFACE`  
**Priority:** MEDIUM (user-facing, can iterate)

**Scope:**
- Device UI design and implementation
- Mode switching UX (targeted vs broadcast)
- Voice interface design
- User testing and feedback

**Dependencies:** Epic 1 (hardware), Epic 2 (firmware UI framework)

**Sub-Epics:**
- `OPAL-UX-1`: Targeted vs Broadcast Mode Switching
- `OPAL-UX-2`: Device UI Design & Implementation
- `OPAL-UX-3`: Voice Interface Design
- `OPAL-UX-4`: User Testing & Feedback

---

### **Epic 8: Demo & Pilot Programs**
**Epic Key:** `OPAL-DEMO-PILOTS`  
**Priority:** MEDIUM (business development)

**Scope:**
- Demo storyboard and planning
- Dashboard visualization
- Video production
- Pilot program execution

**Dependencies:** Epics 1-7 (all layers must be functional for demos)

**Sub-Epics:**
- `OPAL-DEMO-1`: Closed Loop Pilot (Cardiology/Cath Lab)
- `OPAL-DEMO-2`: Rounds Pilot (Med-Surg)
- `OPAL-DEMO-3`: Safety Net Pilot (Psychiatry/ED)
- `OPAL-DEMO-4`: Dashboard Visualization
- `OPAL-DEMO-5`: Video Production

---

## Critical Constraints Summary

### **Hardware Constraints (BLOCKING)**
1. **I2C Pull-up Resistors**: REQUIRED - 4.7kΩ on SDA/SCL (GPIO7/8)
   - Blocks: All I2C device integration (codec, touch, RTC, IMU)
   - Fix: Hardware soldering (user will handle)
   
2. **ES8311 CE Pin**: Hard-wired HIGH (not controllable)
   - Constraint: Codec always enabled when powered
   - Impact: No software power control
   
3. **Touch RST Pin**: Not connected
   - Constraint: No software reset capability
   - Impact: Must rely on power-on reset only
   
4. **Partition Table**: 3MB app partition required
   - Constraint: Binary size ~1.37MB
   - Impact: Must configure in `partitions.csv`

### **Firmware Constraints (CRITICAL)**
1. **AEC Sample Rate**: REQUIRED - 16kHz only
   - Constraint: AEC library only supports 16kHz
   - Impact: I2S and codec must be 16kHz
   - Error if wrong: "Only support 16K sample rate"
   
2. **ESP-ADF Board Abstraction**: REQUIRED
   - Constraint: Must use ESP-ADF board configuration
   - Impact: Cannot bypass board abstraction
   - Solution: Custom board config created (`esp32c6_opal`)
   
3. **VoIP Codec**: G.711 A-law (8kHz codec, 16kHz I2S)
   - Constraint: Codec 8kHz, I2S 16kHz (can differ)
   - Impact: Must handle sample rate conversion
   
4. **Closed-Source Library**: SIP/RTP uses `esp_rtc`
   - Constraint: Cannot modify internal implementation
   - Impact: Must use provided API only

### **Integration Constraints (HIGH RISK)**
1. **Paging System Protocol**: UNKNOWN
   - Constraint: Vendor, protocol, format unknown
   - Risk: Demo may rely on assumptions
   - Mitigation: Mock paging server first
   
2. **EMR Integration APIs**: UNKNOWN
   - Constraint: Varies by hospital system
   - Risk: Integration complexity unknown
   - Mitigation: Mock EMR API for development
   
3. **LLM Role**: UNDEFINED
   - Constraint: Scope unclear
   - Risk: Scope creep
   - Mitigation: Define early, start with Contextual Router

### **Compliance Constraints (CRITICAL)**
1. **HIPAA/PHI Compliance**: REQUIRED
   - Constraint: Must be compliant for production
   - Impact: Security infrastructure is critical path
   - Requirement: Audit logging, encryption, access control

### **Business Constraints (HIGH PRIORITY)**
1. **Demo-Driven Development**: Patient blood loss workflow
   - Constraint: Flagship demo must be ready
   - Impact: High priority for workflow definition
   
2. **Mode Switching UX**: CRITICAL
   - Constraint: Must support targeted vs broadcast
   - Impact: Required for clinical workflows
   - Priority: HIGH

---

## Development Sequencing Strategy

### **Phase 1: Foundation (Weeks 1-4)**
**Focus:** Hardware fixes and firmware core

**Epics:**
1. Epic 1: Device Hardware Foundation (CRITICAL - BLOCKING)
   - **Constraint**: I2C pull-up resistors must be added (hardware fix)
   - **Constraint**: Audio output debugging (AEC 16kHz configuration)
   - **Deliverable**: Stable hardware platform with working I2C
   
2. Epic 2: Firmware Core Services (CRITICAL - DEPENDS ON EPIC 1)
   - **Constraint**: AEC must be 16kHz (I2S and codec)
   - **Constraint**: ESP-ADF board abstraction required
   - **Deliverable**: Working audio pipeline, basic VoIP functionality
   
3. Epic 5: Backend Platform Services (in parallel - NO BLOCKING)
   - **Constraint**: HIPAA/PHI compliance required
   - **Deliverable**: Backend authentication, security, MFA, email

**Critical Path:**
- I2C hardware fix → I2C device testing → Audio pipeline → VoIP integration

**Parallel Work:**
- Backend services (no dependencies)
- Workflow design (no dependencies)
- UI/UX design (no dependencies)

---

### **Phase 2: Communication & Integration (Weeks 5-8)**
**Focus:** Device-to-backend communication

**Epics:**
1. Epic 3: Communication Infrastructure (HIGH)
   - **Constraint**: Paging protocol unknown (use mock first)
   - **Constraint**: MVP requirement - generate compatible outputs
   - **Deliverable**: Device-to-backend APIs, mock paging server
   
2. Continue Epic 5: Backend Platform Services
   - **Deliverable**: Backend services operational, device registry

**Deliverables:**
- Device-to-backend APIs
- Mock paging server (allows development without production protocol)
- Backend services operational
- Device registry and management
- Paging protocol discovery (parallel work)

**Critical Path:**
- Device-to-backend APIs → Mock paging server → Protocol discovery → Production integration

---

### **Phase 3: Intelligence Layer (Weeks 9-16)**
**Focus:** AI-enhanced features

**Epics:**
1. Epic 4: AI-Enhanced Communications (HIGH)
   - **Constraint**: LLM infrastructure needed (critical path)
   - **Constraint**: LLM role must be defined early
   - **Constraint**: EMR APIs unknown (use mock)
   - **Priority**: Contextual Router first (90% probability, highest value)
   - **Deliverable**: Contextual Router (MVP), Actionable Voice (MVP), Universal Translator (MVP)
   
2. Epic 7: User Experience & Interface (in parallel)
   - **Constraint**: Mode switching UX is CRITICAL
   - **Constraint**: Depends on touch screen (I2C fix from Phase 1)
   - **Deliverable**: Device UI functional, mode switching implemented

**Deliverables:**
- LLM infrastructure operational
- Contextual Router (MVP) - 90% probability, highest value
- Actionable Voice (MVP) - 85% probability
- Universal Translator (MVP) - 75% probability
- Device UI functional
- Mode switching implemented (CRITICAL for workflows)

**Critical Path:**
- LLM infrastructure → Contextual Router → Other AI features
- Touch screen (I2C fix) → Device UI → Mode switching

---

### **Phase 4: Clinical Application (Weeks 17-24)**
**Focus:** Workflows and demos

**Epics:**
1. Epic 6: Clinical Workflows (MEDIUM - HIGH PRIORITY FOR DEMO)
   - **Constraint**: Patient blood loss workflow is flagship demo
   - **Constraint**: Must support targeted and broadcast messaging
   - **Constraint**: Request lifecycle tracking required
   - **Deliverable**: Use case catalog, patient blood loss workflow, department workflows
   
2. Epic 8: Demo & Pilot Programs (MEDIUM - BUSINESS DEVELOPMENT)
   - **Constraint**: Demo-driven development
   - **Deliverable**: Demo dashboard, video production, pilot programs

**Deliverables:**
- Use case catalog (from transcribed conversations)
- Patient blood loss workflow (flagship demo - HIGH PRIORITY)
- Department-specific workflows (ER, Pharmacy, MedSurg, Admissions)
- Demo dashboard (visualizes message flow and device status)
- Video production (Opal team acting out workflows)
- Pilot programs ready (Closed Loop, Rounds, Safety Net)

**Critical Path:**
- Use case catalog → Patient blood loss workflow → Demo preparation → Pilot programs

---

## Key Architectural Decisions

### **1. Hardware-First Approach**
- Hardware must be stable before firmware development
- I2C hardware fix is blocking all device integration
- Audio debugging is critical path

### **2. Incremental AI Features**
- AI features can be developed incrementally
- Start with Contextual Router (highest value)
- Each feature can be validated independently

### **3. Parallel Backend Development**
- Backend infrastructure can be developed in parallel
- Security infrastructure is critical path
- Database design should happen early

### **4. Workflow-Driven UI Design**
- UI design should be informed by workflow requirements
- Mode switching UX is critical for clinical workflows
- User testing should happen early and often

### **5. Demo-Driven Development**
- Patient blood loss workflow is flagship demo
- Dashboard visualization supports demos
- Video production can happen in parallel with development

---

## Risk Mitigation

### **Hardware Risks:**
- **Risk:** I2C hardware issues block development
  - **Impact:** CRITICAL - Blocks all I2C device integration (codec, touch, RTC, IMU)
  - **Mitigation:** 
    - Hardware fix is top priority (4.7kΩ pull-up resistors)
    - Can work on backend services in parallel
    - Can design workflows and UI while hardware is fixed
    - Comprehensive diagnostics help identify issues quickly

- **Risk:** Audio output issues (currently only brief click)
  - **Impact:** HIGH - Blocks audio testing and VoIP integration
  - **Mitigation:**
    - Audio pipeline debugging is critical path
    - AEC configuration must be correct (16kHz)
    - Codec mute/volume settings must be verified
    - Can test VoIP with mock audio if needed

- **Risk:** GPIO pin conflicts
  - **Impact:** CRITICAL - I2C won't work if pins conflict
  - **Mitigation:**
    - Pin conflict detection code exists
    - All pins verified from datasheet
    - Board configuration ensures correct pins

### **Integration Risks:**
- **Risk:** Paging system protocol unknown
  - **Impact:** MEDIUM - Demo may rely on assumptions
  - **Mitigation:** 
    - Mock paging server allows development without production protocol
    - Generate compatible outputs first (MVP requirement)
    - Full integration can follow once trust is built
    - Protocol discovery is parallel work (doesn't block development)

- **Risk:** EMR integration APIs unknown
  - **Impact:** MEDIUM - Blocks voice-to-EMR features
  - **Mitigation:**
    - Can develop voice transcription and entity extraction first
    - EMR integration can be hospital-specific (varies by deployment)
    - Mock EMR API for development and demos

- **Risk:** Identifier assignment & mapping misalignment
  - **Impact:** MEDIUM - May not fit hospital IT constraints
  - **Mitigation:**
    - Design flexible identifier scheme
    - Work with hospital IT early
    - Support multiple identifier formats

### **AI/LLM Risks:**
- **Risk:** LLM infrastructure complexity
  - **Impact:** HIGH - Blocks all AI features
  - **Mitigation:** 
    - Start with simple features (Contextual Router)
    - Incrementally add complexity
    - LLM infrastructure can be developed in parallel
    - Use existing LLM services initially (reduce complexity)

- **Risk:** LLM role undefined (scope creep)
  - **Impact:** MEDIUM - Misaligned expectations
  - **Mitigation:**
    - Draft initial LLM integration proposal early
    - Define goals, constraints, data boundaries
    - Start with highest-value features first (Contextual Router: 90% probability)

- **Risk:** Real-time translation latency
  - **Impact:** MEDIUM - Poor user experience
  - **Mitigation:**
    - Backend processing (device lacks compute)
    - Optimize network latency
    - Use efficient translation models
    - Test in clinical environment early

### **Timeline Risks:**
- **Risk:** Dependencies create bottlenecks
  - **Impact:** HIGH - Delays development
  - **Mitigation:** 
    - Parallel development where possible
    - Clear dependency mapping (this document)
    - Backend services can be developed in parallel
    - Workflow design can happen in parallel

- **Risk:** Hardware fixes take longer than expected
  - **Impact:** HIGH - Blocks all device development
  - **Mitigation:**
    - Hardware fix is well-defined (soldering pull-up resistors)
    - Can continue backend and design work
    - Comprehensive diagnostics help identify issues quickly

### **Compliance Risks:**
- **Risk:** HIPAA/PHI compliance gaps
  - **Impact:** CRITICAL - Blocks production deployment
  - **Mitigation:**
    - Security infrastructure is critical path
    - Design compliance from the start
    - Regular security audits
    - Work with compliance experts early

---

## Success Metrics

### **Hardware:**
- All I2C devices detected and functional
- Audio pipeline stable (playback + recording)
- PCB design ready for production

### **Firmware:**
- VoIP calls functional (full-duplex)
- Device management operational
- All device drivers functional

### **Communication:**
- Device-to-backend APIs operational
- Paging integration functional (mock + real)
- Backend services stable

### **AI Features:**
- Contextual Router reduces call failures by 50%
- Actionable Voice saves 2+ hours/day per clinician
- Universal Translator enables non-English communication

### **Clinical Workflows:**
- Patient blood loss workflow demo ready
- 3+ department workflows implemented
- User testing feedback positive

---

## Next Steps

1. **Review this architecture** with technical team
2. **Prioritize Epic 1** (Device Hardware Foundation)
3. **Create detailed tasks** for each epic
4. **Set up Jira epics** using this structure
5. **Begin Phase 1** development

---

## Appendix: Backlog Items Mapped to Epics

### **Epic 1: Device Hardware Foundation**
- Provision ESP32-C6 OPAL Board (SCRUM-20)
- Document current hardware stack
- Outline PCB production roadmap
- Hardware testing and validation

### **Epic 2: Firmware Core Services**
- Audio pipeline debugging
- VoIP stack integration
- Device management services
- I2C device drivers

### **Epic 3: Communication Infrastructure**
- Identify paging system vendors
- Obtain paging message format spec
- Design device-to-backend APIs
- Build mock paging server
- Implement backend services

### **Epic 4: AI-Enhanced Communications**
- LLM integration infrastructure
- Contextual Router development
- Actionable Voice development
- Universal Translator development
- Clinical Oracle development
- Sentiment Sentinel development

### **Epic 5: Backend Platform Services**
- MFA infrastructure
- Email notification system
- Monitoring and operations
- Database schema design
- HIPAA/PHI compliance

### **Epic 6: Clinical Workflows**
- Transcribe and tag conversations (use case catalog)
- Define patient blood loss workflow
- Select additional departmental scenarios
- Implement workflows

### **Epic 7: User Experience & Interface**
- Define mode switching UX
- Device UI design
- Voice interface design
- User testing

### **Epic 8: Demo & Pilot Programs**
- Demo storyboard
- Dashboard visualization
- Video production
- Pilot program execution

---

**Document Status:** Draft for Review  
**Last Updated:** 2025-11-19  
**Next Review:** After team feedback

