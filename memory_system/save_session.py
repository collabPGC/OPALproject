#!/usr/bin/env python3
"""Saves Claude Code session context to Neo4j and ChromaDB.

This script stores session summaries, concepts, files modified, and decisions
made during a Claude Code session for later retrieval.

Usage:
    python save_session.py --summary "Session summary" [--concepts "c1,c2"] [--files "f1,f2"]

    Or pipe JSON:
    echo '{"summary": "...", "concepts": [...]}' | python save_session.py --stdin

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

# Optional: Google Gemini for embeddings
try:
    import google.generativeai as genai
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False

# Load environment from multiple possible locations
for env_path in [
    "D:/VS Workspace/.env",
    "D:/VS Workspace/ClaudeCode/.env",
    os.path.join(os.path.dirname(__file__), "../.env"),
]:
    if os.path.exists(env_path):
        load_dotenv(env_path)
        break


class MemorySaver:
    """Saves session context to Neo4j and ChromaDB."""

    def __init__(self):
        # Neo4j connection
        self.neo4j_uri = os.getenv("NEO4J_URI") or os.getenv("KNOWLEDGE_GRAPH_URI", "neo4j://127.0.0.1:7687")
        self.neo4j_user = os.getenv("NEO4J_USERNAME") or os.getenv("KNOWLEDGE_GRAPH_USERNAME", "neo4j")
        self.neo4j_pass = os.getenv("NEO4J_PASSWORD") or os.getenv("KNOWLEDGE_GRAPH_PASSWORD", "architecture123")
        self.neo4j_db = os.getenv("NEO4J_DATABASE") or os.getenv("KNOWLEDGE_GRAPH_DATABASE", "neo4j")

        # ChromaDB connection
        self.chroma_host = os.getenv("CHROMA_HOST", "localhost")
        self.chroma_port = int(os.getenv("CHROMA_PORT", 8000))

        # Embedding API
        self.google_api_key = os.getenv("GOOGLE_API_KEY")
        if HAS_GENAI and self.google_api_key:
            genai.configure(api_key=self.google_api_key)

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

    def generate_session_id(self, project: str) -> str:
        """Generate a unique session ID."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_project = project.lower().replace(" ", "_").replace("-", "_")
        return f"session_{safe_project}_{timestamp}"

    def get_embedding(self, text: str) -> Optional[list]:
        """Generate embedding using Google Gemini."""
        if not HAS_GENAI or not self.google_api_key:
            return None
        try:
            text = text.replace("\n", " ")[:8000]  # Limit length
            result = genai.embed_content(
                model="models/embedding-001",
                content=text
            )
            return result['embedding']
        except Exception as e:
            print(f"Embedding error: {e}", file=sys.stderr)
            return None

    def save_to_neo4j(self, session_data: dict) -> bool:
        """Save session and relationships to Neo4j."""
        query = """
        // Create or update session node
        MERGE (s:Session {id: $session_id})
        SET s.date = $date,
            s.project = $project,
            s.summary = $summary,
            s.focus = $focus,
            s.working_directory = $working_directory,
            s.key_findings = $key_findings

        // Create concept relationships using FOREACH (handles empty lists)
        WITH s
        FOREACH (concept_name IN $concepts |
            MERGE (c:Concept {name: concept_name})
            MERGE (s)-[:DISCUSSED]->(c)
        )

        // Create file relationships
        WITH s
        FOREACH (file_path IN $files |
            MERGE (f:File {path: file_path})
            MERGE (s)-[:MODIFIED]->(f)
        )

        RETURN s.id as session_id
        """
        try:
            with self.neo4j_driver.session(database=self.neo4j_db) as session:
                result = session.run(
                    query,
                    session_id=session_data["session_id"],
                    date=session_data.get("date", datetime.now().isoformat()),
                    project=session_data.get("project"),
                    summary=session_data.get("summary"),
                    focus=session_data.get("focus"),
                    working_directory=session_data.get("working_directory"),
                    key_findings=session_data.get("key_findings"),
                    concepts=session_data.get("concepts", []),
                    files=session_data.get("files", [])
                )
                record = result.single()
                return record is not None
        except Exception as e:
            print(f"Neo4j save error: {e}", file=sys.stderr)
            return False

    def save_to_chromadb(self, session_data: dict) -> bool:
        """Save session summary to ChromaDB with embedding."""
        try:
            collection = self.chroma_client.get_or_create_collection(
                name="claude_sessions",
                metadata={"description": "Claude Code session summaries"}
            )

            # Build document text for embedding
            doc_parts = []
            if session_data.get("summary"):
                doc_parts.append(f"Summary: {session_data['summary']}")
            if session_data.get("focus"):
                doc_parts.append(f"Focus: {session_data['focus']}")
            if session_data.get("concepts"):
                doc_parts.append(f"Concepts: {', '.join(session_data['concepts'])}")
            if session_data.get("key_findings"):
                doc_parts.append(f"Key Findings: {session_data['key_findings']}")

            document = "\n".join(doc_parts)

            # Prepare metadata
            metadata = {
                "project": session_data.get("project", "unknown"),
                "date": session_data.get("date", datetime.now().isoformat()),
                "focus": session_data.get("focus", ""),
                "working_directory": session_data.get("working_directory", "")
            }

            # Get embedding if available
            embedding = self.get_embedding(document)

            if embedding:
                collection.add(
                    ids=[session_data["session_id"]],
                    documents=[document],
                    embeddings=[embedding],
                    metadatas=[metadata]
                )
            else:
                # ChromaDB will generate embedding automatically
                collection.add(
                    ids=[session_data["session_id"]],
                    documents=[document],
                    metadatas=[metadata]
                )

            return True
        except Exception as e:
            print(f"ChromaDB save error: {e}", file=sys.stderr)
            return False

    def save_session(self, session_data: dict) -> dict:
        """Save session to both databases."""
        # Generate session ID if not provided
        if "session_id" not in session_data:
            project = session_data.get("project", detect_project())
            session_data["session_id"] = self.generate_session_id(project)
            session_data["project"] = project

        # Add timestamp
        if "date" not in session_data:
            session_data["date"] = datetime.now().isoformat()

        # Add working directory
        if "working_directory" not in session_data:
            session_data["working_directory"] = os.getcwd()

        results = {
            "session_id": session_data["session_id"],
            "neo4j_saved": False,
            "chromadb_saved": False
        }

        # Save to Neo4j
        results["neo4j_saved"] = self.save_to_neo4j(session_data)

        # Save to ChromaDB
        results["chromadb_saved"] = self.save_to_chromadb(session_data)

        return results

    def close(self):
        if self._neo4j_driver:
            self._neo4j_driver.close()


