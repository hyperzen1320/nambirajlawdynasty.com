import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Partner } from "@/models/Partner";
import { User } from "@/models/User";
import { logActivity } from "@/lib/activity";
import { requireAdmin } from "@/lib/admin-auth";
import { corsHeaders } from "@/lib/cors";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requireAdmin(request);
  if ("error" in guard) return guard.error;

  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json(
      { error: "Invalid id" },
      { status: 400, headers: corsHeaders() }
    );
  }

  const body = await request.json().catch(() => null);
  const password = body?.password;
  if (typeof password !== "string" || password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400, headers: corsHeaders() }
    );
  }

  await connectDB();
  const partner = await Partner.findById(id).lean();
  if (!partner) {
    return NextResponse.json(
      { error: "Partner not found" },
      { status: 404, headers: corsHeaders() }
    );
  }

  const partnerAdmin = await User.findOne({
    partnerId: partner._id,
    userType: "partner_admin",
    isDeleted: false,
  });
  if (!partnerAdmin) {
    return NextResponse.json(
      { error: "Partner-admin user not found" },
      { status: 404, headers: corsHeaders() }
    );
  }

  partnerAdmin.passwordHash = await bcrypt.hash(password, 12);
  partnerAdmin.passwordReset = { tokenHash: null, expiresAt: null };
  await partnerAdmin.save();

  await logActivity({
    actor: {
      id: guard.ctx.user.id,
      name: `${guard.ctx.user.firstName} ${guard.ctx.user.lastName}`.trim(),
      email: guard.ctx.user.email,
      type: "global_admin",
    },
    action: "partner_password_reset",
    targetType: "user",
    targetId: String(partnerAdmin._id),
    targetName: partnerAdmin.email,
    message: `Reset partner-admin password for ${partner.name} (${partnerAdmin.email}).`,
    metadata: { via: guard.ctx.isMobile ? "mobile" : "web" },
    partnerId: String(partner._id),
  });

  return NextResponse.json({ ok: true }, { headers: corsHeaders() });
}
