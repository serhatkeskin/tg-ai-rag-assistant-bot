from typing import TypedDict, Any
from langgraph.graph import StateGraph, START, END
from llama_index.llms.google_genai import GoogleGenAI
from llama_index.core.vector_stores import (
    MetadataFilter, MetadataFilters, FilterOperator, FilterCondition,
)

from src.config import GOOGLE_API_KEY, LLM_MODEL
from src.indexer import setup_llama_settings, get_retriever

DEFAULT_TAG = "__default__"


class RAGState(TypedDict):
    query: str
    context: str
    answer: str
    sources: list
    retriever: Any


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


def retrieve_node(state: RAGState) -> RAGState:
    nodes = state["retriever"].retrieve(state["query"])
    sources = []
    context_parts = []
    for i, node in enumerate(nodes, 1):
        title = node.metadata.get("title", "") if node.metadata else ""
        header = f"[{i}] (Source: {title})" if title else f"[{i}]"
        context_parts.append(f"{header}\n{node.text}")
        sources.append({
            "text": node.text,
            "score": round(float(node.score), 4) if node.score is not None else None,
            "metadata": node.metadata or {},
        })
    return {**state, "context": "\n\n".join(context_parts), "sources": sources}


def generate_node(state: RAGState) -> RAGState:
    llm = GoogleGenAI(model=LLM_MODEL, api_key=GOOGLE_API_KEY)
    prompt = f"""You are a helpful assistant. Answer the question using ONLY the provided context.
If the context does not contain enough information, say so clearly.
Be concise and direct. Use plain text, not markdown.

Context:
{state['context']}

Question: {state['query']}

Answer:"""
    response = llm.complete(prompt)
    return {**state, "answer": str(response)}


def build_graph():
    graph = StateGraph(RAGState)
    graph.add_node("retrieve", retrieve_node)
    graph.add_node("generate", generate_node)
    graph.add_edge(START, "retrieve")
    graph.add_edge("retrieve", "generate")
    graph.add_edge("generate", END)
    return graph.compile()


def run_query(query: str, demo_token=None) -> dict:
    setup_llama_settings()
    retriever = get_retriever(filters=build_token_filters(demo_token))
    app = build_graph()
    result = app.invoke({
        "query": query, "context": "", "answer": "", "sources": [],
        "retriever": retriever,
    })
    return {"answer": result["answer"], "sources": result["sources"]}
