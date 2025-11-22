# Week 1 Task Breakdown: Setup & Initial Design

This document provides a detailed decomposition of the high-level milestones for the first week of the OPAL project MVP development.

---

## 1. Project Setup & Environment Configuration

**Goal:** Establish a robust foundation for development, collaboration, and automated quality checks.

### Tasks:

- **Git Repository Setup:**
  - `T-101`: Define and apply branch protection rules for `main` and `develop` branches (e.g., require PR reviews, passing status checks).
  - `T-102`: Create a comprehensive `.gitignore` file tailored for Python, Node.js, and common OS files.
  - `T-103`: Implement an `.editorconfig` file to enforce consistent coding styles (indentation, line endings) across different IDEs.

- **Developer Environment:**
  - `T-104`: Create a `CONTRIBUTING.md` file with detailed instructions for setting up a local development environment, including:
    - Required SDKs (Python 3.x, Node.js, etc.).
    - Package managers (`pip`, `pnpm`).
    - IDE/editor recommendations and required extensions.
    - Steps to install dependencies and run the applications.

- **CI/CD Pipeline (GitHub Actions):**
  - `T-105`: Implement a basic CI workflow (`.github/workflows/ci.yml`) that triggers on push/PR to the `develop` branch.
  - `T-106`: The CI workflow should include jobs for:
    - Linting the Python code (`ruff`, `black`).
    - Linting the TypeScript/JS code (e.g., `eslint`).
    - Running unit tests (once they are created).

- **Project Management:**
  - `T-107`: Set up a GitHub Project board with the columns: `Backlog`, `To Do`, `In Progress`, `In Review`, `Done`.
  - `T-108`: Populate the `Backlog` with the epics and high-level features defined in the Phase 1 plan.

- **Code Scaffolding:**
  - `T-109`: Initialize the `gateway-service` with a `pyproject.toml` file, specifying dependencies like `fastapi`, `uvicorn`, and `pydantic`.
  - `T-110`: Initialize the `wearable-client` with a `package.json` file, specifying a frontend framework (e.g., React/Next.js) and dependencies.

---

## 2. Detailed Design: Wearable Client & Gateway Service

**Goal:** Define the technical architecture, APIs, and user experience for the core components of the MVP.

### Wearable Client (Opal)

- **User Story:**
  - `US-101`: As a Nurse, I want a minimalist, hands-free interface on my wearable device so that I can interact with the assistant quickly and without distraction from my primary duties.

- **Tasks:**
  - `T-201`: **Component Architecture:** Create a document (`software/wearable-client/DESIGN.md`) outlining the frontend architecture (e.g., state management approach, component hierarchy, data flow).
  - `T-202`: **UX/UI Wireframes:** Design simple wireframes for the core user states:
    - `Idle`: Waiting for activation.
    - `Listening`: Capturing the user's voice command.
    - `Processing`: Indicating that the request is being handled.
    - `Responding`: Displaying the transcribed question and the LLM's answer.
  - `T-203`: **Communication Protocol:** Decide on and document the real-time communication protocol between the client and gateway (e.g., WebSocket for low-latency, bi-directional communication).
  - `T-204`: **Client-Side Data Models:** Define the TypeScript interfaces for data structures the client will manage (e.g., `Conversation`, `Message`, `UserState`).

### Gateway Service

- **User Story:**
  - `US-102`: As a Frontend Developer, I need a clearly defined and stable API contract for the gateway service so that I can develop the wearable client application in parallel and with confidence.

- **Tasks:**
  - `T-205`: **API Specification:** Create an OpenAPI 3.0 (Swagger) specification (`software/gateway-service/openapi.yml`).
  - `T-206`: Define the initial set of endpoints in the OpenAPI spec, including:
    - `POST /api/v1/session`: To initiate a new user session.
    - `WS /api/v1/stream`: The main WebSocket endpoint for real-time ASR/LLM/TTS interaction.
  - `T-207`: **Service Architecture:** Create a diagram (`software/gateway-service/ARCHITECTURE.md`) illustrating the components of the gateway and its interactions with external services (ASR, LLM, TTS, Data Connectors).
  - `T-208`: **API Data Models:** Define the Pydantic models for all API request and response payloads to ensure data validation and serialization.

---

## 3. Security & Compliance Requirements

**Goal:** Ensure all aspects of the system are designed with HIPAA and data privacy as a primary consideration.

- **User Story:**
  - `US-103`: As a Hospital Compliance Officer, I must be able to verify that all patient-related data is encrypted, access is strictly controlled, and all interactions are auditable to ensure we meet our legal and ethical obligations under HIPAA.

- **Tasks:**
  - `T-301`: **Security Checklist Document:** Create the initial `SECURITY_CHECKLIST.md` document.
  - `T-302`: **Data Handling Policy:** Define and document a strict policy for how Protected Health Information (PHI) is identified, handled, and de-identified. **Rule #1: Do not store raw audio or PHI unless absolutely necessary and encrypted.**
  - `T-303`: **Authentication & Authorization:** Design the authentication flow. For the MVP, this might be a simple API key or token-based system for the device. Document this in the security checklist.
  - `T-304`: **Encryption:** Mandate TLS 1.3 for all communication (HTTPS, WSS). Specify requirements for encryption at rest for any sensitive data that must be stored.
  - `T-305`: **Logging & Auditing:** Define what events must be logged for security auditing (e.g., session creation, failed auth, errors) and what must *not* be logged (e.g., PHI).
  - `T-306`: **Data Retention Policy:** Define the lifecycle for any stored data, including automated deletion schedules. For the MVP, the default policy should be to retain as little as possible for as short a time as possible.
