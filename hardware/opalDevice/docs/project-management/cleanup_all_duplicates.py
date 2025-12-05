#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comprehensive duplicate JIRA ticket cleanup

Strategy: For each group of duplicates, keep the OLDEST ticket (lowest SCRUM number)
and delete all newer duplicates.

Author: Claude Code
Date: 2025-11-28
"""

from jira import JIRA
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from collections import defaultdict

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


def get_issue_number(key: str) -> int:
    """Extract numeric part from issue key (e.g., SCRUM-123 -> 123)"""
    return int(key.split('-')[1])


def main():
    print("=" * 70)
    print("JIRA Duplicate Ticket Cleanup")
    print("=" * 70)
    print(f"Project: {PROJECT_KEY}")
    print()

    # Connect to Jira
    try:
        jira = JIRA(server=JIRA_SERVER, basic_auth=(JIRA_EMAIL, JIRA_API_TOKEN))
        current_user = jira.current_user()
        print(f"Connected as: {current_user}")
    except Exception as e:
        print(f"Failed to connect to Jira: {e}")
        sys.exit(1)

    # Get all issues
    print("\nFetching all issues...")
    try:
        all_issues = jira.search_issues(
            f'project = {PROJECT_KEY}',
            maxResults=500,
            fields='summary,issuetype,status,created'
        )
        print(f"Found {len(all_issues)} issues")
    except Exception as e:
        print(f"Failed to fetch issues: {e}")
        sys.exit(1)

    # Group by normalized summary (lowercase, trimmed)
    summary_map = defaultdict(list)
    for issue in all_issues:
        # Normalize summary for comparison
        summary = issue.fields.summary.strip().lower()
        summary_map[summary].append(issue)

    # Find duplicates (more than one issue with same summary)
    duplicates = {k: v for k, v in summary_map.items() if len(v) > 1}

    if not duplicates:
        print("\nNo duplicates found!")
        return

    print(f"\n{'=' * 70}")
    print(f"Found {len(duplicates)} duplicate groups")
    print(f"{'=' * 70}")

    # Collect all issues to delete
    issues_to_delete = []
    issues_to_keep = []

    for summary, issues in sorted(duplicates.items()):
        # Sort by issue number (oldest first)
        sorted_issues = sorted(issues, key=lambda x: get_issue_number(x.key))

        # Keep the oldest (first one)
        keep = sorted_issues[0]
        delete = sorted_issues[1:]

        issues_to_keep.append(keep)
        issues_to_delete.extend(delete)

        print(f"\n'{keep.fields.summary}':")
        print(f"  KEEP: {keep.key}")
        for d in delete:
            print(f"  DELETE: {d.key}")

    print(f"\n{'=' * 70}")
    print(f"Summary")
    print(f"{'=' * 70}")
    print(f"Total duplicate groups: {len(duplicates)}")
    print(f"Issues to KEEP: {len(issues_to_keep)}")
    print(f"Issues to DELETE: {len(issues_to_delete)}")

    # List all issues to delete
    print(f"\nIssues scheduled for deletion:")
    for issue in sorted(issues_to_delete, key=lambda x: get_issue_number(x.key)):
        print(f"  {issue.key}: {issue.fields.summary}")

    # Confirm before deletion
    print(f"\n{'=' * 70}")
    response = input(f"Delete {len(issues_to_delete)} duplicate issues? (yes/no): ")

    if response.lower() != 'yes':
        print("\nAborted. No issues deleted.")
        return

    # Delete duplicates
    print(f"\nDeleting {len(issues_to_delete)} duplicate issues...")
    deleted = 0
    failed = 0

    for issue in issues_to_delete:
        try:
            key = issue.key
            issue.delete()
            print(f"  Deleted: {key}")
            deleted += 1
        except Exception as e:
            print(f"  Failed to delete {issue.key}: {e}")
            failed += 1

    print(f"\n{'=' * 70}")
    print(f"Cleanup Complete")
    print(f"{'=' * 70}")
    print(f"Deleted: {deleted}")
    print(f"Failed: {failed}")
    print(f"Remaining issues: {len(all_issues) - deleted}")


if __name__ == "__main__":
    main()
