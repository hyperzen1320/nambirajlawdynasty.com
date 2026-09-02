import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Activity } from "@/models/Activity";
import { Partner } from "@/models/Partner";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

// Auto-prune is run lazily on every GET. Cost: one deleteMany on a tenant
// scoped + indexed collection. Bounded because we only run it if the
// retention setting is set, and at most once per request.
async function maybePrune(
  partnerId: mongoose.Types.ObjectId
): Promise<{ ranAt: Date; pruned: number; retentionDays: number | null }> {
  const partner = await Partner.findById(partnerId)
    .select("settings")
    .lean();
  const days = partner?.settings?.activityRetentionDays ?? null;
  if (!days || !Number.isFinite(days) || days < 1) {
    return { ranAt: new Date(), pruned: 0, retentionDays: null };
  }
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const res = await Activity.deleteMany({
    partnerId,
    createdAt: { $lt: cutoff },
  });
  return {
    ranAt: new Date(),
    pruned: res.deletedCount ?? 0,
    retentionDays: days,
  };
}

export async function GET(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  // The activity feed is the office admin's audit trail — staff never see it.
  if (guard.ctx.user.userType !== "partner_admin") {
    return NextResponse.json(
      { error: "Not authorized." },
      { status: 403, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);

  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1),
    200
  );
  const before = url.searchParams.get("before"); // ISO date — pagination cursor (older-than)
  const from = url.searchParams.get("from"); // ISO date — lower bound (>=)
  const to = url.searchParams.get("to"); // ISO date — upper bound (<= end of day)
  const actorId = url.searchParams.get("actor"); // userId
  const boardId = url.searchParams.get("board"); // boardId
  const targetId = url.searchParams.get("target"); // any target
  const action = url.searchParams.get("action"); // exact action
  const actionPrefix = url.searchParams.get("actionPrefix"); // e.g. "task."
  const targetType = url.searchParams.get("targetType");

  await maybePrune(partnerId);

  // Exclude global-admin actions (e.g. "Reset partner-admin password",
  // "Extended trial") — those are recorded against this partnerId but belong
  // to the platform admin's audit trail, not the office's own activity feed.
  const filter: Record<string, unknown> = {
    partnerId,
    actorType: { $ne: "global_admin" },
  };
  // Compose createdAt bounds. `from` and `to` give a range; `before` is
  // the pagination cursor and tightens the upper bound further when set.
  const createdAt: Record<string, Date> = {};
  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) createdAt.$gte = d;
  }
  if (to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) {
      // Treat `to` as inclusive: capture the entire day.
      d.setHours(23, 59, 59, 999);
      createdAt.$lte = d;
    }
  }
  if (before) {
    const d = new Date(before);
    if (!Number.isNaN(d.getTime())) createdAt.$lt = d;
  }
  if (Object.keys(createdAt).length > 0) {
    filter.createdAt = createdAt;
  }
  if (actorId && mongoose.isValidObjectId(actorId)) {
    filter.actorUserId = new mongoose.Types.ObjectId(actorId);
  }
  if (boardId && mongoose.isValidObjectId(boardId)) {
    filter.boardId = new mongoose.Types.ObjectId(boardId);
  }
  if (targetId && mongoose.isValidObjectId(targetId)) {
    filter.targetId = new mongoose.Types.ObjectId(targetId);
  }
  // Senior Desk chat is private to its participants — never surface it in the
  // office audit feed, even for admins, and even if an action filter is passed.
  const actionConditions: Record<string, unknown>[] = [
    { action: { $nin: ["chat.message", "chat.private_started"] } },
  ];
  if (action) {
    actionConditions.push({ action });
  } else if (actionPrefix) {
    actionConditions.push({
      action: {
        $regex: `^${actionPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
      },
    });
  }
  filter.$and = actionConditions;
  if (targetType) {
    filter.targetType = targetType;
  }

  const docs = await Activity.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = docs.length > limit;
  const trimmed = hasMore ? docs.slice(0, limit) : docs;

  return NextResponse.json(
    {
      activity: trimmed.map((a) => ({
        id: String(a._id),
        actorUserId: a.actorUserId ? String(a.actorUserId) : null,
        actorName: a.actorName,
        actorEmail: a.actorEmail,
        actorType: a.actorType,
        action: a.action,
        targetType: a.targetType,
        targetId: a.targetId ? String(a.targetId) : null,
        targetName: a.targetName,
        message: a.message,
        metadata: a.metadata,
        boardId: a.boardId ? String(a.boardId) : null,
        createdAt: a.createdAt.toISOString(),
      })),
      hasMore,
      nextCursor: hasMore
        ? trimmed[trimmed.length - 1].createdAt.toISOString()
        : null,
    },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
