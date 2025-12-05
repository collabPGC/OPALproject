#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Improve Jira clarity without changing project key
- Add labels to issues
- Review and improve issue titles
- Add components
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
print("Improving Jira Clarity (SCRUM = OPAL Project)")
print("=" * 60)
print(f"Project: {PROJECT_KEY}")
print()

try:
    jira = JIRA(server=JIRA_SERVER, basic_auth=(JIRA_EMAIL, JIRA_API_TOKEN))
    current_user = jira.current_user()
    print(f"✓ Connected as: {current_user}")
    
    # Get project
    project = jira.project(PROJECT_KEY)
    print(f"✓ Project: {project.key} - {project.name}")
except Exception as e:
    print(f"✗ Failed to connect to Jira: {e}")
    sys.exit(1)

# Get all issues
print("\nFetching all issues...")
try:
    all_issues = jira.search_issues(f'project = {PROJECT_KEY}', maxResults=1000)
    print(f"✓ Found {len(all_issues)} issues")
except Exception as e:
    print(f"✗ Failed to fetch issues: {e}")
    sys.exit(1)

# Define labels by epic/issue type
epic_labels = {
    "SCRUM-27": ["opal", "hardware", "foundation"],  # Device Hardware Foundation
    "SCRUM-28": ["opal", "firmware", "core-services"],  # Firmware Core Services
    "SCRUM-29": ["opal", "backend", "communication", "integration"],  # Communication Infrastructure
    "SCRUM-30": ["opal", "ai", "llm", "intelligence"],  # AI-Enhanced Communications
    "SCRUM-31": ["opal", "backend", "infrastructure", "security"],  # Backend Platform Services
    "SCRUM-32": ["opal", "workflows", "clinical", "demo"],  # Clinical Workflows
    "SCRUM-33": ["opal", "ux", "ui", "interface"],  # User Experience & Interface
    "SCRUM-34": ["opal", "demo", "pilot", "business"],  # Demo & Pilot Programs
}

# Add labels to epics
print("\n" + "=" * 60)
print("Adding Labels to Epics")
print("=" * 60)

epics_updated = 0
for epic_key, labels in epic_labels.items():
    try:
        issue = jira.issue(epic_key)
        current_labels = issue.fields.labels if hasattr(issue.fields, 'labels') else []
        
        # Add new labels (avoid duplicates)
        new_labels = [l for l in labels if l not in current_labels]
        if new_labels:
            all_labels = list(current_labels) + new_labels
            issue.update(fields={'labels': all_labels})
            print(f"✓ {epic_key}: Added labels {new_labels}")
            epics_updated += 1
        else:
            print(f"  {epic_key}: Labels already present")
    except Exception as e:
        print(f"✗ {epic_key}: Failed - {e}")

# Add "opal" label to all other issues
print("\n" + "=" * 60)
print("Adding 'opal' Label to Other Issues")
print("=" * 60)

other_issues = [issue for issue in all_issues if issue.fields.issuetype.name != 'Epic']
other_updated = 0

for issue in other_issues:
    try:
        current_labels = issue.fields.labels if hasattr(issue.fields, 'labels') else []
        if 'opal' not in current_labels:
            all_labels = list(current_labels) + ['opal']
            issue.update(fields={'labels': all_labels})
            print(f"✓ {issue.key}: Added 'opal' label")
            other_updated += 1
    except Exception as e:
        print(f"✗ {issue.key}: Failed - {e}")

# Review issue titles for clarity
print("\n" + "=" * 60)
print("Reviewing Issue Titles for Clarity")
print("=" * 60)

title_improvements = []

# Check for vague titles
vague_patterns = [
    ("LYNA", "OPAL"),  # Update old "LYNA" references to "OPAL"
]

for issue in all_issues:
    title = issue.fields.summary
    issue_type = issue.fields.issuetype.name
    
    # Check for old "LYNA" references
    if "LYNA" in title.upper() and issue_type != 'Epic':
        new_title = title.replace("LYNA", "OPAL").replace("Lyna", "OPAL").replace("lyna", "OPAL")
        title_improvements.append((issue.key, title, new_title))

if title_improvements:
    print(f"\nFound {len(title_improvements)} issues with 'LYNA' that should be 'OPAL':")
    for key, old, new in title_improvements:
        print(f"\n  {key}:")
        print(f"    Old: {old}")
        print(f"    New: {new}")
    
    print("\nUpdating titles...")
    updated_titles = 0
    for key, old, new in title_improvements:
        try:
            issue = jira.issue(key)
            issue.update(fields={'summary': new})
            print(f"✓ {key}: Updated title")
            updated_titles += 1
        except Exception as e:
            print(f"✗ {key}: Failed - {e}")
    
    print(f"\n✓ Updated {updated_titles} issue titles")
else:
    print("✓ All issue titles look good")

# Summary
print("\n" + "=" * 60)
print("Summary")
print("=" * 60)
print(f"Epics updated with labels: {epics_updated}")
print(f"Other issues updated with 'opal' label: {other_updated}")
print(f"Issue titles updated: {len(title_improvements)}")
print("\n✓ Clarity improvements complete!")
print(f"\nNote: Project name should be updated manually in Jira to:")
print(f"  'OPAL Clinical Communications Device'")
print(f"\nView project at: {JIRA_SERVER}/browse/{PROJECT_KEY}")

