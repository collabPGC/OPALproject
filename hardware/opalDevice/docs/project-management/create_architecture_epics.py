#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Create OPAL Architecture Epics in Jira
Based on refined architecture document: opal-system-architecture-epics.md
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
PROJECT_KEY = os.getenv("JIRA_PROJECT_KEY", "SCRUM")  # Default to SCRUM

if not JIRA_API_TOKEN:
    print("Error: JIRA_API_TOKEN not found in .jira.env")
    sys.exit(1)

# Connect to Jira
print("=" * 60)
print("Creating OPAL Architecture Epics in Jira")
print("=" * 60)
print(f"Project: {PROJECT_KEY}")
print(f"Server: {JIRA_SERVER}")
print()

try:
    jira = JIRA(server=JIRA_SERVER, basic_auth=(JIRA_EMAIL, JIRA_API_TOKEN))
    current_user = jira.current_user()
    print(f"✓ Connected as: {current_user}")
    
    # Verify project exists
    project = jira.project(PROJECT_KEY)
    print(f"✓ Found project: {project.key} - {project.name}")
except Exception as e:
    print(f"✗ Failed to connect to Jira: {e}")
    sys.exit(1)

# Epic definitions based on refined architecture
epics = [
    {
        'summary': 'Device Hardware Foundation',
        'description': """**Epic 1: Device Hardware Foundation** (CRITICAL - BLOCKING)

This epic encompasses all work required to provision and validate the ESP32-C6 OPAL board hardware.

## Scope
- ESP32-C6 board provisioning (I2C fixes, audio debugging)
- PCB design and production roadmap
- Hardware testing and validation
- Hardware documentation

## Critical Constraints
- **I2C Pull-up Resistors**: REQUIRED - 4.7kΩ on SDA/SCL (GPIO7/8) - BLOCKS ALL I2C DEVICES
- **ES8311 CE Pin**: Hard-wired HIGH (not controllable)
- **Touch RST Pin**: Not connected (no software reset)
- **Partition Table**: 3MB app partition required

## Dependencies
- None (foundation layer)
- **BLOCKING**: All other epics depend on this

## Sub-Epics
- ESP32-C6 Firmware Development
- Audio System (ES8311 Codec, I2S)
- I2C Device Integration (Touch, RTC, IMU)
- PCB Design & Production
- Hardware Testing & Validation

## Priority
**CRITICAL** - Blocks all other development work""",
        'priority': 'Critical'
    },
    {
        'summary': 'Firmware Core Services',
        'description': """**Epic 2: Firmware Core Services** (CRITICAL)

Real-time processing layer running on ESP32-C6.

## Scope
- Audio pipeline (I2S, AEC, codec interface)
- VoIP stack (SIP/RTP integration)
- Device management (WiFi, state, power)
- I2C device drivers (touch, RTC, IMU)

## Critical Constraints
- **AEC Sample Rate**: REQUIRED - 16kHz only (I2S and codec must be 16kHz)
- **ESP-ADF Board Abstraction**: REQUIRED - Cannot bypass
- **VoIP Codec**: G.711 A-law (8kHz codec, 16kHz I2S)
- **Closed-Source Library**: SIP/RTP uses `esp_rtc` (cannot modify)

## Dependencies
- Epic 1: Device Hardware Foundation (hardware must be stable)
- **BLOCKING**: Audio pipeline must be stable before VoIP integration

## Priority
**CRITICAL** - Required for all device functionality""",
        'priority': 'Critical'
    },
    {
        'summary': 'Communication Infrastructure',
        'description': """**Epic 3: Communication Infrastructure** (HIGH)

Network & protocol layer for device-to-backend communication.

## Scope
- Device-to-backend APIs (REST, WebSocket)
- Paging system integration (mock + real)
- Backend services (device registry, routing, gateway)
- Mock paging server (for demos)

## Critical Constraints
- **Paging System Protocol**: UNKNOWN - Must be discovered
  - Risk: Demo may rely on assumptions
  - Mitigation: Build mock paging server first
- **MVP Requirement**: Generate compatible outputs first
- **Device Identifiers**: Must fit hospital IT constraints

## Dependencies
- Epic 2: Firmware Core Services (firmware must support communication)
- Paging integration depends on protocol discovery (can use mock initially)

## Priority
**HIGH** - Required for backend integration""",
        'priority': 'High'
    },
    {
        'summary': 'AI-Enhanced Communications',
        'description': """**Epic 4: AI-Enhanced Communications** (HIGH)

LLM-driven features for contextual routing, voice-to-EMR, translation, and clinical knowledge.

## Scope
- Contextual Router (Smart Call Routing) - 90% probability, highest value
- Actionable Voice (Voice-to-EMR Integration) - 85% probability
- Universal Translator (Real-time Translation) - 75% probability
- Clinical Oracle (Protocol Knowledge Base) - 65% probability
- Sentiment Sentinel (Burnout Detection) - 50% probability

## Critical Constraints
- **LLM Integration**: Infrastructure needed, role undefined
  - Risk: Scope creep or misaligned expectations
  - Mitigation: Define early, start with Contextual Router
- **EMR Integration APIs**: Unknown (varies by hospital)
- **Real-Time Translation**: Low-latency requirement

## Dependencies
- Epic 3: Communication Infrastructure (backend APIs)
- LLM infrastructure setup (critical path)
- EMR integration depends on hospital system APIs

## Priority
**HIGH** - Competitive differentiator""",
        'priority': 'High'
    },
    {
        'summary': 'Backend Platform Services',
        'description': """**Epic 5: Backend Platform Services** (HIGH)

Supporting infrastructure for authentication, security, monitoring, and operations.

## Scope
- Authentication & security (MFA, device auth, HIPAA compliance)
- Notification services (email, push)
- Monitoring & operations
- Database & storage

## Critical Constraints
- **HIPAA/PHI Compliance**: REQUIRED for production
  - Security infrastructure is critical path
  - Audit logging required
  - Data encryption at rest and in transit
- **MFA Infrastructure**: Required for authentication
- **Database Schema**: Must be designed early (affects all services)

## Dependencies
- Can be developed in parallel with other epics
- Required before production deployment

## Priority
**HIGH** - Required for production""",
        'priority': 'High'
    },
    {
        'summary': 'Clinical Workflows',
        'description': """**Epic 6: Clinical Workflows** (MEDIUM - HIGH PRIORITY FOR DEMO)

Department-specific use cases and clinical workflow implementation.

## Scope
- Use case catalog (from transcribed conversations)
- Patient blood loss workflow (flagship demo - HIGH PRIORITY)
- Department-specific workflows:
  - Emergency Room Workflows
  - Pharmacy Dosage Calls
  - MedSurg Floor Communications
  - Admissions Workflows

## Critical Constraints
- **Demo-Driven Development**: Patient blood loss workflow is flagship demo
- **Messaging Modes**: Must support both targeted and broadcast
- **Request Lifecycle**: Must track statuses (pending, waiting, completed)

## Dependencies
- Epics 1-4 (all lower layers must be functional)
- Can be designed in parallel with development

## Priority
**MEDIUM** - But HIGH PRIORITY for demo""",
        'priority': 'Medium'
    },
    {
        'summary': 'User Experience & Interface',
        'description': """**Epic 7: User Experience & Interface** (MEDIUM)

Device UI, mode switching, and user experience design.

## Scope
- Mode switching UX (targeted vs broadcast) - **CRITICAL**
- Device UI design and implementation
- Voice interface design
- User testing and feedback

## Critical Constraints
- **Mode Switching UX**: CRITICAL for clinical workflows
  - Must support targeted vs broadcast messaging
  - Clear UI affordances so users know who is being messaged
  - Priority: HIGH (required for workflows)
- **Device UI**: Depends on touch screen hardware (I2C fix required)
- **Voice Interface**: Must be hands-free, work in noisy environments

## Dependencies
- Epic 1: Device Hardware Foundation (touch screen hardware)
- Epic 2: Firmware Core Services (firmware UI framework)
- Informs Epic 6 (workflow design)

## Priority
**MEDIUM** - But mode switching UX is CRITICAL""",
        'priority': 'Medium'
    },
    {
        'summary': 'Demo & Pilot Programs',
        'description': """**Epic 8: Demo & Pilot Programs** (MEDIUM)

Pilot programs to demonstrate Opal advantages over Vocera.

## Scope
- Demo storyboard and planning
- Dashboard visualization
- Video production
- Pilot program execution:
  - Closed Loop Pilot (Cardiology/Cath Lab)
  - Rounds Pilot (Med-Surg)
  - Safety Net Pilot (Psychiatry/ED)

## Critical Constraints
- **Demo-Driven Development**: Demo storyboard must be defined
- **Dashboard Visualization**: Must visualize message flow and device status
- **Video Production**: Opal team acting out workflows

## Dependencies
- Epics 1-7 (all layers must be functional for demos)

## Priority
**MEDIUM** - Business development""",
        'priority': 'Medium'
    }
]

