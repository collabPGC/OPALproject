# Contributing to the OPAL Project

First off, thank you for considering contributing to the OPAL project! Your help is greatly appreciated.

This document provides guidelines for setting up your development environment and contributing to the project.

## Table of Contents
1. [Code of Conduct](#code-of-conduct)
2. [Setting Up Your Development Environment](#setting-up-your-development-environment)
   - [Prerequisites](#prerequisites)
   - [Repository Forking & Cloning](#repository-forking--cloning)
   - [Dependency Installation](#dependency-installation)
3. [Coding Standards](#coding-standards)
4. [Commit Message Guidelines](#commit-message-guidelines)
5. [Submitting Pull Requests](#submitting-pull-requests)

## Code of Conduct
This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. A `CODE_OF_CONDUCT.md` file will be added shortly.

## Setting Up Your Development Environment

### Prerequisites
You will need the following tools installed on your system:

- **Python**: Version 3.11 or higher.
- **Node.js**: Version 20.x or higher.
- **pnpm**: As the preferred Node.js package manager. You can install it via `npm install -g pnpm`.
- **Git**: For version control.

### Repository Forking & Cloning
1.  **Fork the repository**: Click the "Fork" button on the top right of the repository page.
2.  **Clone your fork**:
    ```bash
    git clone https://github.com/YOUR_USERNAME/OPALproject.git
    cd OPALproject
    ```
3.  **Add the upstream remote**:
    ```bash
    git remote add upstream https://github.com/Edge-Micropayments-Inc/OPALproject.git
    ```

### Dependency Installation

The project is divided into several components. You'll need to install dependencies for each service you are working on.

#### Gateway Service (Python/FastAPI)
The gateway service uses Python. We recommend using a virtual environment.

```bash
# Navigate to the gateway service directory
cd software/gateway-service

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies (once pyproject.toml or requirements.txt is created)
# pip install -r requirements.txt
```

#### Wearable Client (Node.js/React)
The wearable client is a Node.js application.

```bash
# Navigate to the wearable client directory
cd software/wearable-client

# Install dependencies using pnpm
pnpm install
```

### Recommended IDE/Editor Setup
We recommend using **Visual Studio Code** with the following extensions for a consistent development experience:

- **Python** (by Microsoft)
- **Ruff** (by Astral Software)
- **ESLint** (by Microsoft)
- **Prettier - Code formatter** (by Prettier)
- **EditorConfig for VS Code** (by EditorConfig)

## Coding Standards
Please ensure your code adheres to the standards defined in the `/standards` directory. Our CI pipeline will check for compliance.

- **Python**: Google Python Style Guide, formatted with `black` and linted with `ruff`.
- **TypeScript/JavaScript**: TSDoc for documentation, formatted with `Prettier` and linted with `ESLint`.
- **C++**: Doxygen documentation, C++26 Contracts on all public APIs (see below).

### C++26 Contracts (Firmware Development)

All C++ code in the firmware must use C++26 contracts to express functional correctness assumptions. This is a **required skill** for all firmware developers.

#### When to Use Contracts

✅ **Use contracts for:**
- **API Preconditions**: Pointer validity, parameter ranges, buffer sizes
- **Hardware Constraints**: Sample rates, GPIO pins, timing requirements
- **Protocol State**: Registration state, connection validity, session state
- **Algorithm Invariants**: Array bounds, state machine states

❌ **Do NOT use contracts for:**
- **External Input Validation**: Sensor readings, network packets, user input
- **Recoverable Runtime Errors**: File I/O failures, network timeouts
- **Side Effects**: Logging, telemetry, hardware I/O operations

#### Contract Best Practices

**1. No Side Effects in Predicates**
```cpp
// ❌ BAD: Side effects
pre: log_call() && validate()

// ✅ GOOD: Pure predicate
pre: value >= 0 && value < MAX
```

**2. Use Short-Circuit Evaluation**
```cpp
// ❌ DANGER: Split conditions
pre: p != nullptr
pre: p->is_valid()  // Could crash!

// ✅ SAFE: Single compound condition
pre: p != nullptr && p->is_valid()
```

**3. Express Hardware Constraints**
```cpp
// ✅ Document firmware requirements
void aec_init(uint32_t sample_rate)
    pre: sample_rate == 16000  // AEC only works at 16kHz
{ ... }
```

#### Quick Reference

See `/docs/development/contracts-quick-reference.md` for detailed guidance.

**Slash Commands:**
- `/add-contract` - Add contracts to a function
- `/review-contracts` - Review contract usage in current file

**Required Skills:**
- Distinguish programming bugs from runtime errors
- Write side-effect-free predicates
- Configure contract build modes
- Integrate contracts with Doxygen documentation

## Commit Message Guidelines
We follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification. This helps in automating changelog generation and makes the commit history more readable.

Example: `feat(gateway): add session creation endpoint`

## Submitting Pull Requests
1.  Keep your fork's `develop` branch up to date with the upstream `develop` branch.
2.  Create a new feature branch from your `develop` branch (e.g., `git checkout -b feat/T-109-gateway-pyproject`).
3.  Make your changes and commit them with a descriptive message.
4.  Push your feature branch to your fork.
5.  Open a pull request from your feature branch to the upstream `develop` branch.
6.  Ensure all CI checks are passing.
7.  A project maintainer will review your PR.

---
Thank you for your contribution!
