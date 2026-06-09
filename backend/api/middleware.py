import uuid
from datetime import datetime, timezone
from django.http import JsonResponse


class DemoTokenMiddleware:
    EXEMPT_PATHS = {"/api/health/"}
    EXEMPT_PREFIXES = ("/api/admin/",)

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if (
            request.path in self.EXEMPT_PATHS
            or any(request.path.startswith(p) for p in self.EXEMPT_PREFIXES)
            or request.method == "OPTIONS"
        ):
            return self.get_response(request)

        auth = request.headers.get("Authorization", "")
        raw = auth.removeprefix("Bearer ").strip()

        if not raw:
            return JsonResponse({"error": "Missing token"}, status=401)

        try:
            token_uuid = uuid.UUID(raw)
        except ValueError:
            return JsonResponse({"error": "Invalid token format"}, status=401)

        from api.models import DemoToken

        try:
            tok = DemoToken.objects.get(token=token_uuid, is_active=True)
        except DemoToken.DoesNotExist:
            return JsonResponse({"error": "Token not found or revoked"}, status=401)

        if tok.expires_at < datetime.now(tz=timezone.utc):
            return JsonResponse({"error": "Token expired"}, status=401)

        if tok.usage_limit is not None and tok.usage_count >= tok.usage_limit:
            return JsonResponse({"error": "Usage limit reached"}, status=429)

        request.demo_token = tok
        return self.get_response(request)
