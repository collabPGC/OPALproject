#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Update UX/UI task statuses and link to epics
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
print("Updating UX/UI Task Statuses")
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

# Task status updates
task_updates = [
    {
        'key': 'SCRUM-36',
        'summary': 'Design System & UX Documentation',
        'status': 'Done',  # Documentation is complete
        'comment': 'Design system, wireframes, interaction flows, and screen designs documentation completed. Design tokens JSON created.'
    },
    {
        'key': 'SCRUM-37',
        'summary': 'Interactive Prototypes & Visual Mockups',
        'status': 'Done',  # Prototypes are complete
        'comment': 'HTML/CSS mockups and interactive prototype completed. Ready for user testing.'
    },
    {
        'key': 'SCRUM-38',
        'summary': 'Device UI Implementation (LVGL)',
        'status': 'To Do',  # Implementation needed
        'comment': 'LVGL theme structure created. Ready for implementation on hardware.'
    },
    {
        'key': 'SCRUM-39',
        'summary': 'Dashboard UI Implementation (React)',
        'status': 'To Do',  # Implementation needed
        'comment': 'React dashboard structure created. Ready for implementation.'
    }
]

print("\n" + "=" * 60)
print("Updating Task Statuses")
print("=" * 60)
print()

updated_count = 0
failed_count = 0

for task_update in task_updates:
    try:
        issue = jira.issue(task_update['key'])
        current_status = issue.fields.status.name
        target_status = task_update['status']
        
        print(f"Updating {task_update['key']}: {task_update['summary']}")
        print(f"  Current status: {current_status}")
        print(f"  Target status: {target_status}")
        
        # Add comment
        if 'comment' in task_update:
            jira.add_comment(issue, task_update['comment'])
            print(f"  ✓ Added comment")
        
        # Transition status if needed
        if current_status != target_status:
            # Get available transitions
            transitions = jira.transitions(issue)
            transition_id = None
            
            for transition in transitions:
                # Handle both dict and object formats
                to_status = transition.get('to', {}) if isinstance(transition, dict) else transition.to
                status_name = to_status.get('name') if isinstance(to_status, dict) else to_status.name
                
                if status_name == target_status:
                    transition_id = transition.get('id') if isinstance(transition, dict) else transition.id
                    break
            
            if transition_id:
                jira.transition_issue(issue, transition_id)
                print(f"  ✓ Status updated to: {target_status}")
            else:
                print(f"  ⚠ Cannot transition to '{target_status}' (transition not available)")
                # Show available transitions
                available = []
                for t in transitions:
                    to_status = t.get('to', {}) if isinstance(t, dict) else t.to
                    status_name = to_status.get('name') if isinstance(to_status, dict) else to_status.name
                    available.append(status_name)
                print(f"    Available transitions: {available}")
                print(f"    Note: You may need to transition manually in Jira UI")
        else:
            print(f"  → Status already {target_status}")
        
        updated_count += 1
        print()
        
    except Exception as e:
        print(f"  ✗ Failed: {e}")
        failed_count += 1
        print()

# Summary
print("=" * 60)
print("Summary")
print("=" * 60)
print(f"Updated: {updated_count} tasks")
print(f"Failed: {failed_count} tasks")

# Show current status of all tasks
print("\n" + "=" * 60)
print("Current Task Status")
print("=" * 60)

for task_update in task_updates:
    try:
        issue = jira.issue(task_update['key'])
        print(f"{issue.key}: {issue.fields.summary}")
        print(f"  Status: {issue.fields.status.name}")
        print(f"  View at: {JIRA_SERVER}/browse/{issue.key}")
        print()
    except Exception as e:
        print(f"{task_update['key']}: Error - {e}")
        print()

print("✓ Task statuses updated!")

