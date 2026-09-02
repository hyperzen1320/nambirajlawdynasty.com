import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { DeleteRequest } from "@/models/DeleteRequest";
import { BoardList } from "@/models/BoardList";
import { Task } from "@/models/Task";
import { Board } from "@/models/Board";
import { Client } from "@/models/Client";
import { Court } from "@/models/Court";
import { Case } from "@/models/Case";
import { CaseDocument } from "@/models/CaseDocument";
import { User } from "@/models/User";
import { PromptTemplate } from "@/models/PromptTemplate";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { logWorkflowActivity } from "@/lib/activity";
import { notifyAdmins } from "@/lib/push";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

const VALID_TARGETS = [
  "list",
  "task",
  "board",
  "client",
  "court",
  "case",
  "case_document",
  "user",
  "prompt",
] as const;
type TargetType = (typeof VALID_TARGETS)[number];

async function resolveTargetSnapshot(
  partnerId: mongoose.Types.ObjectId,
  targetType: TargetType,
  targetId: mongoose.Types.ObjectId
): Promise<{ name: string; boardId: string | null } | null> {
  switch (targetType) {
    case "list": {
      const l = await BoardList.findOne({
        _id: targetId,
        partnerId,
        isDeleted: false,
      })
        .select("title boardId")
        .lean();
      return l ? { name: l.title, boardId: String(l.boardId) } : null;
    }
    case "task": {
      const t = await Task.findOne({
        _id: targetId,
        partnerId,
        isDeleted: false,
      })
        .select("title boardId")
        .lean();
      return t ? { name: t.title, boardId: String(t.boardId) } : null;
    }
    case "board": {
      const b = await Board.findOne({
        _id: targetId,
        partnerId,
        isDeleted: false,
      })
        .select("title")
        .lean();
      return b ? { name: b.title, boardId: String(b._id) } : null;
    }
    case "client": {
      const c = await Client.findOne({
        _id: targetId,
        partnerId,
        isDeleted: false,
      })
        .select("name")
        .lean();
      return c ? { name: c.name, boardId: null } : null;
    }
    case "court": {
      const c = await Court.findOne({
        _id: targetId,
        partnerId,
        isDeleted: false,
      })
        .select("name")
        .lean();
      return c ? { name: c.name, boardId: null } : null;
    }
    case "case": {
      const c = await Case.findOne({
        _id: targetId,
        partnerId,
        isDeleted: false,
      })
        .select("caseNo fileNo")
        .lean();
      return c
        ? { name: c.caseNo || c.fileNo || "", boardId: null }
        : null;
    }
    case "case_document": {
      const d = await CaseDocument.findOne({
        _id: targetId,
        partnerId,
        isDeleted: false,
      })
        .select("filename")
        .lean();
      return d ? { name: d.filename, boardId: null } : null;
    }
    case "user": {
      const u = await User.findOne({
        _id: targetId,
        partnerId,
        isDeleted: false,
      })
        .select("firstName lastName email")
        .lean();
      return u
        ? {
            name:
              `${u.firstName} ${u.lastName}`.trim() || u.email,
            boardId: null,
          }
        : null;
    }
    case "prompt": {
      const p = await PromptTemplate.findOne({
        _id: targetId,
        partnerId,
        isDeleted: false,
      })
        .select("title")
        .lean();
      return p ? { name: p.title, boardId: null } : null;
    }
  }
}

