import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { BoardList } from "@/models/BoardList";
import mongoose from "mongoose";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { canPerform, workflowDeny } from "@/lib/workflow-rbac";
import { logWorkflowActivity } from "@/lib/activity";
import { loadBoard } from "@/lib/workflow-helpers";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

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

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json(
      { error: "List title is required." },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  await connectDB();
  const board = await loadBoard(id, guard.ctx.user.partnerId);
  if (!board) {
    return NextResponse.json(
      { error: "Board not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const last = await BoardList.findOne({
    partnerId: board.partnerId,
    boardId: board._id,
    isDeleted: false,
  })
    .sort({ sortOrder: -1 })
    .select("sortOrder")
    .lean();
  const sortOrder = (last?.sortOrder ?? -1) + 1;

  const doc = await BoardList.create({
    partnerId: board.partnerId,
    boardId: board._id,
    title,
    sortOrder,
    createdBy: guard.ctx.user.id
      ? new mongoose.Types.ObjectId(guard.ctx.user.id)
      : null,
  });

  await logWorkflowActivity(guard.ctx, {
    action: "list.created",
    targetType: "list",
    targetId: String(doc._id),
    targetName: title,
    boardId: String(board._id),
    message: `added list **${title}** to **${board.title}**`,
    metadata: { boardTitle: board.title },
  });

  return NextResponse.json(
    {
      ok: true,
      list: {
        id: String(doc._id),
        title: doc.title,
        sortOrder: doc.sortOrder,
      },
    },
    { status: 201, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
