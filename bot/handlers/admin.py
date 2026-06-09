from __future__ import annotations

import os

from telegram import Update
from telegram.ext import (
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from bot.handlers.commands import get_storage
from bot.services.api_client import APIClient

API_BASE_URL = os.getenv("API_BASE_URL", "http://backend:8000")
ADMIN_CHAT_ID = int(os.getenv("ADMIN_CHAT_ID", "0"))

ASK_LABEL = 0
ASK_DAYS = 1


def _is_admin(chat_id: int) -> bool:
    return ADMIN_CHAT_ID != 0 and chat_id == ADMIN_CHAT_ID


async def cmd_admin_set_key(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    if not _is_admin(chat_id):
        await update.message.reply_text("Unauthorized.")
        return

    args = context.args
    if not args:
        await update.message.reply_text("Usage: `/admin_set_key <admin-key>`", parse_mode="Markdown")
        return

    key = args[0].strip()
    storage = get_storage()
    await storage.save_admin_key(chat_id, key)
    await update.message.reply_text("Admin key saved.")


async def cmd_admin_tokens(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    if not _is_admin(chat_id):
        await update.message.reply_text("Unauthorized.")
        return

    storage = get_storage()
    admin_key = await storage.get_admin_key(chat_id)
    if not admin_key:
        await update.message.reply_text("No admin key set. Use `/admin_set_key <key>` first.", parse_mode="Markdown")
        return

    client = APIClient(API_BASE_URL, admin_key=admin_key)
    result = await client.admin_list_tokens()
    if result["status"] != 200:
        await update.message.reply_text("Failed to list tokens.")
        return

    tokens = result["data"]
    if not tokens:
        await update.message.reply_text("No tokens found.")
        return

    lines = ["*All tokens:*"]
    for tok in tokens:
        status = "active" if tok["is_active"] else "revoked"
        lines.append(f"[{tok['id']}] {tok['label']} — {status} — expires {tok.get('expires_at', 'N/A')}")
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


async def cmd_admin_revoke(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    if not _is_admin(chat_id):
        await update.message.reply_text("Unauthorized.")
        return

    args = context.args
    if not args or not args[0].isdigit():
        await update.message.reply_text("Usage: `/admin_revoke <token-id>`", parse_mode="Markdown")
        return

    storage = get_storage()
    admin_key = await storage.get_admin_key(chat_id)
    if not admin_key:
        await update.message.reply_text("No admin key set. Use `/admin_set_key <key>` first.", parse_mode="Markdown")
        return

    token_id = int(args[0])
    client = APIClient(API_BASE_URL, admin_key=admin_key)
    result = await client.admin_revoke_token(token_id)
    if result["status"] == 200:
        await update.message.reply_text(f"Token {token_id} revoked.")
    elif result["status"] == 404:
        await update.message.reply_text("Token not found.")
    else:
        await update.message.reply_text("Revoke failed.")


# ConversationHandler for /admin_create_token
async def admin_create_token_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    chat_id = update.effective_chat.id
    if not _is_admin(chat_id):
        await update.message.reply_text("Unauthorized.")
        return ConversationHandler.END

    storage = get_storage()
    admin_key = await storage.get_admin_key(chat_id)
    if not admin_key:
        await update.message.reply_text("No admin key set. Use `/admin_set_key <key>` first.", parse_mode="Markdown")
        return ConversationHandler.END

    await update.message.reply_text("Enter label for the new token:")
    return ASK_LABEL


async def admin_create_token_label(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    label = update.message.text.strip()
    if not label:
        await update.message.reply_text("Label cannot be empty. Try again:")
        return ASK_LABEL
    context.user_data["new_token_label"] = label
    await update.message.reply_text(f"Label: *{label}*\nHow many days should this token be valid?", parse_mode="Markdown")
    return ASK_DAYS


async def admin_create_token_days(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip()
    if not text.isdigit() or int(text) < 1:
        await update.message.reply_text("Enter a positive integer for days:")
        return ASK_DAYS

    days = int(text)
    label = context.user_data.get("new_token_label", "unknown")
    chat_id = update.effective_chat.id

    storage = get_storage()
    admin_key = await storage.get_admin_key(chat_id)
    client = APIClient(API_BASE_URL, admin_key=admin_key)
    result = await client.admin_create_token(label, days)

    if result["status"] == 201:
        tok = result["data"]
        await update.message.reply_text(
            f"Token created!\nLabel: *{tok['label']}*\nToken: `{tok['token']}`\nExpires: {tok.get('expires_at', 'N/A')}",
            parse_mode="Markdown",
        )
    else:
        await update.message.reply_text("Failed to create token.")

    context.user_data.pop("new_token_label", None)
    return ConversationHandler.END


async def admin_create_token_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data.pop("new_token_label", None)
    await update.message.reply_text("Cancelled.")
    return ConversationHandler.END


def build_admin_conversation() -> ConversationHandler:
    return ConversationHandler(
        entry_points=[CommandHandler("admin_create_token", admin_create_token_start)],
        states={
            ASK_LABEL: [MessageHandler(filters.TEXT & ~filters.COMMAND, admin_create_token_label)],
            ASK_DAYS: [MessageHandler(filters.TEXT & ~filters.COMMAND, admin_create_token_days)],
        },
        fallbacks=[CommandHandler("cancel", admin_create_token_cancel)],
    )
