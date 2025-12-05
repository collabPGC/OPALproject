#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Add ESP32-C6 Board Provisioning Issue to Jira
Creates a single comprehensive issue for all board provisioning work
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
    print(f"Error: {env_file.name} not found. Please run jira-setup-secure.py first.")
    sys.exit(1)

load_dotenv(env_file)

JIRA_SERVER = os.getenv("JIRA_SERVER", "https://pgconsulting.atlassian.net")
JIRA_EMAIL = os.getenv("JIRA_EMAIL", "hubert.williams@gmail.com")
JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN")
PROJECT_KEY = os.getenv("JIRA_PROJECT_KEY", "SCRUM")  # Default to SCRUM (OPAL Project)

if not JIRA_API_TOKEN:
    print("Error: JIRA_API_TOKEN not found in .jira.env")
    sys.exit(1)

# Connect to Jira
print("Connecting to Jira...")
try:
    jira = JIRA(server=JIRA_SERVER, basic_auth=(JIRA_EMAIL, JIRA_API_TOKEN))
    current_user = jira.current_user()
    print(f"✓ Connected as: {current_user}")
except Exception as e:
    print(f"✗ Failed to connect to Jira: {e}")
    sys.exit(1)

# Issue details
issue_summary = "Provision ESP32-C6 OPAL Board"
issue_description = """This issue encompasses all work required to provision and validate the ESP32-C6 OPAL board hardware and firmware.

## Hardware Tasks
- [ ] Add I2C pull-up resistors (4.7kΩ on SDA/SCL)
- [ ] Verify I2C communication with ES8311 codec
- [ ] Verify I2C communication with touch screen (CST816S)
- [ ] Verify I2C communication with RTC
- [ ] Verify I2C communication with IMU

## Audio System
- [ ] Debug and fix audio output (currently only brief click)
- [ ] Verify continuous audio playback
- [ ] Test audio recording pipeline
- [ ] Validate AEC (Acoustic Echo Cancellation) functionality
- [ ] Test full-duplex audio

## Device Integration
- [ ] Test touch screen functionality
- [ ] Test RTC functionality
- [ ] Test IMU functionality
- [ ] Verify all GPIO pin configurations

## VoIP Integration
- [ ] Integrate VoIP service into project
- [ ] Test SIP registration
- [ ] Test RTP audio transmission
- [ ] Test full-duplex VoIP calls

## System Validation
- [ ] End-to-end audio pipeline test
- [ ] Full system integration test
- [ ] Performance validation
- [ ] Documentation update

## Notes
- Hardware soldering work will be done manually
- All software components are ready (ESP-ADF board config, AEC project, VoIP service)
- Testing can proceed once I2C hardware is fixed
"""

# Try to find Hardware Development epic
epic_key = None
try:
    # Search for epics in the project
    epics = jira.search_issues(
        f'project = {PROJECT_KEY} AND issuetype = Epic AND summary ~ "Hardware Development"',
        maxResults=1
    )
    if epics:
        epic_key = epics[0].key
        print(f"✓ Found Hardware Development epic: {epic_key}")
except Exception as e:
    print(f"Note: Could not find Hardware Development epic: {e}")

# Verify project exists
print(f"\nVerifying project {PROJECT_KEY}...")
try:
    project = jira.project(PROJECT_KEY)
    print(f"✓ Found project: {project.key} - {project.name}")
except Exception as e:
    print(f"✗ Project {PROJECT_KEY} not found: {e}")
    print("\nAvailable projects:")
    try:
        projects = jira.projects()
        for proj in projects:
            print(f"  - {proj.key}: {proj.name}")
    except Exception as e2:
        print(f"Could not list projects: {e2}")
    print(f"\nPlease set JIRA_PROJECT_KEY in .jira.env or use an existing project key")
    sys.exit(1)

# Create the issue
print(f"\nCreating issue in project {PROJECT_KEY}...")
try:
    issue_dict = {
        'project': {'key': PROJECT_KEY},
        'summary': issue_summary,
        'description': issue_description,
        'issuetype': {'name': 'Task'},  # Try Task first
    }
    
    # Note: Epic linking will need to be done manually in Jira UI
    # as the custom field ID varies by project configuration
    
    issue = jira.create_issue(fields=issue_dict)
    print(f"✓ Created issue: {issue.key}")
    print(f"  Summary: {issue_summary}")
    print(f"\nView issue at:")
    print(f"{JIRA_SERVER}/browse/{issue.key}")
    
except Exception as e:
    # Try as Story if Task doesn't work
    print(f"Failed to create as Task: {e}")
    print("Trying as Story...")
    try:
        issue_dict = {
            'project': {'key': PROJECT_KEY},
            'summary': issue_summary,
            'description': issue_description,
            'issuetype': {'name': 'Story'},
        }
        issue = jira.create_issue(fields=issue_dict)
        print(f"✓ Created issue: {issue.key}")
        print(f"  Summary: {issue_summary}")
        print(f"\nView issue at:")
        print(f"{JIRA_SERVER}/browse/{issue.key}")
    except Exception as e2:
        print(f"✗ Failed to create issue: {e2}")
        print("\nTroubleshooting:")
        print("1. Verify project key is correct")
        print("2. Check that you have permission to create issues")
        print("3. Verify issue types are available in the project")
        sys.exit(1)

print("\n✓ Issue created successfully!")

