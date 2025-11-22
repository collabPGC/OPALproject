# Jira Organization Plan - OPAL Project

**Date:** 2025-11-18  
**Purpose:** Organize Jira workspace for OPAL/Lina Clinical Communications project

---

## Project Structure

### **Main Project: OPAL (Clinical Communications Device)**

**Project Key:** `OPAL`  
**Project Type:** Software + Hardware Development  
**Lead:** TBD

---

## Epic Structure

### **Epic 1: Hardware Development**
**Epic Key:** `OPAL-HW`  
**Description:** ESP32-C6 OPAL device hardware development, PCB design, and hardware integration

**Sub-Epics:**
- `OPAL-HW-1`: ESP32-C6 Firmware Development
- `OPAL-HW-2`: Audio System (ES8311 Codec, I2S)
- `OPAL-HW-3`: I2C Device Integration (Touch, RTC, IMU)
- `OPAL-HW-4`: PCB Design & Production
- `OPAL-HW-5`: Hardware Testing & Validation

---

### **Epic 2: Paging System Integration**
**Epic Key:** `OPAL-PAGING`  
**Description:** Integration with hospital paging infrastructure

**Sub-Epics:**
- `OPAL-PAGING-1`: Paging System Discovery & Analysis
- `OPAL-PAGING-2`: Message Format Specification
- `OPAL-PAGING-3`: Mock Paging Server Development
- `OPAL-PAGING-4`: Production Integration

---

### **Epic 3: AI-Enhanced Communications**
**Epic Key:** `OPAL-AI`  
**Description:** LLM-driven features for contextual routing, voice-to-EMR, translation, and clinical knowledge

**Sub-Epics:**
- `OPAL-AI-1`: Contextual Router (Smart Call Routing)
- `OPAL-AI-2`: Actionable Voice (Voice-to-EMR Integration)
- `OPAL-AI-3`: Universal Translator (Real-time Translation)
- `OPAL-AI-4`: Clinical Oracle (Protocol Knowledge Base)
- `OPAL-AI-5`: Sentiment Sentinel (Burnout Detection)

---

### **Epic 4: Use Cases & Clinical Workflows**
**Epic Key:** `OPAL-WORKFLOWS`  
**Description:** Department-specific use cases and clinical workflow implementation

**Sub-Epics:**
- `OPAL-WORKFLOWS-1`: Emergency Room Workflows
- `OPAL-WORKFLOWS-2`: Pharmacy Dosage Calls
- `OPAL-WORKFLOWS-3`: MedSurg Floor Communications
- `OPAL-WORKFLOWS-4`: Admissions Workflows
- `OPAL-WORKFLOWS-5`: Patient Blood Loss Workflow (Flagship Demo)

---

### **Epic 5: Demo & Pilot Programs**
**Epic Key:** `OPAL-DEMO`  
**Description:** Pilot programs to demonstrate Opal advantages over Vocera

**Sub-Epics:**
- `OPAL-DEMO-1`: Closed Loop Pilot (Cardiology/Cath Lab)
- `OPAL-DEMO-2`: Rounds Pilot (Med-Surg)
- `OPAL-DEMO-3`: Safety Net Pilot (Psychiatry/ED)
- `OPAL-DEMO-4`: Dashboard Visualization
- `OPAL-DEMO-5`: Video Production

---

### **Epic 6: Security & Infrastructure**
**Epic Key:** `OPAL-INFRA`  
**Description:** Backend infrastructure, security, and DevOps

**Sub-Epics:**
- `OPAL-INFRA-1`: Multi-Factor Authentication (MFA)
- `OPAL-INFRA-2`: Email Notification System
- `OPAL-INFRA-3`: LLM Integration Infrastructure
- `OPAL-INFRA-4`: HIPAA/PHI Compliance
- `OPAL-INFRA-5`: Authentication & Authorization
- `OPAL-INFRA-6`: Monitoring & Operations

---

### **Epic 7: User Experience & Interface**
**Epic Key:** `OPAL-UX`  
**Description:** Device UI, mode switching, and user experience design

**Sub-Epics:**
- `OPAL-UX-1`: Targeted vs Broadcast Mode Switching
- `OPAL-UX-2`: Device UI Design
- `OPAL-UX-3`: Voice Interface Design
- `OPAL-UX-4`: User Testing & Feedback

---

## Issue Types

### **Standard Issue Types:**
- **Story:** User-facing features and functionality
- **Task:** Technical work items
- **Bug:** Defects and issues
- **Epic:** Large bodies of work
- **Subtask:** Work breakdown within stories/tasks

### **Custom Issue Types (Recommended):**
- **Hardware Task:** Hardware-specific work
- **Integration Task:** System integration work
- **Research Task:** Investigation and analysis
- **Documentation:** Documentation work

---

## Components

### **Hardware Components:**
- `ESP32-C6-Firmware`
- `Audio-System`
- `I2C-Devices`
- `PCB-Design`
- `Hardware-Testing`

### **Software Components:**
- `Backend-API`
- `LLM-Integration`
- `Voice-Processing`
- `EMR-Integration`
- `Translation-Engine`

