"""
Load documents from data/ and index them into pgvector.
Run: python scripts/ingest.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from pathlib import Path
from llama_index.core import SimpleDirectoryReader, VectorStoreIndex, StorageContext
from src.indexer import setup_llama_settings, get_vector_store
from src.config import COLLECTION_NAME

DATA_DIR = Path(__file__).parent.parent / "data"


def main():
    print("Setting up LlamaIndex with Gemini...")
    setup_llama_settings()

    print(f"Loading documents from {DATA_DIR}...")
    documents = SimpleDirectoryReader(str(DATA_DIR)).load_data()
    print(f"  Loaded {len(documents)} document(s)")

    print("Connecting to pgvector...")
    vector_store = get_vector_store()
    storage_context = StorageContext.from_defaults(vector_store=vector_store)

    print("Embedding and indexing documents...")
    index = VectorStoreIndex.from_documents(
        documents,
        storage_context=storage_context,
        show_progress=True,
    )

    print(f"Done. Documents indexed into collection '{COLLECTION_NAME}'.")


if __name__ == "__main__":
    main()
