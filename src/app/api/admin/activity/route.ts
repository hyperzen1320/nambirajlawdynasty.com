import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Activity } from "@/models/Activity";
import { requireAdmin } from "@/lib/admin-auth";
import { corsHeaders } from "@/lib/cors";

const FILTERS: Record<string, Record<string, unknown>> = {
  // Platform admin trail only — never the chambers' own internal activity
  // (case/court/task events live in each partner's feed, not here).
  all: { actorType: "global_admin" },
  created: { action: "partner_created" },
  updated: {
    action: {
      $in: [
        "partner_updated",
        "partner_plan_changed",
        "partner_features_changed",
        "partner_trial_extended",
        "partner_unsuspended",
      ],
    },
  },
  password: { action: "partner_password_reset" },
  danger: { action: { $in: ["partner_suspended", "partner_deleted"] } },
};

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if ("error" in guard) return guard.error;

  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") ?? "all";
  const limit = Math.min(
    100,
    Math.max(10, Number(url.searchParams.get("limit") ?? "50"))
  );

  const query = FILTERS[filter] ?? FILTERS.all;

  await connectDB();
  const [docs, total] = await Promise.all([
    Activity.find(query).sort({ createdAt: -1 }).limit(limit).lean(),
    Activity.countDocuments({ actorType: "global_admin" }),
  ]);

  const activities = docs.map((a) => ({
    id: String(a._id),
    actorName: a.actorName,
    actorEmail: a.actorEmail,
    actorType: a.actorType,
    action: a.action,
    targetType: a.targetType,
    targetId: a.targetId ? String(a.targetId) : null,
    targetName: a.targetName,
    message: a.message,
    metadata: a.metadata ?? {},
    createdAt: a.createdAt.toISOString(),
  }));

  return NextResponse.json({ activities, total }, { headers: corsHeaders() });
}
