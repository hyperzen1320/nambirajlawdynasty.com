import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { BoardEdge } from "@/models/BoardEdge";
import { BoardList } from "@/models/BoardList";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { canPerform, workflowDeny } from "@/lib/workflow-rbac";
import { logWorkflowActivity } from "@/lib/activity";
import { loadBoard } from "@/lib/workflow-helpers";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

const VALID_HANDLES = ["top", "bottom", "left", "right"] as const;
const VALID_STYLES = ["solid", "dashed"] as const;

// POST /api/app/boards/[id]/edges
// Body: { sourceListId, targetListId, sourceHandle?, targetHandle?,
//         label?, color?, style? }
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  if (!canPerform(guard.ctx.user.role, "listEdit")) {
    return workflowDeny("listEdit", guard.ctx.isMobile, corsHeaders);
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

  const sourceListId =
    typeof body.sourceListId === "string" ? body.sourceListId : "";
  const targetListId =
    typeof body.targetListId === "string" ? body.targetListId : "";

  if (
    !mongoose.isValidObjectId(sourceListId) ||
    !mongoose.isValidObjectId(targetListId) ||
    sourceListId === targetListId
  ) {
    return NextResponse.json(
      { error: "sourceListId and targetListId must be different valid ids" },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const sourceHandle =
    typeof body.sourceHandle === "string" &&
    VALID_HANDLES.includes(body.sourceHandle as (typeof VALID_HANDLES)[number])
      ? (body.sourceHandle as (typeof VALID_HANDLES)[number])
      : "right";
  const targetHandle =
    typeof body.targetHandle === "string" &&
    VALID_HANDLES.includes(body.targetHandle as (typeof VALID_HANDLES)[number])
      ? (body.targetHandle as (typeof VALID_HANDLES)[number])
      : "left";

  const label = typeof body.label === "string" ? body.label.trim() : "";
  const color = typeof body.color === "string" ? body.color : null;
  const style =
    typeof body.style === "string" &&
    VALID_STYLES.includes(body.style as (typeof VALID_STYLES)[number])
      ? (body.style as (typeof VALID_STYLES)[number])
      : "solid";

  await connectDB();
  const board = await loadBoard(id, guard.ctx.user.partnerId);
  if (!board) {
    return NextResponse.json(
      { error: "Board not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  // Verify both lists belong to this board
  const lists = await BoardList.find({
    _id: {
      $in: [
        new mongoose.Types.ObjectId(sourceListId),
        new mongoose.Types.ObjectId(targetListId),
      ],
    },
    partnerId: board.partnerId,
    boardId: board._id,
    isDeleted: false,
  })
    .select("title")
    .lean();
  if (lists.length !== 2) {
    return NextResponse.json(
      { error: "Both lists must belong to this board" },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }
  const byId = new Map(lists.map((l) => [String(l._id), l.title]));

  // Prevent duplicate edges (same source+target+handles)
  const dup = await BoardEdge.findOne({
    partnerId: board.partnerId,
    boardId: board._id,
    sourceListId: new mongoose.Types.ObjectId(sourceListId),
    targetListId: new mongoose.Types.ObjectId(targetListId),
    sourceHandle,
    targetHandle,
    isDeleted: false,
  });
  if (dup) {
    return NextResponse.json(
      {
        ok: true,
        edge: serialize(dup),
        message: "Edge already exists",
      },
      { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const edge = await BoardEdge.create({
    partnerId: board.partnerId,
    boardId: board._id,
    sourceListId: new mongoose.Types.ObjectId(sourceListId),
    targetListId: new mongoose.Types.ObjectId(targetListId),
    sourceHandle,
    targetHandle,
    label,
    color,
    style,
    createdBy: guard.ctx.user.id
      ? new mongoose.Types.ObjectId(guard.ctx.user.id)
      : null,
  });

  await logWorkflowActivity(guard.ctx, {
    action: "list.connected" as never,
    targetType: "list",
    targetId: String(edge._id),
    targetName: `${byId.get(sourceListId)} → ${byId.get(targetListId)}`,
    boardId: String(board._id),
    message: `connected **${byId.get(sourceListId)}** → **${byId.get(targetListId)}**`,
    metadata: {
      sourceListId,
      targetListId,
      sourceHandle,
      targetHandle,
    },
  });

  return NextResponse.json(
    { ok: true, edge: serialize(edge) },
    { status: 201, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}

function serialize(e: {
  _id: mongoose.Types.ObjectId;
  sourceListId: mongoose.Types.ObjectId;
  targetListId: mongoose.Types.ObjectId;
  sourceHandle: string;
  targetHandle: string;
  label: string;
  color: string | null;
  style: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: String(e._id),
    sourceListId: String(e.sourceListId),
    targetListId: String(e.targetListId),
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    label: e.label,
    color: e.color,
    style: e.style,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}
