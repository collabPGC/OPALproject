#!/usr/bin/env python3
"""Retrieves relevant context from Neo4j and ChromaDB for Claude Code sessions.

This script queries both databases to find relevant past session information
based on the current working directory/project and optional search query.

Usage:
    python recall_context.py [--project PROJECT] [--query "search terms"] [--limit N]

Author: Claude Code Memory System
Version: 1.0.0
"""
import argparse
import json
import os
import sys
from datetime import datetime
from typing import Optional

import chromadb
from neo4j import GraphDatabase
from dotenv import load_dotenv

# Load environment from multiple possible locations
for env_path in [
    "D:/VS Workspace/.env",
    "D:/VS Workspace/ClaudeCode/.env",
    os.path.join(os.path.dirname(__file__), "../.env"),
]:
    if os.path.exists(env_path):
        load_dotenv(env_path)
        break


class MemoryRetriever:
    """Retrieves context from Neo4j and ChromaDB."""

    def __init__(self):
        # Neo4j connection
        self.neo4j_uri = os.getenv("NEO4J_URI") or os.getenv("KNOWLEDGE_GRAPH_URI", "neo4j://127.0.0.1:7687")
        self.neo4j_user = os.getenv("NEO4J_USERNAME") or os.getenv("KNOWLEDGE_GRAPH_USERNAME", "neo4j")
        self.neo4j_pass = os.getenv("NEO4J_PASSWORD") or os.getenv("KNOWLEDGE_GRAPH_PASSWORD", "architecture123")
        self.neo4j_db = os.getenv("NEO4J_DATABASE") or os.getenv("KNOWLEDGE_GRAPH_DATABASE", "neo4j")

        # ChromaDB connection
        self.chroma_host = os.getenv("CHROMA_HOST", "localhost")
        self.chroma_port = int(os.getenv("CHROMA_PORT", 8000))

        self._neo4j_driver = None
        self._chroma_client = None

    @property
    def neo4j_driver(self):
        if self._neo4j_driver is None:
            self._neo4j_driver = GraphDatabase.driver(
                self.neo4j_uri,
                auth=(self.neo4j_user, self.neo4j_pass)
            )
        return self._neo4j_driver

    @property
    def chroma_client(self):
        if self._chroma_client is None:
            self._chroma_client = chromadb.HttpClient(
                host=self.chroma_host,
                port=self.chroma_port
            )
        return self._chroma_client

    def get_recent_sessions(self, project: Optional[str] = None, limit: int = 5) -> list:
        """Get recent sessions from Neo4j, optionally filtered by project."""
        query = """
        MATCH (s:Session)
        WHERE s.project IS NULL OR s.project = $project OR $project IS NULL
        OPTIONAL MATCH (s)-[:DISCUSSED]->(c:Concept)
        OPTIONAL MATCH (s)-[:MODIFIED]->(f:File)
        OPTIONAL MATCH (s)-[:MADE]->(d:Decision)
        RETURN s.id as session_id,
               s.date as date,
               s.project as project,
               s.summary as summary,
               s.focus as focus,
               collect(DISTINCT c.name) as concepts,
               collect(DISTINCT f.path) as files,
               collect(DISTINCT d.description) as decisions
        ORDER BY s.date DESC
        LIMIT $limit
        """
        try:
            with self.neo4j_driver.session(database=self.neo4j_db) as session:
                result = session.run(query, project=project, limit=limit)
                return [dict(record) for record in result]
        except Exception as e:
            print(f"Neo4j query error: {e}", file=sys.stderr)
            return []

    def get_session_chain(self, session_id: str) -> list:
        """Get the chain of sessions that led to a given session."""
        query = """
        MATCH path = (s:Session {id: $session_id})<-[:CONTINUES*0..5]-(prev:Session)
        RETURN prev.id as session_id,
               prev.date as date,
               prev.summary as summary,
               length(path) as depth
        ORDER BY depth
        """
        try:
            with self.neo4j_driver.session(database=self.neo4j_db) as session:
                result = session.run(query, session_id=session_id)
                return [dict(record) for record in result]
        except Exception as e:
            print(f"Neo4j query error: {e}", file=sys.stderr)
            return []

    def semantic_search(self, query: str, project: Optional[str] = None, limit: int = 5) -> list:
        """Search ChromaDB for semantically similar sessions."""
        try:
            collection = self.chroma_client.get_or_create_collection(
                name="claude_sessions",
                metadata={"description": "Claude Code session summaries"}
            )

            # Build where clause for metadata filtering
            where = None
            if project:
                where = {"project": project}

            results = collection.query(
                query_texts=[query],
                n_results=limit,
                where=where,
                include=["documents", "metadatas", "distances"]
            )

            sessions = []
            if results and results["documents"]:
                for i, doc in enumerate(results["documents"][0]):
                    sessions.append({
                        "document": doc,
                        "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                        "distance": results["distances"][0][i] if results["distances"] else None
                    })
            return sessions
        except Exception as e:
            print(f"ChromaDB query error: {e}", file=sys.stderr)
            return []

    def get_project_context(self, project: str) -> dict:
        """Get all context related to a specific project."""
        query = """
        MATCH (s:Session {project: $project})
        OPTIONAL MATCH (s)-[:DISCUSSED]->(c:Concept)
        OPTIONAL MATCH (s)-[:MODIFIED]->(f:File)
        OPTIONAL MATCH (s)-[:MADE]->(d:Decision)
        WITH s, collect(DISTINCT c.name) as concepts,
             collect(DISTINCT f.path) as files,
             collect(DISTINCT d.description) as decisions
        RETURN count(s) as session_count,
               collect(DISTINCT s.focus) as focuses,
               collect(DISTINCT concepts) as all_concepts,
               collect(DISTINCT files) as all_files,
               collect(DISTINCT decisions) as all_decisions
        """
        try:
            with self.neo4j_driver.session(database=self.neo4j_db) as session:
                result = session.run(query, project=project)
                record = result.single()
                if record:
                    return dict(record)
                return {}
        except Exception as e:
            print(f"Neo4j query error: {e}", file=sys.stderr)
            return {}

    def close(self):
        if self._neo4j_driver:
            self._neo4j_driver.close()


