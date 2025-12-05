# OPAL System Architecture - Executive Summary

**Date:** 2025-11-19  
**Purpose:** High-level summary of OPAL system architecture and development epics

---

## System Overview

OPAL is a **multi-layered clinical communications platform** that combines hardware, firmware, communication, AI intelligence, backend infrastructure, and clinical workflows to displace Vocera in hospital environments.

---

## Architecture Layers (7 Layers)

1. **Device Hardware** - ESP32-C6, ES8311 codec, touch, sensors
2. **Firmware Core** - Audio pipeline, VoIP, device management
3. **Communication** - Device-to-backend APIs, paging integration
4. **AI/Intelligence** - LLM-driven features (routing, voice-to-EMR, translation)
5. **Backend Infrastructure** - Auth, security, monitoring, compliance
6. **Clinical Workflows** - Department-specific use cases
7. **User Experience** - Device UI, voice interface, mode switching

---

## Critical Constraints

### **BLOCKING Constraints:**
- **I2C Pull-up Resistors**: REQUIRED - 4.7kΩ on SDA/SCL (blocks all I2C devices)
- **AEC Sample Rate**: REQUIRED - 16kHz only (I2S and codec must be 16kHz)
- **ESP-ADF Board Abstraction**: REQUIRED - Cannot bypass

### **HIGH RISK Constraints:**
- **Paging System Protocol**: UNKNOWN (use mock first)
- **EMR Integration APIs**: UNKNOWN (varies by hospital)
- **LLM Role**: UNDEFINED (risk of scope creep)

### **CRITICAL Path Constraints:**
- **HIPAA/PHI Compliance**: REQUIRED for production
- **Mode Switching UX**: CRITICAL for workflows
- **Patient Blood Loss Workflow**: Flagship demo (high priority)

---

## Development Epics (8 Epics)

### **Epic 1: Device Hardware Foundation** (CRITICAL - BLOCKING)
- ESP32-C6 board provisioning
- I2C hardware fixes (pull-up resistors)
- Audio system debugging
- PCB design and production
- Hardware testing and validation

**Dependencies:** None (foundation layer)  
**Blocking:** All other epics depend on this

---

### **Epic 2: Firmware Core Services** (CRITICAL)
- Audio pipeline (I2S, AEC, codec interface)
- VoIP stack (SIP/RTP integration)
- Device management (WiFi, state, power)
- I2C device drivers (touch, RTC, IMU)

**Dependencies:** Epic 1 (hardware must be stable)  
**Constraints:** AEC 16kHz, ESP-ADF board abstraction

---

### **Epic 3: Communication Infrastructure** (HIGH)
- Device-to-backend APIs
- Paging system integration (mock + real)
- Backend services (device registry, routing, gateway)
- Mock paging server (for demos)

**Dependencies:** Epic 2 (firmware must support communication)  
**Constraints:** Paging protocol unknown (use mock first)

---

### **Epic 4: AI-Enhanced Communications** (HIGH)
- Contextual Router (90% probability, highest value)
- Actionable Voice (85% probability)
- Universal Translator (75% probability)
- Clinical Oracle (65% probability)
- Sentiment Sentinel (50% probability)

**Dependencies:** Epic 3 (communication infrastructure), LLM infrastructure  
**Constraints:** LLM role undefined, EMR APIs unknown

---

### **Epic 5: Backend Platform Services** (HIGH)
- Authentication & security (MFA, device auth, HIPAA compliance)
- Notification services (email, push)
- Monitoring & operations
- Database & storage

**Dependencies:** Can be developed in parallel  
**Constraints:** HIPAA/PHI compliance required

---

### **Epic 6: Clinical Workflows** (MEDIUM - HIGH PRIORITY FOR DEMO)
- Use case catalog (from transcribed conversations)
- Patient blood loss workflow (flagship demo)
- Department-specific workflows (ER, Pharmacy, MedSurg, Admissions)

**Dependencies:** Epics 1-4 (all lower layers must be functional)  
**Constraints:** Patient blood loss workflow is flagship demo

---

### **Epic 7: User Experience & Interface** (MEDIUM)
- Mode switching UX (targeted vs broadcast) - CRITICAL
- Device UI design and implementation
- Voice interface design
- User testing and feedback

**Dependencies:** Epic 1 (touch screen hardware), Epic 2 (firmware UI framework)  
**Constraints:** Mode switching UX is critical for workflows

---

### **Epic 8: Demo & Pilot Programs** (MEDIUM)
- Demo storyboard and planning
- Dashboard visualization
- Video production
- Pilot program execution

**Dependencies:** Epics 1-7 (all layers must be functional)  
**Constraints:** Demo-driven development

---

## Development Phases

### **Phase 1: Foundation (Weeks 1-4)**
- Epic 1: Device Hardware Foundation (CRITICAL - BLOCKING)
- Epic 2: Firmware Core Services (CRITICAL)
- Epic 5: Backend Platform Services (parallel)

**Critical Path:** I2C hardware fix → I2C device testing → Audio pipeline → VoIP integration

---

### **Phase 2: Communication & Integration (Weeks 5-8)**
- Epic 3: Communication Infrastructure (HIGH)
- Continue Epic 5: Backend Platform Services

**Critical Path:** Device-to-backend APIs → Mock paging server → Protocol discovery → Production integration

---

### **Phase 3: Intelligence Layer (Weeks 9-16)**
- Epic 4: AI-Enhanced Communications (HIGH)
- Epic 7: User Experience & Interface (parallel)

**Critical Path:** LLM infrastructure → Contextual Router → Other AI features

---

### **Phase 4: Clinical Application (Weeks 17-24)**
- Epic 6: Clinical Workflows (MEDIUM - HIGH PRIORITY FOR DEMO)
- Epic 8: Demo & Pilot Programs (MEDIUM)

**Critical Path:** Use case catalog → Patient blood loss workflow → Demo preparation → Pilot programs

---

## Key Success Factors

1. **Hardware Fixes**: I2C pull-up resistors must be added (user will handle)
2. **Audio Pipeline**: Must be stable with 16kHz AEC configuration
3. **LLM Infrastructure**: Critical path for AI features
4. **Mode Switching UX**: Critical for clinical workflows
5. **Patient Blood Loss Workflow**: Flagship demo must be ready

---

## Risk Mitigation

- **Hardware Risks**: Can work on backend in parallel while hardware is fixed
- **Integration Risks**: Use mock services first, adapt to production later
- **AI/LLM Risks**: Start with simple features (Contextual Router), incrementally add complexity
- **Timeline Risks**: Parallel development where possible, clear dependency mapping

---

## Next Steps

1. ✅ Architecture document refined with all constraints
2. ✅ Summary document created
3. ⏳ Create Jira epics based on this architecture
4. ⏳ Create detailed tasks for each epic
5. ⏳ Begin Phase 1 development

---

**Document Status:** Complete  
**Last Updated:** 2025-11-19

