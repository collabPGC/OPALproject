#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Create JIRA tasks for simulator enhancements
Role-based communication, intelligent routing, emergency calls
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
print("Creating Simulator Enhancement Tasks")
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

# Find relevant epics
demo_epic_key = "SCRUM-34"  # Demo & Pilot Programs
comm_epic_key = "SCRUM-29"  # Communication Infrastructure
ux_epic_key = "SCRUM-33"    # User Experience & Interface

try:
    demo_epic = jira.issue(demo_epic_key)
    print(f"✓ Found Demo epic: {demo_epic.key} - {demo_epic.fields.summary}")
    comm_epic = jira.issue(comm_epic_key)
    print(f"✓ Found Communication epic: {comm_epic.key} - {comm_epic.fields.summary}")
    ux_epic = jira.issue(ux_epic_key)
    print(f"✓ Found UX epic: {ux_epic.key} - {ux_epic.fields.summary}")
except Exception as e:
    print(f"✗ Epic not found: {e}")
    sys.exit(1)

# Task definitions - Appropriately scoped
tasks = [
    {
        'summary': 'Role-Based & Group Communication System (Phase 1)',
        'description': """**Role-Based & Group Communication System (Phase 1)**

Implement foundational role-based and group communication system for OPAL simulator/dashboard.

**Core Concept:**
Clinicians don't always know specific person names or devices. They need to contact:
- **Roles**: "Call the charge nurse for the ICU"
- **Groups**: "Broadcast to the Code Blue Team"
- **Specific People**: "Call Dr. Smith"

**Scope:**

**Data Model Extension:**
- User model: `{id, name, role}` (e.g., "Dr. Adams, Cardiologist")
- Group model: `{name, members[]}` (e.g., "ICU Nurses", "Code Blue Team")
- Device-User association: Simulate "logging in" by associating User with Device
- Device becomes: "Room 101 (used by Dr. Adams, Cardiologist)" instead of just "Room 101"

**Backend/Server:**
- User management system
- Group management system
- Device-User association tracking
- Role-based lookup service
- Group membership management

**Simulator/Dashboard UI:**
- "Call Control" panel:
  - Select Initiator: Choose any online user/device
  - Select Target (key feature):
    - Specific person (e.g., "Dr. Smith")
    - Role (e.g., "Charge Nurse") - System finds correct person/device
    - Group (e.g., "ICU Nurses") - For broadcasting
  - Action buttons: "Place Call" and "Broadcast Message"
- Visual updates:
  - Network Participants list shows User and Role, not just device name
  - Hover over device shows both device and logged-in user info
  - Visual distinction between role-based and direct calls

**Deliverables:**
- User and Group data models
- Backend services for role/group management
- Call Control panel UI
- Enhanced network visualization
- Role-based call routing (basic)

**Epic:** Demo & Pilot Programs (SCRUM-34) - Simulator enhancement
**Labels:** `opal`, `simulator`, `dashboard`, `communication`, `backend`, `ui`
**Priority:** High
**Dependencies:** 
- Dashboard UI Implementation (SCRUM-39) - Base dashboard must exist
- Communication Infrastructure (Epic 3) - Basic communication must work

**Success Criteria:**
- Can make calls by role (e.g., "Call Charge Nurse")
- Can make calls by group (e.g., "Broadcast to ICU Nurses")
- Can make calls to specific people
- UI clearly shows user roles and groups
- Simulator demonstrates role-based routing""",
        'epic': demo_epic_key,
        'labels': ['opal', 'simulator', 'dashboard', 'communication', 'backend', 'ui'],
        'priority': 'High'
    },
    {
        'summary': 'Intelligent Routing & Emergency Call System (Phase 2)',
        'description': """**Intelligent Routing & Emergency Call System (Phase 2)**

Implement "Genie" intelligent routing system and emergency/panic call functionality.

**Core Concept:**
The "Genie" is the intelligent dispatcher that maps roles and names to physical devices. When a user says "Call Dr. Smith," the system knows who Dr. Smith is, finds their currently active device, and routes the call.

**Scope:**

**Intelligent Routing ("Genie"):**
- Name-to-device mapping service
- Role-to-person mapping service
- Active device lookup (finds currently active device for a user)
- Smart routing logic:
  - "Call Dr. Smith" → Finds Dr. Smith's active device → Routes call
  - "Call Charge Nurse" → Finds charge nurse role → Finds active device → Routes call
  - Handles multiple devices per user (routes to active one)
- Routing decision logging (for visualization)

**Emergency/Panic Call System:**
- New event type: "Panic Call" (highest priority)
- Pre-defined emergency groups (e.g., "Rapid Response Team")
- Panic call behavior:
  - Instant connection to emergency group
  - Automatic hold/termination of non-critical calls involving team members
  - Override capability for critical situations
- Priority system:
  - Panic/Emergency (highest)
  - Urgent
  - Normal
  - Low

**Targeted Broadcasts:**
- Enhanced broadcast system (currently random)
- Targeted broadcasts:
  - "Broadcast to Emergency Department"
  - "Broadcast to all available nurses"
  - "Broadcast to Code Blue Team"
- Group-based broadcast routing

**Visual Enhancements:**
- Red "Panic" button next to each device in participant list
- Panic calls generate unique, flashing red packets (faster movement)
- Devices involved in panic calls have pulsing red "emergency" glow
- Event log highlights panic events in bright red
- Visual distinction for priority levels

**Deliverables:**
- Intelligent routing service ("Genie")
- Emergency/panic call system
- Priority call management
- Targeted broadcast system
- Enhanced visualizations (panic indicators, priority colors)
- Emergency group management

**Epic:** Demo & Pilot Programs (SCRUM-34) - Simulator enhancement
**Labels:** `opal`, `simulator`, `dashboard`, `communication`, `emergency`, `ai`, `routing`
**Priority:** High
**Dependencies:**
- Role-Based & Group Communication System (Phase 1) - Foundation must exist
- AI-Enhanced Communications (Epic 4) - Intelligent routing may leverage AI

**Success Criteria:**
- "Genie" successfully routes calls by name and role
- Panic calls instantly connect to emergency groups
- Panic calls override non-critical communications
- Visual indicators clearly show emergency situations
- Simulator demonstrates life-saving emergency workflows

**Clinical Value:**
This transforms the simulator from a passive network visualizer into an interactive tool that demonstrates sophisticated clinical workflows and directly competes with Vocera's intelligent routing capabilities.""",
        'epic': demo_epic_key,
        'labels': ['opal', 'simulator', 'dashboard', 'communication', 'emergency', 'ai', 'routing'],
        'priority': 'High'
    }
]

