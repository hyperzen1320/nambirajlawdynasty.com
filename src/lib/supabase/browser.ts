import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseConfig } from "./config";

// Browser client for the admin (sign-in, media uploads). The config comes from
// the server as a prop rather than from NEXT_PUBLIC_* build-time variables.
export function createBrowserSupabase(config: SupabaseConfig) {
  return createBrowserClient(config.url, config.key);
}
