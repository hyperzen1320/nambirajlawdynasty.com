import { NextResponse } from "next/server";
import { corsHeaders } from "@/lib/cors";
import { verifyOtp, verifyFailureMessage, clearOtp } from "@/lib/otp";
import {
  provisionTrialChambers,
  SELF_SIGNUP_TRIAL_DAYS,
  type SignupPayload,
} from "@/lib/signup";

// POST /api/account/signup/verify   { email, code }
//
// Step 2: the code checks out, so the details captured in step 1 are spent
// — Partner + partner-admin User are created on the trial plan and the
// chambers appears in the global admin's list, marked as a self sign-up
// with a verified email.

export const runtime = "nodejs";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

function isSignupPayload(v: unknown): v is SignupPayload {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.chambersName === "string" &&
    typeof p.contactName === "string" &&
    typeof p.phone === "string" &&
    typeof p.passwordHash === "string" &&
    p.passwordHash.length > 0
  );
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

  const result = await verifyOtp({ email, purpose: "signup", code });
  if (!result.ok) {
    return NextResponse.json(
      { error: verifyFailureMessage(result), reason: result.reason },
      { status: 400, headers: corsHeaders() }
    );
  }

  if (!isSignupPayload(result.payload)) {
    // The challenge verified but carries nothing to build a chambers from
    // — only reachable if the row was written by an older/other flow.
    await clearOtp(email, "signup");
    return NextResponse.json(
      { error: "That sign-up has expired. Please start again." },
      { status: 400, headers: corsHeaders() }
    );
  }

  const provisioned = await provisionTrialChambers({
    email,
    payload: result.payload,
  });
  if (!provisioned.ok) {
    return NextResponse.json(
      { error: provisioned.error },
      { status: provisioned.status, headers: corsHeaders() }
    );
  }

  // The chambers exists now — drop the challenge so the code can't be
  // replayed and the stored password hash doesn't linger.
  await clearOtp(email, "signup");

  return NextResponse.json(
    {
      ok: true,
      partner: {
        id: provisioned.partnerId,
        name: provisioned.partnerName,
        slug: provisioned.slug,
      },
      trial: {
        days: SELF_SIGNUP_TRIAL_DAYS,
        endsAt: provisioned.trialEndsAt.toISOString(),
        seatLimit: provisioned.seatLimit,
      },
    },
    { status: 201, headers: corsHeaders() }
  );
}
