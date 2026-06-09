from __future__ import annotations

import os

from telegram import Update
from telegram.ext import ContextTypes

from bot.handlers.commands import get_storage
from bot.services.api_client import APIClient

API_BASE_URL = os.getenv("API_BASE_URL", "http://backend:8000")
MAX_FILE_BYTES = 20 * 1024 * 1024  # 20 MB


async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    storage = get_storage()
    token = await storage.get_token(chat_id)
    if not token:
        await update.message.reply_text("Not authenticated. Use `/auth <token>`.", parse_mode="Markdown")
        return

    tg_doc = update.message.document
    if tg_doc is None:
        await update.message.reply_text("Send a PDF or TXT file.")
        return

    filename = tg_doc.file_name or "upload"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ("pdf", "txt"):
        await update.message.reply_text("Only PDF and TXT files are supported.")
        return

    if tg_doc.file_size and tg_doc.file_size > MAX_FILE_BYTES:
        await update.message.reply_text("File too large (max 20 MB).")
        return

    await update.message.reply_text(f"Uploading *{filename}*...", parse_mode="Markdown")

    tg_file = await tg_doc.get_file()
    file_bytes = await tg_file.download_as_bytearray()

    content_type = "application/pdf" if ext == "pdf" else "text/plain"
    client = APIClient(API_BASE_URL, token=token)
    try:
        result = await client.upload_document(filename, bytes(file_bytes), content_type=content_type)
    except Exception as exc:
        await update.message.reply_text(f"Could not reach the API: {exc}")
        return

    if result["status"] in (200, 201):
        data = result["data"]
        chunks = data.get("chunk_count", "?")
        await update.message.reply_text(
            f"Uploaded *{data.get('title', filename)}* — {chunks} chunks indexed.",
            parse_mode="Markdown",
        )
    elif result["status"] == 401:
        await update.message.reply_text("Token expired. Use `/auth <token>` to re-authenticate.", parse_mode="Markdown")
    else:
        await update.message.reply_text("Upload failed. Try again later.")
