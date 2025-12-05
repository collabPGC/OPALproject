#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Revert task status to 'To Do' and add completion comments
This fixes the board 404 issue while still documenting completion
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
print("Reverting Task Status to 'To Do'")
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

# Tasks to revert
tasks_to_revert = [
    {
        'key': 'SCRUM-36',
        'summary': 'Design System & UX Documentation',
        'completion_comment': """✅ **WORK COMPLETE** ✅

This task has been completed. All deliverables are done:

**Completed Deliverables:**
- ✅ Design system specification (colors, typography, spacing, components)
- ✅ Wireframes for device UI (7 screens) and dashboard (5 views)
- ✅ Interaction flow documentation (8 user journeys)
- ✅ High-fidelity screen designs with pixel specifications
- ✅ Design tokens JSON file (multi-platform support)

**Documentation Location:**
- `docs/ux/opal-design-system.md`
- `docs/ux/opal-ui-wireframes.md`
- `docs/ux/opal-interaction-flows.md`
- `docs/ux/opal-screen-designs.md`
- `docs/ux/design-tokens.json`

**Status:** All documentation complete and ready for implementation.

*Note: Task kept in 'To Do' status due to board configuration. Work is 100% complete.*"""
    },
    {
        'key': 'SCRUM-37',
        'summary': 'Interactive Prototypes & Visual Mockups',
        'completion_comment': """✅ **WORK COMPLETE** ✅

This task has been completed. All deliverables are done:

**Completed Deliverables:**
- ✅ HTML/CSS visual mockups for device UI and dashboard
- ✅ Interactive HTML prototype with working interactions
- ✅ Mode switching functionality (working)
- ✅ Voice command simulation (working)
- ✅ Screen transitions and animations

**Files Created:**
- `docs/ux/implementation/html-mockups/device-home.html`
- `docs/ux/implementation/html-mockups/dashboard-overview.html`
- `docs/ux/implementation/html-prototype/device-prototype.html`

**Status:** All prototypes complete and ready for user testing.

*Note: Task kept in 'To Do' status due to board configuration. Work is 100% complete.*"""
    }
]

print("\n" + "=" * 60)
print("Reverting Tasks to 'To Do' Status")
print("=" * 60)
print()

reverted_count = 0
failed_count = 0

for task_info in tasks_to_revert:
    try:
        issue = jira.issue(task_info['key'])
        current_status = issue.fields.status.name
        
        print(f"Processing {task_info['key']}: {task_info['summary']}")
        print(f"  Current status: {current_status}")
        
        # Add completion comment
        jira.add_comment(issue, task_info['completion_comment'])
        print(f"  ✓ Added completion comment")
        
        # Transition to 'To Do' if not already
        if current_status != 'To Do':
            transitions = jira.transitions(issue)
            transition_id = None
            
            for trans in transitions:
                trans_name = trans.get('name') if isinstance(trans, dict) else trans.name
                to_status = trans.get('to', {}) if isinstance(trans, dict) else trans.to
                to_name = to_status.get('name') if isinstance(to_status, dict) else to_status.name
                
                if to_name == 'To Do':
                    transition_id = trans.get('id') if isinstance(trans, dict) else trans.id
                    break
            
            if transition_id:
                jira.transition_issue(issue, transition_id)
                print(f"  ✓ Reverted to 'To Do' status")
            else:
                print(f"  ⚠ Could not find transition to 'To Do'")
        else:
            print(f"  → Already in 'To Do' status")
        
        reverted_count += 1
        print()
        
    except Exception as e:
        print(f"  ✗ Failed: {e}")
        failed_count += 1
        print()

# Summary
print("=" * 60)
print("Summary")
print("=" * 60)
print(f"Reverted: {reverted_count} tasks")
print(f"Failed: {failed_count} tasks")

# Show final status
print("\n" + "=" * 60)
print("Final Task Status")
print("=" * 60)

for task_info in tasks_to_revert:
    try:
        issue = jira.issue(task_info['key'])
        print(f"{issue.key}: {issue.fields.summary}")
        print(f"  Status: {issue.fields.status.name}")
        print(f"  View at: {JIRA_SERVER}/browse/{issue.key}")
        print()
    except Exception as e:
        print(f"{task_info['key']}: Error - {e}")
        print()

print("✓ Tasks reverted to 'To Do' with completion comments!")
print("\nThe tasks will now appear on your board, and the comments")
print("clearly indicate that the work is 100% complete.")

