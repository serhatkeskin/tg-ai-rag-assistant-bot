from llama_index.core.chat_engine import CondensePlusContextChatEngine, SimpleChatEngine
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
GENERAL_KEYWORD = "!general"


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


def _build_memory(chat_history: list[dict] | None) -> ChatMemoryBuffer:
    messages = []
    for msg in (chat_history or []):
        role = MessageRole.USER if msg["role"] == "user" else MessageRole.ASSISTANT
        messages.append(ChatMessage(role=role, content=msg["content"]))
    return ChatMemoryBuffer.from_defaults(chat_history=messages, token_limit=3000)


def run_query(query: str, demo_token=None, chat_history: list[dict] | None = None) -> dict:
    setup_llama_settings()
    llm = GoogleGenAI(model=LLM_MODEL, api_key=GOOGLE_API_KEY)
    memory = _build_memory(chat_history)

    # General knowledge mode — keyword anywhere in query
    if GENERAL_KEYWORD in query.lower():
        actual_query = query.lower().replace(GENERAL_KEYWORD, "").strip()
        if not actual_query:
            return {"answer": f"Please provide a question along with {GENERAL_KEYWORD}.", "sources": []}
        chat_engine = SimpleChatEngine.from_defaults(
            llm=llm,
            memory=memory,
            system_prompt=(
                "You are a helpful AI assistant with broad general knowledge. "
                "Respond in the same language the user writes in. "
                "Be concise and direct."
            ),
        )
        response = chat_engine.chat(actual_query)
        return {"answer": str(response), "sources": []}

    # RAG mode
    retriever = get_retriever(filters=build_token_filters(demo_token))
    chat_engine = CondensePlusContextChatEngine.from_defaults(
        retriever=retriever,
        llm=llm,
        memory=memory,
        system_prompt=(
            "You are a helpful assistant. Answer questions using ONLY the provided context. "
            "IMPORTANT: Always respond in the EXACT same language the user used. "
            "Turkish question → Turkish answer. English question → English answer. "
            f"If the context does not contain enough information to answer, you MUST: "
            f"1) Say in the user's language that this topic is not in the knowledge base. "
            f"2) Suggest they add '{GENERAL_KEYWORD}' anywhere in their message to get a general knowledge answer. "
            f"Example for Turkish: 'Bu konu bilgi havuzumda yer almıyor. "
            f"Genel bilgi için mesajına \"{GENERAL_KEYWORD}\" ekleyebilirsin.' "
            f"Example for English: 'This topic is not in the knowledge base. "
            f"Add \"{GENERAL_KEYWORD}\" to your message for a general knowledge answer.' "
            "Be concise. Use plain text, not markdown."
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
