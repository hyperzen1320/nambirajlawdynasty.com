import { cache } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { isNetworkError } from "@/lib/supabase/errors";

export { isNetworkError, UNREACHABLE_MESSAGE } from "@/lib/supabase/errors";

// Who is using the admin. Signing in proves identity; being listed in
// public.cms_admins is what grants editing rights, and row level security
// enforces the same rule again on every write — this check exists so the UI
// can say "not allowed" instead of failing on save.

export type AdminState =
  | { status: "unconfigured" }
  | { status: "unreachable"; message: string }
  | { status: "signed-out" }
  | { status: "forbidden"; email: string }
  | { status: "ok"; supabase: SupabaseClient; user: User };

// cache(): the admin shell and the page inside it both ask, once per request.
export const getAdminState = cache(async (): Promise<AdminState> => {
  const supabase = await createServerSupabase();
  if (!supabase) return { status: "unconfigured" };

  // getUser() asks the Auth server, so a forged or revoked cookie fails here.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (isNetworkError(userError)) return { status: "unreachable", message: userError!.message };
  if (!user) return { status: "signed-out" };

  const { data: isAdmin, error } = await supabase.rpc("is_cms_admin");
  if (isNetworkError(error)) return { status: "unreachable", message: error!.message };
  if (error || isAdmin !== true) {
    if (error) console.error("[cms] is_cms_admin check failed:", error.message);
    return { status: "forbidden", email: user.email ?? "" };
  }
  return { status: "ok", supabase, user };
});
