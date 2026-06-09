const BACKEND_URL = "https://tg-rag-api.projects.serhatkeskin.com";

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const target = `${BACKEND_URL}${url.pathname}${url.search}`;

  const headers = new Headers(request.headers);
  headers.set("host", new URL(BACKEND_URL).host);

  const proxied = new Request(target, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "follow",
  });

  return fetch(proxied);
}
