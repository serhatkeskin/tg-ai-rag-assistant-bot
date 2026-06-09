from __future__ import annotations

import os

from telegram import Update
from telegram.ext import ContextTypes

from bot.services.api_client import APIClient
from bot.storage import Storage

API_BASE_URL = os.getenv("API_BASE_URL", "http://backend:8000")

_storage: Storage | None = None


def get_storage() -> Storage:
    global _storage
    if _storage is None:
        _storage = Storage()
    return _storage


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    storage = get_storage()
    token = await storage.get_token(chat_id)
    if token:
        client = APIClient(API_BASE_URL, token=token)
        result = await client.me()
        if result["status"] == 200:
            info = result["data"]
            await update.message.reply_text(
                f"Welcome back! You are authenticated as *{info['label']}*.\n\n"
                "Commands:\n"
                "/ask <question> — Ask the RAG assistant\n"
                "/docs — List your documents\n"
                "/upload — Upload a document (send as file)\n"
                "/status — Show token info",
                parse_mode="Markdown",
            )
            return
    await update.message.reply_text(
        "Welcome to Aven AI Assistant!\n\n"
        "Send your demo token to get started:\n"
        "`/auth <your-token>`",
        parse_mode="Markdown",
    )


async def cmd_auth(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    args = context.args
    if not args:
        await update.message.reply_text("Usage: `/auth <your-token>`", parse_mode="Markdown")
        return

    token = args[0].strip()
    client = APIClient(API_BASE_URL, token=token)
    result = await client.me()

    if result["status"] == 200:
        storage = get_storage()
        await storage.save_session(chat_id, token)
        info = result["data"]
        await update.message.reply_text(
            f"Authenticated as *{info['label']}*. Token expires: {info.get('expires_at', 'N/A')}",
            parse_mode="Markdown",
        )
    elif result["status"] == 401:
        await update.message.reply_text("Invalid or expired token.")
    else:
        await update.message.reply_text("Authentication failed. Try again later.")


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    storage = get_storage()
    token = await storage.get_token(chat_id)
    if not token:
        await update.message.reply_text("Not authenticated. Use `/auth <token>`.", parse_mode="Markdown")
        return

    client = APIClient(API_BASE_URL, token=token)
    result = await client.me()
    if result["status"] == 200:
        info = result["data"]
        await update.message.reply_text(
            f"Label: *{info['label']}*\nActive: {info['is_active']}\nExpires: {info.get('expires_at', 'N/A')}",
            parse_mode="Markdown",
        )
    else:
        await update.message.reply_text("Token is no longer valid. Use `/auth <token>` to re-authenticate.", parse_mode="Markdown")


async def cmd_ask(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    storage = get_storage()
    token = await storage.get_token(chat_id)
    if not token:
        await update.message.reply_text("Not authenticated. Use `/auth <token>`.", parse_mode="Markdown")
        return

    question = " ".join(context.args or [])
    if not question:
        await update.message.reply_text("Usage: `/ask <your question>`", parse_mode="Markdown")
        return

    await update.message.reply_text("Thinking...")
    client = APIClient(API_BASE_URL, token=token)
    result = await client.query(question)
    if result["status"] == 200:
        answer = result["data"].get("answer", "No answer returned.")
        await update.message.reply_text(answer)
    elif result["status"] == 401:
        await update.message.reply_text("Token expired. Use `/auth <token>` to re-authenticate.", parse_mode="Markdown")
    else:
        await update.message.reply_text("Query failed. Try again later.")


async def cmd_docs(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    storage = get_storage()
    token = await storage.get_token(chat_id)
    if not token:
        await update.message.reply_text("Not authenticated. Use `/auth <token>`.", parse_mode="Markdown")
        return

    client = APIClient(API_BASE_URL, token=token)
    result = await client.list_documents()
    if result["status"] != 200:
        await update.message.reply_text("Failed to fetch documents.")
        return

    docs = result["data"]
    if not docs:
        await update.message.reply_text("No documents uploaded yet. Send a PDF or TXT file to upload.")
        return

    lines = ["*Your documents:*"]
    for doc in docs:
        deletable = doc.get("deletable", True)
        marker = "" if deletable else " (shared)"
        lines.append(f"• [{doc['id']}] {doc['title']}{marker}")
    lines.append("\nTo delete: `/delete <id>`")
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


async def cmd_delete(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    storage = get_storage()
    token = await storage.get_token(chat_id)
    if not token:
        await update.message.reply_text("Not authenticated.", parse_mode="Markdown")
        return

    args = context.args
    if not args or not args[0].isdigit():
        await update.message.reply_text("Usage: `/delete <document-id>`", parse_mode="Markdown")
        return

    doc_id = int(args[0])
    client = APIClient(API_BASE_URL, token=token)
    result = await client.delete_document(doc_id)
    if result["status"] == 200:
        await update.message.reply_text(f"Document {doc_id} deleted.")
    elif result["status"] == 403:
        await update.message.reply_text("Cannot delete shared documents.")
    elif result["status"] == 404:
        await update.message.reply_text("Document not found.")
    else:
        await update.message.reply_text("Delete failed.")
