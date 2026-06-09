from __future__ import annotations

import aiosqlite


class Storage:
    def __init__(self, db_path: str = "/data/bot.db"):
        self.db_path = db_path

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
