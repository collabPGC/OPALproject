#!/usr/bin/env python3
"""
Jira Setup Script for OPAL Project
Organizes Jira workspace based on jira-organization-plan.md

Requirements:
    pip install jira

Usage:
    python jira-setup-script.py

You'll be prompted for:
    - Jira URL (default: https://pgconsulting.atlassian.net)
    - Email/Username
    - API Token (get from https://id.atlassian.com/manage-profile/security/api-tokens)
"""

from jira import JIRA
import sys
import getpass

# Jira Configuration
JIRA_SERVER = "https://pgconsulting.atlassian.net"
PROJECT_KEY = "OPAL"  # Change if you want a different project key

def get_jira_connection():
    """Establish connection to Jira"""
    print("=== Jira Connection Setup ===")
    print(f"Jira Server: {JIRA_SERVER}")
    print()
    
    email = input("Enter your Jira email/username: ").strip()
    if not email:
        print("Error: Email is required")
        sys.exit(1)
    
    print("\nTo get an API token:")
    print("1. Go to: https://id.atlassian.com/manage-profile/security/api-tokens")
    print("2. Click 'Create API token'")
    print("3. Copy the token and paste it below")
    print()
    
    api_token = getpass.getpass("Enter your Jira API token: ").strip()
    if not api_token:
        print("Error: API token is required")
        sys.exit(1)
    
    try:
        jira = JIRA(server=JIRA_SERVER, basic_auth=(email, api_token))
        print("\n✓ Successfully connected to Jira!")
        return jira
    except Exception as e:
        print(f"\n✗ Failed to connect to Jira: {e}")
        sys.exit(1)

def create_project(jira, project_key, project_name):
    """Create a new Jira project"""
    print(f"\n=== Creating Project: {project_key} ===")
    
    # Check if project already exists
    try:
        project = jira.project(project_key)
        print(f"Project {project_key} already exists. Using existing project.")
        return project
    except:
        pass
    
    # Project template - Scrum software development
    project_data = {
        'key': project_key,
        'name': project_name,
        'projectTypeKey': 'software',
        'templateKey': 'com.pyxis.greenhopper.jira:gh-scrum-template',
        'description': 'OPAL Clinical Communications Device - Hardware and Software Development',
        'lead': jira.current_user(),
        'assigneeType': 'PROJECT_LEAD',
        'avatarId': 10200,  # Default avatar
        'permissionScheme': 0,  # Use default
        'notificationScheme': 0,  # Use default
    }
    
    try:
        project = jira.create_project(**project_data)
        print(f"✓ Project {project_key} created successfully!")
        return project
    except Exception as e:
        print(f"✗ Failed to create project: {e}")
        print("You may need to create it manually in Jira.")
        return None

def create_epics(jira, project_key):
    """Create epic issues for the project"""
    print(f"\n=== Creating Epics ===")
    
    epics = [
        {
            'summary': 'Hardware Development',
            'description': 'ESP32-C6 OPAL device hardware development, PCB design, and hardware integration',
            'key': 'OPAL-HW'
        },
        {
            'summary': 'Paging System Integration',
            'description': 'Integration with hospital paging infrastructure',
            'key': 'OPAL-PAGING'
        },
        {
            'summary': 'AI-Enhanced Communications',
            'description': 'LLM-driven features for contextual routing, voice-to-EMR, translation, and clinical knowledge',
            'key': 'OPAL-AI'
        },
        {
            'summary': 'Use Cases & Clinical Workflows',
            'description': 'Department-specific use cases and clinical workflow implementation',
            'key': 'OPAL-WORKFLOWS'
        },
        {
            'summary': 'Demo & Pilot Programs',
            'description': 'Pilot programs to demonstrate Opal advantages over Vocera',
            'key': 'OPAL-DEMO'
        },
        {
            'summary': 'Security & Infrastructure',
            'description': 'Backend infrastructure, security, and DevOps',
            'key': 'OPAL-INFRA'
        },
        {
            'summary': 'User Experience & Interface',
            'description': 'Device UI, mode switching, and user experience design',
            'key': 'OPAL-UX'
        }
    ]
    
    created_epics = []
    for epic_data in epics:
        try:
            # Create epic as a story with epic name field
            issue_dict = {
                'project': {'key': project_key},
                'summary': epic_data['summary'],
                'description': epic_data['description'],
                'issuetype': {'name': 'Epic'},
            }
            
            epic = jira.create_issue(fields=issue_dict)
            created_epics.append(epic)
            print(f"✓ Created Epic: {epic.key} - {epic_data['summary']}")
        except Exception as e:
            print(f"✗ Failed to create epic {epic_data['key']}: {e}")
    
    return created_epics

