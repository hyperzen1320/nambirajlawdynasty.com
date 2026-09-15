import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { isNetworkError } from "@/lib/supabase/errors";

// Runs before every /admin request. Two jobs:
//   1. Keep the Supabase session fresh — an expiring access token is refreshed
//      here and the new cookies written onto the response, since Server
//      Components can't set cookies themselves.
//   2. Send signed-out visitors to the login page early.
// This is an optimistic gate only. Admin rights are checked again in the
// admin shell and in every server action, and enforced by row level security.

export async function proxy(request: NextRequest) {
  const isLogin = request.nextUrl.pathname === "/admin/login";
  let response = NextResponse.next({ request });

  const supabaseConfig = getSupabaseConfig();
  if (!supabaseConfig) {
    // Nothing to authenticate against; the login page explains on submit.
    return isLogin ? response : NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const supabase = createServerClient(supabaseConfig.url, supabaseConfig.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Cache-busting headers from Supabase so no proxy caches a session.
        for (const [key, value] of Object.entries(headers ?? {})) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Verifies the session token (refreshing it when due). Nothing may run
  // between creating the client and this call, or sessions drop at random.
  const { data, error } = await supabase.auth.getClaims();

  // If Supabase is unreachable, don't treat the visitor as signed out — let the
  // request through and the admin shell explains the outage instead.
  if (!data?.claims && !isLogin && !isNetworkError(error)) {
    const redirect = NextResponse.redirect(new URL("/admin/login", request.url));
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
