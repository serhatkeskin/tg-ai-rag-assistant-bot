#!/usr/bin/env bash
# Container entrypoint: runs the Django API and, when TELEGRAM_BOT_TOKEN is
# set, the Telegram bot as a second process in the same container. The bot
# reaches the API over loopback. If either process exits, the container exits
# with its status so the platform restarts both.

set -euo pipefail

cd /app/backend
python manage.py migrate --noinput

port="${PORT:-8000}"
gunicorn core.wsgi:application --bind "0.0.0.0:${port}" --workers 3 --timeout 120 &

if [ -n "${TELEGRAM_BOT_TOKEN:-}" ]; then
  export API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:${port}}"
  (cd /app && python -m bot.main) &
else
  echo "TELEGRAM_BOT_TOKEN not set; starting the API without the bot"
fi

trap 'kill $(jobs -p) 2>/dev/null' TERM INT
set +e
wait -n
status=$?
kill $(jobs -p) 2>/dev/null
exit "$status"
