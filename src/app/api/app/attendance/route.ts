import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Attendance, ATTENDANCE_STATUSES, type AttendanceStatus } from "@/models/Attendance";
import { User } from "@/models/User";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { logWorkflowActivity } from "@/lib/activity";
import {
  elapsedDaysInMonth,
  monthRange,
  normaliseToIstMidnight,
  parseMonthParam,
  summariseUser,
} from "@/lib/attendance";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

type RecordDTO = {
  id: string;
  userId: string;
  date: string;
  status: AttendanceStatus;
  note: string;
  markedByName: string;
  markedAt: string;
};

type UserDTO = {
  id: string;
  name: string;
  email: string;
  role: string;
  isYou: boolean;
};

export async function GET(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  // Attendance is now wholly office-admin only — the page redirects
  // non-admins, and this is the server half of the same gate so a
  // hand-crafted GET can't read the office register either.
  if (guard.ctx.user.userType !== "partner_admin") {
    return NextResponse.json(
      { error: "Attendance is visible to the office admin only." },
      {
        status: 403,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);
  const isAdmin = guard.ctx.user.userType === "partner_admin";
  const callerId = new mongoose.Types.ObjectId(guard.ctx.user.id);

  const url = new URL(request.url);
  const { year, month } = parseMonthParam(url.searchParams.get("month"));
  const { start, end, totalDays } = monthRange(year, month);
  const daysSoFar = elapsedDaysInMonth(year, month);

  // Admin pulls every active office user; non-admins only see their own
  // attendance — colleagues' P/A/L is none of their business by default.
  const userFilter = isAdmin
    ? { partnerId, isDeleted: false, active: { $ne: false } }
    : { _id: callerId, partnerId, isDeleted: false };

  const userDocs = await User.find(userFilter)
    .select("firstName lastName email role userType active")
    .sort({ userType: 1, firstName: 1, lastName: 1 })
    .lean();

  const userIds = userDocs.map((u) => u._id);

  const recordDocs = userIds.length
    ? await Attendance.find({
        partnerId,
        userId: { $in: userIds },
        date: { $gte: start, $lt: end },
      })
        .sort({ date: 1 })
        .lean()
    : [];

  // Look up the names of the admins who did the marking, in one round-
  // trip. This lets the cell tooltip read "Marked by Tejas, 2pm" rather
  // than just showing the raw timestamp.
  const markerIds = Array.from(
    new Set(
      recordDocs
        .map((r) => (r.markedByUserId ? String(r.markedByUserId) : null))
        .filter((x): x is string => Boolean(x))
    )
  );
  const markers = markerIds.length
    ? await User.find({
        _id: {
          $in: markerIds.map((id) => new mongoose.Types.ObjectId(id)),
        },
        partnerId,
      })
        .select("firstName lastName email")
        .lean()
    : [];
  const markerNames = new Map<string, string>();
  for (const m of markers) {
    markerNames.set(
      String(m._id),
      `${m.firstName || ""} ${m.lastName || ""}`.trim() || m.email
    );
  }

  const users: UserDTO[] = userDocs.map((u) => ({
    id: String(u._id),
    name:
      `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
    email: u.email,
    role:
      u.userType === "partner_admin"
        ? "admin"
        : u.role || "junior",
    isYou: String(u._id) === guard.ctx.user.id,
  }));

  const records: RecordDTO[] = recordDocs.map((r) => ({
    id: String(r._id),
    userId: String(r.userId),
    date: r.date.toISOString(),
    status: r.status,
    note: r.note || "",
    markedByName: r.markedByUserId
      ? markerNames.get(String(r.markedByUserId)) || ""
      : "",
    markedAt: r.markedAt ? r.markedAt.toISOString() : "",
  }));

  // Per-user summary. Group records by user once so the per-user
  // summariseUser call is cheap.
  const grouped = new Map<string, { status: AttendanceStatus }[]>();
  for (const r of records) {
    const arr = grouped.get(r.userId) ?? [];
    arr.push({ status: r.status });
    grouped.set(r.userId, arr);
  }
  const perUser: Record<
    string,
    ReturnType<typeof summariseUser>
  > = {};
  let pctSum = 0;
  let pctCount = 0;
  let totalMarked = 0;
  for (const u of users) {
    const s = summariseUser(
      grouped.get(u.id) ?? [],
      totalDays,
      daysSoFar
    );
    perUser[u.id] = s;
    totalMarked += s.present + s.absent + s.halfDay + s.leave + s.holiday;
    // Only include users with at least one working-day record in the
    // office average — otherwise a brand-new hire skews the chambers
    // pct to zero.
    if (s.present + s.absent + s.halfDay > 0) {
      pctSum += s.attendancePct;
      pctCount += 1;
    }
  }
  const office = {
    avgAttendancePct: pctCount > 0 ? Math.round((pctSum / pctCount) * 10) / 10 : 0,
    totalUsers: users.length,
    totalMarked,
    totalPossible: users.length * daysSoFar,
  };

  return NextResponse.json(
    {
      month: `${year}-${String(month).padStart(2, "0")}`,
      totalDays,
      daysSoFar,
      users,
      records,
      summary: { perUser, office },
      isAdmin,
    },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}

export async function POST(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  // Marking is admin-only. Non-admins can read their own attendance
  // (via GET) but never write — they can't unilaterally mark themselves
  // present and bias their own metric.
  if (guard.ctx.user.userType !== "partner_admin") {
    return NextResponse.json(
      { error: "Only the office admin can mark attendance." },
      {
        status: 403,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }

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

  const userIdRaw = typeof body.userId === "string" ? body.userId : "";
  const dateRaw = typeof body.date === "string" ? body.date : "";
  const statusRaw = typeof body.status === "string" ? body.status : "";
  const noteRaw = typeof body.note === "string" ? body.note.trim() : "";

  if (!mongoose.isValidObjectId(userIdRaw)) {
    return NextResponse.json(
      { error: "Invalid user id." },
      {
        status: 400,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }
  if (!dateRaw) {
    return NextResponse.json(
      { error: "Date is required." },
      {
        status: 400,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }
  const parsedDate = new Date(dateRaw);
  if (Number.isNaN(parsedDate.getTime())) {
    return NextResponse.json(
      { error: "Date is not a valid timestamp." },
      {
        status: 400,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }
  const dayIst = normaliseToIstMidnight(parsedDate);

  // Future-date guard. The UI greys out future cells but the server is
  // the source of truth — a craftily-typed POST shouldn't be able to
  // mark tomorrow as Present. Today's IST midnight is the boundary:
  // dates strictly greater than that are rejected.
  const todayIst = normaliseToIstMidnight(new Date());
  if (dayIst.getTime() > todayIst.getTime()) {
    return NextResponse.json(
      {
        error:
          "Attendance can only be marked for today or past dates.",
      },
      {
        status: 400,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);
  const userObjId = new mongoose.Types.ObjectId(userIdRaw);
  const markerId = new mongoose.Types.ObjectId(guard.ctx.user.id);

  // Confirm the target user actually belongs to this partner so an
  // admin from chambers A can't mark someone in chambers B's office.
  const targetUser = await User.findOne({
    _id: userObjId,
    partnerId,
    isDeleted: false,
  })
    .select("firstName lastName email userType")
    .lean();
  if (!targetUser) {
    return NextResponse.json(
      { error: "That teammate isn't in your office." },
      {
        status: 404,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }
  const targetName =
    `${targetUser.firstName || ""} ${targetUser.lastName || ""}`.trim() ||
    targetUser.email;
  const dayLabel = dayIst.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Empty / null status = clear the marking (delete the row). This is
  // how the "Not marked" button in the cell popover unsets attendance.
  if (!statusRaw) {
    const deleted = await Attendance.findOneAndDelete({
      partnerId,
      userId: userObjId,
      date: dayIst,
    });
    if (deleted) {
      await logWorkflowActivity(guard.ctx, {
        action: "attendance.cleared",
        targetType: "attendance",
        targetId: String(deleted._id),
        targetName,
        message: `cleared attendance for **${targetName}** on ${dayLabel}`,
        metadata: {
          userId: userIdRaw,
          date: dayIst.toISOString(),
          previousStatus: deleted.status,
        },
      });
    }
    return NextResponse.json(
      { ok: true, cleared: true },
      { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  if (
    !ATTENDANCE_STATUSES.includes(statusRaw as AttendanceStatus)
  ) {
    return NextResponse.json(
      {
        error:
          "Status must be one of: present, absent, half_day, leave, holiday.",
      },
      {
        status: 400,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }
  const status = statusRaw as AttendanceStatus;
  const note = noteRaw.slice(0, 500);

  // findOneAndUpdate + upsert lets two browser tabs land on the same
  // (user, date) at once without creating two rows — the unique index
  // would reject the duplicate anyway, but the upsert is cleaner.
  const updated = await Attendance.findOneAndUpdate(
    { partnerId, userId: userObjId, date: dayIst },
    {
      $set: {
        partnerId,
        userId: userObjId,
        date: dayIst,
        status,
        note,
        markedByUserId: markerId,
        markedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  await logWorkflowActivity(guard.ctx, {
    action: "attendance.marked",
    targetType: "attendance",
    targetId: String(updated._id),
    targetName,
    message: `marked **${targetName}** ${status.replace("_", " ")} on ${dayLabel}`,
    metadata: {
      userId: userIdRaw,
      date: dayIst.toISOString(),
      status,
      note: note || undefined,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      record: {
        id: String(updated._id),
        userId: userIdRaw,
        date: dayIst.toISOString(),
        status,
        note,
        markedAt: updated.markedAt.toISOString(),
      },
    },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
