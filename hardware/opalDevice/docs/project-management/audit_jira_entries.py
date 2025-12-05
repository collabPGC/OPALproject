#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Audit Jira entries for duplicates, verbosity, and focus
Ensures entries are lean and not duplicated
"""

from jira import JIRA
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from collections import defaultdict
import re

# Semantic duplicate patterns - issues with different wording but same meaning
SEMANTIC_PATTERNS = [
    {
        "name": "GPIO Pin Mapping",
        "pattern": r"(gpio|pin).*(map|assign|config|document)",
        "keywords": ["gpio", "pin", "mapping", "pinout", "assignment"]
    },
    {
        "name": "UX Voice Interface",
        "pattern": r"(ux|voice|user).*(interface|design|interaction)",
        "keywords": ["ux", "voice", "interface", "user experience", "audio interface"]
    },
    {
        "name": "Cleanup Duplicates",
        "pattern": r"(clean|remov|delet).*(duplicat|jira|ticket)",
        "keywords": ["cleanup", "duplicate", "remove", "delete", "consolidate"]
    },
    {
        "name": "Fix JIRA Workflow",
        "pattern": r"(fix|updat|config).*(jira|workflow|board)",
        "keywords": ["jira", "workflow", "sprint", "board", "fix"]
    },
    {
        "name": "ESP32 Firmware Development",
        "pattern": r"(esp32|firmware|develop).*(setup|build|config|implement)",
        "keywords": ["esp32", "firmware", "development", "setup", "build"]
    },
    {
        "name": "ESP32 Hardware Review",
        "pattern": r"(esp32|hardware|board).*(review|analyz|evaluat)",
        "keywords": ["hardware", "review", "board", "schematic", "evaluation"]
    },
    {
        "name": "ESP32 Documentation",
        "pattern": r"(esp32|document).*(review|creat|updat)",
        "keywords": ["documentation", "esp32", "datasheet", "reference", "manual"]
    },
    {
        "name": "Critical Path",
        "pattern": r"(critical|path|priorit).*(identif|defin|track)",
        "keywords": ["critical", "path", "priority", "milestone", "timeline"]
    },
    {
        "name": "JIRA Automation Config",
        "pattern": r"(jira|automat).*(config|setup|integrat)",
        "keywords": ["jira", "automation", "integration", "configuration", "setup"]
    },
    {
        "name": "Disable Automation",
        "pattern": r"(disabl|stop|turn.?off).*(automat|bot|scout|spark)",
        "keywords": ["disable", "automation", "bot", "scout", "spark", "stop"]
    },
]


def match_semantic_pattern(summary: str) -> str | None:
    """Check if summary matches any semantic pattern. Returns pattern name or None."""
    summary_lower = summary.lower()
    for pattern in SEMANTIC_PATTERNS:
        # Check regex pattern
        if re.search(pattern["pattern"], summary_lower, re.IGNORECASE):
            return pattern["name"]
        # Check keywords (at least 2 must match)
        keyword_matches = sum(1 for kw in pattern["keywords"] if kw in summary_lower)
        if keyword_matches >= 2:
            return pattern["name"]
    return None


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
print("Auditing Jira Entries for Lean, Focused Structure")
print("=" * 60)
print(f"Project: {PROJECT_KEY}")
print()

try:
    jira = JIRA(server=JIRA_SERVER, basic_auth=(JIRA_EMAIL, JIRA_API_TOKEN))
    current_user = jira.current_user()
    print(f"Connected as: {current_user}")
except Exception as e:
    print(f"Failed to connect to Jira: {e}")
    sys.exit(1)

# Get all issues in the project
print("\nFetching all issues...")
try:
    all_issues = jira.search_issues(f'project = {PROJECT_KEY}', maxResults=1000)
    print(f"Found {len(all_issues)} issues")
except Exception as e:
    print(f"Failed to fetch issues: {e}")
    sys.exit(1)

# Analyze issues
print("\n" + "=" * 60)
print("Analysis")
print("=" * 60)

# Group by issue type
by_type = defaultdict(list)
for issue in all_issues:
    issue_type = issue.fields.issuetype.name
    by_type[issue_type].append(issue)

print(f"\nIssues by type:")
for issue_type, issues in sorted(by_type.items()):
    print(f"  {issue_type}: {len(issues)}")

# Check for duplicate summaries
print(f"\nChecking for duplicate summaries...")
summary_map = defaultdict(list)
for issue in all_issues:
    summary = issue.fields.summary.strip()
    summary_map[summary].append(issue)

duplicates = {k: v for k, v in summary_map.items() if len(v) > 1}
if duplicates:
    print(f"Found {len(duplicates)} duplicate summaries:")
    for summary, issues in duplicates.items():
        print(f"\n  '{summary}':")
        for issue in issues:
            print(f"    - {issue.key} ({issue.fields.issuetype.name})")
else:
    print("No duplicate summaries found")

# Check for semantic duplicates
print(f"\nChecking for semantic duplicates...")
semantic_groups = defaultdict(list)
for issue in all_issues:
    pattern_name = match_semantic_pattern(issue.fields.summary)
    if pattern_name:
        semantic_groups[pattern_name].append(issue)

# Filter to groups with more than one issue
semantic_duplicates = {k: v for k, v in semantic_groups.items() if len(v) > 1}
if semantic_duplicates:
    total_semantic = sum(len(v) - 1 for v in semantic_duplicates.values())
    print(f"Found {len(semantic_duplicates)} semantic duplicate groups ({total_semantic} potential duplicates):")
    for pattern_name, issues in sorted(semantic_duplicates.items()):
        print(f"\n  {pattern_name} ({len(issues)} issues):")
        for issue in sorted(issues, key=lambda x: x.key):
            print(f"    - {issue.key}: {issue.fields.summary}")
else:
    print("No semantic duplicates found")

# Check for overly verbose descriptions
print(f"\nChecking description lengths...")
verbose_issues = []
for issue in all_issues:
    if hasattr(issue.fields, 'description') and issue.fields.description:
        desc_length = len(issue.fields.description)
        if desc_length > 2000:  # More than 2000 chars is verbose
            verbose_issues.append((issue, desc_length))

if verbose_issues:
    print(f"Found {len(verbose_issues)} issues with verbose descriptions (>2000 chars):")
    for issue, length in sorted(verbose_issues, key=lambda x: x[1], reverse=True):
        print(f"  - {issue.key}: {issue.fields.summary} ({length} chars)")
else:
    print("No overly verbose descriptions found")

# List all epics
print(f"\n" + "=" * 60)
print("Epics Summary")
print("=" * 60)

epics = [issue for issue in all_issues if issue.fields.issuetype.name == 'Epic']
print(f"\nTotal Epics: {len(epics)}")
print("\nEpic List:")
for epic in sorted(epics, key=lambda x: x.key):
    desc_length = len(epic.fields.description) if hasattr(epic.fields, 'description') and epic.fields.description else 0
    status = epic.fields.status.name
    print(f"  {epic.key}: {epic.fields.summary}")
    print(f"    Status: {status}, Description: {desc_length} chars")

# List all other issues
other_issues = [issue for issue in all_issues if issue.fields.issuetype.name != 'Epic']
if other_issues:
    print(f"\n" + "=" * 60)
    print("Other Issues Summary")
    print("=" * 60)
    print(f"\nTotal Non-Epic Issues: {len(other_issues)}")
    print("\nIssue List:")
    for issue in sorted(other_issues, key=lambda x: x.key):
        issue_type = issue.fields.issuetype.name
        status = issue.fields.status.name
        print(f"  {issue.key}: {issue.fields.summary} ({issue_type}, {status})")

# Recommendations
print(f"\n" + "=" * 60)
print("Recommendations")
print("=" * 60)

recommendations = []

if duplicates:
    recommendations.append(f"Delete {len(duplicates)} exact duplicate issue(s)")

if semantic_duplicates:
    total_semantic = sum(len(v) - 1 for v in semantic_duplicates.values())
    recommendations.append(f"Review {total_semantic} semantic duplicate(s) across {len(semantic_duplicates)} groups")

if verbose_issues:
    recommendations.append(f"Consider condensing {len(verbose_issues)} verbose description(s)")

if len(epics) > 10:
    recommendations.append(f"Consider consolidating epics (currently {len(epics)})")

if not recommendations:
    print("\nJira structure looks good!")
    print("  - No duplicates found")
    print("  - No semantic duplicates found")
    print("  - Descriptions are reasonable length")
    print("  - Epic count is manageable")
else:
    print("\nRecommendations:")
    for rec in recommendations:
        print(f"  - {rec}")

print("\n" + "=" * 60)
print("Audit Complete")
print("=" * 60)