### **Infrastructure Components:**
- `Authentication`
- `Security`
- `DevOps`
- `Monitoring`
- `Database`

### **Clinical Components:**
- `ER-Workflows`
- `Pharmacy`
- `MedSurg`
- `Admissions`
- `Safety`

---

## Labels

### **Priority Labels:**
- `priority-critical`
- `priority-high`
- `priority-medium`
- `priority-low`

### **Status Labels:**
- `blocked`
- `waiting-review`
- `in-testing`
- `ready-for-demo`

### **Technical Labels:**
- `hardware`
- `firmware`
- `backend`
- `ai-ml`
- `integration`
- `security`
- `ui-ux`

### **Department Labels:**
- `emergency-room`
- `pharmacy`
- `medsurg`
- `admissions`
- `psychiatry`

### **Feature Labels:**
- `contextual-router`
- `actionable-voice`
- `universal-translator`
- `clinical-oracle`
- `sentiment-sentinel`

---

## Workflow States

### **Standard Workflow:**
1. **Backlog** → Issues not yet started
2. **To Do** → Ready to be worked on
3. **In Progress** → Currently being worked on
4. **In Review** → Code/design review
5. **Testing** → QA/testing phase
6. **Done** → Completed and verified

### **Hardware-Specific States:**
- **Design** → Hardware design phase
- **Prototyping** → Building prototype
- **Testing** → Hardware testing
- **Production** → Production-ready

---

## Initial Issues to Create

### **From Daily Status (2025-11-18):**

#### **System & Integration:**
- [ ] **OPAL-PAGING-1**: Identify exact paging system(s) and vendors used in target hospitals
  - **Owner:** TBD (likely Huber / integrations lead)
  - **Due:** Next discovery cycle
  - **Labels:** `integration`, `research`, `priority-high`

- [ ] **OPAL-PAGING-2**: Obtain or reverse-engineer message format specification for paging system
  - **Owner:** Integrations engineer
  - **Output:** Draft "Paging Message Format Spec v0.1"
  - **Labels:** `integration`, `documentation`, `priority-high`

- [ ] **OPAL-PAGING-3**: Design Lina-side module to generate and send messages in required format
  - **Owner:** Backend/Firmware team
  - **Output:** API + data model doc
  - **Labels:** `backend`, `firmware`, `priority-high`

- [ ] **OPAL-PAGING-4**: Build mock paging server to simulate hospital behavior for demos
  - **Owner:** Backend engineer
  - **Output:** `mock-pager-service` with simple admin UI/logs
  - **Labels:** `backend`, `demo`, `priority-medium`

#### **Use Cases & Content:**
- [ ] **OPAL-WORKFLOWS-1**: Transcribe and tag existing conversations to build use case catalog by department
  - **Owner:** Product / Clinical workflows lead
  - **Labels:** `workflows`, `documentation`, `priority-medium`

- [ ] **OPAL-WORKFLOWS-5**: Define patient blood loss workflow in structured format
  - **Owner:** Product + clinical SME
  - **Labels:** `workflows`, `demo`, `priority-high`

- [ ] **OPAL-WORKFLOWS-2**: Select 2-3 additional departmental scenarios
  - **Owner:** Product
  - **Labels:** `workflows`, `priority-medium`

#### **Demo & UX:**
- [ ] **OPAL-DEMO-4**: Specify demo storyboard (intro → live demo → dashboard → video)
  - **Owner:** Product / Demo lead
  - **Labels:** `demo`, `ux`, `priority-high`

- [ ] **OPAL-UX-1**: Define UX for mode switching (targeted vs broadcast messaging) on device UI
  - **Owner:** UX + firmware
  - **Labels:** `ui-ux`, `firmware`, `priority-high`

- [ ] **OPAL-DEMO-4**: Implement basic dashboard that visualizes message flow and device status
  - **Owner:** Frontend engineer
  - **Labels:** `frontend`, `demo`, `priority-medium`

- [ ] **OPAL-DEMO-5**: Plan & script video scenario with Opal team acting out workflows
  - **Owner:** Marketing / Product
  - **Labels:** `demo`, `marketing`, `priority-low`

#### **Hardware:**
- [ ] **OPAL-HW-4**: Document current hardware stack (boards, revisions, known limitations)
  - **Owner:** Huber / Alex
  - **Labels:** `hardware`, `documentation`, `priority-medium`

- [ ] **OPAL-HW-4**: Outline roadmap for first production-capable PCB revision
  - **Owner:** Alex
  - **Labels:** `hardware`, `pcb-design`, `priority-medium`

#### **Collaboration & Infra:**
- [ ] **OPAL-INFRA-1**: Add all team members to GitHub repo with appropriate permissions
  - **Owner:** Repo admin
  - **Labels:** `infrastructure`, `priority-low`

- [ ] **OPAL-INFRA-1**: Create/organize Jira board with epics
  - **Owner:** Project manager / product
  - **Labels:** `infrastructure`, `priority-medium`

