import { connectDB } from "@/lib/db";
import { SupportTicket } from "@/models/SupportTicket";
import SupportInbox, { type TicketRow } from "./SupportInbox";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  await connectDB();
  const [docs, counts] = await Promise.all([
    SupportTicket.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean(),
    SupportTicket.aggregate<{ _id: string; n: number }>([
      { $match: { isDeleted: false } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
  ]);

  const tickets: TicketRow[] = docs.map((t) => ({
    id: String(t._id),
    partnerName: t.partnerName || "",
    reporterName: t.reporterName || "",
    reporterEmail: t.reporterEmail || "",
    reporterPhone: t.reporterPhone || "",
    subject: t.subject || "",
    category: t.category || "Other",
    message: t.message || "",
    status: (t.status || "open") as TicketRow["status"],
    adminNote: t.adminNote || "",
    createdAt: t.createdAt.toISOString(),
  }));

  const byStatus: Record<string, number> = {};
  for (const c of counts) byStatus[c._id] = c.n;

  return <SupportInbox tickets={tickets} counts={byStatus} />;
}
