// Session Summary for 2025-10-16: Context-Saving System Setup
MERGE (s:Session {id: '2025-10-16-setup', date: '2025-10-16'})
ON CREATE SET s.summary = 'Designed and implemented a system to maintain context across sessions using Neo4j and ChromaDB.'

MERGE (f1:File {path: 'G:/Projects/OPALproject/ProjectWork/embed_and_store.py'})
MERGE (f2:File {path: 'G:/Projects/OPALproject/ProjectWork/.env'})
MERGE (f3:File {path: 'G:/Projects/OPALproject/ProjectWork/AI-CONTEXT.md'})

MERGE (c1:Concept {name: 'Cross-Session Memory'})
MERGE (c2:Concept {name: 'Neo4j'})
MERGE (c3:Concept {name: 'ChromaDB'})
MERGE (c4:Concept {name: 'Vector Embeddings'})
MERGE (c5:Concept {name: 'Automation'})

MERGE (s)-[:CREATED]->(f1)
MERGE (s)-[:USED]->(f2)
MERGE (s)-[:DEFINED_IN]->(f3)
MERGE (s)-[:DISCUSSED]->(c1)
MERGE (s)-[:CONFIGURED]->(c2)
MERGE (s)-[:CONFIGURED]->(c3)
MERGE (s)-[:IMPLEMENTED_WITH]->(c4)
MERGE (s)-[:ACHIEVED]->(c5)

MERGE (f1)-[:IMPLEMENTS]->(c3)
MERGE (f1)-[:IMPLEMENTS]->(c4)