def detect_project() -> str:
    """Detect project name from current directory."""
    cwd = os.getcwd()

    # Check for common project indicators
    if "opalDevice" in cwd or "OPAL" in cwd:
        return "OPAL Device"
    elif "ClaudeCode" in cwd:
        return "ClaudeCode"
    elif "trading" in cwd.lower():
        return "Trading System"

    # Default to directory name
    return os.path.basename(cwd)


def format_context(sessions: list, semantic_results: list, project_context: dict) -> str:
    """Format retrieved context for injection into Claude Code."""
    output = []

    output.append("=" * 60)
    output.append("RECALLED CONTEXT FROM MEMORY SYSTEM")
    output.append("=" * 60)

    if sessions:
        output.append("\n## Recent Sessions (from Neo4j graph)")
        for s in sessions:
            output.append(f"\n### {s.get('session_id', 'Unknown')} ({s.get('date', 'No date')})")
            if s.get('focus'):
                output.append(f"Focus: {s['focus']}")
            if s.get('summary'):
                output.append(f"Summary: {s['summary'][:500]}...")
            if s.get('concepts'):
                concepts = [c for c in s['concepts'] if c]
                if concepts:
                    output.append(f"Concepts: {', '.join(concepts)}")
            if s.get('files'):
                files = [f for f in s['files'] if f]
                if files:
                    output.append(f"Files: {', '.join(files[:5])}")
            if s.get('decisions'):
                decisions = [d for d in s['decisions'] if d]
                if decisions:
                    output.append(f"Decisions: {'; '.join(decisions[:3])}")

    if semantic_results:
        output.append("\n## Semantically Similar Sessions (from ChromaDB)")
        for i, r in enumerate(semantic_results, 1):
            output.append(f"\n### Match {i} (distance: {r.get('distance', 'N/A'):.3f})")
            meta = r.get('metadata', {})
            if meta.get('date'):
                output.append(f"Date: {meta['date']}")
            if r.get('document'):
                output.append(f"Content: {r['document'][:300]}...")

    if project_context and project_context.get('session_count', 0) > 0:
        output.append(f"\n## Project Overview")
        output.append(f"Total sessions: {project_context.get('session_count', 0)}")
        focuses = [f for f in project_context.get('focuses', []) if f]
        if focuses:
            output.append(f"Past focuses: {', '.join(focuses[:5])}")

    output.append("\n" + "=" * 60)
    return "\n".join(output)


def main():
    parser = argparse.ArgumentParser(description="Recall context from Claude Code memory system")
    parser.add_argument("--project", "-p", help="Project name to filter by")
    parser.add_argument("--query", "-q", help="Semantic search query")
    parser.add_argument("--limit", "-l", type=int, default=5, help="Number of results")
    parser.add_argument("--json", "-j", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    # Auto-detect project if not specified
    project = args.project or detect_project()

    retriever = MemoryRetriever()

    try:
        # Get recent sessions from Neo4j
        sessions = retriever.get_recent_sessions(project=project, limit=args.limit)

        # Semantic search if query provided
        semantic_results = []
        if args.query:
            semantic_results = retriever.semantic_search(
                query=args.query,
                project=project,
                limit=args.limit
            )

        # Get project overview
        project_context = retriever.get_project_context(project) if project else {}

        if args.json:
            output = {
                "project": project,
                "timestamp": datetime.now().isoformat(),
                "neo4j_sessions": sessions,
                "semantic_matches": semantic_results,
                "project_context": project_context
            }
            print(json.dumps(output, indent=2, default=str))
        else:
            print(format_context(sessions, semantic_results, project_context))

    finally:
        retriever.close()


if __name__ == "__main__":
    main()
