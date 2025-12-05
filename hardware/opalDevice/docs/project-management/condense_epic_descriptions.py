#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Condense epic descriptions to be lean and focused
Remove verbose sections, keep only essential information
"""

from jira import JIRA
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Fix Windows console encoding
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Load credentials from .env file
env_file = Path(__file__).parent / ".jira.env"
if not env_file.exists():
    print(f"Error: {env_file.name} not found.")
    sys.exit(1)

load_dotenv(env_file)

JIRA_SERVER = os.getenv("JIRA_SERVER", "https://pgconsulting.atlassian.net")
JIRA_EMAIL = os.getenv("JIRA_EMAIL", "hubert.williams@gmail.com")
JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN")
PROJECT_KEY = os.getenv("JIRA_PROJECT_KEY", "SCRUM")

if not JIRA_API_TOKEN:
    print("Error: JIRA_API_TOKEN not found in .jira.env")
    sys.exit(1)

# Connect to Jira
print("=" * 60)
print("Condensing Epic Descriptions")
print("=" * 60)
print(f"Project: {PROJECT_KEY}")
print()

try:
    jira = JIRA(server=JIRA_SERVER, basic_auth=(JIRA_EMAIL, JIRA_API_TOKEN))
    current_user = jira.current_user()
    print(f"✓ Connected as: {current_user}")
except Exception as e:
    print(f"✗ Failed to connect to Jira: {e}")
    sys.exit(1)

# Lean descriptions for each epic
lean_descriptions = {
    "SCRUM-27": """**Device Hardware Foundation** (CRITICAL - BLOCKING)

ESP32-C6 board provisioning, I2C fixes, audio debugging, PCB design.

**Constraints:**
- I2C pull-up resistors required (4.7kΩ on GPIO7/8)
- ES8311 CE pin hard-wired HIGH
- 3MB app partition required

**Dependencies:** None (foundation layer)""",

    "SCRUM-28": """**Firmware Core Services** (CRITICAL)

Audio pipeline, VoIP stack, device management, I2C drivers.

**Constraints:**
- AEC requires 16kHz sample rate
- ESP-ADF board abstraction required
- G.711 A-law codec (8kHz codec, 16kHz I2S)

**Dependencies:** Epic 1 (hardware must be stable)""",

    "SCRUM-29": """**Communication Infrastructure** (HIGH)

Device-to-backend APIs, paging integration, backend services.

**Constraints:**
- Paging protocol unknown (use mock first)
- MVP: Generate compatible outputs first

**Dependencies:** Epic 2 (firmware must support communication)""",

    "SCRUM-30": """**AI-Enhanced Communications** (HIGH)

Contextual Router (90%), Actionable Voice (85%), Universal Translator (75%), Clinical Oracle (65%), Sentiment Sentinel (50%).

**Constraints:**
- LLM infrastructure needed
- EMR APIs unknown (varies by hospital)

**Dependencies:** Epic 3 (communication infrastructure), LLM infrastructure""",

    "SCRUM-31": """**Backend Platform Services** (HIGH)

Authentication, security, notifications, monitoring, database.

**Constraints:**
- HIPAA/PHI compliance required
- Security infrastructure is critical path

**Dependencies:** Can be developed in parallel""",

    "SCRUM-32": """**Clinical Workflows** (MEDIUM - HIGH PRIORITY FOR DEMO)

Use case catalog, patient blood loss workflow (flagship demo), department workflows.

**Constraints:**
- Patient blood loss workflow is flagship demo
- Must support targeted and broadcast messaging

**Dependencies:** Epics 1-4 (all lower layers must be functional)""",

    "SCRUM-33": """**User Experience & Interface** (MEDIUM)

Mode switching UX (CRITICAL), device UI, voice interface, user testing.

**Constraints:**
- Mode switching UX is critical for workflows
- Depends on touch screen hardware (I2C fix)

**Dependencies:** Epic 1 (hardware), Epic 2 (firmware UI framework)""",

    "SCRUM-34": """**Demo & Pilot Programs** (MEDIUM)

Demo storyboard, dashboard visualization, video production, pilot programs.

**Dependencies:** Epics 1-7 (all layers must be functional)"""
}

# Update epics
print("\nUpdating epic descriptions...")
print()

updated_count = 0
failed_count = 0

for epic_key, lean_desc in lean_descriptions.items():
    try:
        issue = jira.issue(epic_key)
        old_length = len(issue.fields.description) if hasattr(issue.fields, 'description') and issue.fields.description else 0
        new_length = len(lean_desc)
        
        print(f"Updating {epic_key}: {issue.fields.summary}...", end=" ")
        print(f"({old_length} → {new_length} chars)", end=" ")
        
        issue.update(fields={'description': lean_desc})
        print("✓ Updated")
        updated_count += 1
    except Exception as e:
        print(f"✗ Failed: {e}")
        failed_count += 1

# Summary
print("\n" + "=" * 60)
print("Summary")
print("=" * 60)
print(f"Updated: {updated_count}")
print(f"Failed: {failed_count}")
print("\n✓ Epic descriptions condensed!")

