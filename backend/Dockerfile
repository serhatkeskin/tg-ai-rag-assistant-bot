FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt -r /app/backend/requirements.txt

COPY . .

ENV PYTHONPATH=/app

CMD ["sh", "-c", "python backend/manage.py migrate --noinput && gunicorn --chdir backend --bind 0.0.0.0:8000 core.wsgi:application"]
