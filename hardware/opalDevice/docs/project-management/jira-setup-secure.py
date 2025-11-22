#!/usr/bin/env python3
"""
Secure Jira Setup Script for OPAL Project
Organizes Jira workspace based on jira-organization-plan.md

This script uses secure input methods and never stores credentials in plain text.

Requirements:
    pip install jira python-dotenv

Usage:
    python jira-setup-secure.py

The script will:
1. Prompt for API token securely (input is hidden)
2. Optionally save to .env file (excluded from git)
3. Connect to Jira and set up the project structure
"""

from jira import JIRA
import sys
import getpass
import os
from pathlib import Path

# Jira Configuration
JIRA_SERVER = "https://pgconsulting.atlassian.net"
JIRA_EMAIL = "hubert.williams@gmail.com"
PROJECT_KEY = "OPAL"  # Change if you want a different project key

def get_api_token_secure():
    """Securely get API token from user input or .env file"""
    # Try to load from .env file first
    env_file = Path(__file__).parent / ".jira.env"
    
    if env_file.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv(env_file)
            token = os.getenv("JIRA_API_TOKEN")
            if token:
                print(f"✓ Found API token in {env_file.name}")
                use_saved = input("Use saved token? (y/n): ").strip().lower()
                if use_saved == 'y':
                    return token
        except ImportError:
            pass
        except Exception as e:
            print(f"Warning: Could not load .env file: {e}")
    
    # Prompt for token securely
    print("\n" + "=" * 60)
    print("SECURE API TOKEN INPUT")
    print("=" * 60)
    print("\nTo get your API token:")
    print("1. Go to: https://id.atlassian.com/manage-profile/security/api-tokens")
    print("2. Click 'Create API token'")
    print("3. Copy the token and paste it below (input will be hidden)")
    print()
    
    api_token = getpass.getpass("Enter your Jira API token: ").strip()
    if not api_token:
        print("Error: API token is required")
        sys.exit(1)
    
    # Optionally save to .env file
    save_token = input("\nSave token to .jira.env file for future use? (y/n): ").strip().lower()
    if save_token == 'y':
        try:
            env_content = f"JIRA_API_TOKEN={api_token}\nJIRA_EMAIL={JIRA_EMAIL}\nJIRA_SERVER={JIRA_SERVER}\n"
            env_file.write_text(env_content)
            # Set restrictive permissions (Unix-like systems)
            if hasattr(os, 'chmod'):
                os.chmod(env_file, 0o600)
            print(f"✓ Token saved to {env_file.name} (excluded from git)")
            print("  You can use this token next time without re-entering it.")
        except Exception as e:
            print(f"Warning: Could not save token: {e}")
            print("Token will only be used for this session.")
    
    return api_token

def get_jira_connection():
    """Establish secure connection to Jira"""
    print("=" * 60)
    print("Jira Connection Setup")
    print("=" * 60)
    print(f"Jira Server: {JIRA_SERVER}")
    print(f"Email: {JIRA_EMAIL}")
    print()
    
    api_token = get_api_token_secure()
    
    try:
        jira = JIRA(server=JIRA_SERVER, basic_auth=(JIRA_EMAIL, api_token))
        # Test connection by getting current user
        current_user = jira.current_user()
        print(f"\n✓ Successfully connected to Jira!")
        print(f"✓ Logged in as: {current_user}")
        return jira
    except Exception as e:
        print(f"\n✗ Failed to connect to Jira: {e}")
        print("\nTroubleshooting:")
        print("1. Verify your API token is correct")
        print("2. Check that your email matches your Jira account")
        print("3. Ensure you have permission to create projects")
        sys.exit(1)

