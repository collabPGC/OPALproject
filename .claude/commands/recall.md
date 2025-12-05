# Recall Context from Memory System

Retrieve relevant context from past sessions stored in Neo4j and ChromaDB.

## Instructions

Run the memory recall script to get context about this project:

```bash
python G:/Projects/OPALproject/ProjectWork/memory_system/recall_context.py --project "OPAL Device" --limit 5
```

If the user provided a specific query, add it:
```bash
python G:/Projects/OPALproject/ProjectWork/memory_system/recall_context.py --query "$ARGUMENTS" --limit 5
```

After running, summarize the key context retrieved:
1. Recent sessions and their focus areas
2. Concepts that were discussed
3. Files that were modified
4. Any relevant decisions made

This context helps you understand where we left off and what has been done before.
