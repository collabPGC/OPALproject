# Proposal Summary: Edge Micropayments to Opal

This document is a proposal from **Edge Micropayments, Inc.** to **Opal** for the design and development of a nurse-worn medical assistant integrated with their EMPIC platform. The project is divided into two phases:

**Phase 1: MVP (Minimum Viable Product)**
*   **Goal:** Create a functional wearable assistant with LLM integration for policy Q&A and language translation.
*   **Scope:**
    *   **Wearable Client (Opal):** A lapel device or companion app with features like push-to-talk and secure audio streaming.
    *   **Device Gateway (Provider-side):** A low-latency pipeline for ASR, LLM, and TTS.
    *   **Policy Q&A and Translation:** An LLM tuned on the Mount Sinai policy corpus.
*   **Deliverables:** A wearable client application, an edge gateway service, data connectors, a security and compliance checklist, and a pilot runbook.
*   **Phase 1 Commitment:**
    *   **Team:** 2 contributors.
    *   **Effort:** 96 hours (80 for engineering, 16 for consulting).
    *   **Duration:** Approximately 4 weeks.

**Phase 2: EMPIC Payment Integration**
*   **Objective:** To commercialize the MVP by integrating an escrow-backed service for automated settlement and financial reporting.
*   **Implementation:** This phase involves implementing the EMPIC SDK on both the wearable (consumer) and the gateway (provider), as well as integrating with Stripe for treasury operations.

**IP & Ownership:**
*   **Opal** will own the wearable hardware design, firmware, and client UX.
*   **Edge Micropayments** will own the EMPIC platform, SDKs, and related tooling.
*   Ownership of the server-side integration software is to be determined.
