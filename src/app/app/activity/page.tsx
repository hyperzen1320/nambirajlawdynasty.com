import mongoose from "mongoose";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { Activity } from "@/models/Activity";
import { Partner } from "@/models/Partner";
import { Board } from "@/models/Board";
import { User } from "@/models/User";
import { fullName } from "@/lib/display-name";
import ActivityClient, {
  type ActivityRow,
  type ActivityActor,
  type ActivityBoardOption,
} from "./ActivityClient";
import { guardFeature } from "@/lib/feature-guard";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function ActivityPage() {
  await guardFeature("activity");
  const session = await auth();
  if (!session?.user?.partnerId) {
    return null;
  }
  // The full Activity explorer is office-admin only. (The bell dropdown
  // + workflow live-feed still surface a non-admin's own delete requests
  // — those run off separate, intentionally-open endpoints.)
  if (session.user.userType !== "partner_admin") redirect("/app");
  const partnerId = new mongoose.Types.ObjectId(session.user.partnerId);
  const isAdmin = session.user.userType === "partner_admin";

  await connectDB();

  // Lazy auto-prune on landing
  const partner = await Partner.findById(partnerId).select("settings").lean();
  const days = partner?.settings?.activityRetentionDays ?? null;
  if (days && Number.isFinite(days) && days >= 1) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    await Activity.deleteMany({ partnerId, createdAt: { $lt: cutoff } });
  }

  const [docs, boards, users] = await Promise.all([
    Activity.find({ partnerId, actorType: { $ne: "global_admin" } })
      .sort({ createdAt: -1 })
      .limit(PAGE_SIZE + 1)
      .lean(),
    Board.find({ partnerId, isDeleted: false })
      .select("title color")
      .sort({ title: 1 })
      .lean(),
    User.find({ partnerId, isDeleted: false })
      .select("firstName lastName")
      .sort({ firstName: 1 })
      .lean(),
  ]);

  const hasMore = docs.length > PAGE_SIZE;
  const trimmed = hasMore ? docs.slice(0, PAGE_SIZE) : docs;

  const activity: ActivityRow[] = trimmed.map((a) => ({
    id: String(a._id),
    actorUserId: a.actorUserId ? String(a.actorUserId) : null,
    actorName: a.actorName,
    action: a.action,
    targetType: a.targetType,
    targetId: a.targetId ? String(a.targetId) : null,
    targetName: a.targetName,
    message: a.message,
    metadata: (a.metadata as Record<string, unknown>) ?? {},
    boardId: a.boardId ? String(a.boardId) : null,
    createdAt: a.createdAt.toISOString(),
  }));

  const actors: ActivityActor[] = users.map((u) => ({
    id: String(u._id),
    name: fullName(u.firstName, u.lastName),
  }));

  const boardOptions: ActivityBoardOption[] = boards.map((b) => ({
    id: String(b._id),
    title: b.title,
    color: b.color as string,
  }));

  const nextCursor = hasMore
    ? trimmed[trimmed.length - 1].createdAt.toISOString()
    : null;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-[1100px]">
        <ActivityClient
          initialActivity={activity}
          initialNextCursor={nextCursor}
          actors={actors}
          boards={boardOptions}
          isAdmin={isAdmin}
          retentionDays={days ?? null}
        />
      </div>
    </div>
  );
}
