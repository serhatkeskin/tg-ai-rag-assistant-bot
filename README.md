# RAG Assistant — LlamaIndex + Gemini + pgvector, web and Telegram

Token-gated RAG assistant. Documents are embedded with Gemini and stored in
pgvector; every demo token sees the shared corpus plus only its own uploads.
One container serves both channels: the Django API behind the Next.js web UI,
and a Telegram bot process that calls the same API over loopback. Both keep
per-user conversation memory. The bot runs on demand: it polls Telegram only
while activated from the web UI's `/bot` page and stops when its active window
expires, so an idle container can scale to zero.

🔗 **Live demo:** [rag.projects.serhatkeskin.com](https://rag.projects.serhatkeskin.com/)

This repository merges the former `rag-explorer` web demo into the Telegram
assistant; both histories are preserved.

## Demo

A real user flow — start unauthenticated, enter an access token, add your **own**
document, index it, then ask a question answered *only* from that document.

<video src="rag-explorer-portfolio/rag-explorer-demo.mp4" controls muted loop width="100%"></video>

> ▶️ If the player doesn't load inline, [watch the MP4](rag-explorer-portfolio/rag-explorer-demo.mp4) · [view the GIF](rag-explorer-portfolio/rag-explorer-demo.gif)

📄 Case study (architecture, features, screenshots): **[rag-explorer-overview.pdf](rag-explorer-portfolio/rag-explorer-overview.pdf)**

## Features

- **Tenant isolation:** chunks are tagged with the owning token; retrieval and
  chunk listing only return the default corpus plus the caller's uploads.
- **Conversation memory:** `CondensePlusContextChatEngine` rewrites follow-up
  questions using the chat history sent by the client.
- **Language matching:** answers in the language of the question.
- **`!general` keyword:** add it anywhere in a message to answer from the
  model's general knowledge instead of the knowledge base.
- **Token limits:** each demo token expires by date, and optionally after a
  number of queries (`usage_limit`).
- **Admin:** create, list and revoke tokens from `/secret-admin` (web) or the
  bot's admin commands, both behind `ADMIN_KEY`.

## Stack

| Component | Technology |
|---|---|
| LLM | Gemini 3.5 Flash (`gemini-3.5-flash`) |
| Embeddings | Gemini Embedding 2 (`gemini-embedding-2`, 3072 dim) |
| Vector store | PostgreSQL + pgvector (LlamaIndex `PGVectorStore`) |
| API | Django + Django REST Framework (`backend/`) |
| Web UI | Next.js static export on Cloudflare Pages (`frontend/`) |
| Bot | python-telegram-bot, SQLite session store at `/data` (`bot/`) |

## Project structure

```
.
├── backend/            # Django API: tokens, documents, chunks, query
├── bot/                # Telegram bot, runs next to the API and calls it over HTTP
├── frontend/           # Next.js UI + Pages Function proxying /api/* to the API
├── src/
│   ├── config.py       # env + model config
│   ├── indexer.py      # LlamaIndex + pgvector setup
│   ├── graph.py        # chat engines, token filters, !general mode
│   └── main.py         # CLI entry point
├── scripts/
│   ├── start.sh        # container entrypoint: migrate, gunicorn
│   ├── ingest.py       # index data/ into pgvector
│   └── seed_demo.py    # load the NovaTech demo corpus
├── data/demo/          # default knowledge base
└── docker-compose.yml  # postgres + backend (API and bot) for local development
```

## Local development

```bash
cp .env.example .env          # set GOOGLE_API_KEY, TELEGRAM_BOT_TOKEN, keys
docker compose up -d postgres backend
docker compose exec backend python backend/manage.py create_demo_token local
docker compose exec backend python backend/manage.py seed_documents   # shared demo corpus
```

- API: `http://localhost:8000/api/health/`
- Web UI: `cd frontend && npm install && NEXT_PUBLIC_API_URL=http://localhost:8000/api npm run dev`
- Bot: runs inside `backend` once activated from the web UI's `/bot` page
  (needs `TELEGRAM_BOT_TOKEN` in `.env`)
- CLI query: `docker compose exec backend python -m src.main "Your question"`

## Environment

| Variable | Used by | Notes |
|---|---|---|
| `GOOGLE_API_KEY` | backend | Gemini LLM and embeddings |
| `DJANGO_SECRET_KEY`, `ADMIN_KEY`, `DEBUG` | backend | `ADMIN_KEY` guards token admin |
| `DATABASE_URL` or `POSTGRES_HOST/PORT/DB/USER/PASSWORD` | backend | database must have the `vector` extension |
| `TELEGRAM_BOT_TOKEN`, `ADMIN_CHAT_ID` | bot | |
| `API_BASE_URL` | bot | base URL of the API without `/api`; defaults to the local gunicorn |
| `BOT_DB_PATH` | bot | SQLite session store, default `/data/bot.db` (mount a volume) |
| `BOT_HEALTH_PORT` | bot | optional standalone `/health` port; unset inside the API container |
| `BACKEND_URL` | Pages Function | overrides the proxy target |

## Deployment

Pipelines live in a separate private control-plane repository. The API and the
bot run as one Railway service (volume at `/data`) next to a shared Postgres;
the web UI is a Cloudflare Pages project whose Function proxies `/api/*` to the
API, so the browser only ever talks to one origin.
