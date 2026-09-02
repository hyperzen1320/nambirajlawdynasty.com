import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Partner } from "@/models/Partner";
import { verifyMobileJWT } from "@/lib/jwt";
import { corsHeaders } from "@/lib/cors";
import { fullFeatureMap, readFeatures } from "@/lib/features";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json(
      { error: "Missing token" },
      { status: 401, headers: corsHeaders() }
    );
  }
  const token = auth.slice(7).trim();

  let payload;
  try {
    payload = await verifyMobileJWT(token);
  } catch {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401, headers: corsHeaders() }
    );
  }

  await connectDB();
  const user = await User.findById(payload.sub).lean();
  if (!user || user.isDeleted || !user.active) {
    return NextResponse.json(
      { error: "Account inactive" },
      { status: 401, headers: corsHeaders() }
    );
  }

  // Re-check tenant status (the partner might have been suspended since the JWT was issued)
  let partner = null;
  if (user.userType !== "global_admin" && user.partnerId) {
    const p = await Partner.findById(user.partnerId).lean();
    if (!p || p.isDeleted) {
      return NextResponse.json(
        { error: "Account inactive" },
        { status: 403, headers: corsHeaders() }
      );
    }
    const status = p.subscription.status;
    if (status === "suspended" || status === "cancelled") {
      return NextResponse.json(
        { error: "Account inactive" },
        { status: 403, headers: corsHeaders() }
      );
    }
    if (
      status === "trial" &&
      new Date() > new Date(p.subscription.endDate)
    ) {
      return NextResponse.json(
        { error: "Trial has ended" },
        { status: 403, headers: corsHeaders() }
      );
    }
    partner = {
      id: p._id.toString(),
      name: p.name,
      slug: p.slug,
      plan: p.plan,
      subscription: {
        status: p.subscription.status,
        endDate: p.subscription.endDate.toISOString(),
        startDate: p.subscription.startDate.toISOString(),
      },
      // Every key with an explicit boolean, so the app can hide tabs and
      // menu entries for modules the global admin switched off. The APIs
      // enforce the same map, so this is a display concern only.
      features: fullFeatureMap(readFeatures(p.features)),
    };
  }

  return NextResponse.json(
    {
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        partnerId: user.partnerId ? user.partnerId.toString() : null,
      },
      partner,
    },
    { status: 200, headers: corsHeaders() }
  );
}