- [ ] **OPAL-INFRA-1**: Stand up MFA and email notification infrastructure
  - **Owner:** DevOps / infra
  - **Labels:** `infrastructure`, `security`, `priority-high`

- [ ] **OPAL-INFRA-3**: Draft initial LLM integration proposal
  - **Owner:** AI/ML lead
  - **Labels:** `ai-ml`, `integration`, `priority-medium`

---

## Sprints

### **Sprint 1: Foundation (Weeks 1-2)**
**Focus:** Hardware stabilization, basic integration setup

**Goals:**
- Complete hardware documentation
- Fix I2C communication issues
- Set up basic paging system research
- Establish infrastructure (MFA, email)

### **Sprint 2: Integration (Weeks 3-4)**
**Focus:** Paging system integration, LLM infrastructure

**Goals:**
- Complete paging system analysis
- Build mock paging server
- Set up LLM integration infrastructure
- Begin use case catalog

### **Sprint 3: AI Features (Weeks 5-6)**
**Focus:** Core AI-enhanced communication features

**Goals:**
- Implement Contextual Router (Epic 1)
- Begin Actionable Voice (Epic 2)
- Start Universal Translator (Epic 3)

### **Sprint 4: Workflows & Demo (Weeks 7-8)**
**Focus:** Clinical workflows and pilot preparation

**Goals:**
- Complete patient blood loss workflow
- Prepare pilot scenarios
- Build dashboard visualization
- Begin video production

---

## Filters & Dashboards

### **Recommended Filters:**

1. **My Open Issues**
   - Assignee = Current User AND Status != Done

2. **Hardware Blockers**
   - Component = Hardware AND Status = Blocked

3. **High Priority Items**
   - Priority = Critical OR Priority = High

4. **Demo Preparation**
   - Epic = OPAL-DEMO AND Status != Done

5. **Integration Tasks**
   - Labels = integration AND Status = In Progress

### **Recommended Dashboards:**

1. **Project Overview Dashboard**
   - Epic progress
   - Sprint burndown
   - Blocked issues
   - Recent activity

2. **Hardware Development Dashboard**
   - Hardware epic progress
   - Hardware component issues
   - Testing status

3. **AI Features Dashboard**
   - AI epic progress
   - Feature completion status
   - Integration status

4. **Demo & Pilot Dashboard**
   - Pilot preparation status
   - Demo deliverables
   - Video production progress

---

## Automation Rules (Recommended)

### **Auto-Assignment Rules:**
- Issues with `hardware` label → Assign to Hardware team
- Issues with `backend` label → Assign to Backend team
- Issues with `ai-ml` label → Assign to AI/ML team

### **Auto-Transition Rules:**
- When PR is merged → Transition to "Testing"
- When all subtasks are done → Transition parent to "In Review"

### **Notification Rules:**
- When issue is blocked → Notify epic owner
- When high-priority issue is created → Notify project lead

---

## Access & Permissions

### **Project Roles:**

1. **Project Administrators**
   - Full access to all project settings
   - Can manage epics, components, versions

2. **Developers**
   - Can create, edit, assign issues
   - Can transition issues through workflow
   - Can comment and add attachments

3. **Viewers**
   - Read-only access
   - Can view issues and dashboards

4. **Stakeholders**
   - Can view and comment
   - Cannot edit issues

---

## Version Management

### **Hardware Versions:**
- `HW-v0.1` - Initial prototype
- `HW-v0.2` - Current development
- `HW-v1.0` - Production-ready (target)

### **Software Versions:**
- `SW-v0.1` - Basic firmware
- `SW-v0.2` - Current development (AEC, VoIP)
- `SW-v1.0` - Production-ready (target)

### **Integration Versions:**
- `INT-v0.1` - Mock paging server
- `INT-v0.2` - Basic paging integration
- `INT-v1.0` - Production integration

---

## Quick Start Checklist

- [ ] Create OPAL project in Jira
- [ ] Set up project structure (epics, components, labels)
- [ ] Configure workflow states
- [ ] Create initial epics (7 main epics)
- [ ] Create issues from action items in daily status
- [ ] Set up filters and dashboards
- [ ] Invite team members with appropriate roles
- [ ] Create first sprint
- [ ] Set up automation rules
- [ ] Document Jira processes for team

---

## Integration with GitHub

### **Recommended Setup:**
- Link Jira project to GitHub repository
- Enable automatic issue linking in commit messages
- Use format: `OPAL-123: commit message`
- Set up webhooks for PR status updates

---

## Next Steps

1. **Review this plan** with project stakeholders
2. **Create the Jira project** using this structure
3. **Import initial issues** from the action items listed above
4. **Set up dashboards** for key stakeholders
5. **Train team** on Jira processes and workflows
6. **Begin Sprint 1** with prioritized issues

---

## Notes

- This structure is designed to be flexible and scalable
- Epics can be split or merged as needed
- Components and labels can be adjusted based on team needs
- Workflow states can be customized for hardware vs software work
- Regular reviews (bi-weekly) recommended to adjust structure

