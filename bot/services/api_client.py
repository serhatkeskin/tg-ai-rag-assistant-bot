from __future__ import annotations

import aiohttp


class APIClient:
    def __init__(self, base_url: str, token: str | None = None, admin_key: str | None = None):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.admin_key = admin_key

    def _auth_headers(self) -> dict:
        if self.token:
            return {"Authorization": f"Bearer {self.token}"}
        return {}

    def _admin_headers(self) -> dict:
        if self.admin_key:
            return {"X-Admin-Key": self.admin_key}
        return {}

    async def me(self) -> dict:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.base_url}/api/me/",
                headers=self._auth_headers(),
            ) as resp:
                return {"status": resp.status, "data": await resp.json() if resp.status == 200 else None}

    async def list_documents(self) -> dict:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.base_url}/api/documents/",
                headers=self._auth_headers(),
            ) as resp:
                return {"status": resp.status, "data": await resp.json() if resp.status == 200 else None}

    async def delete_document(self, doc_id: int) -> dict:
        async with aiohttp.ClientSession() as session:
            async with session.delete(
                f"{self.base_url}/api/documents/{doc_id}/",
                headers=self._auth_headers(),
            ) as resp:
                body = None
                try:
                    body = await resp.json()
                except Exception:
                    pass
                return {"status": resp.status, "data": body}

    async def upload_document(self, filename: str, file_bytes: bytes, content_type: str = "application/octet-stream") -> dict:
        async with aiohttp.ClientSession() as session:
            form = aiohttp.FormData()
            form.add_field("file", file_bytes, filename=filename, content_type=content_type)
            async with session.post(
                f"{self.base_url}/api/documents/upload/",
                data=form,
                headers=self._auth_headers(),
            ) as resp:
                return {"status": resp.status, "data": await resp.json() if resp.status in (200, 201) else None}

    async def query(self, question: str) -> dict:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/api/query/",
                json={"question": question},
                headers=self._auth_headers(),
            ) as resp:
                return {"status": resp.status, "data": await resp.json() if resp.status == 200 else None}

    async def chunks_count(self) -> dict:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.base_url}/api/chunks/",
                headers=self._auth_headers(),
            ) as resp:
                return {"status": resp.status, "data": await resp.json() if resp.status == 200 else None}

    async def admin_list_tokens(self) -> dict:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.base_url}/api/admin/tokens/",
                headers=self._admin_headers(),
            ) as resp:
                return {"status": resp.status, "data": await resp.json() if resp.status == 200 else None}

    async def admin_create_token(self, label: str, days: int) -> dict:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/api/admin/tokens/",
                json={"label": label, "days": days},
                headers=self._admin_headers(),
            ) as resp:
                return {"status": resp.status, "data": await resp.json() if resp.status == 201 else None}

    async def admin_revoke_token(self, token_id: int) -> dict:
        async with aiohttp.ClientSession() as session:
            async with session.delete(
                f"{self.base_url}/api/admin/tokens/{token_id}/",
                headers=self._admin_headers(),
            ) as resp:
                body = None
                try:
                    body = await resp.json()
                except Exception:
                    pass
                return {"status": resp.status, "data": body}
