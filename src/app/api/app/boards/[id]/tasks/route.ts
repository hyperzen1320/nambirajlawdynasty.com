import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { BoardList } from "@/models/BoardList";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { canPerform, workflowDeny } from "@/lib/workflow-rbac";
import { logWorkflowActivity } from "@/lib/activity";
import { loadBoard } from "@/lib/workflow-helpers";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

// POST /api/app/boards/[id]/tasks  — create a card under a list
// Body: { listId, title, description?, sortOrder? }
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  if (!canPerform(guard.ctx.user.role, "taskEdit")) {
    return workflowDeny("taskEdit", guard.ctx.isMobile, corsHeaders);
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
  const listId = typeof body.listId === "string" ? body.listId.trim() : "";
  if (!title || !listId) {
    return NextResponse.json(
      { error: "Title and list are required." },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }
  if (!mongoose.isValidObjectId(listId)) {
    return NextResponse.json(
      { error: "Invalid list" },
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

  const list = await BoardList.findOne({
    _id: new mongoose.Types.ObjectId(listId),
    partnerId: board.partnerId,
    boardId: board._id,
    isDeleted: false,
  });
  if (!list) {
    return NextResponse.json(
      { error: "List not found on this board" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  // Append by default (sortOrder = max + 1 for tasks in this list)
  const last = await Task.findOne({
    partnerId: board.partnerId,
    listId: list._id,
    isDeleted: false,
  })
    .sort({ sortOrder: -1 })
    .select("sortOrder")
    .lean();
  const sortOrder = (last?.sortOrder ?? -1) + 1;

  const description =
    typeof body.description === "string" ? body.description : "";

  const doc = await Task.create({
    partnerId: board.partnerId,
    boardId: board._id,
    listId: list._id,
    title,
    description,
    sortOrder,
    createdBy: guard.ctx.user.id
      ? new mongoose.Types.ObjectId(guard.ctx.user.id)
      : null,
  });

  await logWorkflowActivity(guard.ctx, {
    action: "task.created",
    targetType: "task",
    targetId: String(doc._id),
    targetName: title,
    boardId: String(board._id),
    message: `added card **${title}** to **${list.title}**`,
    metadata: { listId: String(list._id), listTitle: list.title },
  });

  return NextResponse.json(
    {
      ok: true,
      task: {
        id: String(doc._id),
        listId: String(doc.listId),
        title: doc.title,
        description: doc.description,
        sortOrder: doc.sortOrder,
        assignee: null,
        dueDate: null,
        priority: null,
        checklistSummary: { totalChecklists: 0, totalItems: 0, doneItems: 0 },
        hasDescription: Boolean(doc.description.trim()),
        updatedAt: doc.updatedAt.toISOString(),
      },
    },
    { status: 201, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
