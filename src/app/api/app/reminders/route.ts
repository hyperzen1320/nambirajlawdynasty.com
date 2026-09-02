import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { Reminder, type ReminderPriority } from "@/models/Reminder";
import { User } from "@/models/User";
import { logWorkflowActivity } from "@/lib/activity";

// GET  /api/app/reminders?bucket=mine_active|mine_done|office_active|office_done
// POST /api/app/reminders   { title, description, dueDate, priority, assignedToUserId }
//
// Buckets:
//   • mine_active   → reminders assigned to me, status=pending. Sorted by
//                     due-soonest first, then created-recently.
//   • mine_done     → reminders assigned to me, status=done.
//   • office_active → admin-only. Every pending reminder in the office.
//   • office_done   → admin-only. Every completed reminder in the office.
//
// `dueOrOverdueCount` in the response is what the Senior Desk pill uses
// for the unread badge — it counts pending reminders for the caller that
// are due today or in the past.

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

const VALID_PRIORITY: ReminderPriority[] = ["low", "normal", "high"];

type ReminderDTO = {
  id: string;
  title: string;
  description: string;
  dueDate: string | null;
  priority: ReminderPriority;
  assignedToUserId: string;
  assignedToName: string;
  createdByUserId: string;
  createdByName: string;
  status: "pending" | "done";
  completedAt: string | null;
  isMine: boolean;
  isOverdue: boolean;
  isDueToday: boolean;
  createdAt: string;
};

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function serialize(
  r: {
    _id: mongoose.Types.ObjectId;
    title: string;
    description: string;
    dueDate: Date | null;
    priority: ReminderPriority;
    assignedToUserId: mongoose.Types.ObjectId;
    assignedToName: string;
    createdByUserId: mongoose.Types.ObjectId;
    createdByName: string;
    status: "pending" | "done";
    completedAt: Date | null;
    createdAt: Date;
  },
  callerUserId: string
): ReminderDTO {
  const todayStart = startOfToday();
  const todayEnd = endOfToday();
  const isPending = r.status === "pending";
  return {
    id: String(r._id),
    title: r.title,
    description: r.description,
    dueDate: r.dueDate ? r.dueDate.toISOString() : null,
    priority: r.priority,
    assignedToUserId: String(r.assignedToUserId),
    assignedToName: r.assignedToName,
    createdByUserId: String(r.createdByUserId),
    createdByName: r.createdByName,
    status: r.status,
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    isMine: String(r.assignedToUserId) === callerUserId,
    isOverdue: Boolean(
      isPending && r.dueDate && new Date(r.dueDate) < todayStart
    ),
    isDueToday: Boolean(
      isPending &&
        r.dueDate &&
        new Date(r.dueDate) >= todayStart &&
        new Date(r.dueDate) <= todayEnd
    ),
    createdAt: r.createdAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);
  const userId = new mongoose.Types.ObjectId(guard.ctx.user.id);

  const url = new URL(request.url);
  const bucket = url.searchParams.get("bucket") || "mine_active";
  const isAdmin = guard.ctx.user.userType === "partner_admin";

  let filter: Record<string, unknown>;
  let sort: Record<string, 1 | -1>;
  switch (bucket) {
    case "mine_done":
      filter = {
        partnerId,
        isDeleted: false,
        assignedToUserId: userId,
        status: "done",
      };
      sort = { completedAt: -1 };
      break;
    case "office_active":
      if (!isAdmin) {
        return NextResponse.json(
          { error: "Admin only." },
          {
            status: 403,
            headers: guard.ctx.isMobile ? corsHeaders() : undefined,
          }
        );
      }
      filter = { partnerId, isDeleted: false, status: "pending" };
      sort = { dueDate: 1, createdAt: -1 };
      break;
    case "office_done":
      if (!isAdmin) {
        return NextResponse.json(
          { error: "Admin only." },
          {
            status: 403,
            headers: guard.ctx.isMobile ? corsHeaders() : undefined,
          }
        );
      }
      filter = { partnerId, isDeleted: false, status: "done" };
      sort = { completedAt: -1 };
      break;
    case "mine_active":
    default:
      filter = {
        partnerId,
        isDeleted: false,
        assignedToUserId: userId,
        status: "pending",
      };
      // Mongo sorts nulls first asc, last desc — for due-soonest we want
      // dated reminders first then undated. Achieved by sorting on a
      // secondary stable field.
      sort = { dueDate: 1, createdAt: -1 };
      break;
  }

  const docs = await Reminder.find(filter).sort(sort).limit(500).lean();
  const items = docs.map((r) => serialize(r, guard.ctx.user.id));

  // Always compute the "due or overdue for me" count, regardless of bucket.
  // The Senior Desk pill polls `mine_active` and reads this field for the
  // badge — keeps the request count low.
  const dueOrOverdueCount = await Reminder.countDocuments({
    partnerId,
    isDeleted: false,
    assignedToUserId: userId,
    status: "pending",
    dueDate: { $lte: endOfToday() },
  });

  return NextResponse.json(
    { reminders: items, dueOrOverdueCount },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}

export async function POST(request: Request) {
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

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json(
      { error: "Reminder needs a title." },
      {
        status: 400,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }
  if (title.length > 240) {
    return NextResponse.json(
      { error: "Title must be 240 characters or fewer." },
      {
        status: 400,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }
  const description =
    typeof body.description === "string"
      ? body.description.trim().slice(0, 4000)
      : "";
  const priorityInput =
    typeof body.priority === "string" ? body.priority.toLowerCase() : "normal";
  const priority = (
    VALID_PRIORITY.includes(priorityInput as ReminderPriority)
      ? priorityInput
      : "normal"
  ) as ReminderPriority;

  let dueDate: Date | null = null;
  if (typeof body.dueDate === "string" && body.dueDate.trim()) {
    const d = new Date(body.dueDate);
    if (!Number.isNaN(d.getTime())) dueDate = d;
  }

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);
  const callerId = new mongoose.Types.ObjectId(guard.ctx.user.id);

  // Default the assignee to the caller (personal reminder); allow assigning
  // to any active user in the office.
  let assignedToId = callerId;
  if (
    typeof body.assignedToUserId === "string" &&
    body.assignedToUserId &&
    mongoose.isValidObjectId(body.assignedToUserId)
  ) {
    assignedToId = new mongoose.Types.ObjectId(body.assignedToUserId);
  }

  const assignee = await User.findOne({
    _id: assignedToId,
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

  const callerName =
    `${guard.ctx.user.firstName} ${guard.ctx.user.lastName}`.trim() ||
    guard.ctx.user.email;
  const assigneeName =
    `${assignee.firstName} ${assignee.lastName}`.trim() || assignee.email;

  const doc = await Reminder.create({
    partnerId,
    title,
    description,
    dueDate,
    priority,
    assignedToUserId: assignedToId,
    assignedToName: assigneeName,
    createdByUserId: callerId,
    createdByName: callerName,
    status: "pending",
    completedAt: null,
    completedByUserId: null,
    isDeleted: false,
  });

  // Log a creation event. If the assignee is someone OTHER than the
  // creator, also log an "assigned" event so the assignee can see who
  // pinged them in the activity feed.
  await logWorkflowActivity(guard.ctx, {
    action: "reminder.created",
    targetType: "reminder",
    targetId: String(doc._id),
    targetName: title,
    message: `created a reminder **${title}**`,
    metadata: {
      reminderId: String(doc._id),
      assignedToUserId: String(assignedToId),
      assignedToName: assigneeName,
      priority,
      dueDate: dueDate ? dueDate.toISOString() : null,
    },
  });
  if (String(assignedToId) !== guard.ctx.user.id) {
    await logWorkflowActivity(guard.ctx, {
      action: "reminder.assigned",
      targetType: "reminder",
      targetId: String(doc._id),
      targetName: title,
      message: `assigned **${title}** to **${assigneeName}**`,
      metadata: {
        reminderId: String(doc._id),
        assignedToUserId: String(assignedToId),
      },
    });
  }

  return NextResponse.json(
    { ok: true, reminder: serialize(doc, guard.ctx.user.id) },
    {
      status: 201,
      headers: guard.ctx.isMobile ? corsHeaders() : undefined,
    }
  );
}
