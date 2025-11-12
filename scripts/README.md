# Scripts

This directory contains utility scripts and tools for the OPAL project.

## Directory Structure

### `database/`
Database utility scripts for ChromaDB (vector database) and Neo4j (knowledge graph):

- **embed_and_store.py** - Embeds document content using Google Gemini API and stores vectors in ChromaDB
- **query_chroma.py** - Queries and retrieves documents from the ChromaDB session_summaries collection
- **neo4j_updater.py** - Executes Cypher queries against the Neo4j knowledge graph

## Usage

Refer to individual script documentation for usage details. Most scripts require environment variables configured in a `.env` file at the project root.

### Required Environment Variables

```bash
# Google Gemini API (for embed_and_store.py)
GOOGLE_API_KEY=your_api_key_here

# Neo4j Knowledge Graph (for neo4j_updater.py)
KNOWLEDGE_GRAPH_URI=bolt://localhost:7687
KNOWLEDGE_GRAPH_USERNAME=neo4j
KNOWLEDGE_GRAPH_PASSWORD=your_password_here
KNOWLEDGE_GRAPH_DATABASE=neo4j
```

### ChromaDB Setup

Scripts assume ChromaDB is running as an HTTP server:
```bash
# Default configuration
Host: localhost
Port: 8000
```
