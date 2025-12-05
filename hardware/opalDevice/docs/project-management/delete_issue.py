#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Delete a Jira issue
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

# Delete OCVC-1
issue_key = "OCVC-1"
print(f"\nDeleting issue {issue_key}...")
try:
    issue = jira.issue(issue_key)
    print(f"Found issue: {issue.key} - {issue.fields.summary}")
    
    # Delete the issue
    issue.delete()
    print(f"✓ Successfully deleted {issue_key}")
except Exception as e:
    print(f"✗ Failed to delete {issue_key}: {e}")
    sys.exit(1)

print("\n✓ Done!")

