
import chromadb
import sys

def query_chroma():
    """
    Connects to ChromaDB, retrieves all documents from the 'session_summaries' collection,
    and prints them to the console.
    """
    try:
        # --- Initialize Clients Once ---
        chroma_client = chromadb.HttpClient(host='localhost', port=8000)
        collection = chroma_client.get_collection(name="session_summaries") # Use get_collection instead of get_or_create

        # --- Retrieve all documents ---
        results = collection.get(include=["documents"])

        # --- Print documents ---
        if results and results['documents']:
            print("--- Documents from 'session_summaries' collection ---")
            for doc in results['documents']:
                print(doc)
                print("--------------------")
        else:
            print("No documents found in 'session_summaries' collection.")

    except Exception as e:
        print(f"An error occurred: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    query_chroma()
