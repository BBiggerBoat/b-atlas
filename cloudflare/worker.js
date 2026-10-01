import { onRequest } from "../functions/api/[[path]].js";

const CORS_ORIGINS = new Set(["https://b-atlas.org", "https://www.b-atlas.org"]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  if (!CORS_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function withCors(request, response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      const headers = corsHeaders(request);
      if (!headers["Access-Control-Allow-Origin"]) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers });
    }
    const response = await onRequest({
      request,
      env,
      waitUntil: ctx.waitUntil.bind(ctx),
      passThroughOnException() {}
    });
    return withCors(request, response);
  }
};
