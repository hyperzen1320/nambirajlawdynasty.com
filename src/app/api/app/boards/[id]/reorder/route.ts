import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { BoardList } from "@/models/BoardList";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { canPerform, workflowDeny } from "@/lib/workflow-rbac";
import { loadBoard } from "@/lib/workflow-helpers";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

// POST /api/app/boards/[id]/reorder
// Body: { listIds: string[] } — full ordered array of list ids on this board
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  if (!canPerform(guard.ctx.user.role, "listEdit")) {
    return workflowDeny("listEdit", guard.ctx.isMobile, corsHeaders);
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const ids = Array.isArray(body?.listIds)
    ? (body!.listIds as unknown[]).filter(
        (x): x is string => typeof x === "string"
      )
    : [];
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "listIds is required" },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  await connectDB();
  const board = await loadBoard(id, guard.ctx.user.partnerId);
  if (!board) {
    return NextResponse.json(
      { error: "Board not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  // Bulk update only lists that are actually on this board (defence in depth)
  const ops = ids.map((listId, idx) => ({
    updateOne: {
      filter: {
        _id: new mongoose.Types.ObjectId(listId),
        partnerId: board.partnerId,
        boardId: board._id,
        isDeleted: false,
      },
      update: { $set: { sortOrder: idx } },
    },
  }));

  if (ops.length > 0) {
    await BoardList.bulkWrite(ops);
  }

  // Reordering is a layout change, not a content event — no activity
  // entry. The user explicitly only wants create / edit / connect /
  // cross-list card moves in the audit feed.

  return NextResponse.json(
    { ok: true },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
