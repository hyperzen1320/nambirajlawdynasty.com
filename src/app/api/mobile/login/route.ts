import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Partner } from "@/models/Partner";
import { signMobileJWT } from "@/lib/jwt";
import { corsHeaders } from "@/lib/cors";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "")
    .toLowerCase()
    .trim();
  const password = String(body?.password ?? "");

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400, headers: corsHeaders() }
    );
  }

  await connectDB();
  const user = await User.findOne({ email, isDeleted: false });
  if (!user || !user.active) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401, headers: corsHeaders() }
    );
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401, headers: corsHeaders() }
    );
  }

  // Tenant guard — same logic as web auth.ts
  if (user.userType !== "global_admin" && user.partnerId) {
    const partner = await Partner.findById(user.partnerId).lean();
    if (!partner || partner.isDeleted) {
      return NextResponse.json(
        { error: "Account inactive" },
        { status: 403, headers: corsHeaders() }
      );
    }
    const status = partner.subscription.status;
    if (status === "suspended") {
      return NextResponse.json(
        {
          error:
            "Your chambers has been suspended. Please contact Legalezi support.",
        },
        { status: 403, headers: corsHeaders() }
      );
    }
    if (status === "cancelled") {
      return NextResponse.json(
        { error: "Your chambers has been cancelled." },
        { status: 403, headers: corsHeaders() }
      );
    }
    if (
      status === "trial" &&
      new Date() > new Date(partner.subscription.endDate)
    ) {
      return NextResponse.json(
        {
          error:
            "Your chambers' trial has ended. Ask your global admin to extend or move to a paid plan.",
        },
        { status: 403, headers: corsHeaders() }
      );
    }
  }

  await User.updateOne(
    { _id: user._id },
    { $set: { lastLoginAt: new Date() } }
  );

  const token = await signMobileJWT({
    sub: user._id.toString(),
    email: user.email,
    userType: user.userType,
    partnerId: user.partnerId ? user.partnerId.toString() : null,
    firstName: user.firstName,
    lastName: user.lastName,
  });

  return NextResponse.json(
    {
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        partnerId: user.partnerId ? user.partnerId.toString() : null,
      },
    },
    { status: 200, headers: corsHeaders() }
  );
}
