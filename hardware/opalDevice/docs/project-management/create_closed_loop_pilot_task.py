#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Create Closed Loop Pilot task based on strategy recommendation
This is the recommended pilot (Sample A) from the strategy document
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
print("Creating Closed Loop Pilot Task")
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

# Task details
task_summary = "Implement Closed Loop Pilot (Cardiology/Cath Lab) - Sample A"
task_description = """**Closed Loop Pilot - Recommended (Sample A)**

**Strategic Rationale:**
Clinical speed is the currency of the hospital. If Opal creates a "Fast Lane" that Vocera cannot match because it lacks the AI integration to trigger multiple events from one command, you win the contract.

**The Test:** Speed to Treatment

**Vocera Workflow:**
- Nurse calls Doctor
- Doctor answers
- Nurse explains STEMI
- Doctor hangs up
- Doctor calls Cath Lab team
- Doctor hangs up
- Doctor calls Operator for bed

**Opal Workflow:**
- Nurse says "Code STEMI, Room 4"
- Opal's AI immediately:
  - Blasts the entire on-call STEMI team
  - Opens a dedicated voice channel for them
  - Drafts the "Code Start Time" in the EMR
  - Alerts the Cath Lab to warm up the table

**The Win:**
- 10 minutes shaved off "Door-to-Balloon" time
- Vocera looks dangerously slow
- Demonstrates AI integration advantage Vocera cannot match

**Strategic Positioning:**
- Vocera = "Dumb Radio" (moves audio A→B)
- Opal = "Intelligent Node" (analyzes, understands, executes)

**Key Features Required:**
- Single command triggers multiple coordinated actions
- AI integration for team coordination
- EMR integration for code start time
- Cath Lab alert system
- Measurable time savings

**Success Metrics:**
- Door-to-Balloon time reduction (target: 10 minutes)
- Single command execution (vs. multiple sequential calls)
- Team coordination effectiveness

**Epic:** Demo & Pilot Programs (SCRUM-34)
**Priority:** High (recommended pilot)
**Labels:** `opal`, `demo`, `pilot`, `clinical`, `ai`
"""

# Find the Demo & Pilot Programs epic
epic_key = "SCRUM-34"
try:
    epic = jira.issue(epic_key)
    print(f"✓ Found epic: {epic.key} - {epic.fields.summary}")
except Exception as e:
    print(f"✗ Epic {epic_key} not found: {e}")
    sys.exit(1)

# Create the task
print(f"\nCreating task...")
try:
    issue_dict = {
        'project': {'key': PROJECT_KEY},
        'summary': task_summary,
        'description': task_description,
        'issuetype': {'name': 'Task'},
        'labels': ['opal', 'demo', 'pilot', 'clinical', 'ai'],
    }
    
    # Note: Epic linking will need to be done manually in Jira UI
    # as the custom field ID varies by project configuration
    
    issue = jira.create_issue(fields=issue_dict)
    print(f"✓ Created task: {issue.key}")
    print(f"  Summary: {task_summary}")
    print(f"\nView task at:")
    print(f"{JIRA_SERVER}/browse/{issue.key}")
    
except Exception as e:
    print(f"✗ Failed to create task: {e}")
    sys.exit(1)

print("\n✓ Closed Loop Pilot task created successfully!")
print("\nThis task represents the recommended pilot from the strategy document.")
print("It demonstrates Opal's AI integration advantage over Vocera.")

