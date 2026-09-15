import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

// A cookie-less client for reading public content. It carries no user session,
// which is exactly what lets CMS reads run inside "use cache" scopes — row
// level security grants everyone read access to published documents.
export function createPublicSupabase() {
  const config = getSupabaseConfig();
  if (!config) return null;
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
