#!/usr/bin/env python3
"""
Update SCRUM-42 to link to epic and mark as Done.
"""

from jira import JIRA
import sys
import os
from pathlib import Path

# Jira Configuration
JIRA_SERVER = "https://pgconsulting.atlassian.net"
ISSUE_KEY = "SCRUM-42"
EPIC_KEY = "SCRUM-27"

def get_credentials():
    """Load credentials from .env file"""
    env_file = Path(__file__).parent / ".jira.env"

    if not env_file.exists():
        print(f"Error: {env_file.name} not found")
        sys.exit(1)

    try:
        from dotenv import load_dotenv
        load_dotenv(env_file)
        token = os.getenv("JIRA_API_TOKEN")
        email = os.getenv("JIRA_EMAIL")

        if not token or not email:
            print("Error: JIRA_API_TOKEN or JIRA_EMAIL not found")
            sys.exit(1)

        return email, token
    except Exception as e:
        print(f"Error loading credentials: {e}")
        sys.exit(1)

def update_issue():
    """Update SCRUM-42"""

    email, token = get_credentials()

    print(f"Connecting to {JIRA_SERVER}...")
    try:
        jira = JIRA(server=JIRA_SERVER, basic_auth=(email, token))
        print("[OK] Connected")
    except Exception as e:
        print(f"[ERROR] Connection failed: {e}")
        sys.exit(1)

    print(f"\nUpdating {ISSUE_KEY}...")
    try:
        issue = jira.issue(ISSUE_KEY)

        # Link to epic
        print(f"Linking to epic {EPIC_KEY}...")
        try:
            issue.update(fields={'parent': {'key': EPIC_KEY}})
            print(f"[OK] Linked to epic")
        except Exception as e:
            print(f"[WARN] Could not link: {e}")

        # Transition to Done
        print("Transitioning to Done...")
        transitions = jira.transitions(issue)

        done_transition_id = None
        for transition in transitions:
            print(f"  Available: {transition['name']}")
            if transition['name'].lower() in ['done', 'complete', 'closed']:
                done_transition_id = transition['id']

        if done_transition_id:
            jira.transition_issue(issue, done_transition_id)
            print(f"[OK] Transitioned to Done")
        else:
            print("[WARN] Could not find Done transition")

        print(f"\n[SUCCESS] View at: {JIRA_SERVER}/browse/{ISSUE_KEY}")

    except Exception as e:
        print(f"[ERROR] {e}")
        sys.exit(1)

if __name__ == "__main__":
    update_issue()
