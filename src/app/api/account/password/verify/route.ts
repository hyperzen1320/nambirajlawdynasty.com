import { NextResponse } from "next/server";
import { corsHeaders } from "@/lib/cors";
import { verifyOtp, verifyFailureMessage } from "@/lib/otp";
import { signPasswordResetTicket } from "@/lib/jwt";

// POST /api/account/password/verify   { email, code }
//
// Step 2 of the reset: exchange a correct one-time code for a short-lived
// signed ticket. The ticket — not the code, and not a client-held "I
// verified, honest" flag — is what step 3 will accept, so the final
// password write can't be reached by anyone who didn't read the mailbox.

export const runtime = "nodejs";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    code?: unknown;
  } | null;
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (!email || !code) {
    return NextResponse.json(
      { error: "Enter the code we emailed you." },
      { status: 400, headers: corsHeaders() }
    );
  }

  const result = await verifyOtp({ email, purpose: "password_reset", code });
  if (!result.ok) {
    return NextResponse.json(
      { error: verifyFailureMessage(result), reason: result.reason },
      { status: 400, headers: corsHeaders() }
    );
  }

  const ticket = await signPasswordResetTicket(email);
  return NextResponse.json({ ok: true, ticket }, { headers: corsHeaders() });
}
