from llama_index.core import VectorStoreIndex, StorageContext
from llama_index.core.node_parser import SentenceSplitter
from llama_index.embeddings.google_genai import GoogleGenAIEmbedding
from llama_index.llms.google_genai import GoogleGenAI
from llama_index.vector_stores.postgres import PGVectorStore
from llama_index.core import Settings

from src.config import (
    GOOGLE_API_KEY,
    POSTGRES_DB,
    POSTGRES_HOST,
    POSTGRES_PORT,
    POSTGRES_USER,
    POSTGRES_PASSWORD,
    EMBED_MODEL,
    LLM_MODEL,
    COLLECTION_NAME,
    TOP_K,
)


def setup_llama_settings():
    Settings.embed_model = GoogleGenAIEmbedding(
        model_name=EMBED_MODEL, api_key=GOOGLE_API_KEY,
    )
    Settings.llm = GoogleGenAI(model=LLM_MODEL, api_key=GOOGLE_API_KEY)
    Settings.node_parser = SentenceSplitter(chunk_size=256, chunk_overlap=32)


def get_vector_store() -> PGVectorStore:
    return PGVectorStore.from_params(
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
        database=POSTGRES_DB,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
        table_name=COLLECTION_NAME,
        embed_dim=3072,
    )


def get_index(vector_store: PGVectorStore | None = None) -> VectorStoreIndex:
    if vector_store is None:
        vector_store = get_vector_store()
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    return VectorStoreIndex.from_vector_store(
        vector_store=vector_store, storage_context=storage_context,
    )


def get_retriever(index: VectorStoreIndex | None = None, filters=None):
    if index is None:
        index = get_index()
    return index.as_retriever(similarity_top_k=TOP_K, filters=filters)