def detect_project() -> str:
    """Detect project name from current directory."""
    cwd = os.getcwd()

    if "opalDevice" in cwd or "OPAL" in cwd:
        return "OPAL Device"
    elif "ClaudeCode" in cwd:
        return "ClaudeCode"
    elif "trading" in cwd.lower():
        return "Trading System"

    return os.path.basename(cwd)


def main():
    parser = argparse.ArgumentParser(description="Save Claude Code session to memory system")
    parser.add_argument("--summary", "-s", help="Session summary")
    parser.add_argument("--focus", "-f", help="Main focus of the session")
    parser.add_argument("--concepts", "-c", help="Comma-separated concepts discussed")
    parser.add_argument("--files", help="Comma-separated files modified")
    parser.add_argument("--decisions", "-d", help="JSON array of decisions")
    parser.add_argument("--project", "-p", help="Project name")
    parser.add_argument("--previous", help="Previous session ID for continuity")
    parser.add_argument("--key-findings", "-k", help="Key findings from the session")
    parser.add_argument("--stdin", action="store_true", help="Read JSON from stdin")
    parser.add_argument("--json", "-j", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    # Build session data
    if args.stdin:
        session_data = json.load(sys.stdin)
    else:
        session_data = {}
        if args.summary:
            session_data["summary"] = args.summary
        if args.focus:
            session_data["focus"] = args.focus
        if args.concepts:
            session_data["concepts"] = [c.strip() for c in args.concepts.split(",")]
        if args.files:
            session_data["files"] = [f.strip() for f in args.files.split(",")]
        if args.decisions:
            session_data["decisions"] = json.loads(args.decisions)
        if args.project:
            session_data["project"] = args.project
        if args.previous:
            session_data["previous_session"] = args.previous
        if args.key_findings:
            session_data["key_findings"] = args.key_findings

    if not session_data.get("summary"):
        print("Error: Session summary is required (--summary or via --stdin)", file=sys.stderr)
        sys.exit(1)

    saver = MemorySaver()

    try:
        results = saver.save_session(session_data)

        if args.json:
            print(json.dumps(results, indent=2))
        else:
            status = "SUCCESS" if results["neo4j_saved"] and results["chromadb_saved"] else "PARTIAL"
            print(f"\n{status}: Session saved")
            print(f"  Session ID: {results['session_id']}")
            print(f"  Neo4j: {'OK' if results['neo4j_saved'] else 'FAILED'}")
            print(f"  ChromaDB: {'OK' if results['chromadb_saved'] else 'FAILED'}")

    finally:
        saver.close()


if __name__ == "__main__":
    main()
