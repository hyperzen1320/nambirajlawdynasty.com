import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { EmailOtp, type OtpPurpose } from "@/models/EmailOtp";

// Issue / verify one-time email codes. Everything about the policy lives
// here so the routes stay thin and the two flows (sign-up verification and
// password reset) can never drift apart.
//
// Policy, in one place:
//   • 6 digits, valid for 10 minutes
//   • 5 wrong guesses burns the code (a fresh one must be requested)
//   • 60-second cooldown between sends to the same address
//   • 5 sends per address per hour
//
// bcrypt at cost 8 rather than the 12 used for passwords: a 6-digit code
// only lives for ten minutes and is rate-limited to 5 guesses, so the
// work factor buys nothing but latency on a path a user is waiting on.

export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MAX_SENDS_PER_WINDOW = 5;
export const OTP_WINDOW_MINUTES = 60;

const BCRYPT_COST = 8;

export type IssueResult =
  | { ok: true; code: string; expiresInMinutes: number }
  | { ok: false; reason: "cooldown"; retryAfterSeconds: number }
  | { ok: false; reason: "too_many"; retryAfterSeconds: number };

export type VerifyResult =
  | { ok: true; payload: Record<string, unknown> | null }
  | { ok: false; reason: "not_found" | "expired" | "used" | "locked" | "mismatch"; attemptsLeft?: number };

function generateCode(): string {
  // randomInt is CSPRNG-backed; padStart keeps leading zeros so every code
  // is exactly OTP_LENGTH characters.
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

/**
 * Mints a code for (email, purpose), replacing any live one, and returns
 * it so the caller can mail it. Enforces the cooldown and the per-address
 * hourly cap; the caller should surface `retryAfterSeconds` verbatim.
 *
 * `payload` is stored alongside and handed back on a successful verify —
 * that's how sign-up keeps the chambers details out of the database until
 * the address has been proven.
 */
export async function issueOtp(args: {
  email: string;
  purpose: OtpPurpose;
  payload?: Record<string, unknown> | null;
}): Promise<IssueResult> {
  const email = args.email.trim().toLowerCase();
  const purpose = args.purpose;
  await connectDB();
  const now = new Date();

  const existing = await EmailOtp.findOne({ email, purpose }).lean();

  let sends = 1;
  let windowStartedAt = now;
  if (existing) {
    const windowAge = now.getTime() - existing.windowStartedAt.getTime();
    const windowOpen = windowAge < OTP_WINDOW_MINUTES * 60_000;

    if (windowOpen) {
      const sinceLast = now.getTime() - existing.lastSentAt.getTime();
      if (sinceLast < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
        return {
          ok: false,
          reason: "cooldown",
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((OTP_RESEND_COOLDOWN_SECONDS * 1000 - sinceLast) / 1000)
          ),
        };
      }
      if (existing.sends >= OTP_MAX_SENDS_PER_WINDOW) {
        return {
          ok: false,
          reason: "too_many",
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((OTP_WINDOW_MINUTES * 60_000 - windowAge) / 1000)
          ),
        };
      }
      sends = existing.sends + 1;
      windowStartedAt = existing.windowStartedAt;
    }
  }

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, BCRYPT_COST);
  const codeExpiry = new Date(now.getTime() + OTP_TTL_MINUTES * 60_000);
  // Keep the row alive until the throttle window closes too, otherwise the
  // TTL index would delete the send-count and hand the caller a fresh
  // allowance every ten minutes.
  const windowEnd = new Date(
    windowStartedAt.getTime() + OTP_WINDOW_MINUTES * 60_000
  );
  const expiresAt =
    windowEnd > codeExpiry ? windowEnd : codeExpiry;

  await EmailOtp.findOneAndUpdate(
    { email, purpose },
    {
      $set: {
        email,
        purpose,
        codeHash,
        payload: args.payload ?? null,
        attempts: 0,
        consumedAt: null,
        sends,
        windowStartedAt,
        lastSentAt: now,
        codeExpiresAt: codeExpiry,
        expiresAt,
      },
    },
    { upsert: true, new: true }
  );

  return { ok: true, code, expiresInMinutes: OTP_TTL_MINUTES };
}

/**
 * Checks a submitted code. A success consumes the challenge so the same
 * code can never be replayed; a failure increments the attempt counter and
 * burns the challenge once the cap is hit.
 */
export async function verifyOtp(args: {
  email: string;
  purpose: OtpPurpose;
  code: string;
}): Promise<VerifyResult> {
  const email = args.email.trim().toLowerCase();
  const purpose = args.purpose;
  const code = args.code.replace(/\D/g, "");
  await connectDB();

  const doc = await EmailOtp.findOne({ email, purpose });
  if (!doc) return { ok: false, reason: "not_found" };
  if (doc.consumedAt) return { ok: false, reason: "used" };
  if (doc.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: "locked" };

  // The code dies before the document does — the throttle window has to
  // outlive the code it's counting, so check the code's own deadline.
  if (new Date() > doc.codeExpiresAt) return { ok: false, reason: "expired" };

  if (code.length !== OTP_LENGTH) {
    doc.attempts += 1;
    await doc.save();
    return {
      ok: false,
      reason: "mismatch",
      attemptsLeft: Math.max(0, OTP_MAX_ATTEMPTS - doc.attempts),
    };
  }

  const match = await bcrypt.compare(code, doc.codeHash);
  if (!match) {
    doc.attempts += 1;
    await doc.save();
    return {
      ok: false,
      reason: "mismatch",
      attemptsLeft: Math.max(0, OTP_MAX_ATTEMPTS - doc.attempts),
    };
  }

  const payload = (doc.payload ?? null) as Record<string, unknown> | null;
  doc.consumedAt = new Date();
  await doc.save();
  return { ok: true, payload };
}

/** Drops any live challenge — used once a flow has fully completed. */
export async function clearOtp(
  email: string,
  purpose: OtpPurpose
): Promise<void> {
  await connectDB();
  await EmailOtp.deleteOne({ email: email.trim().toLowerCase(), purpose });
}

/** Human-readable message for a failed verify, safe to show a user. */
export function verifyFailureMessage(result: Extract<VerifyResult, { ok: false }>): string {
  switch (result.reason) {
    case "not_found":
      return "That code has expired. Ask for a new one.";
    case "expired":
      return "That code has expired. Ask for a new one.";
    case "used":
      return "That code has already been used. Ask for a new one.";
    case "locked":
      return "Too many wrong codes. Ask for a new one.";
    case "mismatch":
      return result.attemptsLeft && result.attemptsLeft > 0
        ? `That code doesn't match. ${result.attemptsLeft} ${
            result.attemptsLeft === 1 ? "try" : "tries"
          } left.`
        : "Too many wrong codes. Ask for a new one.";
  }
}
