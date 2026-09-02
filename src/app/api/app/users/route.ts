import { NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { logWorkflowActivity } from "@/lib/activity";
import { getSeatStatus, seatLimitMessage } from "@/lib/seats";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function adminGuard(ctx: { user: { userType: string } }) {
  return ctx.user.userType === "partner_admin";
}

const VALID_ROLES = ["admin", "advocate", "junior", "clerk", "viewer"] as const;

function serialize(u: {
  _id: mongoose.Types.ObjectId;
  email: string;
  firstName: string;
  lastName: string;
  userType: string;
  role: string;
  phone: string;
  designation: string;
  active: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: String(u._id),
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    name: `${u.firstName} ${u.lastName}`.trim(),
    userType: u.userType,
    role:
      u.userType === "partner_admin"
        ? "admin"
        : u.role || "junior",
    phone: u.phone || "",
    designation: u.designation || "",
    active: u.active,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);

  const docs = await User.find({ partnerId, isDeleted: false })
    .sort({ userType: 1, firstName: 1, lastName: 1 })
    .lean();

  const users = docs.map((u) => ({
    ...serialize(u),
    isYou: String(u._id) === guard.ctx.user.id,
  }));

  // Seat headroom rides along with the list so the client can show the
  // meter and pre-disable "Add user" instead of only finding out at POST.
  const seats = await getSeatStatus(partnerId);

  return NextResponse.json(
    { users, currentUserId: guard.ctx.user.id, seats },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}

export async function POST(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  if (!adminGuard(guard.ctx)) {
    return NextResponse.json(
      { error: "Only the office admin can add users." },
      { status: 403, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json(
      { error: "Invalid body" },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const firstName =
    typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName =
    typeof body.lastName === "string" ? body.lastName.trim() : "";
  const designation =
    typeof body.designation === "string" ? body.designation.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const requestedRole =
    typeof body.role === "string" ? body.role.trim().toLowerCase() : "junior";
  // Office admin role is reserved for the partner_admin themselves; staff
  // can be advocate / junior / clerk / viewer. Default junior.
  const role = (
    VALID_ROLES.includes(requestedRole as (typeof VALID_ROLES)[number]) &&
    requestedRole !== "admin"
      ? requestedRole
      : "junior"
  ) as (typeof VALID_ROLES)[number];

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "A valid email is required." },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }
  // Only email + password are mandatory. First/last name, role, phone and
  // designation are all optional — a missing one must never block account
  // creation (a required-but-empty field used to throw a schema
  // ValidationError that reached the client as a generic "Network error").

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);
  const headers = guard.ctx.isMobile ? corsHeaders() : undefined;

  const existing = await User.findOne({ email });
  if (existing) {
    return NextResponse.json(
      { error: "Another account with this email already exists." },
      { status: 409, headers }
    );
  }

  // Seat limit. The office's plan has always carried one; until now
  // nothing read it, so a 5-seat Trial could hold twenty-five people.
  const seats = await getSeatStatus(partnerId);
  if (seats.atCap) {
    return NextResponse.json(
      {
        error: seatLimitMessage(seats, "add"),
        code: "seat_limit_reached",
        seats,
      },
      { status: 409, headers }
    );
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const doc = await User.create({
      email,
      passwordHash,
      firstName,
      lastName,
      userType: "user",
      role,
      partnerId,
      phone,
      designation,
      active: true,
    });

    const newName = `${doc.firstName} ${doc.lastName}`.trim() || doc.email;
    await logWorkflowActivity(guard.ctx, {
      action: "user.invited",
      targetType: "user",
      targetId: String(doc._id),
      targetName: newName,
      message: `invited **${newName}** as ${doc.role}`,
      metadata: { email: doc.email, role: doc.role },
    });

    return NextResponse.json(
      { ok: true, user: serialize(doc) },
      { status: 201, headers }
    );
  } catch (err) {
    // Never let a DB error escape as an uncaught 500 — the add-user form
    // reads a non-JSON 500 body as a generic "Network error". Translate the
    // common failures into a clear message the form can show.
    const code =
      typeof err === "object" && err !== null
        ? (err as { code?: number }).code
        : undefined;
    if (code === 11000) {
      return NextResponse.json(
        { error: "Another account with this email already exists." },
        { status: 409, headers }
      );
    }
    if (err instanceof mongoose.Error.ValidationError) {
      const first = Object.values(err.errors)[0]?.message;
      return NextResponse.json(
        { error: first || "Please check the details and try again." },
        { status: 400, headers }
      );
    }
    console.error("[users.create] failed:", err);
    return NextResponse.json(
      { error: "Couldn't create the user. Please try again." },
      { status: 500, headers }
    );
  }
}