# Create tasks
print("\n" + "=" * 60)
print("Creating Tasks")
print("=" * 60)
print()

created_tasks = []
failed_tasks = []

for i, task_data in enumerate(tasks, 1):
    try:
        print(f"Creating task {i}/{len(tasks)}: {task_data['summary']}...", end=" ")
        
        issue_dict = {
            'project': {'key': PROJECT_KEY},
            'summary': task_data['summary'],
            'description': task_data['description'],
            'issuetype': {'name': 'Task'},
            'labels': task_data['labels'],
        }
        
        # Try to set priority
        try:
            issue_dict['priority'] = {'name': task_data['priority']}
        except:
            pass  # Priority may not be settable via API
        
        issue = jira.create_issue(fields=issue_dict)
        created_tasks.append(issue)
        print(f"✓ Created {issue.key}")
        
    except Exception as e:
        print(f"✗ Failed: {e}")
        failed_tasks.append((task_data['summary'], str(e)))

# Summary
print("\n" + "=" * 60)
print("Summary")
print("=" * 60)
print(f"Created: {len(created_tasks)} tasks")
print(f"Failed: {len(failed_tasks)} tasks")

if created_tasks:
    print("\nCreated Tasks:")
    for task in created_tasks:
        print(f"  - {task.key}: {task.fields.summary}")
        print(f"    View at: {JIRA_SERVER}/browse/{task.key}")

if failed_tasks:
    print("\nFailed Tasks:")
    for summary, error in failed_tasks:
        print(f"  - {summary}: {error}")

print("\n✓ Simulator enhancement tasks created!")
print("\nNote: Epic linking may need to be done manually in Jira UI")
print("      as custom field IDs vary by project configuration.")

