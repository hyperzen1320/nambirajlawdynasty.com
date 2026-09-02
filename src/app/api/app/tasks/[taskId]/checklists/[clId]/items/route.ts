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

// POST — add an item (row) to a checklist
export async function POST(
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
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json(
      { error: "Text is required" },
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

  const sortOrder = checklist.items.length;
  checklist.items.push({
    text,
    done: false,
    sortOrder,
  } as unknown as (typeof checklist.items)[number]);
  await task.save();

  const created = checklist.items[checklist.items.length - 1];

  await logWorkflowActivity(guard.ctx, {
    action: "checklist_item.added",
    targetType: "task",
    targetId: String(task._id),
    targetName: task.title,
    boardId: String(task.boardId),
    message: `added "${text}" to **${task.title}**`,
    metadata: {
      checklistId: String(clId),
      itemId: String(created._id),
      text,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      item: {
        id: String(created._id),
        text: created.text,
        done: created.done,
        sortOrder: created.sortOrder,
      },
    },
    { status: 201, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