// POST — anyone (in-tenant) can raise a request
export async function POST(request: Request) {
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

  const targetType = body.targetType as string;
  const targetIdRaw = body.targetId as string;
  const reasonRaw = (body.reason as string) || "";
  const reason = reasonRaw.trim();

  if (!VALID_TARGETS.includes(targetType as TargetType)) {
    return NextResponse.json(
      { error: "Invalid target type" },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }
  if (!mongoose.isValidObjectId(targetIdRaw)) {
    return NextResponse.json(
      { error: "Invalid target id" },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }
  if (reason.length < 4) {
    return NextResponse.json(
      { error: "Please give a reason (at least 4 characters)" },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);
  const targetId = new mongoose.Types.ObjectId(targetIdRaw);

  const snapshot = await resolveTargetSnapshot(
    partnerId,
    targetType as TargetType,
    targetId
  );
  if (!snapshot) {
    return NextResponse.json(
      { error: "Target not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  // De-dup: if a pending request already exists by the same requester for
  // this target, reuse it (update reason).
  const existing = await DeleteRequest.findOne({
    partnerId,
    requesterUserId: new mongoose.Types.ObjectId(guard.ctx.user.id),
    targetType,
    targetId,
    status: "pending",
  });
  if (existing) {
    existing.reason = reason;
    existing.targetName = snapshot.name;
    await existing.save();
    return NextResponse.json(
      {
        ok: true,
        request: serialize(existing),
        deduped: true,
      },
      { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const requesterName =
    `${guard.ctx.user.firstName} ${guard.ctx.user.lastName}`.trim() ||
    guard.ctx.user.email;

  const doc = await DeleteRequest.create({
    partnerId,
    requesterUserId: new mongoose.Types.ObjectId(guard.ctx.user.id),
    requesterName,
    requesterEmail: guard.ctx.user.email,
    targetType,
    targetId,
    targetName: snapshot.name,
    boardId: snapshot.boardId
      ? new mongoose.Types.ObjectId(snapshot.boardId)
      : null,
    reason,
    status: "pending",
  });

  // Activity log entry — surfaces the request in the office feed
  await logWorkflowActivity(guard.ctx, {
    action: "delete_request.created" as never,
    targetType: targetType === "user" ? "user" : "task",
    targetId: String(targetId),
    targetName: snapshot.name,
    boardId: snapshot.boardId,
    message: `requested deletion of ${targetType} **${snapshot.name}** — “${reason}”`,
    metadata: {
      requestId: String(doc._id),
      reason,
      targetType,
    },
  });

  // Tell the admins' phones. A request nobody sees is a request that
  // waits — the point of the queue is that it gets looked at. Not
  // awaited; the request is filed either way.
  void notifyAdmins(partnerId, {
    title: "Delete request",
    body: `${requesterName} wants to delete ${snapshot.name}`,
    data: { kind: "delete_request", requestId: String(doc._id) },
  });

  return NextResponse.json(
    { ok: true, request: serialize(doc) },
    { status: 201, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}

// GET — list requests
//   admin → sees all; non-admin → sees only their own
//   ?status=pending|approved|rejected|obsolete
//   ?boardId=<id>  scope to a board (used by canvas drawer)
export async function GET(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const boardId = url.searchParams.get("boardId");
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1),
    200
  );

  const filter: Record<string, unknown> = { partnerId };
  if (
    status === "pending" ||
    status === "approved" ||
    status === "rejected" ||
    status === "obsolete"
  ) {
    filter.status = status;
  }
  if (boardId && mongoose.isValidObjectId(boardId)) {
    filter.boardId = new mongoose.Types.ObjectId(boardId);
  }
  if (guard.ctx.user.role !== "admin") {
    filter.requesterUserId = new mongoose.Types.ObjectId(guard.ctx.user.id);
  }

  const docs = await DeleteRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json(
    {
      requests: docs.map(serialize),
      isAdmin: guard.ctx.user.role === "admin",
    },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}

function serialize(d: {
  _id: mongoose.Types.ObjectId;
  partnerId: mongoose.Types.ObjectId;
  requesterUserId: mongoose.Types.ObjectId;
  requesterName: string;
  requesterEmail: string;
  targetType: string;
  targetId: mongoose.Types.ObjectId;
  targetName: string;
  boardId: mongoose.Types.ObjectId | null;
  reason: string;
  status: string;
  reviewedByUserId: mongoose.Types.ObjectId | null;
  reviewedByName: string;
  reviewedAt: Date | null;
  reviewerNote: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: String(d._id),
    requesterUserId: String(d.requesterUserId),
    requesterName: d.requesterName,
    requesterEmail: d.requesterEmail,
    targetType: d.targetType,
    targetId: String(d.targetId),
    targetName: d.targetName,
    boardId: d.boardId ? String(d.boardId) : null,
    reason: d.reason,
    status: d.status,
    reviewedByUserId: d.reviewedByUserId ? String(d.reviewedByUserId) : null,
    reviewedByName: d.reviewedByName,
    reviewedAt: d.reviewedAt ? d.reviewedAt.toISOString() : null,
    reviewerNote: d.reviewerNote,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}
