from llama_index.core.chat_engine import CondensePlusContextChatEngine
from llama_index.core.llms import ChatMessage, MessageRole
from llama_index.core.memory import ChatMemoryBuffer
from llama_index.core.vector_stores import (
    FilterCondition,
    FilterOperator,
    MetadataFilter,
    MetadataFilters,
)
from llama_index.llms.google_genai import GoogleGenAI

from src.config import GOOGLE_API_KEY, LLM_MODEL
from src.indexer import get_retriever, setup_llama_settings

DEFAULT_TAG = "__default__"


def build_token_filters(demo_token=None) -> MetadataFilters:
    values = [DEFAULT_TAG]
    if demo_token:
        values.append(str(demo_token))
    return MetadataFilters(
        filters=[
            MetadataFilter(key="demo_token", value=v, operator=FilterOperator.EQ)
            for v in values
        ],
        condition=FilterCondition.OR,
    )


def run_query(query: str, demo_token=None, chat_history: list[dict] | None = None) -> dict:
    setup_llama_settings()
    retriever = get_retriever(filters=build_token_filters(demo_token))
    llm = GoogleGenAI(model=LLM_MODEL, api_key=GOOGLE_API_KEY)

    messages = []
    for msg in (chat_history or []):
        role = MessageRole.USER if msg["role"] == "user" else MessageRole.ASSISTANT
        messages.append(ChatMessage(role=role, content=msg["content"]))

    memory = ChatMemoryBuffer.from_defaults(
        chat_history=messages,
        token_limit=3000,
    )

    chat_engine = CondensePlusContextChatEngine.from_defaults(
        retriever=retriever,
        llm=llm,
        memory=memory,
        system_prompt=(
            "You are a helpful assistant. Answer questions using ONLY the provided context. "
            "If the context does not contain enough information, say so clearly. "
            "Be concise and direct. Use plain text, not markdown."
        ),
    )

    response = chat_engine.chat(query)

    sources = []
    for node in getattr(response, "source_nodes", []):
        sources.append({
            "text": node.text,
            "score": round(float(node.score), 4) if node.score is not None else None,
            "metadata": node.metadata or {},
        })

    return {"answer": str(response), "sources": sources}
