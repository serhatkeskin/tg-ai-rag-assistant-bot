from __future__ import annotations

import asyncio
import logging
import os

from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    filters,
)

from bot.handlers.admin import (
    build_admin_conversation,
    cmd_admin_revoke,
    cmd_admin_set_key,
    cmd_admin_tokens,
)
from bot.handlers.commands import (
    cmd_ask,
    cmd_auth,
    cmd_delete,
    cmd_docs,
    cmd_start,
    cmd_status,
    get_storage,
)
from bot.handlers.files import handle_document
from bot.health import start_health_server

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]


async def main() -> None:
    storage = get_storage()
    await storage.init()

    runner = await start_health_server()
    logger.info("Health server started on :8080")

    app = ApplicationBuilder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("auth", cmd_auth))
    app.add_handler(CommandHandler("status", cmd_status))
    app.add_handler(CommandHandler("ask", cmd_ask))
    app.add_handler(CommandHandler("docs", cmd_docs))
    app.add_handler(CommandHandler("delete", cmd_delete))
    app.add_handler(CommandHandler("admin_set_key", cmd_admin_set_key))
    app.add_handler(CommandHandler("admin_tokens", cmd_admin_tokens))
    app.add_handler(CommandHandler("admin_revoke", cmd_admin_revoke))
    app.add_handler(build_admin_conversation())
    app.add_handler(MessageHandler(filters.Document.ALL, handle_document))

    logger.info("Bot polling started")
    await app.run_polling()

    await runner.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
