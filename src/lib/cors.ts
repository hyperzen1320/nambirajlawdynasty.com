// Permissive CORS for /api/mobile/* endpoints.
// Safe because these endpoints don't use cookies — they require a Bearer
// token in Authorization which isn't auto-attached cross-origin.

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function withCors<T extends Response>(response: T): T {
  const h = corsHeaders();
  for (const [k, v] of Object.entries(h)) {
    response.headers.set(k, v);
  }
  return response;
}
