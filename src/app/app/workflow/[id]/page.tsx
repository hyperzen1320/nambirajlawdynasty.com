import mongoose from "mongoose";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { Board } from "@/models/Board";
import { BoardList } from "@/models/BoardList";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import { BOARD_COLOR_STYLES } from "@/lib/board-defaults";
import { summarizeChecklists } from "@/lib/workflow-helpers";
import BoardCanvas from "./BoardCanvas";
import { guardFeature } from "@/lib/feature-guard";

export const dynamic = "force-dynamic";

export default async function BoardCanvasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await guardFeature("workflow");
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) notFound();

  const session = await auth();
  if (!session?.user?.partnerId) notFound();
  const partnerId = new mongoose.Types.ObjectId(session.user.partnerId);
  const boardObjId = new mongoose.Types.ObjectId(id);

  await connectDB();

  const [board, lists, tasks, members] = await Promise.all([
    Board.findOne({ _id: boardObjId, partnerId, isDeleted: false }),
    BoardList.find({
      partnerId,
      boardId: boardObjId,
      isDeleted: false,
    })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean(),
    Task.find({
      partnerId,
      boardId: boardObjId,
      isDeleted: false,
    })
      .sort({ listId: 1, sortOrder: 1, createdAt: 1 })
      .lean(),
    User.find({ partnerId, isDeleted: false, active: true })
      .select("firstName lastName role userType")
      .sort({ firstName: 1 })
      .lean(),
  ]);

  if (!board) notFound();

  // ─── Auto-layout on first open ──────────────────────────────────────────
  // Lists created before the canvas existed have position {0,0}. Spread
  // them into a tidy grid then mark the board so we don't redo it.
  const PADDING_X = 360;
  const PADDING_Y = 460;
  const PER_ROW = 4;
  if (!board.layoutInitialized) {
    for (let i = 0; i < lists.length; i++) {
      const x = (i % PER_ROW) * PADDING_X + 60;
      const y = Math.floor(i / PER_ROW) * PADDING_Y + 80;
      lists[i].position = { x, y };
      lists[i].width = lists[i].width || 320;
      await BoardList.updateOne(
        { _id: lists[i]._id },
        { $set: { position: { x, y }, width: lists[i].width } }
      );
    }
    board.layoutInitialized = true;
    await board.save();
  }

  const memberById = new Map<
    string,
    { id: string; name: string; role: string }
  >();
  for (const m of members) {
    memberById.set(String(m._id), {
      id: String(m._id),
      name: `${m.firstName} ${m.lastName}`.trim(),
      role: m.role || (m.userType === "partner_admin" ? "admin" : "junior"),
    });
  }

  // Pull the fine-grained role straight from the user record. The session
  // only carries the broad userType (partner_admin / user); to enforce
  // canEdit and to colour cursor labels we need the actual role.
  const meDoc = session.user.id
    ? await User.findById(new mongoose.Types.ObjectId(session.user.id))
        .select("role userType")
        .lean()
    : null;
  const role =
    meDoc?.role ||
    (session.user.userType === "partner_admin" ? "admin" : "junior");

  const styles =
    BOARD_COLOR_STYLES[board.color] ?? BOARD_COLOR_STYLES.copper;

  return (
    <BoardCanvas
      currentUserId={session.user.id ?? null}
      boardId={String(board._id)}
      board={{
        id: String(board._id),
        title: board.title,
        description: board.description,
        color: board.color,
      }}
      accent={styles.gradient[0]}
      accentSoft={styles.accent}
      gradient={styles.gradient as [string, string]}
      initialViewport={{
        x: board.viewport?.x ?? 0,
        y: board.viewport?.y ?? 0,
        zoom: board.viewport?.zoom ?? 1,
      }}
      initialLists={lists.map((l) => ({
        id: String(l._id),
        title: l.title,
        description: l.description || "",
        listDate: (l.listDate ?? l.createdAt).toISOString(),
        sortOrder: l.sortOrder,
        position: l.position || { x: 0, y: 0 },
        width: l.width || 320,
        color: l.color ?? null,
      }))}
      initialTasks={tasks.map((t) => ({
        id: String(t._id),
        listId: String(t.listId),
        title: t.title,
        description: t.description || "",
        sortOrder: t.sortOrder,
        assignee: t.assignedToUserId
          ? memberById.get(String(t.assignedToUserId)) || null
          : null,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        priority: t.priority,
        checklistSummary: summarizeChecklists(t.checklists || []),
        hasDescription: Boolean(
          t.description && t.description.trim().length > 0
        ),
        updatedAt: t.updatedAt.toISOString(),
      }))}
      members={Array.from(memberById.values())}
      role={role}
    />
  );
}
