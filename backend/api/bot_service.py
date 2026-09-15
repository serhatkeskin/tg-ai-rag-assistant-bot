from __future__ import annotations

import json
import logging
import os
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from django.conf import settings

logger = logging.getLogger(__name__)

CONTROL_FILE = os.getenv("BOT_CONTROL_FILE", "/tmp/tg_bot_state.json")
BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "aven_ai_assistant_bot")


def _is_pid_alive(pid: int | None) -> bool:
    if not pid or pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, OSError):
        return False


def read_state() -> dict:
    if not os.path.exists(CONTROL_FILE):
        return {"is_running": False, "pid": None, "stop_at": None, "started_at": None}
    try:
        with open(CONTROL_FILE, "r") as f:
            return json.load(f)
    except Exception as e:
        logger.warning("Failed to read bot control file: %s", e)
        return {"is_running": False, "pid": None, "stop_at": None, "started_at": None}


def write_state(state: dict) -> None:
    try:
        temp_file = f"{CONTROL_FILE}.tmp"
        with open(temp_file, "w") as f:
            json.dump(state, f)
        os.replace(temp_file, CONTROL_FILE)
    except Exception as e:
        logger.error("Failed to write bot control file: %s", e)


def get_bot_status() -> dict:
    state = read_state()
    pid = state.get("pid")
    stop_at = state.get("stop_at")
    alive = _is_pid_alive(pid)

    if alive:
        if stop_at and time.time() >= float(stop_at):
            # Window expired: signal graceful stop
            try:
                os.kill(pid, signal.SIGTERM)
            except Exception:
                pass
            state["is_running"] = False
            state["pid"] = None
            write_state(state)
            return {
                "is_running": False,
                "active_until": None,
                "remaining_seconds": 0,
                "bot_username": BOT_USERNAME,
                "has_token": bool(os.getenv("TELEGRAM_BOT_TOKEN")),
            }
        else:
            remaining = int(float(stop_at) - time.time()) if stop_at else 0
            active_until = (
                datetime.fromtimestamp(float(stop_at), tz=timezone.utc).isoformat()
                if stop_at
                else None
            )
            return {
                "is_running": True,
                "active_until": active_until,
                "remaining_seconds": max(0, remaining),
                "bot_username": BOT_USERNAME,
                "has_token": bool(os.getenv("TELEGRAM_BOT_TOKEN")),
            }
    else:
        if state.get("is_running"):
            state["is_running"] = False
            state["pid"] = None
            write_state(state)
        return {
            "is_running": False,
            "active_until": None,
            "remaining_seconds": 0,
            "bot_username": BOT_USERNAME,
            "has_token": bool(os.getenv("TELEGRAM_BOT_TOKEN")),
        }


def activate_bot(duration_seconds: int = 3600) -> dict:
    duration_seconds = max(5, min(duration_seconds, 86400))
    stop_at = time.time() + duration_seconds
    state = read_state()
    pid = state.get("pid")

    if _is_pid_alive(pid):
        state["stop_at"] = stop_at
        state["stop"] = False
        state["is_running"] = True
        write_state(state)
        logger.info("Bot extended for %s seconds until %s", duration_seconds, stop_at)
        return get_bot_status()

    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not bot_token:
        raise ValueError("TELEGRAM_BOT_TOKEN is not configured")

    state = {
        "is_running": True,
        "pid": None,
        "started_at": time.time(),
        "stop_at": stop_at,
        "stop": False,
    }
    write_state(state)

    project_root = Path(settings.BASE_DIR).parent
    env = os.environ.copy()
    env["PYTHONPATH"] = str(project_root)
    env["BOT_CONTROL_FILE"] = CONTROL_FILE
    env["BOT_ACTIVE_DURATION"] = str(duration_seconds)
    env["API_BASE_URL"] = env.get(
        "API_BASE_URL", f"http://127.0.0.1:{os.getenv('PORT', '8000')}"
    )

    # The bot inherits the worker's stdout/stderr so its logs reach the
    # container log stream.
    proc = subprocess.Popen(
        [sys.executable, "-m", "bot.main"],
        cwd=str(project_root),
        env=env,
        start_new_session=True,
    )

    state["pid"] = proc.pid
    write_state(state)
    logger.info("Bot started with PID %s for %s seconds", proc.pid, duration_seconds)

    return get_bot_status()


def stop_bot() -> dict:
    state = read_state()
    pid = state.get("pid")
    state["stop"] = True
    state["is_running"] = False
    write_state(state)

    if _is_pid_alive(pid):
        try:
            os.kill(pid, signal.SIGTERM)
        except Exception as e:
            logger.warning("Error stopping bot PID %s: %s", pid, e)

    state["pid"] = None
    state["stop_at"] = None
    write_state(state)
    return get_bot_status()
