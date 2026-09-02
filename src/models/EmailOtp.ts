import mongoose, { Schema, Types, type Model } from "mongoose";

// One-time email codes for the two self-serve account flows:
//
//   • signup          — proves the address exists before we create a
//                       chambers for it. The pending sign-up details ride
//                       along in `payload` so nothing is written to
//                       Partner/User until the code checks out.
//   • password_reset  — proves the address belongs to whoever is asking
//                       for a new password.
//
// Only the bcrypt hash of the code is stored; a leaked database read
// therefore can't be replayed as a login. There is at most ONE live
// challenge per (email, purpose) — a resend overwrites the previous one,
// which is also what stops an attacker from farming many valid codes.
//
// Documents self-destruct via a TTL index on `expiresAt`. Mongo's TTL
// monitor only sweeps once a minute, so the application ALSO checks the
// expiry — never rely on the index alone for correctness.

export type OtpPurpose = "signup" | "password_reset";

export const OTP_PURPOSES: OtpPurpose[] = ["signup", "password_reset"];

export interface IEmailOtp {
  _id: Types.ObjectId;
  email: string;
  purpose: OtpPurpose;
  codeHash: string;
  // When the CODE stops being accepted. Tracked separately from the
  // document's own lifetime because the throttle window outlives the code
  // — the send-count has to survive longer than the thing it's counting.
  codeExpiresAt: Date;
  // When the DOCUMENT is swept by the TTL index — always the later of the
  // code expiry and the end of the throttle window.
  expiresAt: Date;
  // Wrong guesses against the CURRENT code. Burns the challenge at the cap.
  attempts: number;
  // How many codes we've mailed inside the rolling window that began at
  // `windowStartedAt` — the per-address throttle.
  sends: number;
  windowStartedAt: Date;
  lastSentAt: Date;
  consumedAt: Date | null;
  // Sign-up only: the chambers details captured on step 1, replayed on
  // verify. Never holds a plaintext password — only its bcrypt hash.
  payload: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const EmailOtpSchema = new Schema<IEmailOtp>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    purpose: {
      type: String,
      enum: OTP_PURPOSES,
      required: true,
    },
    codeHash: { type: String, required: true },
    codeExpiresAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    sends: { type: Number, default: 1 },
    windowStartedAt: { type: Date, required: true, default: () => new Date() },
    lastSentAt: { type: Date, required: true, default: () => new Date() },
    consumedAt: { type: Date, default: null },
    payload: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

// At most one live challenge per address per flow. Every issue is an
// upsert on this key, so a resend replaces rather than accumulates.
EmailOtpSchema.index({ email: 1, purpose: 1 }, { unique: true });
// Self-cleaning: delete the document once `expiresAt` has passed. The
// throttle window outlives the code itself, so the expiry we store is
// max(code expiry, window end) — see lib/otp.ts.
EmailOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailOtp: Model<IEmailOtp> =
  (mongoose.models.EmailOtp as Model<IEmailOtp>) ||
  mongoose.model<IEmailOtp>("EmailOtp", EmailOtpSchema);
