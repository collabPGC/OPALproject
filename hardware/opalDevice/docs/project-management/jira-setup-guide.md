# Jira Setup Guide - OPAL Project

**Jira Instance:** https://pgconsulting.atlassian.net  
**Project Key:** OPAL (or SCRUM if using existing project)

---

## Quick Start

### Option 1: Automated Setup (Recommended)

1. **Install Python Jira library:**
   ```bash
   pip install jira
   ```

2. **Get your API token:**
   - Go to: https://id.atlassian.com/manage-profile/security/api-tokens
   - Click "Create API token"
   - Copy the token (you'll need it for the script)

3. **Run the setup script:**
   ```bash
   cd docs/project-management
   python jira-setup-script.py
   ```

4. **Follow the prompts:**
   - Enter your Jira email
   - Paste your API token
   - Confirm project key (default: OPAL)

### Option 2: Manual Setup

Follow the structure in `jira-organization-plan.md` to manually create:
- Epics
- Components
- Initial issues
- Labels
- Workflows

---

## API Token Setup

1. **Visit:** https://id.atlassian.com/manage-profile/security/api-tokens
2. **Click:** "Create API token"
3. **Name it:** "OPAL Project Setup" (or similar)
4. **Copy the token** - you'll only see it once!

**Important:** Keep your API token secure. Don't commit it to git.

---

## Using Existing SCRUM Project

If you want to use the existing SCRUM project instead of creating OPAL:

1. Update the script: Change `PROJECT_KEY = "SCRUM"`
2. Or manually add epics/issues to the SCRUM project
3. Use the existing board at: https://pgconsulting.atlassian.net/jira/software/projects/SCRUM/boards/1

---

## Manual Setup Steps

### 1. Create Epics

Go to your project → Create Issue → Epic

Create these 7 epics:
- **OPAL-HW**: Hardware Development
- **OPAL-PAGING**: Paging System Integration
- **OPAL-AI**: AI-Enhanced Communications
- **OPAL-WORKFLOWS**: Use Cases & Clinical Workflows
- **OPAL-DEMO**: Demo & Pilot Programs
- **OPAL-INFRA**: Security & Infrastructure
- **OPAL-UX**: User Experience & Interface

### 2. Create Components

Go to Project Settings → Components

Add components:
- ESP32-C6-Firmware
- Audio-System
- I2C-Devices
- PCB-Design
- Backend-API
- LLM-Integration
- Voice-Processing
- EMR-Integration
- Authentication
- Security
- ER-Workflows
- Pharmacy
- MedSurg

### 3. Create Labels

Go to Project Settings → Labels (or use existing labels)

Add labels:
- `priority-critical`, `priority-high`, `priority-medium`, `priority-low`
- `hardware`, `firmware`, `backend`, `ai-ml`, `integration`, `security`, `ui-ux`
- `emergency-room`, `pharmacy`, `medsurg`, `admissions`, `psychiatry`
- `contextual-router`, `actionable-voice`, `universal-translator`, `clinical-oracle`, `sentiment-sentinel`

### 4. Create Initial Issues

Use the action items from `jira-organization-plan.md` to create initial issues.

---

## Troubleshooting

### "Project already exists"
- Either use the existing project or choose a different project key

### "Permission denied"
- You need project admin permissions to create projects/epics
- Contact your Jira administrator

### "API token invalid"
- Make sure you copied the entire token
- Tokens are one-time view - if lost, create a new one

### "Epic field not found"
- Make sure your project has Epic issue type enabled
- Check project template (Scrum software development template includes epics)

---

## Next Steps After Setup

1. **Review created epics and issues**
2. **Assign owners** to issues
3. **Set priorities** and due dates
4. **Create first sprint**
5. **Set up dashboards** (see jira-organization-plan.md)
6. **Invite team members** to the project

---

## References

- **Jira API Documentation:** https://developer.atlassian.com/cloud/jira/platform/rest/v3/
- **Python Jira Library:** https://jira.readthedocs.io/
- **Organization Plan:** See `jira-organization-plan.md`

