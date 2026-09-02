import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { Partner } from "@/models/Partner";
import { loadHearingsBucket, type Bucket } from "@/lib/hearings-bucket";
import HearingTrackClient from "./HearingTrackClient";
import { guardFeature } from "@/lib/feature-guard";

export const dynamic = "force-dynamic";

export default async function HearingTrackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await guardFeature("hearings");
  const sp = await searchParams;
  const tabParam = typeof sp.tab === "string" ? sp.tab : undefined;
  const bucket: Bucket =
    tabParam === "tomorrow" ||
    tabParam === "pending" ||
    tabParam === "all"
      ? tabParam
      : "today";

  const session = await auth();
  const partnerId = session?.user?.partnerId
    ? new mongoose.Types.ObjectId(session.user.partnerId)
    : null;
  const isAdmin = session?.user?.userType === "partner_admin";

  let items: Awaited<ReturnType<typeof loadHearingsBucket>>["items"] = [];
  let counts = { today: 0, tomorrow: 0, pending: 0, all: 0 };
  let officeName = "";
  let noticeTemplate = "";

  if (partnerId) {
    await connectDB();
    const [bucketData, partner] = await Promise.all([
      loadHearingsBucket(partnerId, bucket),
      Partner.findById(partnerId).lean(),
    ]);
    items = bucketData.items;
    counts = bucketData.counts;
    officeName = partner?.branding?.officeName || partner?.name || "";
    noticeTemplate = partner?.noticeTemplate || "";
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-[1280px]">
        <HearingTrackClient
          bucket={bucket}
          items={items}
          counts={counts}
          officeName={officeName}
          noticeTemplate={noticeTemplate}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
