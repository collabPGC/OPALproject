#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Add initial comments to simulator enhancement tasks
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
print("Adding Comments to Simulator Enhancement Tasks")
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

# Task comments
task_comments = [
    {
        'key': 'SCRUM-40',
        'comment': """**Task Created - Ready for Backlog**

This task captures Phase 1 of simulator enhancements based on Vocera analysis.

**Key Requirements:**
- Role-based communication ("Call Charge Nurse")
- Group-based communication ("Broadcast to Code Blue Team")
- User/Group data models
- Call Control panel UI
- Enhanced visualization

**Status:** Ready to start when dashboard base (SCRUM-39) is complete.

**Related Documentation:**
- Vocera analysis insights
- Simulator enhancement proposal
- Dashboard UI implementation (SCRUM-39)"""
    },
    {
        'key': 'SCRUM-41',
        'comment': """**Task Created - Ready for Backlog**

This task captures Phase 2 of simulator enhancements - the advanced features.

**Key Requirements:**
- Intelligent routing ("Genie") - maps names/roles to devices
- Emergency/panic call system
- Priority call management
- Targeted broadcasts
- Visual panic indicators

**Status:** Depends on SCRUM-40 (Phase 1) completion.

**Clinical Value:**
Transforms simulator from passive visualizer to interactive tool demonstrating life-saving workflows that compete directly with Vocera.

**Related Documentation:**
- Vocera analysis insights
- Simulator enhancement proposal
- Role-Based Communication System (SCRUM-40)"""
    }
]

print("\n" + "=" * 60)
print("Adding Comments")
print("=" * 60)
print()

added_count = 0
failed_count = 0

for task_comment in task_comments:
    try:
        issue = jira.issue(task_comment['key'])
        print(f"Adding comment to {task_comment['key']}: {issue.fields.summary}...", end=" ")
        
        jira.add_comment(issue, task_comment['comment'])
        print("✓ Comment added")
        added_count += 1
        
    except Exception as e:
        print(f"✗ Failed: {e}")
        failed_count += 1

# Summary
print("\n" + "=" * 60)
print("Summary")
print("=" * 60)
print(f"Comments added: {added_count}")
print(f"Failed: {failed_count}")

print("\n✓ Comments added to simulator enhancement tasks!")