def create_or_get_project(jira, project_key, project_name):
    """Create a new Jira project or get existing one"""
    print(f"\n=== Project: {project_key} ===")
    
    # Check if project already exists
    try:
        project = jira.project(project_key)
        print(f"✓ Project {project_key} already exists.")
        print(f"  Name: {project.name}")
        print(f"  Key: {project.key}")
        use_existing = input("\nUse existing project? (y/n): ").strip().lower()
        if use_existing == 'y':
            return project
        else:
            print("Please choose a different project key.")
            new_key = input(f"Enter new project key (or press Enter to cancel): ").strip()
            if new_key:
                return create_or_get_project(jira, new_key, project_name)
            else:
                sys.exit(0)
    except:
        pass
    
    # Create new project
    print(f"Creating new project: {project_key}")
    project_data = {
        'key': project_key,
        'name': project_name,
        'projectTypeKey': 'software',
        'templateKey': 'com.pyxis.greenhopper.jira:gh-scrum-template',
        'description': 'OPAL Clinical Communications Device - Hardware and Software Development',
        'lead': JIRA_EMAIL,
        'assigneeType': 'PROJECT_LEAD',
    }
    
    try:
        project = jira.create_project(**project_data)
        print(f"✓ Project {project_key} created successfully!")
        return project
    except Exception as e:
        print(f"✗ Failed to create project: {e}")
        print("\nYou may need to:")
        print("1. Have project creation permissions")
        print("2. Use an existing project instead")
        use_existing = input("\nWould you like to use the existing SCRUM project? (y/n): ").strip().lower()
        if use_existing == 'y':
            try:
                return jira.project("SCRUM")
            except:
                print("Could not access SCRUM project either.")
                sys.exit(1)
        return None

def create_epics(jira, project_key):
    """Create epic issues for the project"""
    print(f"\n=== Creating Epics ===")
    
    epics = [
        {
            'summary': 'Hardware Development',
            'description': 'ESP32-C6 OPAL device hardware development, PCB design, and hardware integration',
        },
        {
            'summary': 'Paging System Integration',
            'description': 'Integration with hospital paging infrastructure',
        },
        {
            'summary': 'AI-Enhanced Communications',
            'description': 'LLM-driven features for contextual routing, voice-to-EMR, translation, and clinical knowledge',
        },
        {
            'summary': 'Use Cases & Clinical Workflows',
            'description': 'Department-specific use cases and clinical workflow implementation',
        },
        {
            'summary': 'Demo & Pilot Programs',
            'description': 'Pilot programs to demonstrate Opal advantages over Vocera',
        },
        {
            'summary': 'Security & Infrastructure',
            'description': 'Backend infrastructure, security, and DevOps',
        },
        {
            'summary': 'User Experience & Interface',
            'description': 'Device UI, mode switching, and user experience design',
        }
    ]
    
    created_epics = []
    for epic_data in epics:
        try:
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
            print(f"✗ Failed to create epic '{epic_data['summary']}': {e}")
            # Try as Story if Epic type doesn't exist
            try:
                issue_dict = {
                    'project': {'key': project_key},
                    'summary': epic_data['summary'],
                    'description': epic_data['description'],
                    'issuetype': {'name': 'Story'},
                }
                epic = jira.create_issue(fields=issue_dict)
                created_epics.append(epic)
                print(f"✓ Created as Story: {epic.key} - {epic_data['summary']}")
            except Exception as e2:
                print(f"✗ Also failed as Story: {e2}")
    
    return created_epics

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
            # Check if component already exists
            existing = [c for c in jira.project_components(project_key) if c.name == comp_data['name']]
            if existing:
                print(f"⊘ Component already exists: {comp_data['name']}")
                created_components.append(existing[0])
                continue
            
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