# Create epics
print("\n" + "=" * 60)
print("Creating Epics")
print("=" * 60)
print()

created_epics = []
for i, epic_data in enumerate(epics, 1):
    try:
        issue_dict = {
            'project': {'key': PROJECT_KEY},
            'summary': epic_data['summary'],
            'description': epic_data['description'],
            'issuetype': {'name': 'Epic'},
        }
        
        # Try to set priority if supported (use string format)
        try:
            # Try different priority formats
            priority_map = {
                'Critical': 'Highest',
                'High': 'High',
                'Medium': 'Medium',
                'Low': 'Low'
            }
            priority_name = priority_map.get(epic_data['priority'], epic_data['priority'])
            issue_dict['priority'] = {'name': priority_name}
        except:
            pass  # Priority may not be supported in all Jira configurations
        
        epic = jira.create_issue(fields=issue_dict)
        created_epics.append(epic)
        print(f"✓ Created Epic {i}: {epic.key} - {epic_data['summary']}")
        
    except Exception as e:
        # Try as Story if Epic doesn't work
        try:
            issue_dict = {
                'project': {'key': PROJECT_KEY},
                'summary': epic_data['summary'],
                'description': epic_data['description'],
                'issuetype': {'name': 'Story'},
            }
            try:
                issue_dict['priority'] = {'name': epic_data['priority']}
            except:
                pass
            epic = jira.create_issue(fields=issue_dict)
            created_epics.append(epic)
            print(f"✓ Created as Story {i}: {epic.key} - {epic_data['summary']}")
        except Exception as e2:
            print(f"✗ Failed to create epic '{epic_data['summary']}': {e2}")

# Summary
print("\n" + "=" * 60)
print("Summary")
print("=" * 60)
print(f"\nEpics created: {len(created_epics)}")
print(f"\nView your project at:")
print(f"{JIRA_SERVER}/browse/{PROJECT_KEY}")
print(f"\nEpic Keys:")
for epic in created_epics:
    print(f"  - {epic.key}: {epic.fields.summary}")
print("\n✓ Epics created successfully!")

