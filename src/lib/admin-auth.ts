import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { verifyMobileJWT } from "@/lib/jwt";
import { corsHeaders } from "@/lib/cors";

export type AdminContext = {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    userType: "global_admin";
  };
  isMobile: boolean;
};

/**
 * Allows admin access via either:
 *  - Auth.js cookie session (web admin pages)
 *  - Bearer JWT in Authorization header (mobile admin)
 *
 * Use in any /api/admin/* route handler. CORS headers are added to error
 * responses so mobile (cross-origin) gets a clean reply.
 */
export async function requireAdmin(
  request: Request
): Promise<{ ctx: AdminContext } | { error: NextResponse }> {
  // Try Bearer JWT (mobile)
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    try {
      const payload = await verifyMobileJWT(token);
      if (payload.userType !== "global_admin") {
        return {
          error: NextResponse.json(
            { error: "Forbidden — admin only" },
            { status: 403, headers: corsHeaders() }
          ),
        };
      }
      return {
        ctx: {
          user: {
            id: payload.sub,
            email: payload.email,
            firstName: payload.firstName,
            lastName: payload.lastName,
            userType: "global_admin",
          },
          isMobile: true,
        },
      };
    } catch {
      return {
        error: NextResponse.json(
          { error: "Invalid or expired token" },
          { status: 401, headers: corsHeaders() }
        ),
      };
    }
  }

  // Fall back to cookie session (web)
  const session = await auth();
  if (!session?.user || session.user.userType !== "global_admin") {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return {
    ctx: {
      user: {
        id: session.user.id ?? "",
        email: session.user.email ?? "",
        firstName: session.user.firstName ?? "",
        lastName: session.user.lastName ?? "",
        userType: "global_admin",
      },
      isMobile: false,
    },
  };
}
