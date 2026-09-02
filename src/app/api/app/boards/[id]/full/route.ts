import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Board } from "@/models/Board";
import { BoardList } from "@/models/BoardList";
import { BoardEdge } from "@/models/BoardEdge";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { summarizeChecklists } from "@/lib/workflow-helpers";

// Returns the full canvas state — board, lists with their positions/colors,
// edges, tasks (with checklist summaries + assignees), and the active
// member list. The canvas calls this on mount and as a "resync" when the
// live feed reports changes that need authoritative data (e.g. another
// user added a card; we have its id from the activity feed but not its
// full payload).

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  const headers = guard.ctx.isMobile ? corsHeaders() : undefined;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json(
      { error: "Invalid board id" },
      { status: 400, headers }
    );
  }

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);
  const boardObjId = new mongoose.Types.ObjectId(id);

  const [board, lists, edges, tasks, members] = await Promise.all([
    Board.findOne({ _id: boardObjId, partnerId, isDeleted: false }).lean(),
    BoardList.find({ partnerId, boardId: boardObjId, isDeleted: false })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean(),
    BoardEdge.find({ partnerId, boardId: boardObjId, isDeleted: false }).lean(),
    Task.find({ partnerId, boardId: boardObjId, isDeleted: false })
      .sort({ listId: 1, sortOrder: 1, createdAt: 1 })
      .lean(),
    User.find({ partnerId, isDeleted: false, active: true })
      .select("firstName lastName role userType")
      .sort({ firstName: 1 })
      .lean(),
  ]);

  if (!board) {
    return NextResponse.json(
      { error: "Board not found" },
      { status: 404, headers }
    );
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

  return NextResponse.json(
    {
      board: {
        id: String(board._id),
        title: board.title,
        description: board.description,
        color: board.color,
      },
      lists: lists.map((l) => ({
        id: String(l._id),
        title: l.title,
        description: l.description || "",
        listDate: (l.listDate ?? l.createdAt).toISOString(),
        sortOrder: l.sortOrder,
        position: l.position || { x: 0, y: 0 },
        width: l.width || 320,
        color: l.color ?? null,
      })),
      edges: edges.map((e) => ({
        id: String(e._id),
        sourceListId: String(e.sourceListId),
        targetListId: String(e.targetListId),
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        label: e.label,
        color: e.color,
        style: e.style,
      })),
      tasks: tasks.map((t) => ({
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
        hasDescription: Boolean(t.description && t.description.trim().length > 0),
        updatedAt: t.updatedAt.toISOString(),
      })),
      members: Array.from(memberById.values()),
      role: guard.ctx.user.role,
      currentUserId: guard.ctx.user.id,
    },
    { headers }
  );
}
