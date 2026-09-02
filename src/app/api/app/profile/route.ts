import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { logWorkflowActivity } from "@/lib/activity";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

function serialize(u: {
  _id: mongoose.Types.ObjectId;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  state: string;
  country: string;
  officeAddress: string;
  barEnrolmentNo: string;
  designation: string;
  profilePhoto: string;
}) {
  return {
    id: String(u._id),
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    name: `${u.firstName} ${u.lastName}`.trim(),
    phone: u.phone || "",
    state: u.state || "",
    country: u.country || "India",
    officeAddress: u.officeAddress || "",
    barEnrolmentNo: u.barEnrolmentNo || "",
    designation: u.designation || "",
    profilePhoto: u.profilePhoto || "",
  };
}

export async function GET(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const user = await User.findById(guard.ctx.user.id).lean();
  if (!user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  return NextResponse.json(
    { profile: serialize(user) },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}

export async function PATCH(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

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

  await connectDB();
  const user = await User.findById(guard.ctx.user.id);
  if (!user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  // Name (split into first / last on first whitespace) — optional
  if (typeof body.name === "string" && body.name.trim()) {
    const trimmed = body.name.trim();
    const split = trimmed.split(/\s+/);
    user.firstName = split[0] || "";
    user.lastName = split.slice(1).join(" ");
  }

  const updatableFields = [
    "phone",
    "state",
    "country",
    "officeAddress",
    "barEnrolmentNo",
    "designation",
    "profilePhoto",
  ] as const;

  const beforeSnapshot: Record<string, string> = {};
  for (const f of updatableFields) {
    beforeSnapshot[f] = user[f] || "";
  }
  const beforeName = `${user.firstName} ${user.lastName}`.trim();

  for (const f of updatableFields) {
    if (typeof body[f] === "string") {
      user[f] = (body[f] as string).trim();
    }
  }

  await user.save();

  const changed: string[] = [];
  for (const f of updatableFields) {
    if ((user[f] || "") !== (beforeSnapshot[f] || "")) {
      changed.push(f);
    }
  }
  const newName = `${user.firstName} ${user.lastName}`.trim();
  if (newName !== beforeName) changed.push("name");
  if (changed.length > 0) {
    await logWorkflowActivity(guard.ctx, {
      action: "profile.updated",
      targetType: "profile",
      targetId: String(user._id),
      targetName: newName || user.email,
      message: `updated profile (${changed.join(", ")})`,
      metadata: { fields: changed },
    });
  }

  return NextResponse.json(
    { ok: true, profile: serialize(user) },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
