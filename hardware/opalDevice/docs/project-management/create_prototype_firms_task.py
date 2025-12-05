#!/usr/bin/env python3
"""
Create JIRA task for prototype device firms due diligence research.
This task is marked as Done (completed work).

Requirements:
    pip install jira python-dotenv

Usage:
    python create_prototype_firms_task.py
"""

from jira import JIRA
import sys
import os
from pathlib import Path

# Jira Configuration
JIRA_SERVER = "https://pgconsulting.atlassian.net"
PROJECT_KEY = "SCRUM"
EPIC_KEY = "SCRUM-27"  # Device Hardware Foundation

def get_credentials():
    """Load credentials from .env file"""
    env_file = Path(__file__).parent / ".jira.env"

    if not env_file.exists():
        print(f"Error: {env_file.name} not found")
        print("Run jira-setup-secure.py first to save credentials")
        sys.exit(1)

    try:
        from dotenv import load_dotenv
        load_dotenv(env_file)
        token = os.getenv("JIRA_API_TOKEN")
        email = os.getenv("JIRA_EMAIL")

        if not token or not email:
            print("Error: JIRA_API_TOKEN or JIRA_EMAIL not found in .env file")
            sys.exit(1)

        return email, token
    except Exception as e:
        print(f"Error loading credentials: {e}")
        sys.exit(1)

def create_prototype_firms_task():
    """Create JIRA task for prototype firms due diligence"""

    # Get credentials
    email, token = get_credentials()

    # Connect to Jira
    print(f"Connecting to {JIRA_SERVER}...")
    try:
        jira = JIRA(server=JIRA_SERVER, basic_auth=(email, token))
        print("[OK] Connected successfully")
    except Exception as e:
        print(f"[ERROR] Connection failed: {e}")
        sys.exit(1)

    # Task description
    description = """Conducted comprehensive due diligence on US-based prototype device and design firms capable of developing wearable medical communication devices from concept through small-scale production.

h2. Scope
Analyzed 15 firms across three categories:
* Boutique specialists (ideal for early-stage, <100 employees)
* Mid-size manufacturers (bridge to production, 100-500 employees)
* Large-scale manufacturers (volume production, 1000+ units)

h2. Key Findings

*Top 3 Recommendations for OPAL Device:*
# *Voler Systems* (Sunnyvale, CA) - 46 years experience, ultra-low power wireless, FDA Class III approval track record, $150-199/hour
# *Priority Designs* (Columbus, OH) - 80+ experts, soft goods integration, ISO 13485 certified, comprehensive wearable capabilities
# *Simplexity Product Development* (San Diego, CA) - 75 engineers, 20+ years avg experience, Microsoft Band & HTC Vive development

h2. Cost & Timeline Estimates
* *Seed Stage ($150K-400K):* Proof-of-concept prototypes (4-8 months)
* *Series A ($800K-1.5M):* Production-intent design + FDA submission (15-20 months)
* *Series B+ ($200K-500K tooling):* Volume production <$100/unit at scale

h2. Critical Capabilities Identified
* Voice/audio streaming expertise (low-latency, noise cancellation)
* Wireless communication in medical environments (RF design, interference mitigation)
* FDA regulatory pathway support (Class I/II/III)
* Manufacturing transition support (100-10,000+ units)

h2. Recommendations by Stage
* *Pre-seed/Seed:* Voler Systems, DeviceLab, IDP ($150K-400K, 4-8 months)
* *Series A:* Simplexity, Priority Designs, Simbex, Kickr Design ($800K-1.5M, 15-20 months)
* *Series B+:* Sterling Industries, SMC Ltd, Sigma Design, Vantage MedTech (production scaling)

h2. Deliverables
* (/) Detailed 25KB analysis document with 15 firm profiles
* (/) Cost/timeline comparison matrices
* (/) Engagement approach recommendations
* (/) Regulatory pathway considerations
* (/) Stage-specific partner selection guidance

h2. Documentation
Full analysis: {{hardware/opalDevice/docs/strategy/prototype-firms-due-diligence.md}}

h2. Next Steps
* Review top 3 recommendations with hardware team
* Prepare brief overview document (2-4 pages) for NDA discussions
* Request portfolio reviews from Voler, Priority, Simplexity
* Consider competitive feasibility studies ($25K-50K each) from 2 firms
"""

    # Create task
    print(f"\nCreating task in project {PROJECT_KEY}...")
    try:
        issue_dict = {
            'project': {'key': PROJECT_KEY},
            'summary': 'Research US Prototype Device and Design Firms for Wearable Medical Device Development',
            'description': description,
            'issuetype': {'name': 'Task'},
            'labels': ['opal', 'research', 'due-diligence', 'hardware', 'vendors', 'completed'],
            'priority': {'name': 'Medium'},
        }

        new_issue = jira.create_issue(fields=issue_dict)
        print(f"[OK] Created task: {new_issue.key}")

        # Link to epic (next-gen projects use parent field)
        print(f"Linking to epic {EPIC_KEY}...")
        try:
            # Try next-gen approach (parent field)
            new_issue.update(fields={'parent': {'key': EPIC_KEY}})
            print(f"[OK] Linked to epic {EPIC_KEY}")
        except Exception as link_error:
            # Try classic approach if next-gen fails
            try:
                jira.add_issues_to_epic(EPIC_KEY, [new_issue.key])
                print(f"[OK] Linked to epic {EPIC_KEY}")
            except Exception as e:
                print(f"[WARN] Could not link to epic: {e}")
                print(f"  Please manually link {new_issue.key} to {EPIC_KEY} in Jira")

        # Transition to Done
        print("Transitioning to Done status...")
        transitions = jira.transitions(new_issue)

        # Find the "Done" transition
        done_transition_id = None
        for transition in transitions:
            if transition['name'].lower() in ['done', 'complete', 'closed']:
                done_transition_id = transition['id']
                break

        if done_transition_id:
            jira.transition_issue(new_issue, done_transition_id)
            print(f"[OK] Transitioned to Done")
        else:
            print("[WARN] Could not find 'Done' transition. Available transitions:")
            for transition in transitions:
                print(f"  - {transition['name']} (ID: {transition['id']})")
            print(f"  Please manually transition {new_issue.key} to Done in Jira")

        # Add story points if custom field exists
        try:
            # Try to find story points field
            fields = jira.fields()
            story_points_field = None
            for field in fields:
                if 'story' in field['name'].lower() and 'point' in field['name'].lower():
                    story_points_field = field['id']
                    break

            if story_points_field:
                new_issue.update(fields={story_points_field: 8})
                print(f"[OK] Added story points: 8")
        except Exception as e:
            print(f"[WARN] Could not add story points (this is OK): {e}")

        print(f"\n{'='*60}")
        print(f"SUCCESS! Task created: {new_issue.key}")
        print(f"View at: {JIRA_SERVER}/browse/{new_issue.key}")
        print(f"{'='*60}")

        return new_issue.key

    except Exception as e:
        print(f"[ERROR] Failed to create task: {e}")
        sys.exit(1)

if __name__ == "__main__":
    create_prototype_firms_task()