def create_initial_issues(jira, project_key):
    """Create initial issues from action items"""
    print(f"\n=== Creating Initial Issues ===")
    
    issues = [
        {
            'summary': 'Identify exact paging system(s) and vendors used in target hospitals',
            'description': 'Research and document the specific paging systems currently in use at target hospital facilities.',
            'issuetype': 'Task',
            'labels': ['integration', 'research', 'priority-high'],
            'epic': 'OPAL-PAGING'
        },
        {
            'summary': 'Obtain or reverse-engineer message format specification for paging system',
            'description': 'Document the message format, field structure, encoding, length limits, and acknowledgement behavior.',
            'issuetype': 'Task',
            'labels': ['integration', 'documentation', 'priority-high'],
            'epic': 'OPAL-PAGING'
        },
        {
            'summary': 'Design Lina-side module to generate and send messages in required format',
            'description': 'Create API and data model for generating paging-compatible messages.',
            'issuetype': 'Task',
            'labels': ['backend', 'firmware', 'priority-high'],
            'epic': 'OPAL-PAGING'
        },
        {
            'summary': 'Build mock paging server to simulate hospital behavior for demos',
            'description': 'Create mock-pager-service with simple admin UI/logs for demonstration purposes.',
            'issuetype': 'Task',
            'labels': ['backend', 'demo', 'priority-medium'],
            'epic': 'OPAL-PAGING'
        },
        {
            'summary': 'Define patient blood loss workflow in structured format',
            'description': 'Document steps, roles, triggers, and messages for the flagship demo scenario.',
            'issuetype': 'Story',
            'labels': ['workflows', 'demo', 'priority-high'],
            'epic': 'OPAL-WORKFLOWS'
        },
        {
            'summary': 'Define UX for mode switching (targeted vs broadcast messaging)',
            'description': 'Design and specify the user interface for switching between targeted and broadcast messaging modes on the device.',
            'issuetype': 'Story',
            'labels': ['ui-ux', 'firmware', 'priority-high'],
            'epic': 'OPAL-UX'
        },
        {
            'summary': 'Stand up MFA and email notification infrastructure',
            'description': 'Implement multi-factor authentication and email notification endpoints for Opal/Lina services.',
            'issuetype': 'Task',
            'labels': ['infrastructure', 'security', 'priority-high'],
            'epic': 'OPAL-INFRA'
        },
        {
            'summary': 'Document current hardware stack (boards, revisions, known limitations)',
            'description': 'Create comprehensive documentation of the current hardware configuration and constraints.',
            'issuetype': 'Task',
            'labels': ['hardware', 'documentation', 'priority-medium'],
            'epic': 'OPAL-HW'
        }
    ]
    
    created_issues = []
    for issue_data in issues:
        try:
            issue_dict = {
                'project': {'key': project_key},
                'summary': issue_data['summary'],
                'description': issue_data['description'],
                'issuetype': {'name': issue_data['issuetype']},
                'labels': issue_data['labels']
            }
            
            issue = jira.create_issue(fields=issue_dict)
            created_issues.append(issue)
            print(f"✓ Created {issue_data['issuetype']}: {issue.key} - {issue_data['summary']}")
        except Exception as e:
            print(f"✗ Failed to create issue: {e}")
    
    return created_issues

def create_components(jira, project_key):
    """Create components for the project"""
    print(f"\n=== Creating Components ===")
    
    components = [
        {'name': 'ESP32-C6-Firmware', 'description': 'ESP32-C6 firmware development'},
        {'name': 'Audio-System', 'description': 'ES8311 codec and I2S audio system'},
        {'name': 'I2C-Devices', 'description': 'Touch, RTC, IMU device integration'},
        {'name': 'PCB-Design', 'description': 'Printed circuit board design'},
        {'name': 'Backend-API', 'description': 'Backend services and APIs'},
        {'name': 'LLM-Integration', 'description': 'Large language model integration'},
        {'name': 'Voice-Processing', 'description': 'Voice recognition and processing'},
        {'name': 'EMR-Integration', 'description': 'Electronic medical record integration'},
        {'name': 'Authentication', 'description': 'Authentication and authorization'},
        {'name': 'Security', 'description': 'Security and compliance'},
        {'name': 'ER-Workflows', 'description': 'Emergency room clinical workflows'},
        {'name': 'Pharmacy', 'description': 'Pharmacy-related workflows'},
        {'name': 'MedSurg', 'description': 'Medical-surgical workflows'}
    ]
    
    created_components = []
    for comp_data in components:
        try:
            component = jira.create_component(
                name=comp_data['name'],
                description=comp_data['description'],
                project=project_key
            )
            created_components.append(component)
            print(f"✓ Created Component: {comp_data['name']}")
        except Exception as e:
            print(f"✗ Failed to create component {comp_data['name']}: {e}")
    
    return created_components

def main():
    """Main execution"""
    print("=" * 60)
    print("Jira Setup Script for OPAL Project")
    print("=" * 60)
    print()
    
    # Connect to Jira
    jira = get_jira_connection()
    
    # Get or create project
    project_key = input(f"\nEnter project key (default: {PROJECT_KEY}): ").strip() or PROJECT_KEY
    project_name = input(f"Enter project name (default: OPAL): ").strip() or "OPAL"
    
    project = create_project(jira, project_key, project_name)
    if not project:
        print("\nCannot proceed without a project. Exiting.")
        sys.exit(1)
    
    # Create components
    create_components(jira, project_key)
    
    # Create epics
    epics = create_epics(jira, project_key)
    
    # Create initial issues
    issues = create_initial_issues(jira, project_key)
    
    # Summary
    print("\n" + "=" * 60)
    print("Setup Complete!")
    print("=" * 60)
    print(f"\nProject: {project_key}")
    print(f"Epics created: {len(epics)}")
    print(f"Issues created: {len(issues)}")
    print(f"\nView your project at:")
    print(f"{JIRA_SERVER}/browse/{project_key}")
    print()

if __name__ == "__main__":
    main()

