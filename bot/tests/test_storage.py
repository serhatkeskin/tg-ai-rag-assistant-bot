import os
import tempfile
import pytest
from bot.storage import Storage


def make_storage() -> Storage:
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    return Storage(path)


@pytest.mark.asyncio
async def test_save_and_get_session():
    storage = make_storage()
    await storage.init()
    await storage.save_session(123, "uuid-abc")
    token = await storage.get_token(123)
    assert token == "uuid-abc"


@pytest.mark.asyncio
async def test_get_session_missing():
    storage = make_storage()
    await storage.init()
    token = await storage.get_token(999)
    assert token is None


@pytest.mark.asyncio
async def test_save_and_get_admin_key():
    storage = make_storage()
    await storage.init()
    await storage.save_admin_key(456, "my-admin-key")
    key = await storage.get_admin_key(456)
    assert key == "my-admin-key"


@pytest.mark.asyncio
async def test_get_admin_key_missing():
    storage = make_storage()
    await storage.init()
    key = await storage.get_admin_key(999)
    assert key is None
