const DEFAULT_BACKEND = "https://rag-api-production-d85e.up.railway.app";

export async function onRequest(context) {
  const backend = (context.env && context.env.BACKEND_URL) || DEFAULT_BACKEND;
  const url = new URL(context.request.url);
  const target = `${backend}${url.pathname}${url.search}`;

  const headers = new Headers(context.request.headers);
  headers.set("host", new URL(backend).host);

  const init = { method: context.request.method, headers };

  if (!["GET", "HEAD"].includes(context.request.method)) {
    init.body = context.request.body;
  }

  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Admin-Key",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      },
    });
  }

  const upstream = await fetch(target, init);
  const respHeaders = new Headers(upstream.headers);
  respHeaders.set("Access-Control-Allow-Origin", "*");

  return new Response(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  });
}
