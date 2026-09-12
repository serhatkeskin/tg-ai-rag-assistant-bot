#!/usr/bin/env bash
# Container entrypoint: runs the Django API (Gunicorn) and optionally
# starts the Telegram bot with an initial active window upon wake-up.
# The bot automatically stops polling when its active duration expires,
# allowing Railway to put the inactive container to sleep.

set -euo pipefail

cd /app/backend
python manage.py migrate --noinput

port="${PORT:-8000}"
export API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:${port}}"

if [ -n "${TELEGRAM_BOT_TOKEN:-}" ]; then
  export BOT_ACTIVE_DURATION="${BOT_ACTIVE_DURATION:-3600}"
  (cd /app && python -m bot.main) &
else
  echo "TELEGRAM_BOT_TOKEN not set; starting the API without the bot"
fi

exec gunicorn core.wsgi:application --bind "0.0.0.0:${port}" --workers 2 --timeout 120
