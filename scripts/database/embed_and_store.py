"""Embeds and stores file content in a vector database.

This script takes one or more file paths as input, generates vector embeddings
for the content of each file using a Google Gemini embedding model, and stores
the content and its corresponding embedding in a ChromaDB collection.

Author: Hubert Williams
Version: 1.3.0
Date: 2025-10-16
"""
import chromadb
import os
import sys
import google.generativeai as genai
from dotenv import load_dotenv
import concurrent.futures
from functools import partial

# Load environment variables from .env file
load_dotenv()

def get_embedding(text, model="models/embedding-001"):
    """Generates an embedding for the given text using a Gemini model.

    Args:
        text (str): The text content to embed.
        model (str): The name of the Gemini embedding model to use.

    Returns:
        list[float]: The vector embedding for the text.
    """
    text = text.replace("\n", " ")
    return genai.embed_content(model=model, content=text)['embedding']


def process_file(file_path, collection, api_key):
    """Reads, embeds, and stores the content of a single file.

    This function handles the entire pipeline for one file: reading its content,
    generating a vector embedding via the Google Gemini API, and storing the result
    in the specified ChromaDB collection. Errors are printed to stderr.

    Args:
        file_path (str): The path to the file to process.
        collection (chromadb.Collection): An initialized ChromaDB collection object.
        api_key (str): The Google API key.
    """
    if not os.path.exists(file_path):
        print(f"Error: File not found at {file_path}", file=sys.stderr)
        return

    try:
        # --- Configure API for this thread ---
        genai.configure(api_key=api_key)

        # --- Read File ---
        with open(file_path, 'r', encoding='utf-8') as f:
            text_content = f.read()

        # --- Generate Embedding ---
        embedding = get_embedding(text_content)

        # --- Store in ChromaDB ---
        # Use the absolute file path as a unique ID to prevent duplicates
        collection.add(
            embeddings=[embedding],
            documents=[text_content],
            ids=[os.path.abspath(file_path)]
        )

        print(f"Successfully embedded and stored '{file_path}' in ChromaDB collection '{collection.name}'.")
    except Exception as e:
        print(f"An error occurred while processing {file_path}: {e}", file=sys.stderr)


def main():
    """Main entry point for the script.

    Parses command-line arguments, initializes API clients, and processes
    the specified files concurrently using a thread pool.

    Usage:
        python embed_and_store.py <file_path1> <file_path2> ...

    Raises:
        SystemExit: If no file paths are provided or if the GOOGLE_API_KEY
            is not found in the environment variables.
    """
    if len(sys.argv) < 2:
        print("Usage: python embed_and_store.py <file_path1> <file_path2> ...", file=sys.stderr)
        sys.exit(1)

    file_paths = sys.argv[1:]
    
    # --- Configuration ---
    api_key = os.getenv("GOOGLE_API_KEY")
    collection_name = "session_summaries"

    # --- Validation ---
    if not api_key:
        print("Error: GOOGLE_API_KEY not found in environment variables.", file=sys.stderr)
        sys.exit(1)

    # --- Initialize ChromaDB Client ---
    chroma_client = chromadb.HttpClient(host='localhost', port=8000)
    collection = chroma_client.get_or_create_collection(name=collection_name)

    # --- Process files concurrently ---
    # Create a partial function with the API key and collection
    process_func = partial(process_file, collection=collection, api_key=api_key)
    
    # Use a ThreadPoolExecutor to process files in parallel
    with concurrent.futures.ThreadPoolExecutor() as executor:
        executor.map(process_func, file_paths)

    print("\nAll files processed.")

if __name__ == "__main__":
    main()
