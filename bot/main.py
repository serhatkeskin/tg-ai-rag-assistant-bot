from __future__ import annotations

import logging
import os

from telegram.ext import (
    Application,
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
    cmd_help,
    cmd_start,
    cmd_status,
    get_storage,
)
from bot.handlers.files import handle_document
from bot.health import start_health_server

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]

_runner = None


async def post_init(application: Application) -> None:
    global _runner
    storage = get_storage()
    await storage.init()
    _runner = await start_health_server()
    logger.info("Health server started on :8080")


async def post_stop(application: Application) -> None:
    global _runner
    if _runner:
        await _runner.cleanup()
        _runner = None


def main() -> None:
    app = (
        ApplicationBuilder()
        .token(BOT_TOKEN)
        .post_init(post_init)
        .post_stop(post_stop)
        .build()
    )

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help", cmd_help))
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
    app.run_polling()


if __name__ == "__main__":
    main()
