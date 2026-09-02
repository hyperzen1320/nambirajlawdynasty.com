import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { Court } from "@/models/Court";
import { Case } from "@/models/Case";
import CourtHubClient, { type CourtRow } from "./CourtHubClient";
import { guardFeature } from "@/lib/feature-guard";

export const dynamic = "force-dynamic";

export default async function CourtsPage() {
  await guardFeature("courts");
  const session = await auth();
  const partnerId = session?.user?.partnerId
    ? new mongoose.Types.ObjectId(session.user.partnerId)
    : null;

  let courts: CourtRow[] = [];

  if (partnerId) {
    await connectDB();
    const [docs, caseAgg] = await Promise.all([
      Court.find({ partnerId, isDeleted: false })
        .sort({ sortOrder: 1, name: 1 })
        .lean(),
      Case.aggregate<{
        _id: { id: mongoose.Types.ObjectId | null; name: string };
        count: number;
      }>([
        { $match: { partnerId, isDeleted: false } },
        {
          $group: {
            _id: { id: "$courtId", name: { $toLower: "$courtName" } },
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

    courts = docs.map((c) => {
      const byIdCount = byId.get(String(c._id)) ?? 0;
      const byNameCount = byName.get((c.name || "").toLowerCase()) ?? 0;
      const caseCount = byIdCount > 0 ? byIdCount : byNameCount;
      return {
        id: String(c._id),
        name: c.name,
        number: c.number,
        place: c.place,
        caseCount,
      };
    });
  }

  const isAdmin = session?.user?.userType === "partner_admin";

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-[1280px]">
        <CourtHubClient initialCourts={courts} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
