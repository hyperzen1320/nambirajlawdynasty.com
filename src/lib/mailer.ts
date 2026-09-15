import nodemailer, { type Transporter } from "nodemailer";

// Outbound email for the account flows (sign-up verification and password
// reset). Deliberately small: one SMTP transport, one send function, and
// the two message templates that use it.
//
// Configuration is entirely environment-driven so the same build runs
// against Gmail, the office's own mailcow server, or a throwaway SMTP box
// in development:
//
//   SMTP_HOST   default smtp.gmail.com
//   SMTP_PORT   default 465            (587 also works — see SMTP_SECURE)
//   SMTP_SECURE default "true" on 465, "false" otherwise
//   SMTP_USER   the mailbox that sends  (e.g. legalezi69@gmail.com)
//   SMTP_PASS   that mailbox's password
//   MAIL_FROM   default `Legalezi <SMTP_USER>`
//
// ⚠️ Gmail specifically: Google stopped accepting ordinary account
// passwords over SMTP in 2022. SMTP_PASS must be a 16-character *App
// Password* (Google Account → Security → 2-Step Verification → App
// passwords), not the password you type into the web login. Without one
// the server answers `535-5.7.8 Username and Password not accepted` and
// every OTP mail fails.
//
// When SMTP_USER/SMTP_PASS are absent the mailer reports itself as
// unconfigured rather than throwing at import time — the app still boots,
// and only the flows that actually need mail return a clear error.

export class MailError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "MailError";
    this.cause = cause;
  }
}

const HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const PORT = Number(process.env.SMTP_PORT || 465);
const USER = process.env.SMTP_USER || "";
const PASS = process.env.SMTP_PASS || "";
const SECURE =
  typeof process.env.SMTP_SECURE === "string"
    ? process.env.SMTP_SECURE.toLowerCase() === "true"
    : PORT === 465;
const FROM =
  process.env.MAIL_FROM || (USER ? `Legalezi <${USER}>` : "Legalezi");

/** True when the environment carries enough to actually send mail. */
export function mailerConfigured(): boolean {
  return Boolean(HOST && USER && PASS);
}

let _transport: Transporter | null = null;

function transport(): Transporter {
  if (!mailerConfigured()) {
    throw new MailError(
      "Email isn't configured on this server yet. Set SMTP_USER and SMTP_PASS."
    );
  }
  if (_transport) return _transport;
  _transport = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: SECURE,
    auth: { user: USER, pass: PASS },
    // A hung SMTP dialogue must not hold an API request open forever.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return _transport;
}

