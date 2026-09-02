import { NextResponse } from "next/server";
import { mailerConfigured, sendInquiryMail, MailError } from "@/lib/mailer";
import { contactLimiter } from "@/lib/upstash";

// POST /api/contact
//   { name, email, phone, type, description, company? }
//
// The public enquiry form on /contact. Delivers one mail to the chambers
// (and to whoever else is on RECIPIENTS) with Reply-To set to the enquirer.
//
// Nothing is persisted — the office works out of its inbox, and storing
// unsolicited personal details we have no plan to use is a liability rather
// than a feature.

export const runtime = "nodejs";

// Comma-separated so more addresses can be added without a code change.
const RECIPIENTS =
  process.env.CONTACT_RECIPIENTS || "nambirajlawdynasty@gmail.com";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_DESCRIPTION = 4000;

type Input = {
  name: string;
  email: string;
  phone: string;
  type: string;
  description: string;
};

function validate(body: unknown): Input | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request." };
  const b = body as Record<string, unknown>;
  const str = (k: string) =>
    typeof b[k] === "string" ? (b[k] as string).trim() : "";

  // Honeypot: a field hidden from people but filled in by naive bots. Answer
  // 200 so the bot has no signal that it was caught.
  if (str("company")) return { error: "__honeypot__" };

  const name = str("name");
  const email = str("email").toLowerCase();
  const phone = str("phone");
  const type = str("type");
  const description = str("description");

  if (!name) return { error: "Please tell us your name." };
  if (name.length > 120) return { error: "That name is too long." };
  if (!email || !EMAIL_RE.test(email))
    return { error: "That email address doesn't look right." };
  if (phone && phone.replace(/\D/g, "").length < 8)
    return { error: "That phone number doesn't look right." };
  if (!type) return { error: "Choose an inquiry type." };
  if (!description) return { error: "Tell us briefly about your matter." };
  if (description.length > MAX_DESCRIPTION)
    return { error: "That description is too long." };

  return { name, email, phone, type, description };
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = validate(body);
  if ("error" in parsed) {
    // Silently accept honeypot hits.
    if (parsed.error === "__honeypot__")
      return NextResponse.json({ ok: true });
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const limiter = contactLimiter();
  if (limiter) {
    const { success } = await limiter.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: "Too many enquiries from this connection. Try again later." },
        { status: 429 }
      );
    }
  }

  // Without SMTP credentials the server cannot send. Say so explicitly so
  // the form can fall back to opening the visitor's own mail client rather
  // than swallowing the enquiry.
  if (!mailerConfigured()) {
    return NextResponse.json(
      {
        error: "Email isn't configured on this server yet.",
        mailUnconfigured: true,
      },
      { status: 503 }
    );
  }

  try {
    await sendInquiryMail(RECIPIENTS, parsed);
  } catch (err) {
    const message =
      err instanceof MailError
        ? err.message
        : "We couldn't send that just now. Please try again in a minute.";
    console.error("[contact] send failed:", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
