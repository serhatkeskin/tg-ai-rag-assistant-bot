import pytest
from aioresponses import aioresponses
from bot.services.api_client import APIClient

BASE = "http://testserver"


def make_client(token="test-token", admin_key=None):
    return APIClient(BASE, token=token, admin_key=admin_key)


@pytest.mark.asyncio
async def test_me_success():
    client = make_client()
    with aioresponses() as m:
        m.get(f"{BASE}/api/me/", status=200, payload={"label": "demo", "is_active": True})
        result = await client.me()
    assert result["status"] == 200
    assert result["data"]["label"] == "demo"


@pytest.mark.asyncio
async def test_me_unauthorized():
    client = make_client()
    with aioresponses() as m:
        m.get(f"{BASE}/api/me/", status=401)
        result = await client.me()
    assert result["status"] == 401
    assert result["data"] is None


@pytest.mark.asyncio
async def test_list_documents():
    client = make_client()
    with aioresponses() as m:
        m.get(f"{BASE}/api/documents/", status=200, payload=[{"id": 1, "title": "doc1"}])
        result = await client.list_documents()
    assert result["status"] == 200
    assert result["data"][0]["id"] == 1


@pytest.mark.asyncio
async def test_delete_document():
    client = make_client()
    with aioresponses() as m:
        m.delete(f"{BASE}/api/documents/5/", status=200, payload={"deleted": True})
        result = await client.delete_document(5)
    assert result["status"] == 200


@pytest.mark.asyncio
async def test_upload_document():
    client = make_client()
    with aioresponses() as m:
        m.post(f"{BASE}/api/documents/upload/", status=201, payload={"id": 3, "title": "file.pdf"})
        result = await client.upload_document("file.pdf", b"bytes")
    assert result["status"] == 201
    assert result["data"]["id"] == 3


@pytest.mark.asyncio
async def test_query():
    client = make_client()
    with aioresponses() as m:
        m.post(f"{BASE}/api/query/", status=200, payload={"answer": "42"})
        result = await client.query("What is the answer?")
    assert result["status"] == 200
    assert result["data"]["answer"] == "42"


@pytest.mark.asyncio
async def test_admin_create_token():
    client = make_client(admin_key="secret-admin")
    with aioresponses() as m:
        m.post(
            f"{BASE}/api/admin/tokens/",
            status=201,
            payload={"id": 7, "label": "new-user", "token": "uuid-xyz", "is_active": True},
        )
        result = await client.admin_create_token("new-user", 30)
    assert result["status"] == 201
    assert result["data"]["label"] == "new-user"


@pytest.mark.asyncio
async def test_admin_revoke_token():
    client = make_client(admin_key="secret-admin")
    with aioresponses() as m:
        m.delete(f"{BASE}/api/admin/tokens/7/", status=200, payload={"revoked": True})
        result = await client.admin_revoke_token(7)
    assert result["status"] == 200
