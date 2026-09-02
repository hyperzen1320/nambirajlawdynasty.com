import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { corsHeaders } from "@/lib/cors";
import { User } from "@/models/User";
import { verifyPasswordResetTicket } from "@/lib/jwt";
import { clearOtp } from "@/lib/otp";
import { logActivity } from "@/lib/activity";

// POST /api/account/password/reset   { ticket, password }
//
// Step 3: spend the ticket minted by /verify and write the new password.
// The ticket carries the address it was cut for, so the client can't point
// the write at somebody else's account. It expires in ten minutes.

export const runtime = "nodejs";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

const MIN_PASSWORD = 8;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    ticket?: unknown;
    password?: unknown;
  } | null;
  const ticket = typeof body?.ticket === "string" ? body.ticket : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!ticket) {
    return NextResponse.json(
      { error: "That reset link has expired. Start again." },
      { status: 400, headers: corsHeaders() }
    );
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json(
      { error: `Your new password must be at least ${MIN_PASSWORD} characters.` },
      { status: 400, headers: corsHeaders() }
    );
  }

  const email = await verifyPasswordResetTicket(ticket);
  if (!email) {
    return NextResponse.json(
      { error: "That code has expired. Start again." },
      { status: 400, headers: corsHeaders() }
    );
  }

  await connectDB();
  const user = await User.findOne({ email, isDeleted: false });
  if (!user || user.active === false) {
    // The ticket was valid but the account has since gone. Nothing useful
    // to reveal beyond "start again".
    return NextResponse.json(
      { error: "That account is no longer active. Contact your office admin." },
      { status: 400, headers: corsHeaders() }
    );
  }

  user.passwordHash = await bcrypt.hash(password, 12);
  // Any half-finished admin-issued reset is void now that the owner has
  // set their own password.
  user.passwordReset = { tokenHash: null, expiresAt: null };
  await user.save();

  // Burn the challenge so the same emailed code can't start a second reset.
  await clearOtp(email, "password_reset");

  await logActivity({
    actor: {
      id: String(user._id),
      name: `${user.firstName} ${user.lastName}`.trim() || user.email,
      email: user.email,
      type: user.userType,
    },
    action: "password_self_reset",
    targetType: "user",
    targetId: String(user._id),
    targetName: `${user.firstName} ${user.lastName}`.trim() || user.email,
    message: "reset their own password with an emailed code",
    partnerId: user.partnerId ? String(user.partnerId) : null,
  });

  return NextResponse.json({ ok: true }, { headers: corsHeaders() });
}
