#!/usr/bin/env bash
# Container entrypoint: runs the Django API (Gunicorn). The Telegram bot does
# not start here; it polls only while activated from the web UI
# (POST /api/bot/activate/) and stops when its active window expires, so an
# idle container has no outbound traffic and Railway can put it to sleep.

set -euo pipefail

cd /app/backend
python manage.py migrate --noinput

port="${PORT:-8000}"
export API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:${port}}"

# Railway keeps the container filesystem across sleep, so a bot state file from
# the previous boot would survive with a stale stop_at and a PID that may now
# belong to another process. Nothing from a previous boot is running anymore.
rm -f "${BOT_CONTROL_FILE:-/tmp/tg_bot_state.json}"

if [ -z "${TELEGRAM_BOT_TOKEN:-}" ]; then
  echo "TELEGRAM_BOT_TOKEN not set; the bot cannot be activated"
fi

exec gunicorn core.wsgi:application --bind "0.0.0.0:${port}" --workers 2 --timeout 120
