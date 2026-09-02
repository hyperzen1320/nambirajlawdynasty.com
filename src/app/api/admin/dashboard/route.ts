import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Partner } from "@/models/Partner";
import { User } from "@/models/User";
import { requireAdmin } from "@/lib/admin-auth";
import { corsHeaders } from "@/lib/cors";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if ("error" in guard) return guard.error;

  await connectDB();

  const [totalPartners, activePartners, trialPartners, totalUsers, recentDocs] =
    await Promise.all([
      Partner.countDocuments({ isDeleted: false }),
      Partner.countDocuments({
        "subscription.status": "active",
        isDeleted: false,
      }),
      Partner.countDocuments({
        "subscription.status": "trial",
        isDeleted: false,
      }),
      User.countDocuments({
        userType: { $ne: "global_admin" },
        isDeleted: false,
      }),
      Partner.find({ isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

  const recentPartners = recentDocs.map((p) => ({
    id: String(p._id),
    name: p.name,
    slug: p.slug,
    primaryEmail: p.primaryEmail,
    plan: p.plan,
    status: p.subscription.status,
    startDate: p.subscription.startDate.toISOString(),
    endDate: p.subscription.endDate.toISOString(),
    createdAt: p.createdAt.toISOString(),
  }));

  return NextResponse.json(
    {
      stats: { totalPartners, activePartners, trialPartners, totalUsers },
      recentPartners,
      adminName: `${guard.ctx.user.firstName} ${guard.ctx.user.lastName}`.trim(),
    },
    { headers: corsHeaders() }
  );
}
