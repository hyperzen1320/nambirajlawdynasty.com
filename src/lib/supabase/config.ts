// Supabase connection settings, read from the server's environment at RUNTIME.
//
// Deliberately not NEXT_PUBLIC_*: Next inlines those at build time, and the
// Docker build never sees .env (see .dockerignore), so they would be frozen as
// undefined in the image. The browser only needs these values inside the
// admin, which receives them from the server as props.

export type SupabaseConfig = { url: string; key: string };

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL?.trim();
  // The publishable key (sb_publishable_…) — the legacy anon key works too.
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  return { url: url.replace(/\/+$/, ""), key };
}
