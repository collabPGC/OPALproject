#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fix JIRA task status issue - check current statuses and available transitions
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
print("Checking JIRA Task Statuses")
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

# Tasks to check
task_keys = ['SCRUM-36', 'SCRUM-37', 'SCRUM-38', 'SCRUM-39']

print("\n" + "=" * 60)
print("Current Task Statuses")
print("=" * 60)
print()

for task_key in task_keys:
    try:
        issue = jira.issue(task_key)
        current_status = issue.fields.status.name
        status_id = issue.fields.status.id
        
        print(f"{task_key}: {issue.fields.summary}")
        print(f"  Current Status: {current_status} (ID: {status_id})")
        
        # Get available transitions
        transitions = jira.transitions(issue)
        print(f"  Available Transitions:")
        if transitions:
            for trans in transitions:
                trans_id = trans.get('id') if isinstance(trans, dict) else trans.id
                trans_name = trans.get('name') if isinstance(trans, dict) else trans.name
                to_status = trans.get('to', {}) if isinstance(trans, dict) else trans.to
                to_name = to_status.get('name') if isinstance(to_status, dict) else to_status.name
                print(f"    - {trans_name} → {to_name} (ID: {trans_id})")
        else:
            print("    (No transitions available)")
        
        print()
        
    except Exception as e:
        print(f"{task_key}: Error - {e}")
        print()

# Check what statuses exist in the project
print("=" * 60)
print("Project Statuses")
print("=" * 60)
print()

try:
    project = jira.project(PROJECT_KEY)
    print(f"Project: {project.key} - {project.name}")
    
    # Get issue types and their workflows
    print("\nChecking workflow statuses...")
    
    # Try to get all statuses
    statuses = jira.statuses()
    print(f"\nAvailable statuses in JIRA:")
    for status in statuses:
        print(f"  - {status.name} (ID: {status.id})")
        
except Exception as e:
    print(f"Could not get project statuses: {e}")

# Check if "Done" status exists and what the correct completion status is
print("\n" + "=" * 60)
print("Recommendation")
print("=" * 60)
print()

# Try to find a completion status
completion_statuses = ['Done', 'Completed', 'Resolved', 'Closed', 'Finished']

print("Checking for completion statuses...")
for task_key in ['SCRUM-36', 'SCRUM-37']:
    try:
        issue = jira.issue(task_key)
        transitions = jira.transitions(issue)
        
        print(f"\n{task_key} transitions:")
        for trans in transitions:
            trans_name = trans.get('name') if isinstance(trans, dict) else trans.name
            to_status = trans.get('to', {}) if isinstance(trans, dict) else trans.to
            to_name = to_status.get('name') if isinstance(to_status, dict) else to_status.name
            
            if any(comp in to_name for comp in completion_statuses):
                print(f"  ✓ Found completion transition: '{trans_name}' → '{to_name}'")
    except Exception as e:
        print(f"  Error checking {task_key}: {e}")

print("\n" + "=" * 60)
print("Action Plan")
print("=" * 60)
print()
print("If 'Done' status is causing 404 errors, we should:")
print("1. Check what the correct completion status is for your project")
print("2. Either transition to the correct status, or")
print("3. Revert to 'To Do' and add a comment that work is complete")
print()
print("Would you like me to:")
print("  A) Revert SCRUM-36 and SCRUM-37 to 'To Do' status")
print("  B) Try to find and use the correct completion status")
print("  C) Just add comments indicating work is complete (keep current status)")

