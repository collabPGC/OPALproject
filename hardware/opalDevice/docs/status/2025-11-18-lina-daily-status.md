# Daily Status Update – Lina Clinical Messaging & Paging Integration

**Date:** 2025-11-18  
**Project:** Lina Clinical Communications / OPAL  
**Meeting Duration Covered:** 00:04 – 18:00

---

## 1. System Compatibility & Messaging Integration (00:04 – 05:21)

**Goal:**  
Enable Lina to interoperate with existing hospital paging infrastructure (wired/wireless, potentially dial-up–based), without replacing it.

**Key Points:**

- Need to identify the *exact* external paging system currently used by hospitals:
  - Vendor / product name.
  - Protocol (wired, wireless, dial-up, etc.).
  - Expected message format and transport mechanism.

- Once identified, Lina must:
  - **Determine required message formats** (field structure, encoding, length limits, acknowledgement behavior).
  - **Replicate those formats** inside Lina.
  - **Initiate communication** to the external system from Lina (outbound messaging).
  - **Support mock/simulated external system**:
    - Simulate a hospital paging system.
    - Demonstrate message flow end-to-end (e.g., "doctor pager receives message").

- Demo emphasis:
  - Same technical pipeline, different **content** per department:
    - Emergency Room workflows.
    - Pharmacy dosage calls.
    - MedSurg floor communications.
    - Admissions-related messages.
  - Methodology is consistent; payloads + language differ by stakeholder.

---

## 2. Scenario Focus – Patient Blood Loss Workflow (02:40 – 07:41)

**Chosen flagship demo scenario:** patient experiencing blood loss.

**Why this scenario:**

- Naturally involves:
  - Clear **procedures** and escalation paths.
  - **Time-bound** behaviors (how long staff remain in room, when to escalate).
  - Multi-role communications (nurse, charge nurse, physician, etc.).

**Messaging requirements:**

- **Private / targeted messaging:**
  - E.g., discreet vibrating alert on a nurse's uniform/device.
  - Used for one-to-one or tightly scoped notifications.

- **Broadcast messaging:**
  - E.g., "all nurses on this unit," "charge nurse group," or "rapid response team."
  - Used for urgent, multi-person coordination.

- Device UX requirement:
  - Ability to **switch between modes** (targeted vs broadcast).
  - Clear UI affordances so users know *who* is being messaged.

**Notable insight:**
- Allowing stakeholders to "talk it out" in conversation surfaces detailed requirements that might be missed in written specs. Transcripts are being treated as raw requirements material.

---

## 3. Development Approach – Use Cases & Data Format Compatibility (04:07 – 07:41)

**Use case capture strategy:**

- Record clinical conversations and:
  - Extract **department-specific use cases**.
  - Identify **procedure bundles**:
    - Low-risk, low-error, standard protocols.
    - Labor-intensive, repetitive, automatable tasks.
    - Frequent notification patterns (to avoid duplicate requests).

**Core functional requirements:**

- Request lifecycle:
  - Track statuses such as **pending**, **waiting**, **completed**, etc.
  - Support both **broadcast** and **targeted** notifications.

- External paging integration philosophy:
  - Lina **does not control** the hospital paging infrastructure.
  - Instead, Lina must:
    - Understand **how external systems receive information**.
    - Output **compatible data formats** to the right endpoints (APIs, modems, serial ports, etc.).
  - **MVP requirement:**
    - Generate *plausibly valid* outputs that look like what the hospital systems already expect, even before full integration.

**Unique device / staff identifiers:**

- Lina devices and users must be addressable and recognizable in hospital IT systems.

| ID Type       | Description                                             |
|---------------|---------------------------------------------------------|
| Phone number  | Unique number per device/end-point for paging/callback. |
| Nurse ID code | Combination of nurse number + code to identify staff.   |

- These identifiers enable two-way workflows (e.g., doctor calls back and system can route/contextualize).

---

## 4. Demo Strategy & Dashboard Visualization (07:41 – 10:35)

**Demo scope:**

- Keep to a **small, curated set of use cases**, across a few departments.
- Example demo flow:
  1. Brief problem statement + high-level solution overview.
  2. Live or recorded **device demo** showing:
     - Sending/receiving messages.
     - Private vs broadcast alerts.
     - Basic workflow for a critical scenario (e.g., blood loss).
  3. **Dashboard visualization**:
     - Shows real-time message flow.
     - Displays devices sending instructions (e.g., device → front desk nurse).
     - Shows message contents, routing, logs/transcripts.

- **Video element:**
  - Professionally produced sequence of the Opal team acting out real-life scenarios.
  - To be shown near the end to tie the workflow together in a narrative way.

**Design note:**
- Audience attention will mostly be on **people and devices**, not backend tech.
- The dashboard acts as **supporting evidence**, not the star of the show.

---

## 5. Team Composition & Hardware Expertise (10:35 – 14:46)

**Key team members noted:**

- **Huber and Alex**:
  - Part of the **hardware development** core.
  - Access to lab equipment:
    - Breadboards, oscilloscopes, multimeters.
    - Soldering irons and general electronics gear.
    - Parts and prototyping materials.

**Skills:**

- Alex:
  - Experience in **PCB design** using **Altium**.
  - Has designed two-layer PCBs, including:
    - Pinout planning.
    - Board layout and routing.

- Others:
  - Less PCB experience but comfortable with basic hardware prototyping and debugging.

**Takeaway:**
- Hardware is a **core strength** of the team.
- Supports Lina as a **physical clinical device**, not just software.

---

