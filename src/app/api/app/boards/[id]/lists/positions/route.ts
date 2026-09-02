import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { BoardList } from "@/models/BoardList";
import { Board } from "@/models/Board";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { canPerform, workflowDeny } from "@/lib/workflow-rbac";
import { loadBoard } from "@/lib/workflow-helpers";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

// POST /api/app/boards/[id]/lists/positions
// Body: { positions: [{ listId, x, y, width? }] }
// Bulk position save called by the canvas's debounced auto-save.
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
  const incoming = Array.isArray(body?.positions)
    ? (body!.positions as Array<{
        listId: string;
        x: number;
        y: number;
        width?: number;
      }>)
    : [];
  if (incoming.length === 0) {
    return NextResponse.json(
      { error: "positions is required" },
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

  const ops = incoming
    .filter(
      (p) =>
        p.listId &&
        mongoose.isValidObjectId(p.listId) &&
        Number.isFinite(p.x) &&
        Number.isFinite(p.y)
    )
    .map((p) => {
      const set: Record<string, unknown> = {
        position: { x: p.x, y: p.y },
      };
      if (typeof p.width === "number" && Number.isFinite(p.width)) {
        set.width = Math.max(240, Math.min(560, p.width));
      }
      return {
        updateOne: {
          filter: {
            _id: new mongoose.Types.ObjectId(p.listId),
            partnerId: board.partnerId,
            boardId: board._id,
            isDeleted: false,
          },
          update: { $set: set },
        },
      };
    });

  if (ops.length > 0) {
    await BoardList.bulkWrite(ops);
  }
  // Mark layout as initialized so we don't auto-arrange on next open.
  if (!board.layoutInitialized) {
    await Board.updateOne(
      { _id: board._id },
      { $set: { layoutInitialized: true } }
    );
  }

  // List position drags are pure layout — they don't fire an activity
  // entry. The user only wants real content events (create / edit /
  // connect / cross-list card moves) in the audit feed.

  return NextResponse.json(
    { ok: true, updated: ops.length },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
