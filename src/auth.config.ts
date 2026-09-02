import type { NextAuthConfig } from "next-auth";

// Edge-safe base config. No DB/Mongoose imports — used by middleware too.
// The full Credentials provider with DB lookup lives in src/auth.ts.

export default {
  // Derive the canonical site URL from the incoming request's
  // X-Forwarded-Host / Host headers instead of trusting NEXTAUTH_URL /
  // AUTH_URL. Without this, a stale `NEXTAUTH_URL=http://localhost:3000`
  // left over from a developer's `.env.local` (or copied into Vercel's
  // env vars) causes Auth.js to embed localhost in the `callbackUrl`
  // query param of /login — and then the post-sign-in redirect bounces
  // the user from the production hostname back to localhost. Vercel
  // already terminates TLS in front of us and sets the forwarded-host
  // header, so trusting it here is safe.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;

      // Auth API endpoints must always be reachable.
      if (pathname.startsWith("/api/auth")) return true;

      // API endpoints — protected at the handler level (JWT or cookie).
      // Don't gate via proxy so mobile JWT requests aren't redirected to /login.
      if (pathname.startsWith("/api/mobile")) return true;
      if (pathname.startsWith("/api/admin")) return true;
      if (pathname.startsWith("/api/app")) return true;

      const isAuthed = !!auth?.user;
      const userType = auth?.user?.userType;

      // Only the partner app and the global-admin console require a session.
      // Everything else — the public marketing site (home, about, practising
      // area, services, contact, product) and the auth screens — is open.
      // This is deliberately the inverse of an allow-list: a newly added
      // marketing page is public by default and can never be silently gated
      // behind /login the way an omitted allow-list entry would be.
      const isProtected =
        pathname.startsWith("/app") || pathname.startsWith("/admin");

      if (!isProtected) {
        // A signed-in user has no reason to sit on the login screen.
        if (isAuthed && pathname === "/login") {
          const dest = userType === "global_admin" ? "/admin" : "/app";
          return Response.redirect(new URL(dest, request.url));
        }
        return true;
      }

      // Protected routes from here on.
      if (!isAuthed) return false; // triggers redirect to /login

      if (pathname.startsWith("/admin") && userType !== "global_admin") {
        return Response.redirect(new URL("/app", request.url));
      }

      if (pathname.startsWith("/app") && userType === "global_admin") {
        return Response.redirect(new URL("/admin", request.url));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.userType = (user as { userType: string }).userType;
        token.partnerId = (user as { partnerId: string | null }).partnerId;
        token.firstName = (user as { firstName: string }).firstName;
        token.lastName = (user as { lastName: string }).lastName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // @ts-expect-error custom fields populated via type augmentation
        session.user.id = token.id;
        // @ts-expect-error custom fields populated via type augmentation
        session.user.userType = token.userType;
        // @ts-expect-error custom fields populated via type augmentation
        session.user.partnerId = token.partnerId;
        // @ts-expect-error custom fields populated via type augmentation
        session.user.firstName = token.firstName;
        // @ts-expect-error custom fields populated via type augmentation
        session.user.lastName = token.lastName;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