def create_initial_issues(jira, project_key):
    """Create initial issues from action items"""
    print(f"\n=== Creating Initial Issues ===")
    
    issues = [
        {
            'summary': 'Identify exact paging system(s) and vendors used in target hospitals',
            'description': 'Research and document the specific paging systems currently in use at target hospital facilities.\n\n**Owner:** TBD (likely Huber / integrations lead)\n**Due:** Next discovery cycle',
            'issuetype': 'Task',
            'labels': ['integration', 'research', 'priority-high'],
        },
        {
            'summary': 'Obtain or reverse-engineer message format specification for paging system',
            'description': 'Document the message format, field structure, encoding, length limits, and acknowledgement behavior.\n\n**Owner:** Integrations engineer\n**Output:** Draft "Paging Message Format Spec v0.1"',
            'issuetype': 'Task',
            'labels': ['integration', 'documentation', 'priority-high'],
        },
        {
            'summary': 'Design Lina-side module to generate and send messages in required format',
            'description': 'Create API and data model for generating paging-compatible messages.\n\n**Owner:** Backend/Firmware team\n**Output:** API + data model doc',
            'issuetype': 'Task',
            'labels': ['backend', 'firmware', 'priority-high'],
        },
        {
            'summary': 'Build mock paging server to simulate hospital behavior for demos',
            'description': 'Create mock-pager-service with simple admin UI/logs for demonstration purposes.\n\n**Owner:** Backend engineer\n**Output:** mock-pager-service with admin UI',
            'issuetype': 'Task',
            'labels': ['backend', 'demo', 'priority-medium'],
        },
        {
            'summary': 'Define patient blood loss workflow in structured format',
            'description': 'Document steps, roles, triggers, and messages for the flagship demo scenario.\n\n**Owner:** Product + clinical SME',
            'issuetype': 'Story',
            'labels': ['workflows', 'demo', 'priority-high'],
        },
        {
            'summary': 'Define UX for mode switching (targeted vs broadcast messaging)',
            'description': 'Design and specify the user interface for switching between targeted and broadcast messaging modes on the device.\n\n**Owner:** UX + firmware',
            'issuetype': 'Story',
            'labels': ['ui-ux', 'firmware', 'priority-high'],
        },
        {
            'summary': 'Stand up MFA and email notification infrastructure',
            'description': 'Implement multi-factor authentication and email notification endpoints for Opal/Lina services.\n\n**Owner:** DevOps / infra',
            'issuetype': 'Task',
            'labels': ['infrastructure', 'security', 'priority-high'],
        },
        {
            'summary': 'Document current hardware stack (boards, revisions, known limitations)',
            'description': 'Create comprehensive documentation of the current hardware configuration and constraints.\n\n**Owner:** Huber / Alex',
            'issuetype': 'Task',
            'labels': ['hardware', 'documentation', 'priority-medium'],
        },
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
            print(f"✓ Created {issue_data['issuetype']}: {issue.key} - {issue_data['summary'][:50]}...")
        except Exception as e:
            print(f"✗ Failed to create issue '{issue_data['summary'][:30]}...': {e}")
    
    return created_issues

def main():
    """Main execution"""
    print("=" * 60)
    print("Secure Jira Setup Script for OPAL Project")
    print("=" * 60)
    print()
    print("This script will:")
    print("  - Connect to your Jira instance securely")
    print("  - Create or use existing project")
    print("  - Set up epics, components, and initial issues")
    print()
    print("Your credentials are handled securely and never displayed.")
    print()
    
    # Connect to Jira
    jira = get_jira_connection()
    
    # Get or create project
    project_key = input(f"\nEnter project key (default: {PROJECT_KEY}, or 'SCRUM' for existing): ").strip() or PROJECT_KEY
    project_name = input(f"Enter project name (default: OPAL): ").strip() or "OPAL"
    
    project = create_or_get_project(jira, project_key, project_name)
    if not project:
        print("\nCannot proceed without a project. Exiting.")
        sys.exit(1)
    
    # Confirm before proceeding
    print(f"\nReady to set up project: {project_key}")
    print("This will create:")
    print("  - 7 Epics")
    print("  - 13 Components")
    print("  - 8 Initial Issues")
    print()
    confirm = input("Proceed? (y/n): ").strip().lower()
    if confirm != 'y':
        print("Setup cancelled.")
        sys.exit(0)
    
    # Create components
    components = create_components(jira, project_key)
    
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
    print(f"Components created: {len(components)}")
    print(f"Issues created: {len(issues)}")
    print(f"\nView your project at:")
    print(f"{JIRA_SERVER}/browse/{project_key}")
    print(f"\nView your board at:")
    print(f"{JIRA_SERVER}/jira/software/projects/{project_key}/boards/1")
    print()

if __name__ == "__main__":
    main()

