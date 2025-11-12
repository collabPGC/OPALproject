import os
from neo4j import GraphDatabase
from dotenv import load_dotenv
import sys

# Load environment variables from .env file
load_dotenv()

def run_cypher_query(query):
    """Connects to Neo4j and executes a Cypher query.

    Args:
        query (str): The Cypher query string to execute.

    Returns:
        list: A list of records returned by the query.
    """
    uri = os.getenv("KNOWLEDGE_GRAPH_URI")
    username = os.getenv("KNOWLEDGE_GRAPH_USERNAME")
    password = os.getenv("KNOWLEDGE_GRAPH_PASSWORD")
    database = os.getenv("KNOWLEDGE_GRAPH_DATABASE", "neo4j") # Default to 'neo4j'

    if not all([uri, username, password]):
        print("Error: Neo4j connection details (URI, USERNAME, PASSWORD) not found in .env", file=sys.stderr)
        sys.exit(1)

    driver = None
    try:
        driver = GraphDatabase.driver(uri, auth=(username, password))
        driver.verify_connectivity()
        print("Connected to Neo4j successfully.")

        with driver.session(database=database) as session:
            result = session.run(query)
            records = [record for record in result]
            print(f"Query executed successfully. Records returned: {len(records)}")
            return records
    except Exception as e:
        print(f"Error connecting to or querying Neo4j: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        if driver:
            driver.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python neo4j_updater.py \"<cypher_query>\"", file=sys.stderr)
        sys.exit(1)

    cypher_query = sys.argv[1]
    run_cypher_query(cypher_query)
