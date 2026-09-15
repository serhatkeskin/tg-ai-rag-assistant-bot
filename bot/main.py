from __future__ import annotations

import asyncio
import json
import logging
import os
import time

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
    cmd_clear,
    cmd_delete,
    cmd_docs,
    cmd_help,
    cmd_start,
    cmd_status,
    get_storage,
    handle_text,
)
from bot.handlers.files import handle_document
from bot.health import start_health_server

logging.basicConfig(level=logging.INFO)
# httpx logs every request URL at INFO, and Telegram API URLs embed the bot token.
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
CONTROL_FILE = os.getenv("BOT_CONTROL_FILE", "/tmp/tg_bot_state.json")

_runner = None


async def _control_watcher(application: Application) -> None:
    logger.info("Bot control watcher started (control_file=%s)", CONTROL_FILE)
    while True:
        await asyncio.sleep(1.5)
        try:
            if os.path.exists(CONTROL_FILE):
                with open(CONTROL_FILE, "r") as f:
                    state = json.load(f)
                if state.get("stop", False):
                    logger.info("Received stop request via control file. Stopping bot polling...")
                    application.stop_running()
                    break
                stop_at = state.get("stop_at")
                if stop_at and time.time() >= float(stop_at):
                    logger.info(
                        "Active window expired (stop_at=%s). Stopping bot polling...",
                        stop_at,
                    )
                    application.stop_running()
                    break
        except Exception as e:
            logger.debug("Error checking control file: %s", e)


async def post_init(application: Application) -> None:
    global _runner
    storage = get_storage()
    await storage.init()

    # Record our PID and active window in control file
    try:
        state = {}
        if os.path.exists(CONTROL_FILE):
            try:
                with open(CONTROL_FILE, "r") as f:
                    state = json.load(f)
            except Exception:
                state = {}
        state["pid"] = os.getpid()
        state["is_running"] = True
        state["stop"] = False
        if not state.get("stop_at"):
            duration = float(os.getenv("BOT_ACTIVE_DURATION", "3600"))
            state["stop_at"] = time.time() + duration
            state["started_at"] = time.time()
        with open(CONTROL_FILE, "w") as f:
            json.dump(state, f)
    except Exception as e:
        logger.warning("Could not write initial PID to control file: %s", e)

    asyncio.create_task(_control_watcher(application))

    # Standalone deployments expose /health for the orchestrator. When the bot
    # runs inside the API container, the API's health check covers it.
    health_port = os.getenv("BOT_HEALTH_PORT")
    if health_port:
        _runner = await start_health_server(port=int(health_port))
        logger.info("Health server started on :%s", health_port)


async def post_stop(application: Application) -> None:
    global _runner
    if _runner:
        await _runner.cleanup()
        _runner = None
    try:
        if os.path.exists(CONTROL_FILE):
            with open(CONTROL_FILE, "r") as f:
                state = json.load(f)
            state["is_running"] = False
            state["pid"] = None
            with open(CONTROL_FILE, "w") as f:
                json.dump(state, f)
    except Exception as e:
        logger.warning("Could not write stop state to control file: %s", e)


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
    app.add_handler(CommandHandler("clear", cmd_clear))
    app.add_handler(CommandHandler("ask", cmd_ask))
    app.add_handler(CommandHandler("docs", cmd_docs))
    app.add_handler(CommandHandler("delete", cmd_delete))
    app.add_handler(CommandHandler("admin_set_key", cmd_admin_set_key))
    app.add_handler(CommandHandler("admin_tokens", cmd_admin_tokens))
    app.add_handler(CommandHandler("admin_revoke", cmd_admin_revoke))
    app.add_handler(build_admin_conversation())
    app.add_handler(MessageHandler(filters.Document.ALL, handle_document))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))

    logger.info("Bot polling started")
    app.run_polling()


if __name__ == "__main__":
    main()
