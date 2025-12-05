#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Create JIRA tasks for UX/UI work
Appropriately scoped to avoid task proliferation
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
print("Creating UX/UI JIRA Tasks")
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

# Find the UX epic
ux_epic_key = "SCRUM-33"
demo_epic_key = "SCRUM-34"

try:
    ux_epic = jira.issue(ux_epic_key)
    print(f"✓ Found UX epic: {ux_epic.key} - {ux_epic.fields.summary}")
    demo_epic = jira.issue(demo_epic_key)
    print(f"✓ Found Demo epic: {demo_epic.key} - {demo_epic.fields.summary}")
except Exception as e:
    print(f"✗ Epic not found: {e}")
    sys.exit(1)

# Task definitions - Appropriately scoped
tasks = [
    {
        'summary': 'Design System & UX Documentation',
        'description': """**Design System & UX Documentation**

Complete UX/UI design documentation for OPAL device and dashboard.

**Scope:**
- Design system specification (colors, typography, spacing, components)
- Wireframes for device UI (7 screens) and dashboard (5 views)
- Interaction flow documentation (8 user journeys)
- High-fidelity screen designs with pixel specifications
- Design tokens (JSON format for multi-platform use)

**Deliverables:**
- Design system documentation
- Wireframe documentation
- Interaction flow documentation
- Screen design specifications
- Design tokens JSON file

**Epic:** User Experience & Interface (SCRUM-33)
**Labels:** `opal`, `ux`, `ui`, `design`, `documentation`
**Priority:** Medium
**Dependencies:** None (foundation work)""",
        'epic': ux_epic_key,
        'labels': ['opal', 'ux', 'ui', 'design', 'documentation'],
        'priority': 'Medium'
    },
    {
        'summary': 'Interactive Prototypes & Visual Mockups',
        'description': """**Interactive Prototypes & Visual Mockups**

Create interactive prototypes and visual mockups for user testing and validation.

**Scope:**
- HTML/CSS visual mockups for device UI and dashboard
- Interactive HTML prototype with working interactions
- Mode switching functionality
- Voice command simulation
- Screen transitions and animations

**Deliverables:**
- HTML/CSS mockup files (device and dashboard)
- Interactive HTML prototype
- Working mode switching
- Voice command flow simulation

**Epic:** User Experience & Interface (SCRUM-33)
**Labels:** `opal`, `ux`, `ui`, `prototype`, `mockup`
**Priority:** Medium
**Dependencies:** Design System & UX Documentation""",
        'epic': ux_epic_key,
        'labels': ['opal', 'ux', 'ui', 'prototype', 'mockup'],
        'priority': 'Medium'
    },
    {
        'summary': 'Device UI Implementation (LVGL)',
        'description': """**Device UI Implementation (LVGL)**

Implement OPAL device UI using LVGL on ESP32-C6.

**Scope:**
- LVGL theme implementation based on design system
- Component library (buttons, cards, mode indicator, status bar)
- Screen implementations (home, mode selection, voice command, call, settings)
- Touch driver integration (CST816S)
- Mode switching functionality
- Performance optimization

**Deliverables:**
- LVGL theme files (header and implementation)
- Component library
- All device screens implemented
- Touch integration working
- Mode switching functional

**Epic:** User Experience & Interface (SCRUM-33)
**Labels:** `opal`, `ux`, `ui`, `firmware`, `lvgl`, `hardware`
**Priority:** High
**Dependencies:** 
- Device Hardware Foundation (Epic 1) - Touch screen must be functional
- Firmware Core Services (Epic 2) - UI framework
- Interactive Prototypes & Visual Mockups (for reference)

**Constraints:**
- Touch targets must be minimum 44x44px (WCAG 2.1 AA)
- Mode indicator must always be visible
- Screen transitions must be < 200ms""",
        'epic': ux_epic_key,
        'labels': ['opal', 'ux', 'ui', 'firmware', 'lvgl', 'hardware'],
        'priority': 'High'
    },
    {
        'summary': 'Dashboard UI Implementation (React)',
        'description': """**Dashboard UI Implementation (React)**

Implement OPAL Control Center dashboard using React.

**Scope:**
- React project setup with design system
- Component library (MetricCard, SystemHealthCard, WorkflowCard, etc.)
- Screen implementations (overview, device map, message flow, AI intelligence, workflows)
- Real-time updates via WebSocket
- Responsive design (mobile, tablet, desktop)
- Performance optimization

**Deliverables:**
- React dashboard application
- Component library
- All dashboard screens implemented
- Real-time WebSocket integration
- Responsive design working

**Epic:** Demo & Pilot Programs (SCRUM-34) - Dashboard visualization
**Labels:** `opal`, `ux`, `ui`, `dashboard`, `react`, `backend`
**Priority:** Medium
**Dependencies:**
- Design System & UX Documentation (for reference)
- Backend Platform Services (Epic 5) - For API integration
- Communication Infrastructure (Epic 3) - For real-time data

**Constraints:**
- Real-time updates must be < 200ms
- Must be responsive on all breakpoints
- Must demonstrate "Intelligent Node" capabilities""",
        'epic': demo_epic_key,
        'labels': ['opal', 'ux', 'ui', 'dashboard', 'react', 'backend'],
        'priority': 'Medium'
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

print("\n✓ UX/UI tasks created!")
print("\nNote: Epic linking may need to be done manually in Jira UI")
print("      as custom field IDs vary by project configuration.")

