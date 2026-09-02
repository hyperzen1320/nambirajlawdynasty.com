import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { Board } from "@/models/Board";
import { BOARD_DEFAULTS } from "@/lib/board-defaults";
import BoardsClient, { type BoardRow } from "./BoardsClient";
import { guardFeature } from "@/lib/feature-guard";

export const dynamic = "force-dynamic";

export default async function WorkflowPage() {
  await guardFeature("workflow");
  const session = await auth();
  const partnerId = session?.user?.partnerId
    ? new mongoose.Types.ObjectId(session.user.partnerId)
    : null;

  let boards: BoardRow[] = [];

  if (partnerId) {
    await connectDB();

    // Lazy-seed defaults the first time this partner visits.
    const count = await Board.countDocuments({
      partnerId,
      isDeleted: false,
    });
    if (count === 0) {
      await Board.insertMany(
        BOARD_DEFAULTS.map((b, idx) => ({
          partnerId,
          title: b.title,
          description: b.description,
          color: b.color,
          sortOrder: idx,
          isSeeded: true,
        }))
      );
    }

    const docs = await Board.find({ partnerId, isDeleted: false })
      .sort({ updatedAt: -1, sortOrder: 1 })
      .lean();

    boards = docs.map((b) => ({
      id: String(b._id),
      title: b.title,
      description: b.description,
      color: b.color,
      isSeeded: b.isSeeded,
      cardCount: 0,
      updatedAt: b.updatedAt.toISOString(),
      createdAt: b.createdAt.toISOString(),
    }));
  }

  const isAdmin = session?.user?.userType === "partner_admin";

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-[1280px]">
        <BoardsClient initialBoards={boards} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
