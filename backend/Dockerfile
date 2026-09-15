FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# Install the RAG, Django and Telegram bot dependencies
COPY requirements.txt /app/requirements.txt
COPY backend/requirements.txt /app/backend/requirements.txt
COPY bot/requirements.txt /app/bot/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt -r /app/backend/requirements.txt -r /app/bot/requirements.txt

COPY . .

ENV PYTHONPATH=/app

# API; the Telegram bot is started on demand from the web UI (/bot)
CMD ["bash", "/app/scripts/start.sh"]
