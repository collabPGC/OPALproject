# OPAL Project - Jira Management

This directory contains scripts and documentation for managing the OPAL project in Jira.

---

## Project Information

**Jira Project Key:** `SCRUM`  
**Project Name:** OPAL Clinical Communications Device  
**Issue Format:** `SCRUM-##`

**Important:** The project key "SCRUM" refers to the **OPAL Clinical Communications Device** project. All issues are labeled with `opal` for clarity.

---

## Quick Start

### View Project
- **Jira Board:** https://pgconsulting.atlassian.net/browse/SCRUM
- **All OPAL Issues:** Search for `project = SCRUM AND labels = opal`

### Current Epics
- SCRUM-27: Device Hardware Foundation
- SCRUM-28: Firmware Core Services
- SCRUM-29: Communication Infrastructure
- SCRUM-30: AI-Enhanced Communications
- SCRUM-31: Backend Platform Services
- SCRUM-32: Clinical Workflows
- SCRUM-33: User Experience & Interface
- SCRUM-34: Demo & Pilot Programs

---

## Documentation

### Naming & Conventions
- **[JIRA_QUICK_REFERENCE.md](JIRA_QUICK_REFERENCE.md)** - Quick reference guide
- **[jira-naming-conventions.md](jira-naming-conventions.md)** - Naming best practices
- **[jira-project-key-analysis.md](jira-project-key-analysis.md)** - Project key analysis

### Setup & Organization
- **[jira-organization-plan.md](jira-organization-plan.md)** - Original organization plan
- **[SECURE_SETUP.md](SECURE_SETUP.md)** - Secure credential setup

---

## Scripts

### Setup Scripts
- **`jira-setup-secure.py`** - Secure Jira project setup (creates epics, components, issues)
- **`create_architecture_epics.py`** - Create architecture-based epics
- **`add_provisioning_issue.py`** - Add board provisioning issue

### Maintenance Scripts
- **`audit_jira_entries.py`** - Audit entries for duplicates and verbosity
- **`cleanup_jira_epics.py`** - Clean up duplicate epics
- **`condense_epic_descriptions.py`** - Condense verbose descriptions
- **`improve_jira_clarity.py`** - Add labels and improve clarity
- **`delete_issue.py`** - Delete a specific issue
- **`delete_duplicate_epics.py`** - Delete duplicate epics

---

## Usage

### Setup Credentials
1. Create `.jira.env` file (see `SECURE_SETUP.md`)
2. Add your Jira API token and organization ID

### Run Scripts
```bash
cd docs/project-management
python <script_name>.py
```

### Common Tasks

**Audit Jira entries:**
```bash
python audit_jira_entries.py
```

**Add labels to issues:**
```bash
python improve_jira_clarity.py
```

**Create new epic:**
```bash
python create_architecture_epics.py
```

---

## Labels

All issues are labeled with `opal` for easy filtering. Additional labels:
- `hardware`, `firmware`, `backend`, `ai`, `llm`, `clinical`, `demo`, `ux`, `ui`

**Filter:** `project = SCRUM AND labels = opal`

---

## Best Practices

1. **Use clear, action-oriented titles**
2. **Add `opal` label to all new issues**
3. **Follow naming conventions** (see `jira-naming-conventions.md`)
4. **Keep descriptions lean and focused**
5. **Link related issues**

---

## Architecture

The project is organized into 8 architecture-based epics:
1. Device Hardware Foundation
2. Firmware Core Services
3. Communication Infrastructure
4. AI-Enhanced Communications
5. Backend Platform Services
6. Clinical Workflows
7. User Experience & Interface
8. Demo & Pilot Programs

See `../architecture/opal-system-architecture-epics.md` for details.

---

**Last Updated:** 2025-11-19

