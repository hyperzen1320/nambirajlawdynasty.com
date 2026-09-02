import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Case } from "@/models/Case";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { istDayStart } from "@/lib/ist-day";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

export async function GET(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);

  // Day boundaries in IST, not in whatever timezone the container
  // happens to run in. The Hearing Track has always used istDayStart;
  // the dashboard used the server's local midnight, so on a UTC host the
  // two disagreed about which matters were "today" and the tile and the
  // diary showed different numbers for the same moment.
  const now = new Date();
  const startOfToday = istDayStart(now, 0);
  const startOfTomorrow = istDayStart(now, 1);
  const startOfDayAfter = istDayStart(now, 2);
  const twoWeeksOut = istDayStart(now, 14);

  await connectDB();

  // Disposed cases are excluded from every dashboard tile and from the
  // upcoming-hearings cause-list. The Disposed Cases section is the
  // only place they show up.
  const activeFilter = {
    partnerId,
    isDeleted: false,
    disposedAt: null,
  } as const;

  const [todayHearings, tomorrowHearings, pendingDates, caseVault, boardDocs] =
    await Promise.all([
      Case.countDocuments({
        ...activeFilter,
        nextHearingDate: { $gte: startOfToday, $lt: startOfTomorrow },
      }),
      Case.countDocuments({
        ...activeFilter,
        nextHearingDate: { $gte: startOfTomorrow, $lt: startOfDayAfter },
      }),
      Case.countDocuments({
        ...activeFilter,
        $or: [
          { nextHearingDate: null },
          { nextHearingDate: { $lt: startOfToday } },
        ],
      }),
      Case.countDocuments(activeFilter),
      Case.find({
        ...activeFilter,
        nextHearingDate: { $gte: startOfToday, $lt: twoWeeksOut },
      })
        .sort({ nextHearingDate: 1 })
        .limit(5)
        .lean(),
    ]);

  const todaysBoard = boardDocs.map((c) => ({
    id: String(c._id),
    caseNo: c.caseNo,
    status: c.status,
    clientName: c.clientName,
    courtName: c.courtName,
    courtPlace: c.courtPlace,
    nextHearingDate: c.nextHearingDate
      ? c.nextHearingDate.toISOString()
      : null,
  }));

  return NextResponse.json(
    {
      stats: { todayHearings, tomorrowHearings, pendingDates, caseVault },
      todaysBoard,
    },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