## 6. Project Coordination & Collaboration Tooling (14:46 – 17:36)

**Tools:**

- **GitHub**
  - Central repo for firmware, backend, and docs.
  - Version control, issues, PRs.

- **Jira**
  - Task and issue tracking.
  - Sprint planning and backlog management.

**Planned activities:**

- Invite new contributors to:
  - GitHub repository.
  - Jira project board.
- Encourage contributions across the skill spectrum (firmware, backend, UI, clinical workflows).

**Near-term technical tasks:**

- Connect Lina/Opal backend to a **Large Language Model (LLM)** for:
  - Advanced processing and/or workflow generation (details tbd).
- Enable **Multi-Factor Authentication (MFA)**.
- Set up **email endpoints**:
  - For notifications (invites, alerts, status updates).
- Establish secure infrastructure for:
  - Authentication.
  - Messaging.
  - Ops/monitoring.

---

## 7. Closing & Next Steps (17:36 – 18:00)

- Call concluded with:
  - Thanks and confirmations.
  - Agreement to continue collaboration and follow-up.
- Expectation to:
  - Review progress on integration & infra tasks.
  - Iterate on use cases and demo content in upcoming sessions.

---

## Summary of Key Insights

| Topic               | Description                                                                                   |
|---------------------|-----------------------------------------------------------------------------------------------|
| System Integration  | Identify external paging tech; replicate message formats; ensure Lina can speak that dialect.|
| Use Cases           | ER, pharmacy, MedSurg, admissions – common pipeline, different content and roles.            |
| Messaging Modes     | Support **private/targeted** and **broadcast** alerts with clear mode switching.             |
| Data Compatibility  | Ensure outputs look like valid hospital paging data; support unique device/staff IDs.        |
| MVP Strategy        | Generate compatible outputs first; full integration can follow once trust is built.          |
| Demo Plan           | Limited use cases, live interactions, dashboard + video storytelling.                        |
| Hardware Strength   | Team has strong lab + PCB capabilities, which underpins device reliability.                  |
| Collaboration       | GitHub + Jira as the backbone; open participation model.                                     |
| Security & Infra    | LLM integration, MFA, and email endpoints are near-term infrastructure priorities.           |

---

## Open Questions / Risks

1. **Exact paging system specs unknown**
   - Vendor, protocol, and message format not yet fully identified.
   - Risk: demo may rely on assumptions rather than production-accurate formats.

2. **Identifier assignment & mapping**
   - Need a consistent scheme for phone numbers and nurse IDs that fit hospital IT constraints.
   - Risk: misalignment with existing identity/directory systems.

3. **LLM use clarity**
   - LLM role (recommendations, workflow generation, triage, etc.) still undefined.
   - Risk: scope creep or misaligned expectations if not clarified early.

4. **Security & compliance**
   - MFA and email notifications are early steps, but:
     - Broader HIPAA / PHI considerations will need explicit design.

---

## Action Items

**System & Integration**

- [ ] Identify the exact paging system(s) and vendors used in target hospitals.  
  - **Owner:** TBD (likely Huber / integrations lead)  
  - **Due:** Next discovery cycle.

- [ ] Obtain or reverse-engineer the **message format specification** for the paging system.  
  - **Owner:** Integrations engineer  
  - **Output:** Draft "Paging Message Format Spec v0.1".

- [ ] Design Lina-side module to **generate and send messages** in the required format.  
  - **Owner:** Backend/Firmware team  
  - **Output:** API + data model doc.

- [ ] Build a **mock paging server** to simulate hospital behavior for demos.  
  - **Owner:** Backend engineer  
  - **Output:** `mock-pager-service` with simple admin UI/logs.

---

**Use Cases & Content**

- [ ] Transcribe and tag existing conversations to build a **use case catalog** by department.  
  - **Owner:** Product / Clinical workflows lead.

- [ ] Define the **patient blood loss workflow** in a structured format (steps, roles, triggers, messages).  
  - **Owner:** Product + clinical SME.

- [ ] Select 2–3 additional departmental scenarios (e.g., pharmacy dosage confirmation, admissions notification).  
  - **Owner:** Product.

---

**Demo & UX**

- [ ] Specify **demo storyboard** (intro → live demo → dashboard → video).  
  - **Owner:** Product / Demo lead.

- [ ] Define UX for **mode switching** (targeted vs broadcast messaging) on the device UI.  
  - **Owner:** UX + firmware.

- [ ] Implement basic **dashboard** that visualizes message flow and device status.  
  - **Owner:** Frontend engineer.

- [ ] Plan & script the **video scenario** with Opal team acting out workflows.  
  - **Owner:** Marketing / Product.

---

**Hardware**

- [ ] Document current hardware stack (boards, revisions, known limitations).  
  - **Owner:** Huber / Alex.

- [ ] Outline roadmap for first **production-capable PCB revision** (layer count, I/O, power budget, audio, radio paths).  
  - **Owner:** Alex.

---

**Collaboration & Infra**

- [ ] Add all team members to the **GitHub repo** with appropriate permissions.  
  - **Owner:** Repo admin.

- [ ] Create/organize **Jira board** with epics: "Paging Integration," "Use Case Library," "Demo/UX," "Hardware," "Security & Infra."  
  - **Owner:** Project manager / product.

- [ ] Stand up **MFA** and **email notification** infrastructure for Opal/Lina services.  
  - **Owner:** DevOps / infra.

- [ ] Draft initial **LLM integration proposal** (goals, constraints, data boundaries).  
  - **Owner:** AI/ML lead.

---
