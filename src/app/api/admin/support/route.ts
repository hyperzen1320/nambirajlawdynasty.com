import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import {
  SupportTicket,
  SUPPORT_STATUSES,
  type SupportStatus,
} from "@/models/SupportTicket";
import { requireAdmin } from "@/lib/admin-auth";
import { corsHeaders } from "@/lib/cors";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

type TicketLean = {
  _id: unknown;
  partnerName: string;
  reporterName: string;
  reporterEmail: string;
  reporterPhone: string;
  subject: string;
  category: string;
  message: string;
  status: string;
  adminNote: string;
  attachments: unknown[];
  createdAt: Date;
  updatedAt: Date;
};

export function serializeTicket(t: TicketLean) {
  return {
    id: String(t._id),
    partnerName: t.partnerName || "",
    reporterName: t.reporterName || "",
    reporterEmail: t.reporterEmail || "",
    reporterPhone: t.reporterPhone || "",
    subject: t.subject || "",
    category: t.category || "Other",
    message: t.message || "",
    status: t.status || "open",
    adminNote: t.adminNote || "",
    attachmentCount: Array.isArray(t.attachments) ? t.attachments.length : 0,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

// GET /api/admin/support — the Global-Admin support inbox. Newest first,
// optional ?status= filter. Also returns per-status counts for the tabs.
export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if ("error" in guard) return guard.error;
  const cors = guard.ctx.isMobile ? corsHeaders() : undefined;

  await connectDB();
  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const query: Record<string, unknown> = { isDeleted: false };
  if (
    statusParam &&
    SUPPORT_STATUSES.includes(statusParam as SupportStatus)
  ) {
    query.status = statusParam;
  }

  const [tickets, counts] = await Promise.all([
    SupportTicket.find(query).sort({ createdAt: -1 }).limit(500).lean(),
    SupportTicket.aggregate<{ _id: string; n: number }>([
      { $match: { isDeleted: false } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
  ]);

  const byStatus: Record<string, number> = {};
  for (const c of counts) byStatus[c._id] = c.n;

  return NextResponse.json(
    {
      tickets: (tickets as unknown as TicketLean[]).map(serializeTicket),
      counts: byStatus,
    },
    { headers: cors }
  );
}
