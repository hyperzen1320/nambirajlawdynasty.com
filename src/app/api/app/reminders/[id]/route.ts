import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { Reminder, type ReminderPriority } from "@/models/Reminder";
import { User } from "@/models/User";
import { logWorkflowActivity } from "@/lib/activity";

// PATCH  /api/app/reminders/[id]
//   Body: { title?, description?, dueDate?, priority?, assignedToUserId?, status? }
//   Permissions:
//     • status toggle (done/pending) — assignee OR creator OR admin
//     • everything else — creator OR admin
//
// DELETE /api/app/reminders/[id]
//   Soft delete. Creator OR admin.

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

const VALID_PRIORITY: ReminderPriority[] = ["low", "normal", "high"];

async function loadOne(
  id: string,
  partnerId: mongoose.Types.ObjectId
) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Reminder.findOne({
    _id: new mongoose.Types.ObjectId(id),
    partnerId,
    isDeleted: false,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json(
      { error: "Invalid body" },
      {
        status: 400,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);
  const callerId = new mongoose.Types.ObjectId(guard.ctx.user.id);
  const isAdmin = guard.ctx.user.userType === "partner_admin";

  const doc = await loadOne(id, partnerId);
  if (!doc) {
    return NextResponse.json(
      { error: "Reminder not found" },
      {
        status: 404,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }

  const isAssignee = String(doc.assignedToUserId) === guard.ctx.user.id;
  const isCreator = String(doc.createdByUserId) === guard.ctx.user.id;
  const canEditMeta = isCreator || isAdmin;
  const canToggleStatus = isAssignee || isCreator || isAdmin;

  let touched = false;
  let activityMessage: string | null = null;
  let activityAction: string | null = null;

  // Status toggle is the most common partial — we check it first so a
  // simple "mark done" doesn't trip the can-edit-meta gate.
  if (typeof body.status === "string") {
    const next = body.status.toLowerCase();
    if (next !== "pending" && next !== "done") {
      return NextResponse.json(
        { error: "Status must be pending or done." },
        {
          status: 400,
          headers: guard.ctx.isMobile ? corsHeaders() : undefined,
        }
      );
    }
    if (next !== doc.status) {
      if (!canToggleStatus) {
        return NextResponse.json(
          { error: "You can't change this reminder's status." },
          {
            status: 403,
            headers: guard.ctx.isMobile ? corsHeaders() : undefined,
          }
        );
      }
      doc.status = next;
      if (next === "done") {
        doc.completedAt = new Date();
        doc.completedByUserId = callerId;
        activityAction = "reminder.completed";
        activityMessage = `marked **${doc.title}** as done`;
      } else {
        doc.completedAt = null;
        doc.completedByUserId = null;
        activityAction = "reminder.reopened";
        activityMessage = `reopened **${doc.title}**`;
      }
      touched = true;
    }
  }

  // Meta edits — title / description / dueDate / priority / assignee.
  // Only the creator or an admin can change these.
  const editingMeta =
    typeof body.title === "string" ||
    typeof body.description === "string" ||
    typeof body.dueDate !== "undefined" ||
    typeof body.priority === "string" ||
    typeof body.assignedToUserId === "string";
  if (editingMeta) {
    if (!canEditMeta) {
      return NextResponse.json(
        { error: "Only the creator or office admin can edit a reminder." },
        {
          status: 403,
          headers: guard.ctx.isMobile ? corsHeaders() : undefined,
        }
      );
    }
    if (typeof body.title === "string") {
      const t = body.title.trim();
      if (!t) {
        return NextResponse.json(
          { error: "Reminder needs a title." },
          {
            status: 400,
            headers: guard.ctx.isMobile ? corsHeaders() : undefined,
          }
        );
      }
      doc.title = t.slice(0, 240);
      touched = true;
    }
    if (typeof body.description === "string") {
      doc.description = body.description.trim().slice(0, 4000);
      touched = true;
    }
    if (typeof body.dueDate !== "undefined") {
      if (body.dueDate === null || body.dueDate === "") {
        doc.dueDate = null;
      } else if (typeof body.dueDate === "string") {
        const d = new Date(body.dueDate);
        if (!Number.isNaN(d.getTime())) doc.dueDate = d;
      }
      touched = true;
    }
    if (typeof body.priority === "string") {
      const p = body.priority.toLowerCase();
      if (VALID_PRIORITY.includes(p as ReminderPriority)) {
        doc.priority = p as ReminderPriority;
        touched = true;
      }
    }
    if (
      typeof body.assignedToUserId === "string" &&
      mongoose.isValidObjectId(body.assignedToUserId)
    ) {
      const assignee = await User.findOne({
        _id: new mongoose.Types.ObjectId(body.assignedToUserId),
        partnerId,
        isDeleted: false,
      })
        .select("firstName lastName email active")
        .lean();
      if (!assignee) {
        return NextResponse.json(
          { error: "Assignee isn't in your office." },
          {
            status: 400,
            headers: guard.ctx.isMobile ? corsHeaders() : undefined,
          }
        );
      }
      if (assignee.active === false) {
        return NextResponse.json(
          { error: "Assignee's account is deactivated." },
          {
            status: 400,
            headers: guard.ctx.isMobile ? corsHeaders() : undefined,
          }
        );
      }
      const newAssigneeName =
        `${assignee.firstName} ${assignee.lastName}`.trim() || assignee.email;
      const wasReassigned =
        String(doc.assignedToUserId) !== body.assignedToUserId;
      doc.assignedToUserId = new mongoose.Types.ObjectId(
        body.assignedToUserId
      );
      doc.assignedToName = newAssigneeName;
      if (wasReassigned && !activityAction) {
        activityAction = "reminder.assigned";
        activityMessage = `reassigned **${doc.title}** to **${newAssigneeName}**`;
      }
      touched = true;
    }
  }

  if (!touched) {
    return NextResponse.json(
      { ok: true, unchanged: true },
      { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  await doc.save();

  if (activityAction && activityMessage) {
    await logWorkflowActivity(guard.ctx, {
      action: activityAction,
      targetType: "reminder",
      targetId: String(doc._id),
      targetName: doc.title,
      message: activityMessage,
      metadata: {
        reminderId: String(doc._id),
        status: doc.status,
        priority: doc.priority,
      },
    });
  }

  return NextResponse.json(
    {
      ok: true,
      reminder: {
        id: String(doc._id),
        title: doc.title,
        description: doc.description,
        dueDate: doc.dueDate ? doc.dueDate.toISOString() : null,
        priority: doc.priority,
        assignedToUserId: String(doc.assignedToUserId),
        assignedToName: doc.assignedToName,
        createdByUserId: String(doc.createdByUserId),
        createdByName: doc.createdByName,
        status: doc.status,
        completedAt: doc.completedAt
          ? doc.completedAt.toISOString()
          : null,
      },
    },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);
  const isAdmin = guard.ctx.user.userType === "partner_admin";

  const doc = await loadOne(id, partnerId);
  if (!doc) {
    return NextResponse.json(
      { error: "Reminder not found" },
      {
        status: 404,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }
  const isCreator = String(doc.createdByUserId) === guard.ctx.user.id;
  if (!isCreator && !isAdmin) {
    return NextResponse.json(
      { error: "Only the creator or office admin can delete this reminder." },
      {
        status: 403,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }
  doc.isDeleted = true;
  await doc.save();

  await logWorkflowActivity(guard.ctx, {
    action: "reminder.deleted",
    targetType: "reminder",
    targetId: String(doc._id),
    targetName: doc.title,
    message: `deleted reminder **${doc.title}**`,
    metadata: { reminderId: String(doc._id) },
  });

  return NextResponse.json(
    { ok: true },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
