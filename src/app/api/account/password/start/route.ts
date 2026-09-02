import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { corsHeaders } from "@/lib/cors";
import { User } from "@/models/User";
import { issueOtp, OTP_RESEND_COOLDOWN_SECONDS } from "@/lib/otp";
import { mailerConfigured, sendOtpMail, MailError } from "@/lib/mailer";

// POST /api/account/password/start   { email }
//
// Step 1 of the self-serve password reset: mail a one-time code to a
// registered address. Shared by the web forgot-password page and the
// mobile app.
//
// This endpoint never reveals whether an address has an account. The
// throttle is applied to the *address* before we look the user up, so an
// unknown address burns the same rate-limit bucket and produces the same
// response as a known one — there's no timing or wording difference to
// enumerate accounts with. Mail is only actually sent when a live account
// is behind the address.

export const runtime = "nodejs";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
  } | null;
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Enter the email address you sign in with." },
      { status: 400, headers: corsHeaders() }
    );
  }

  // An operator-configuration problem, not a user one — and identical for
  // every address, so saying so plainly leaks nothing.
  if (!mailerConfigured()) {
    return NextResponse.json(
      {
        error:
          "Email isn't set up on this server yet, so codes can't be sent. Please contact the Legalezi desk.",
      },
      { status: 503, headers: corsHeaders() }
    );
  }

  // Throttle FIRST, on the address alone. Doing this before the account
  // lookup is what keeps known and unknown addresses indistinguishable.
  const issued = await issueOtp({ email, purpose: "password_reset" });
  if (!issued.ok) {
    return NextResponse.json(
      {
        ok: true,
        throttled: true,
        retryAfterSeconds: issued.retryAfterSeconds,
      },
      { headers: corsHeaders() }
    );
  }

  await connectDB();
  const user = await User.findOne({ email, isDeleted: false })
    .select("_id active")
    .lean();

  if (user && user.active !== false) {
    try {
      await sendOtpMail(
        email,
        issued.code,
        "password_reset",
        issued.expiresInMinutes
      );
    } catch (err) {
      // A send failure is worth surfacing — but only in terms that are
      // true for any address, so the answer still can't be used to probe
      // for accounts.
      console.error("[password/start] mail failed:", err);
      return NextResponse.json(
        {
          error:
            err instanceof MailError
              ? err.message
              : "We couldn't send that email just now. Please try again in a minute.",
        },
        { status: 502, headers: corsHeaders() }
      );
    }
  }

  return NextResponse.json(
    { ok: true, retryAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS },
    { headers: corsHeaders() }
  );
}
