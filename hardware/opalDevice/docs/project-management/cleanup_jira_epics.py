#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Clean up Jira epics - keep only refined architecture epics
Delete old epics from original organization plan
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
print("Cleaning Up Jira Epics")
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

# Old epics to delete (from original organization plan)
# Keep only the refined architecture epics (SCRUM-27 through SCRUM-34)
old_epics_to_delete = [
    "SCRUM-5",   # Hardware Development (old)
    "SCRUM-6",   # Paging System Integration (old)
    "SCRUM-7",   # AI-Enhanced Communications (old - duplicate)
    "SCRUM-8",   # Use Cases & Clinical Workflows (old)
    "SCRUM-9",   # Demo & Pilot Programs (old - duplicate)
    "SCRUM-10",  # Security & Infrastructure (old)
    "SCRUM-11",  # User Experience & Interface (old - duplicate)
]

# Refined architecture epics to keep
keep_epics = [
    "SCRUM-27",  # Device Hardware Foundation
    "SCRUM-28",  # Firmware Core Services
    "SCRUM-29",  # Communication Infrastructure
    "SCRUM-30",  # AI-Enhanced Communications
    "SCRUM-31",  # Backend Platform Services
    "SCRUM-32",  # Clinical Workflows
    "SCRUM-33",  # User Experience & Interface
    "SCRUM-34",  # Demo & Pilot Programs
]

print(f"\nEpics to DELETE (old organization plan): {len(old_epics_to_delete)}")
print(f"Epics to KEEP (refined architecture): {len(keep_epics)}")
print()

# Confirm deletion
print("Epics to be deleted:")
for epic_key in old_epics_to_delete:
    try:
        issue = jira.issue(epic_key)
        print(f"  - {epic_key}: {issue.fields.summary}")
    except:
        print(f"  - {epic_key}: (not found)")

print("\nEpics to be kept:")
for epic_key in keep_epics:
    try:
        issue = jira.issue(epic_key)
        print(f"  - {epic_key}: {issue.fields.summary}")
    except:
        print(f"  - {epic_key}: (not found)")

print("\n" + "=" * 60)
print("Deleting old epics...")
print("=" * 60)

deleted_count = 0
failed_count = 0

for epic_key in old_epics_to_delete:
    try:
        issue = jira.issue(epic_key)
        summary = issue.fields.summary
        print(f"Deleting {epic_key}: {summary}...", end=" ")
        
        issue.delete()
        print("✓ Deleted")
        deleted_count += 1
    except Exception as e:
        error_msg = str(e)
        if "not found" in error_msg.lower() or "does not exist" in error_msg.lower():
            print("⚠ Not found (may already be deleted)")
        else:
            print(f"✗ Failed: {e}")
            failed_count += 1

# Summary
print("\n" + "=" * 60)
print("Cleanup Summary")
print("=" * 60)
print(f"Deleted: {deleted_count}")
print(f"Failed: {failed_count}")
print(f"\nRemaining epics (refined architecture):")
for epic_key in keep_epics:
    try:
        issue = jira.issue(epic_key)
        print(f"  ✓ {epic_key}: {issue.fields.summary}")
    except:
        print(f"  ✗ {epic_key}: (not found)")

print("\n✓ Cleanup complete!")
print(f"\nView your project at: {JIRA_SERVER}/browse/{PROJECT_KEY}")