export async function sendMail(msg: {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Set so a reply goes to the enquirer rather than the sending mailbox. */
  replyTo?: string;
}): Promise<void> {
  try {
    await transport().sendMail({
      from: FROM,
      to: msg.to,
      replyTo: msg.replyTo,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
  } catch (err) {
    if (err instanceof MailError) throw err;
    // Surface the SMTP reason in the server log; callers get a message
    // that's safe to show a user.
    console.error("[mailer] send failed:", err);
    const code = (err as { responseCode?: number } | null)?.responseCode;
    if (code === 535 || code === 534) {
      throw new MailError(
        "The mail account rejected our credentials. If this is Gmail, SMTP_PASS must be a 16-character App Password.",
        err
      );
    }
    throw new MailError(
      "We couldn't send that email just now. Please try again in a minute.",
      err
    );
  }
}

/* ─── Templates ─── */

export type OtpPurpose = "signup" | "password_reset";

const PURPOSE_COPY: Record<
  OtpPurpose,
  { subject: string; heading: string; lead: string }
> = {
  signup: {
    subject: "Your Legalezi verification code",
    heading: "Verify your email",
    lead: "Use this code to finish opening your chambers on Legalezi and start your 7-day trial.",
  },
  password_reset: {
    subject: "Your Legalezi password reset code",
    heading: "Reset your password",
    lead: "Use this code to set a new password for your Legalezi account.",
  },
};

/**
 * Sends a one-time code. The code is passed in plain text because that's
 * what the recipient has to read — only its hash is ever stored.
 */
export async function sendOtpMail(
  to: string,
  code: string,
  purpose: OtpPurpose,
  minutes: number
): Promise<void> {
  const copy = PURPOSE_COPY[purpose];
  const text = [
    copy.heading,
    "",
    copy.lead,
    "",
    `Code: ${code}`,
    `This code expires in ${minutes} minutes.`,
    "",
    "If you didn't ask for this, you can ignore this email — nothing has changed on your account.",
    "",
    "— Legalezi",
  ].join("\n");

  // Inline styles only: every mail client strips <style> blocks, and the
  // editorial look (paper, ink, brass) has to survive that.
  const html = `
<div style="margin:0;padding:32px 16px;background:#f4ecda;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:520px;margin:0 auto;background:#fffdf7;border:1px solid #e3d9c0;">
    <div style="padding:20px 28px;border-bottom:1px solid #e3d9c0;">
      <div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#8a5821;">
        Legalezi &middot; Advocate Edition
      </div>
    </div>
    <div style="padding:32px 28px;">
      <h1 style="margin:0;font-size:28px;line-height:1.15;font-weight:500;color:#0e1a2b;letter-spacing:-0.02em;">
        ${copy.heading}
      </h1>
      <p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#3c4756;">
        ${copy.lead}
      </p>
      <div style="margin:28px 0;padding:20px;text-align:center;background:#f4ecda;border:1px solid #e3d9c0;">
        <div style="font-family:'Courier New',monospace;font-size:34px;letter-spacing:12px;font-weight:700;color:#0e1a2b;">
          ${code}
        </div>
        <div style="margin-top:10px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8a5821;">
          Expires in ${minutes} minutes
        </div>
      </div>
      <p style="margin:0;font-size:13px;line-height:1.7;color:#6b7280;font-style:italic;">
        If you didn't ask for this, you can ignore this email &mdash; nothing
        has changed on your account.
      </p>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #e3d9c0;font-family:'Courier New',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8a5821;">
      Never share this code with anyone
    </div>
  </div>
</div>`.trim();

  await sendMail({ to, subject: copy.subject, text, html });
}


/* ─── Contact form ─── */

export type Inquiry = {
  name: string;
  email: string;
  phone: string;
  type: string;
  description: string;
};

/**
 * Delivers a website enquiry to the chambers. `to` is a comma-separated
 * recipient list so the office and the site maintainer both get a copy in
 * one send. Reply-To is the enquirer, so hitting reply reaches them
 * directly rather than the sending mailbox.
 */
export async function sendInquiryMail(to: string, i: Inquiry): Promise<void> {
  const subject = `Website enquiry: ${i.type} — ${i.name}`;
  const rows: [string, string][] = [
    ["Name", i.name],
    ["Email", i.email],
    ["Phone", i.phone || "—"],
    ["Inquiry type", i.type],
  ];

  const text = [
    "New enquiry from the Nambiraj Law Dynasty website.",
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    "Brief description:",
    i.description,
  ].join("\n");

  const esc = (v: string) =>
    v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const html = `
<div style="margin:0;padding:32px 16px;background:#f4ecda;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:560px;margin:0 auto;background:#fffdf7;border:1px solid #e3d9c0;">
    <div style="padding:20px 28px;border-bottom:1px solid #e3d9c0;font-family:'Courier New',monospace;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#8a5821;">
      Nambiraj Law Dynasty &middot; Website Enquiry
    </div>
    <div style="padding:28px;">
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
        ${rows
          .map(
            ([k, v]) => `<tr>
          <td style="padding:8px 0;width:130px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8a5821;vertical-align:top;">${k}</td>
          <td style="padding:8px 0;font-size:15px;color:#0e1a2b;">${esc(v)}</td>
        </tr>`
          )
          .join("")}
      </table>
      <div style="margin-top:22px;padding-top:18px;border-top:1px solid #e3d9c0;">
        <div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8a5821;">
          Brief description
        </div>
        <p style="margin:10px 0 0;font-size:15px;line-height:1.7;color:#3c4756;white-space:pre-wrap;">${esc(
          i.description
        )}</p>
      </div>
    </div>
  </div>
</div>`.trim();

  await sendMail({ to, subject, text, html, replyTo: i.email });
}
