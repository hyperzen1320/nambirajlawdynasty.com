import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// Lazily resolve the HMAC key. We don't throw at module-load time because
// `next build` imports this file while prerendering pages, where no runtime
// env is present; the check fires only when a token is actually signed or
// verified at runtime (where AUTH_SECRET exists).
function getJwtSecret(): Uint8Array {
  const raw = process.env.AUTH_SECRET;
  if (!raw) {
    throw new Error("AUTH_SECRET is not set in environment");
  }
  return new TextEncoder().encode(raw);
}

export type MobileJWTPayload = {
  sub: string;
  email: string;
  userType: "global_admin" | "partner_admin" | "user";
  partnerId: string | null;
  firstName: string;
  lastName: string;
};

export async function signMobileJWT(
  payload: MobileJWTPayload
): Promise<string> {
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getJwtSecret());
}

export async function verifyMobileJWT(
  token: string
): Promise<MobileJWTPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return {
    sub: String(payload.sub),
    email: String(payload.email),
    userType: payload.userType as MobileJWTPayload["userType"],
    partnerId: (payload.partnerId as string | null) ?? null,
    firstName: String(payload.firstName ?? ""),
    lastName: String(payload.lastName ?? ""),
  };
}

// ─── Password-reset tickets ───
//
// Handed out only once an emailed OTP has been verified, and spent by the
// final "set my new password" call. Signing it means the client can't
// invent one, and the 10-minute expiry means a ticket left sitting in a
// closed tab is worthless. Audience-tagged so a reset ticket can never be
// mistaken for a mobile session token.

const RESET_AUDIENCE = "legalezi:password-reset";

export async function signPasswordResetTicket(email: string): Promise<string> {
  return new SignJWT({ email: email.toLowerCase() })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setAudience(RESET_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getJwtSecret());
}

/** Returns the email the ticket was cut for, or null if it isn't valid. */
export async function verifyPasswordResetTicket(
  token: string
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      audience: RESET_AUDIENCE,
    });
    const email = typeof payload.email === "string" ? payload.email : "";
    return email ? email.toLowerCase() : null;
  } catch {
    return null;
  }
}
