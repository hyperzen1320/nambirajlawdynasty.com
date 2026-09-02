import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { corsHeaders } from "@/lib/cors";
import { issueOtp, OTP_RESEND_COOLDOWN_SECONDS } from "@/lib/otp";
import { mailerConfigured, sendOtpMail, MailError } from "@/lib/mailer";
import { emailAvailable, type SignupPayload } from "@/lib/signup";

// POST /api/account/signup/start
//   { chambersName, contactName, phone, email, password }
//
// Step 1 of self-serve sign-up: collect the chambers details and mail a
// one-time code. NOTHING is written to Partner or User here — the details
// ride along inside the OTP record and are only spent once the address has
// proved itself, so an unverified address can never leave a half-made
// tenant in the global admin's list.
//
// The password is hashed before it's stored on that record; the plaintext
// never outlives this request.

export const runtime = "nodejs";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

type Input = {
  chambersName: string;
  contactName: string;
  phone: string;
  email: string;
  password: string;
};

function validate(body: unknown): Input | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request." };
  const b = body as Record<string, unknown>;
  const str = (k: string) => (typeof b[k] === "string" ? (b[k] as string).trim() : "");

  const chambersName = str("chambersName");
  const contactName = str("contactName");
  const phone = str("phone");
  const email = str("email").toLowerCase();
  const password = typeof b.password === "string" ? b.password : "";

  if (!chambersName) return { error: "Your chambers needs a name." };
  if (chambersName.length > 120)
    return { error: "That chambers name is too long." };
  if (!contactName) return { error: "Tell us who you are." };
  if (!phone || phone.replace(/\D/g, "").length < 8)
    return { error: "Enter a phone number we can reach you on." };
  if (!email || !EMAIL_RE.test(email))
    return { error: "That email address doesn't look right." };
  if (password.length < MIN_PASSWORD)
    return { error: `Your password must be at least ${MIN_PASSWORD} characters.` };

  return { chambersName, contactName, phone, email, password };
}

export async function POST(request: Request) {
  const parsed = validate(await request.json().catch(() => null));
  if ("error" in parsed) {
    return NextResponse.json(
      { error: parsed.error },
      { status: 400, headers: corsHeaders() }
    );
  }

  if (!mailerConfigured()) {
    return NextResponse.json(
      {
        error:
          "Email isn't set up on this server yet, so we can't verify your address. Please contact the Legalezi desk.",
      },
      { status: 503, headers: corsHeaders() }
    );
  }

  // Sign-up genuinely has to say when an address is taken — there's no way
  // to offer someone an account on an email that already has one. (The
  // password-reset flow, where saying so WOULD leak, deliberately doesn't.)
  if (!(await emailAvailable(parsed.email))) {
    return NextResponse.json(
      {
        error:
          "That email already has a Legalezi account. Sign in instead, or reset your password.",
        code: "email_taken",
      },
      { status: 409, headers: corsHeaders() }
    );
  }

  const payload: SignupPayload = {
    chambersName: parsed.chambersName,
    contactName: parsed.contactName,
    phone: parsed.phone,
    passwordHash: await bcrypt.hash(parsed.password, 12),
  };

  const issued = await issueOtp({
    email: parsed.email,
    purpose: "signup",
    payload: payload as unknown as Record<string, unknown>,
  });
  if (!issued.ok) {
    return NextResponse.json(
      {
        error:
          issued.reason === "cooldown"
            ? `A code was just sent. You can ask for another in ${issued.retryAfterSeconds}s.`
            : "Too many codes requested for this address. Try again a little later.",
        retryAfterSeconds: issued.retryAfterSeconds,
      },
      { status: 429, headers: corsHeaders() }
    );
  }

  try {
    await sendOtpMail(
      parsed.email,
      issued.code,
      "signup",
      issued.expiresInMinutes
    );
  } catch (err) {
    console.error("[signup/start] mail failed:", err);
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

  return NextResponse.json(
    { ok: true, retryAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS },
    { headers: corsHeaders() }
  );
}
