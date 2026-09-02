// Live feed endpoint. Clients poll this at adaptive intervals (1s when the
// canvas is active, slower when idle) to learn what activity has happened
// since they last asked.
//
// Two-stage design:
//   1) Cheap probe — read the partner's (or board's) latest activity id
//      from Upstash. If it's the same as the client's `since`, return
//      `{ events: [] }` without touching Mongo. ~95% of polls land here.
//   2) On miss, fetch new rows from Mongo with a tight index hit.
//
// When Upstash isn't configured we skip the probe and always query Mongo —
// the system still works, just less efficiently.

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Activity } from "@/models/Activity";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import {
  redisSafe,
  liveFeedLimiter,
  upstashEnabled,
  keys,
} from "@/lib/upstash";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

const MAX_LIMIT = 50;

function parseObjectId(s: string | null): mongoose.Types.ObjectId | null {
  if (!s || !mongoose.isValidObjectId(s)) return null;
  return new mongoose.Types.ObjectId(s);
}

export async function GET(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  const { partnerId } = guard.ctx.user;
  const headers = guard.ctx.isMobile ? corsHeaders() : undefined;

  // Per-partner sliding-window rate limit. Defends against a runaway client
  // (e.g. 30 stuck tabs) DoSing the live feed.
  const limiter = liveFeedLimiter();
  if (limiter) {
    const { success } = await limiter.limit(`partner:${partnerId}`);
    if (!success) {
      return NextResponse.json(
        { error: "rate_limited", events: [], retryAfter: 5 },
        { status: 429, headers }
      );
    }
  }

  const url = new URL(request.url);
  const since = url.searchParams.get("since");
  const boardParam = url.searchParams.get("board");
  const limitParam = Number(url.searchParams.get("limit") ?? "");
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(limitParam, MAX_LIMIT)
    : MAX_LIMIT;

  const sinceId = parseObjectId(since);
  const boardId = parseObjectId(boardParam);

  // Probe: if Upstash agrees nothing has happened since the client's last
  // seen id, skip the Mongo round-trip entirely.
  if (upstashEnabled && sinceId) {
    const probeKey = boardParam
      ? keys.boardLatestActivity(partnerId, boardParam)
      : keys.partnerLatestActivity(partnerId);
    const latest = await redisSafe.get(probeKey);
    if (latest && latest === String(sinceId)) {
      return NextResponse.json(
        {
          events: [],
          latestId: latest,
          serverTime: Date.now(),
          probeHit: true,
        },
        { headers }
      );
    }
  }

  await connectDB();
  const partnerObj = new mongoose.Types.ObjectId(partnerId);

  const filter: Record<string, unknown> = { partnerId: partnerObj };
  if (boardId) filter.boardId = boardId;
  if (sinceId) filter._id = { $gt: sinceId };

  const docs = await Activity.find(filter)
    .sort({ _id: 1 })
    .limit(limit + 1)
    .lean();

  const truncated = docs.length > limit;
  const slice = truncated ? docs.slice(0, limit) : docs;

  const events = slice.map((a) => ({
    id: String(a._id),
    actorUserId: a.actorUserId ? String(a.actorUserId) : null,
    actorName: a.actorName,
    action: a.action,
    targetType: a.targetType,
    targetId: a.targetId ? String(a.targetId) : null,
    targetName: a.targetName,
    message: a.message,
    metadata: a.metadata,
    boardId: a.boardId ? String(a.boardId) : null,
    createdAt: a.createdAt.toISOString(),
  }));

  const latestId = events.length > 0 ? events[events.length - 1].id : since;

  return NextResponse.json(
    {
      events,
      latestId,
      truncated,
      serverTime: Date.now(),
    },
    { headers }
  );
}
