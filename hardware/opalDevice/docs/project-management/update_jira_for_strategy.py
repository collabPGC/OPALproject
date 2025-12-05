#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Update Jira work items based on strategy document updates
- Update Demo & Pilot Programs epic with Closed Loop recommendation
- Add strategic positioning context where relevant
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
print("Updating Jira Based on Strategy Document")
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

# Update Demo & Pilot Programs epic (SCRUM-34) with Closed Loop recommendation
print("\n" + "=" * 60)
print("Updating Demo & Pilot Programs Epic")
print("=" * 60)

epic_key = "SCRUM-34"
try:
    epic = jira.issue(epic_key)
    print(f"Found epic: {epic.key} - {epic.fields.summary}")
    
    # Updated description with Closed Loop recommendation
    updated_description = """**Demo & Pilot Programs** (MEDIUM)

Demo storyboard, dashboard visualization, video production, pilot programs.

**Strategic Positioning:**
- Vocera = "Dumb Radio" (moves audio A→B)
- Opal = "Intelligent Node" (analyzes, understands, executes)

**Recommended Pilot: Closed Loop (Cardiology/Cath Lab)**
- Clinical speed is the currency of the hospital
- Single command triggers multiple coordinated actions
- 10 minutes shaved off "Door-to-Balloon" time
- Demonstrates AI integration advantage Vocera cannot match

**Dependencies:** Epics 1-7 (all layers must be functional)"""
    
    epic.update(fields={'description': updated_description})
    print(f"✓ Updated {epic_key} with Closed Loop recommendation")
    
except Exception as e:
    print(f"✗ Failed to update {epic_key}: {e}")

# Check if we need to create a specific task for Closed Loop pilot
print("\n" + "=" * 60)
print("Checking for Closed Loop Pilot Task")
print("=" * 60)

try:
    # Search for existing Closed Loop tasks
    existing = jira.search_issues(
        f'project = {PROJECT_KEY} AND summary ~ "Closed Loop" OR summary ~ "STEMI"',
        maxResults=5
    )
    
    if existing:
        print(f"Found {len(existing)} existing issue(s) related to Closed Loop:")
        for issue in existing:
            print(f"  - {issue.key}: {issue.fields.summary}")
    else:
        print("No existing Closed Loop pilot task found")
        print("\nConsider creating a task:")
        print("  'Implement Closed Loop Pilot (Cardiology/Cath Lab) - Sample A'")
        print("  Epic: SCRUM-34 (Demo & Pilot Programs)")
        print("  Priority: High (recommended pilot)")
        
except Exception as e:
    print(f"Note: Could not search for existing issues: {e}")

# Update AI-Enhanced Communications epic with strategic positioning
print("\n" + "=" * 60)
print("Updating AI-Enhanced Communications Epic")
print("=" * 60)

ai_epic_key = "SCRUM-30"
try:
    epic = jira.issue(ai_epic_key)
    print(f"Found epic: {epic.key} - {epic.fields.summary}")
    
    # Add strategic positioning note
    current_desc = epic.fields.description if hasattr(epic.fields, 'description') and epic.fields.description else ""
    
    if "Strategic Positioning" not in current_desc:
        updated_description = current_desc + "\n\n**Strategic Positioning:**\n- Opal = Intelligent Node (analyzes, understands, executes)\n- Vocera = Dumb Radio (moves audio A→B)"
        epic.update(fields={'description': updated_description})
        print(f"✓ Added strategic positioning to {ai_epic_key}")
    else:
        print(f"  {ai_epic_key} already has strategic positioning")
        
except Exception as e:
    print(f"✗ Failed to update {ai_epic_key}: {e}")

# Summary
print("\n" + "=" * 60)
print("Summary")
print("=" * 60)
print("\nStrategy document implications for Jira:")
print("  1. ✓ Updated Demo & Pilot Programs epic with Closed Loop recommendation")
print("  2. ✓ Added strategic positioning to AI epic")
print("  3. ⚠ Consider creating specific Closed Loop pilot task (if not exists)")
print("\nStrategic positioning now reflected in:")
print("  - Epic descriptions")
print("  - Pilot recommendation clearly stated")
print("\n✓ Jira updated to reflect strategy!")

