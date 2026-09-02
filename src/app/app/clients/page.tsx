import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { Client } from "@/models/Client";
import { Case } from "@/models/Case";
import ClientCrewClient, { type ClientRow } from "./ClientCrewClient";
import { guardFeature } from "@/lib/feature-guard";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  await guardFeature("clients");
  const session = await auth();
  const partnerId = session?.user?.partnerId
    ? new mongoose.Types.ObjectId(session.user.partnerId)
    : null;

  let clients: ClientRow[] = [];

  if (partnerId) {
    await connectDB();
    const [docs, caseAgg] = await Promise.all([
      Client.find({ partnerId, isDeleted: false }).sort({ name: 1 }).lean(),
      Case.aggregate<{
        _id: { id: mongoose.Types.ObjectId | null; name: string };
        count: number;
      }>([
        { $match: { partnerId, isDeleted: false } },
        {
          $group: {
            _id: { id: "$clientId", name: { $toLower: "$clientName" } },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const byId = new Map<string, number>();
    const byName = new Map<string, number>();
    for (const row of caseAgg) {
      if (row._id.id) {
        byId.set(
          String(row._id.id),
          (byId.get(String(row._id.id)) ?? 0) + row.count
        );
      }
      if (row._id.name) {
        byName.set(row._id.name, (byName.get(row._id.name) ?? 0) + row.count);
      }
    }

    clients = docs.map((c) => {
      const byIdCount = byId.get(String(c._id)) ?? 0;
      const byNameCount = byName.get((c.name || "").toLowerCase()) ?? 0;
      const caseCount = byIdCount > 0 ? byIdCount : byNameCount;
      return {
        id: String(c._id),
        name: c.name,
        email: c.email,
        phone: c.phone,
        whatsapp: c.whatsapp,
        address: c.address,
        caseCount,
      };
    });
  }

  const isAdmin = session?.user?.userType === "partner_admin";

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-[1280px]">
        <ClientCrewClient initialClients={clients} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
