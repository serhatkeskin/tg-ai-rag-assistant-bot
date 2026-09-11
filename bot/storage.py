from __future__ import annotations

import os

import aiosqlite


class Storage:
    def __init__(self, db_path: str | None = None):
        self.db_path = db_path or os.getenv("BOT_DB_PATH", "/data/bot.db")

    async def init(self):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS user_sessions (
                    chat_id INTEGER PRIMARY KEY,
                    token_uuid TEXT NOT NULL,
                    registered_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            """)
            await db.execute("""
                CREATE TABLE IF NOT EXISTS admin_sessions (
                    chat_id INTEGER PRIMARY KEY,
                    admin_key TEXT NOT NULL,
                    set_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            """)
            await db.execute("""
                CREATE TABLE IF NOT EXISTS chat_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    chat_id INTEGER NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            """)
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_chat_history_chat_id ON chat_history (chat_id)"
            )
            await db.commit()

    async def save_session(self, chat_id: int, token_uuid: str) -> None:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT OR REPLACE INTO user_sessions (chat_id, token_uuid) VALUES (?, ?)",
                (chat_id, token_uuid),
            )
            await db.commit()

    async def get_token(self, chat_id: int) -> str | None:
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(
                "SELECT token_uuid FROM user_sessions WHERE chat_id = ?",
                (chat_id,),
            ) as cursor:
                row = await cursor.fetchone()
                return row[0] if row else None

    async def save_admin_key(self, chat_id: int, admin_key: str) -> None:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT OR REPLACE INTO admin_sessions (chat_id, admin_key) VALUES (?, ?)",
                (chat_id, admin_key),
            )
            await db.commit()

    async def get_admin_key(self, chat_id: int) -> str | None:
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(
                "SELECT admin_key FROM admin_sessions WHERE chat_id = ?",
                (chat_id,),
            ) as cursor:
                row = await cursor.fetchone()
                return row[0] if row else None

    async def add_message(self, chat_id: int, role: str, content: str, max_messages: int = 10) -> None:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT INTO chat_history (chat_id, role, content) VALUES (?, ?, ?)",
                (chat_id, role, content),
            )
            await db.execute(
                """DELETE FROM chat_history WHERE chat_id = ? AND id NOT IN (
                    SELECT id FROM chat_history WHERE chat_id = ? ORDER BY id DESC LIMIT ?
                )""",
                (chat_id, chat_id, max_messages),
            )
            await db.commit()

    async def get_history(self, chat_id: int, limit: int = 10) -> list[dict]:
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(
                "SELECT role, content FROM chat_history WHERE chat_id = ? ORDER BY id DESC LIMIT ?",
                (chat_id, limit),
            ) as cursor:
                rows = await cursor.fetchall()
        return [{"role": r[0], "content": r[1]} for r in reversed(rows)]

    async def clear_history(self, chat_id: int) -> None:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("DELETE FROM chat_history WHERE chat_id = ?", (chat_id,))
            await db.commit()
