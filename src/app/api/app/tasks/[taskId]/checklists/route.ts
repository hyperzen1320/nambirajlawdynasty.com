import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { canPerform, workflowDeny } from "@/lib/workflow-rbac";
import { logWorkflowActivity } from "@/lib/activity";
import { loadTask } from "@/lib/workflow-helpers";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

// POST — add a checklist to a task
export async function POST(
  request: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  if (!canPerform(guard.ctx.user.role, "taskEdit")) {
    return workflowDeny("taskEdit", guard.ctx.isMobile, corsHeaders);
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const title =
    typeof body?.title === "string" && body.title.trim()
      ? body.title.trim()
      : "Checklist";

  await connectDB();
  const task = await loadTask(taskId, guard.ctx.user.partnerId);
  if (!task) {
    return NextResponse.json(
      { error: "Card not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const sortOrder = (task.checklists?.length ?? 0);
  task.checklists.push({
    title,
    sortOrder,
    items: [],
  } as unknown as (typeof task.checklists)[number]);
  await task.save();

  const created = task.checklists[task.checklists.length - 1];

  await logWorkflowActivity(guard.ctx, {
    action: "checklist.added",
    targetType: "task",
    targetId: String(task._id),
    targetName: task.title,
    boardId: String(task.boardId),
    message: `added checklist **${title}** to **${task.title}**`,
    metadata: { checklistId: String(created._id), checklistTitle: title },
  });

  return NextResponse.json(
    {
      ok: true,
      checklist: {
        id: String(created._id),
        title: created.title,
        sortOrder: created.sortOrder,
        items: [],
      },
    },
    { status: 201, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
