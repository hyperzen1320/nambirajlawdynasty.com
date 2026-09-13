import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";

// A client bound to the signed-in admin's session cookies, for the admin
// pages and server actions. Writes it performs are checked by row level
// security as that user.
export async function createServerSupabase() {
  const config = getSupabaseConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies. That's fine: src/proxy.ts
          // refreshes the session on every admin request before render.
        }
      },
    },
  });
}
