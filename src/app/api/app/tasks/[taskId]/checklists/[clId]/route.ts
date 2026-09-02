import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { canPerform, workflowDeny } from "@/lib/workflow-rbac";
import { logWorkflowActivity } from "@/lib/activity";
import { loadTask } from "@/lib/workflow-helpers";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

// PATCH — rename a checklist
export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string; clId: string }> }
) {
  const { taskId, clId } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;
  if (!canPerform(guard.ctx.user.role, "taskEdit")) {
    return workflowDeny("taskEdit", guard.ctx.isMobile, corsHeaders);
  }
  if (!mongoose.isValidObjectId(clId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const title =
    typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json(
      { error: "Title is required" },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  await connectDB();
  const task = await loadTask(taskId, guard.ctx.user.partnerId);
  if (!task) {
    return NextResponse.json(
      { error: "Card not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const checklist = task.checklists.find(
    (c) => String(c._id) === String(clId)
  );
  if (!checklist) {
    return NextResponse.json(
      { error: "Checklist not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const oldTitle = checklist.title;
  checklist.title = title;
  await task.save();

  if (oldTitle !== title) {
    await logWorkflowActivity(guard.ctx, {
      action: "checklist.renamed",
      targetType: "task",
      targetId: String(task._id),
      targetName: task.title,
      boardId: String(task.boardId),
      message: `renamed checklist **${oldTitle}** → **${title}** on **${task.title}**`,
      metadata: { from: oldTitle, to: title, checklistId: String(checklist._id) },
    });
  }

  return NextResponse.json(
    { ok: true },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}

// DELETE — remove a checklist
export async function DELETE(
  request: Request,
  context: { params: Promise<{ taskId: string; clId: string }> }
) {
  const { taskId, clId } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;
  if (!canPerform(guard.ctx.user.role, "taskEdit")) {
    return workflowDeny("taskEdit", guard.ctx.isMobile, corsHeaders);
  }
  if (!mongoose.isValidObjectId(clId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await connectDB();
  const task = await loadTask(taskId, guard.ctx.user.partnerId);
  if (!task) {
    return NextResponse.json(
      { error: "Card not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const idx = task.checklists.findIndex(
    (c) => String(c._id) === String(clId)
  );
  if (idx === -1) {
    return NextResponse.json(
      { error: "Checklist not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }
  const removedTitle = task.checklists[idx].title;
  task.checklists.splice(idx, 1);
  await task.save();

  await logWorkflowActivity(guard.ctx, {
    action: "checklist.removed",
    targetType: "task",
    targetId: String(task._id),
    targetName: task.title,
    boardId: String(task.boardId),
    message: `removed checklist **${removedTitle}** from **${task.title}**`,
    metadata: { checklistId: String(clId), checklistTitle: removedTitle },
  });

  return NextResponse.json(
    { ok: true },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
