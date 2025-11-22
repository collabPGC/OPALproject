# Secure Jira Setup Instructions

**Jira Instance:** https://pgconsulting.atlassian.net  
**Email:** hubert.williams@gmail.com

---

## Security Features

✅ **API token input is hidden** (using getpass)  
✅ **Credentials never displayed** in console  
✅ **Optional .env file** (excluded from git)  
✅ **No credentials in code** or repository

---

## Quick Start

### Step 1: Install Dependencies

```bash
pip install jira python-dotenv
```

### Step 2: Get Your API Token

1. Go to: **https://id.atlassian.com/manage-profile/security/api-tokens**
2. Click **"Create API token"**
3. Name it: "OPAL Project Setup"
4. **Copy the token** (you'll only see it once!)

### Step 3: Run the Secure Script

```bash
cd hardware/opalDevice/docs/project-management
python jira-setup-secure.py
```

### Step 4: Follow Prompts

- The script will ask for your API token (input is hidden)
- You can choose to save it to `.jira.env` for future use
- The `.jira.env` file is automatically excluded from git

---

## What Gets Created

- **7 Epics** (Hardware, Paging, AI, Workflows, Demo, Infra, UX)
- **13 Components** (Firmware, Audio, I2C, PCB, Backend, LLM, etc.)
- **8 Initial Issues** (from action items in daily status)

---

## Security Notes

- ✅ `.jira.env` file is in `.gitignore` - **never committed**
- ✅ API token is only stored locally if you choose to save it
- ✅ Token input is hidden (no echo)
- ✅ Script uses secure authentication

---

## Troubleshooting

### "Permission denied"
- You need project creation permissions
- Or use existing SCRUM project

### "API token invalid"
- Make sure you copied the entire token
- Tokens are one-time view - create a new one if needed

### "Epic type not found"
- Script will try to create as Story instead
- Or enable Epic issue type in project settings

---

## Manual Alternative

If you prefer not to use the script, you can manually create the structure using:
- **Organization Plan:** `jira-organization-plan.md`
- **Setup Guide:** `jira-setup-guide.md`

