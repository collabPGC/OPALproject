#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Delete duplicate OPAL architecture epics
Removes SCRUM-21 through SCRUM-26 (duplicates from first run)
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
print("Deleting Duplicate OPAL Architecture Epics")
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

# Epics to delete (duplicates from first run)
duplicate_epics = [
    "SCRUM-21",  # Communication Infrastructure (duplicate)
    "SCRUM-22",  # AI-Enhanced Communications (duplicate)
    "SCRUM-23",  # Backend Platform Services (duplicate)
    "SCRUM-24",  # Clinical Workflows (duplicate)
    "SCRUM-25",  # User Experience & Interface (duplicate)
    "SCRUM-26",  # Demo & Pilot Programs (duplicate)
]

print("\nDeleting duplicate epics...")
print()

deleted_count = 0
failed_count = 0

for epic_key in duplicate_epics:
    try:
        issue = jira.issue(epic_key)
        summary = issue.fields.summary
        print(f"Deleting {epic_key}: {summary}...", end=" ")
        
        issue.delete()
        print("✓ Deleted")
        deleted_count += 1
    except Exception as e:
        print(f"✗ Failed: {e}")
        failed_count += 1

# Summary
print("\n" + "=" * 60)
print("Summary")
print("=" * 60)
print(f"Deleted: {deleted_count}")
print(f"Failed: {failed_count}")
print(f"\nRemaining epics (SCRUM-27 through SCRUM-34) are the correct ones.")
print("\n✓ Cleanup complete!")

