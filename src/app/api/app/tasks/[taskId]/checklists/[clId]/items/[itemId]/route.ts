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

// PATCH — toggle done / rename text
export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ taskId: string; clId: string; itemId: string }>;
  }
) {
  const { taskId, clId, itemId } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;
  if (!canPerform(guard.ctx.user.role, "taskEdit")) {
    return workflowDeny("taskEdit", guard.ctx.isMobile, corsHeaders);
  }
  if (
    !mongoose.isValidObjectId(clId) ||
    !mongoose.isValidObjectId(itemId)
  ) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
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
  const item = checklist.items.find((i) => String(i._id) === String(itemId));
  if (!item) {
    return NextResponse.json(
      { error: "Item not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const beforeText = item.text;
  const beforeDone = item.done;

  if (typeof body.text === "string" && body.text.trim()) {
    item.text = body.text.trim();
  }
  if (typeof body.done === "boolean") {
    item.done = body.done;
  }

  await task.save();

  if (beforeText !== item.text) {
    await logWorkflowActivity(guard.ctx, {
      action: "checklist_item.renamed",
      targetType: "task",
      targetId: String(task._id),
      targetName: task.title,
      boardId: String(task.boardId),
      message: `renamed "${beforeText}" → "${item.text}" on **${task.title}**`,
      metadata: { from: beforeText, to: item.text },
    });
  }
  if (beforeDone !== item.done) {
    await logWorkflowActivity(guard.ctx, {
      action: item.done ? "checklist_item.checked" : "checklist_item.unchecked",
      targetType: "task",
      targetId: String(task._id),
      targetName: task.title,
      boardId: String(task.boardId),
      message: item.done
        ? `checked off "${item.text}" on **${task.title}**`
        : `unchecked "${item.text}" on **${task.title}**`,
      metadata: { itemId: String(item._id), text: item.text },
    });
  }

  return NextResponse.json(
    { ok: true },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}

// DELETE — remove an item
export async function DELETE(
  request: Request,
  context: {
    params: Promise<{ taskId: string; clId: string; itemId: string }>;
  }
) {
  const { taskId, clId, itemId } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;
  if (!canPerform(guard.ctx.user.role, "taskEdit")) {
    return workflowDeny("taskEdit", guard.ctx.isMobile, corsHeaders);
  }
  if (
    !mongoose.isValidObjectId(clId) ||
    !mongoose.isValidObjectId(itemId)
  ) {
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
  const checklist = task.checklists.find(
    (c) => String(c._id) === String(clId)
  );
  if (!checklist) {
    return NextResponse.json(
      { error: "Checklist not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }
  const idx = checklist.items.findIndex(
    (i) => String(i._id) === String(itemId)
  );
  if (idx === -1) {
    return NextResponse.json(
      { error: "Item not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const removed = checklist.items[idx];
  checklist.items.splice(idx, 1);
  await task.save();

  await logWorkflowActivity(guard.ctx, {
    action: "checklist_item.removed",
    targetType: "task",
    targetId: String(task._id),
    targetName: task.title,
    boardId: String(task.boardId),
    message: `removed "${removed.text}" from **${task.title}**`,
    metadata: { text: removed.text },
  });

  return NextResponse.json(
    { ok: true },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
