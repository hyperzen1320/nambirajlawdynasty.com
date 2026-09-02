// Presence heartbeat. Client POSTs every 15s while the canvas is focused;
// the server upserts the (board, user) presence row with the latest beat
// time and returns everyone whose lastBeat is within 30s.
//
// The TTL on `BoardPresence.lastBeat` removes stale rows automatically, so
// closing the tab without a clean shutdown still results in the user
// disappearing from presence ~60s later.

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { BoardPresence } from "@/models/BoardPresence";
import { Board } from "@/models/Board";
import { User } from "@/models/User";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

const ACTIVE_WINDOW_MS = 30_000;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  const headers = guard.ctx.isMobile ? corsHeaders() : undefined;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json(
      { error: "invalid_board" },
      { status: 400, headers }
    );
  }

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);
  const boardId = new mongoose.Types.ObjectId(id);
  const userId = new mongoose.Types.ObjectId(guard.ctx.user.id);

  // Quick tenant-scope check so a user can't beat against another
  // partner's board id (defence in depth — they shouldn't have one).
  const board = await Board.findOne({
    _id: boardId,
    partnerId,
    isDeleted: false,
  })
    .select("_id")
    .lean();
  if (!board) {
    return NextResponse.json(
      { error: "board_not_found" },
      { status: 404, headers }
    );
  }

  // Pull live name/role/designation off the user record. We could pass
  // them on the JWT too but reading from the source avoids stale labels
  // when an admin changes someone's role mid-session.
  const u = await User.findById(userId)
    .select("firstName lastName role designation userType")
    .lean();
  const fullName = u
    ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()
    : "";
  const role = u?.role || (u?.userType === "partner_admin" ? "admin" : "junior");
  const designation = u?.designation || "";

  await BoardPresence.findOneAndUpdate(
    { boardId, userId },
    {
      $set: {
        partnerId,
        boardId,
        userId,
        userName: fullName,
        role,
        designation,
        lastBeat: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  const since = new Date(Date.now() - ACTIVE_WINDOW_MS);
  const others = await BoardPresence.find({
    partnerId,
    boardId,
    lastBeat: { $gte: since },
  })
    .sort({ lastBeat: -1 })
    .lean();

  const active = others.map((p) => ({
    userId: String(p.userId),
    name: p.userName || "Someone",
    role: p.role,
    designation: p.designation,
    lastBeat: p.lastBeat.toISOString(),
    isYou: String(p.userId) === guard.ctx.user.id,
  }));

  return NextResponse.json({ active }, { headers });
}
