import os
import re
from dotenv import load_dotenv

load_dotenv()

GOOGLE_API_KEY = os.environ["GOOGLE_API_KEY"]

_DATABASE_URL = os.getenv("DATABASE_URL")
if _DATABASE_URL:
    _m = re.match(r"postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+):(\d+)/(.+)", _DATABASE_URL)
    if not _m:
        raise ValueError(f"Cannot parse DATABASE_URL: {_DATABASE_URL!r}")
    POSTGRES_USER = _m.group(1)
    POSTGRES_PASSWORD = _m.group(2)
    POSTGRES_HOST = _m.group(3)
    POSTGRES_PORT = _m.group(4)
    POSTGRES_DB = _m.group(5)
else:
    POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
    POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_DB = os.getenv("POSTGRES_DB", "ragdb")
    POSTGRES_USER = os.getenv("POSTGRES_USER", "raguser")
    POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "ragpass")

PG_CONNECTION_STRING = (
    f"postgresql+psycopg2://{POSTGRES_USER}:{POSTGRES_PASSWORD}"
    f"@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
)

EMBED_MODEL = "gemini-embedding-2"
LLM_MODEL = "gemini-3.5-flash"
COLLECTION_NAME = "rag_docs"
TOP_K = 3
