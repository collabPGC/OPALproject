# Jira Quick Reference - OPAL Project

**Project Key:** `SCRUM`  
**Project Name:** OPAL Clinical Communications Device  
**Issue Format:** `SCRUM-##`

---

## Important Note

**SCRUM = OPAL Project**

The project key "SCRUM" refers to the **OPAL Clinical Communications Device** project. This is a legacy naming convention - the actual product is OPAL, not a generic Scrum methodology project.

When you see `SCRUM-27`, `SCRUM-28`, etc., these are **OPAL device development issues**.

---

## Current Epics (8 Total)

| Epic Key | Title | Labels |
|----------|-------|--------|
| SCRUM-27 | Device Hardware Foundation | `opal`, `hardware`, `foundation` |
| SCRUM-28 | Firmware Core Services | `opal`, `firmware`, `core-services` |
| SCRUM-29 | Communication Infrastructure | `opal`, `backend`, `communication`, `integration` |
| SCRUM-30 | AI-Enhanced Communications | `opal`, `ai`, `llm`, `intelligence` |
| SCRUM-31 | Backend Platform Services | `opal`, `backend`, `infrastructure`, `security` |
| SCRUM-32 | Clinical Workflows | `opal`, `workflows`, `clinical`, `demo` |
| SCRUM-33 | User Experience & Interface | `opal`, `ux`, `ui`, `interface` |
| SCRUM-34 | Demo & Pilot Programs | `opal`, `demo`, `pilot`, `business` |

---

## Labels

All issues are labeled with `opal` to make them easily searchable and filterable.

**Common Labels:**
- `opal` - All OPAL project issues
- `hardware` - Hardware-related work
- `firmware` - Firmware/software work
- `backend` - Backend services
- `ai` / `llm` - AI/LLM features
- `clinical` - Clinical workflows
- `demo` - Demo-related work
- `ux` / `ui` - User experience/interface

**Filter by label:** `label = opal` in Jira search

---

## Naming Conventions

### Epics
- Pattern: `[Area] [Outcome]`
- Example: `Device Hardware Foundation`

### Stories
- Pattern: `[User] can [action] [outcome]`
- Example: `Nurse can switch between targeted and broadcast messaging modes`

### Tasks
- Pattern: `[Action] [Object] [Details]`
- Example: `Add I2C pull-up resistors to GPIO7/8`

### Bugs
- Pattern: `[Component] [Issue] [Context]`
- Example: `Audio codec fails when I2C pull-ups missing`

See `jira-naming-conventions.md` for full details.

---

## Quick Links

- **Project Board:** https://pgconsulting.atlassian.net/browse/SCRUM
- **All OPAL Issues:** `project = SCRUM AND labels = opal`
- **Hardware Issues:** `project = SCRUM AND labels = opal AND labels = hardware`
- **Firmware Issues:** `project = SCRUM AND labels = opal AND labels = firmware`

---

## Search Tips

**Find all OPAL issues:**
```
project = SCRUM AND labels = opal
```

**Find hardware work:**
```
project = SCRUM AND labels = opal AND labels = hardware
```

**Find AI/LLM features:**
```
project = SCRUM AND labels = opal AND labels = ai
```

**Find demo-related work:**
```
project = SCRUM AND labels = opal AND labels = demo
```

---

## Project Context

**What is OPAL?**
- Clinical communications device
- ESP32-C6 based hardware
- AI-enhanced communications
- Designed to displace Vocera in hospital environments

**Why "SCRUM" as project key?**
- Legacy naming convention
- Project was initially set up with "SCRUM" as the key
- Changing project keys is disruptive
- All issues are labeled with `opal` for clarity

**Future Consideration:**
- May migrate to `OPAL-##` format in the future
- For now, `SCRUM-##` with `opal` labels works well

---

**Last Updated:** 2025-11-19

