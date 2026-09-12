from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import DemoToken


def make_token(label="test", days=30) -> DemoToken:
    return DemoToken.objects.create(
        label=label,
        expires_at=timezone.now() + timedelta(days=days),
    )


class HealthTest(TestCase):
    def test_health(self):
        r = APIClient().get("/api/health/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"status": "ok"})


class MeTest(TestCase):
    def test_me_requires_auth(self):
        r = APIClient().get("/api/me/")
        self.assertEqual(r.status_code, 401)

    def test_me_returns_token_info(self):
        tok = make_token("demo-user")
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {tok.token}")
        r = client.get("/api/me/")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["label"], "demo-user")
        self.assertTrue(data["is_active"])

    def test_me_expired_token(self):
        tok = DemoToken.objects.create(
            label="old",
            expires_at=timezone.now() - timedelta(days=1),
        )
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {tok.token}")
        r = client.get("/api/me/")
        self.assertEqual(r.status_code, 401)


class AdminTokensTest(TestCase):
    def setUp(self):
        from django.conf import settings
        self.admin_key = settings.ADMIN_KEY

    def test_create_token(self):
        client = APIClient()
        r = client.post(
            "/api/admin/tokens/",
            {"label": "new-user", "days": 7},
            format="json",
            HTTP_X_ADMIN_KEY=self.admin_key,
        )
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["label"], "new-user")
        self.assertTrue(r.json()["is_active"])

    def test_list_tokens(self):
        make_token("a")
        make_token("b")
        client = APIClient()
        r = client.get("/api/admin/tokens/", HTTP_X_ADMIN_KEY=self.admin_key)
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(len(r.json()), 2)

    def test_revoke_token(self):
        tok = make_token("to-revoke")
        client = APIClient()
        r = client.delete(
            f"/api/admin/tokens/{tok.id}/",
            HTTP_X_ADMIN_KEY=self.admin_key,
        )
        self.assertEqual(r.status_code, 200)
        tok.refresh_from_db()
        self.assertFalse(tok.is_active)

    def test_admin_key_required(self):
        r = APIClient().get("/api/admin/tokens/")
        self.assertEqual(r.status_code, 403)


class BotEndpointsTest(TestCase):
    def test_bot_endpoints_require_auth(self):
        client = APIClient()
        r1 = client.get("/api/bot/status/")
        self.assertEqual(r1.status_code, 401)
        r2 = client.post("/api/bot/activate/", {"duration_seconds": 30}, format="json")
        self.assertEqual(r2.status_code, 401)
        r3 = client.post("/api/bot/stop/")
        self.assertEqual(r3.status_code, 401)

    def test_bot_status_with_token(self):
        tok = make_token("bot-test")
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {tok.token}")
        r = client.get("/api/bot/status/")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("is_running", data)
        self.assertIn("remaining_seconds", data)
        self.assertIn("bot_username", data)

    def test_bot_status_with_admin_key(self):
        from django.conf import settings
        client = APIClient()
        r = client.get("/api/bot/status/", HTTP_X_ADMIN_KEY=settings.ADMIN_KEY)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("is_running", data)

    def test_bot_stop_with_token(self):
        tok = make_token("bot-test-stop")
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {tok.token}")
        r = client.post("/api/bot/stop/")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["is_running"])

