import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import { Activity } from "@/models/Activity";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { canPerform, workflowDeny } from "@/lib/workflow-rbac";
import { logWorkflowActivity } from "@/lib/activity";
import { canDirectDeleteTask } from "@/lib/delete-eligibility";
import { DeleteRequest } from "@/models/DeleteRequest";
import {
  loadTask,
  summarizeChecklists,
  type SerializedTaskFull,
} from "@/lib/workflow-helpers";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

function fmtDate(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// GET — full task with checklists + recent activity for the side panel
export async function GET(
  request: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const task = await loadTask(taskId, guard.ctx.user.partnerId);
  if (!task) {
    return NextResponse.json(
      { error: "Card not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  let assignee: SerializedTaskFull["assignee"] = null;
  if (task.assignedToUserId) {
    const u = await User.findById(task.assignedToUserId)
      .select("firstName lastName role userType")
      .lean();
    if (u) {
      assignee = {
        id: String(u._id),
        name: `${u.firstName} ${u.lastName}`.trim(),
        role: u.role || (u.userType === "partner_admin" ? "admin" : "junior"),
      };
    }
  }

  const recent = await Activity.find({
    partnerId: task.partnerId,
    targetType: "task",
    targetId: task._id,
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const full: SerializedTaskFull = {
    id: String(task._id),
    listId: String(task.listId),
    title: task.title,
    description: task.description || "",
    sortOrder: task.sortOrder,
    assignee,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    priority: task.priority,
    checklistSummary: summarizeChecklists(task.checklists || []),
    hasDescription: Boolean((task.description || "").trim()),
    updatedAt: task.updatedAt.toISOString(),
    checklists: (task.checklists || []).map((c) => ({
      id: String(c._id),
      title: c.title,
      sortOrder: c.sortOrder,
      items: (c.items || []).map((it) => ({
        id: String(it._id),
        text: it.text,
        done: it.done,
        sortOrder: it.sortOrder,
      })),
    })),
  };

  return NextResponse.json(
    {
      task: full,
      activity: recent.map((a) => ({
        id: String(a._id),
        action: a.action,
        actorName: a.actorName,
        message: a.message,
        createdAt: a.createdAt.toISOString(),
        metadata: a.metadata,
      })),
    },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}

// PATCH — update title / description / assignee / due / priority
export async function PATCH(
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
  if (!body) {
    return NextResponse.json(
      { error: "Invalid body" },
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

  const before = {
    title: task.title,
    description: task.description,
    assignedToUserId: task.assignedToUserId
      ? String(task.assignedToUserId)
      : null,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    priority: task.priority,
  };

  if (typeof body.title === "string" && body.title.trim()) {
    task.title = body.title.trim();
  }
  if (typeof body.description === "string") {
    task.description = body.description;
  }
  if (Object.prototype.hasOwnProperty.call(body, "assignedToUserId")) {
    if (body.assignedToUserId === null || body.assignedToUserId === "") {
      task.assignedToUserId = null;
    } else if (
      typeof body.assignedToUserId === "string" &&
      mongoose.isValidObjectId(body.assignedToUserId)
    ) {
      task.assignedToUserId = new mongoose.Types.ObjectId(
        body.assignedToUserId
      );
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "dueDate")) {
    if (body.dueDate === null || body.dueDate === "") {
      task.dueDate = null;
    } else if (typeof body.dueDate === "string") {
      const d = new Date(body.dueDate);
      if (!Number.isNaN(d.getTime())) {
        task.dueDate = d;
      }
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "priority")) {
    if (
      body.priority === null ||
      body.priority === "low" ||
      body.priority === "medium" ||
      body.priority === "high"
    ) {
      task.priority = body.priority as "low" | "medium" | "high" | null;
    }
  }

  await task.save();

  // Activity logs — one per change
  if (before.title !== task.title) {
    await logWorkflowActivity(guard.ctx, {
      action: "task.renamed",
      targetType: "task",
      targetId: String(task._id),
      targetName: task.title,
      boardId: String(task.boardId),
      message: `renamed card **${before.title}** → **${task.title}**`,
      metadata: { from: before.title, to: task.title },
    });
  }
  if (before.description !== task.description) {
    await logWorkflowActivity(guard.ctx, {
      action: "task.described",
      targetType: "task",
      targetId: String(task._id),
      targetName: task.title,
      boardId: String(task.boardId),
      message: `updated description on **${task.title}**`,
      metadata: {},
    });
  }
  const newAssignee = task.assignedToUserId
    ? String(task.assignedToUserId)
    : null;
  if (before.assignedToUserId !== newAssignee) {
    if (newAssignee) {
      const u = await User.findById(newAssignee)
        .select("firstName lastName")
        .lean();
      const name = u ? `${u.firstName} ${u.lastName}`.trim() : "someone";
      await logWorkflowActivity(guard.ctx, {
        action: "task.assigned",
        targetType: "task",
        targetId: String(task._id),
        targetName: task.title,
        boardId: String(task.boardId),
        message: `assigned **${task.title}** to **${name}**`,
        metadata: { assigneeId: newAssignee, assigneeName: name },
      });
    } else {
      await logWorkflowActivity(guard.ctx, {
        action: "task.unassigned",
        targetType: "task",
        targetId: String(task._id),
        targetName: task.title,
        boardId: String(task.boardId),
        message: `unassigned **${task.title}**`,
        metadata: {},
      });
    }
  }
  const newDue = task.dueDate ? task.dueDate.toISOString() : null;
  if (before.dueDate !== newDue) {
    if (newDue) {
      await logWorkflowActivity(guard.ctx, {
        action: "task.due_set",
        targetType: "task",
        targetId: String(task._id),
        targetName: task.title,
        boardId: String(task.boardId),
        message: `set due date on **${task.title}** to ${fmtDate(task.dueDate)}`,
        metadata: { dueDate: newDue },
      });
    } else {
      await logWorkflowActivity(guard.ctx, {
        action: "task.due_cleared",
        targetType: "task",
        targetId: String(task._id),
        targetName: task.title,
        boardId: String(task.boardId),
        message: `cleared the due date on **${task.title}**`,
        metadata: {},
      });
    }
  }
  if (before.priority !== task.priority) {
    await logWorkflowActivity(guard.ctx, {
      action: "task.priority_set",
      targetType: "task",
      targetId: String(task._id),
      targetName: task.title,
      boardId: String(task.boardId),
      message: task.priority
        ? `set priority on **${task.title}** to **${task.priority}**`
        : `cleared the priority on **${task.title}**`,
      metadata: { from: before.priority, to: task.priority },
    });
  }

  return NextResponse.json(
    { ok: true },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const task = await loadTask(taskId, guard.ctx.user.partnerId);
  if (!task) {
    return NextResponse.json(
      { error: "Card not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  // Smart-delete: admins always allowed; non-admins only if they created
  // the card AND it has no description and no checklist items. Otherwise
  // the client must raise a delete request.
  const eligibility = canDirectDeleteTask(task, {
    isAdmin: guard.ctx.user.role === "admin",
    userId: guard.ctx.user.id,
  });
  if (!eligibility.ok) {
    return NextResponse.json(
      {
        error: eligibility.reason,
        code: "delete_request_required",
        targetType: "task",
        targetId: String(task._id),
        targetName: task.title,
      },
      {
        status: 403,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }

  // Auto-mark any pending delete requests for this card as obsolete
  await DeleteRequest.updateMany(
    {
      partnerId: task.partnerId,
      targetType: "task",
      targetId: task._id,
      status: "pending",
    },
    { $set: { status: "obsolete", reviewerNote: "Target deleted directly." } }
  );

  task.isDeleted = true;
  await task.save();

  await logWorkflowActivity(guard.ctx, {
    action: "task.deleted",
    targetType: "task",
    targetId: String(task._id),
    targetName: task.title,
    boardId: String(task.boardId),
    message: `deleted card **${task.title}**`,
    metadata: {},
  });

  return NextResponse.json(
    { ok: true },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
