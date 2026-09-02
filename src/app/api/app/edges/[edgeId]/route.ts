import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { BoardEdge } from "@/models/BoardEdge";
import { BoardList } from "@/models/BoardList";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { canPerform, workflowDeny } from "@/lib/workflow-rbac";
import { logWorkflowActivity } from "@/lib/activity";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

const VALID_STYLES = ["solid", "dashed"] as const;

async function loadEdge(id: string, partnerId: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();
  return BoardEdge.findOne({
    _id: new mongoose.Types.ObjectId(id),
    partnerId: new mongoose.Types.ObjectId(partnerId),
    isDeleted: false,
  });
}

// PATCH — update label / color / style
export async function PATCH(
  request: Request,
  context: { params: Promise<{ edgeId: string }> }
) {
  const { edgeId } = await context.params;
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

  const edge = await loadEdge(edgeId, guard.ctx.user.partnerId);
  if (!edge) {
    return NextResponse.json(
      { error: "Edge not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const beforeLabel = edge.label;
  if (typeof body.label === "string") edge.label = body.label.trim();
  if (typeof body.color === "string" || body.color === null) {
    edge.color = body.color || null;
  }
  if (
    typeof body.style === "string" &&
    VALID_STYLES.includes(body.style as (typeof VALID_STYLES)[number])
  ) {
    edge.style = body.style as (typeof VALID_STYLES)[number];
  }

  await edge.save();

  if (beforeLabel !== edge.label) {
    const lists = await BoardList.find({
      _id: { $in: [edge.sourceListId, edge.targetListId] },
    })
      .select("title")
      .lean();
    const byId = new Map(lists.map((l) => [String(l._id), l.title]));
    await logWorkflowActivity(guard.ctx, {
      action: "list.connection_renamed" as never,
      targetType: "list",
      targetId: String(edge._id),
      targetName: edge.label || "",
      boardId: String(edge.boardId),
      message: edge.label
        ? `labelled connection **${byId.get(String(edge.sourceListId))}** → **${byId.get(String(edge.targetListId))}** as “${edge.label}”`
        : `cleared the label on connection **${byId.get(String(edge.sourceListId))}** → **${byId.get(String(edge.targetListId))}**`,
      metadata: { from: beforeLabel, to: edge.label },
    });
  }

  return NextResponse.json(
    {
      ok: true,
      edge: {
        id: String(edge._id),
        sourceListId: String(edge.sourceListId),
        targetListId: String(edge.targetListId),
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        label: edge.label,
        color: edge.color,
        style: edge.style,
        updatedAt: edge.updatedAt.toISOString(),
      },
    },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}

// DELETE — remove the connection
export async function DELETE(
  request: Request,
  context: { params: Promise<{ edgeId: string }> }
) {
  const { edgeId } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  if (!canPerform(guard.ctx.user.role, "listEdit")) {
    return workflowDeny("listEdit", guard.ctx.isMobile, corsHeaders);
  }

  const edge = await loadEdge(edgeId, guard.ctx.user.partnerId);
  if (!edge) {
    return NextResponse.json(
      { error: "Edge not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  edge.isDeleted = true;
  await edge.save();

  const lists = await BoardList.find({
    _id: { $in: [edge.sourceListId, edge.targetListId] },
  })
    .select("title")
    .lean();
  const byId = new Map(lists.map((l) => [String(l._id), l.title]));

  await logWorkflowActivity(guard.ctx, {
    action: "list.disconnected" as never,
    targetType: "list",
    targetId: String(edge._id),
    targetName: "",
    boardId: String(edge.boardId),
    message: `disconnected **${byId.get(String(edge.sourceListId))}** ✕ **${byId.get(String(edge.targetListId))}**`,
    metadata: {
      sourceListId: String(edge.sourceListId),
      targetListId: String(edge.targetListId),
    },
  });

  return NextResponse.json(
    { ok: true },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
