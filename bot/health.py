from __future__ import annotations

from aiohttp import web


async def health_handler(request: web.Request) -> web.Response:
    return web.json_response({"status": "ok"})


def build_app() -> web.Application:
    app = web.Application()
    app.router.add_get("/health", health_handler)
    return app


async def start_health_server(host: str = "0.0.0.0", port: int = 8080) -> web.AppRunner:
    app = build_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host, port)
    await site.start()
    return runner
