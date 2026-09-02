import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { ChatRoom } from "@/models/ChatRoom";
import { ChatMessage } from "@/models/ChatMessage";
import { ChatRead } from "@/models/ChatRead";
import { getOrCreateGroupRoom } from "@/lib/chat-rooms";
import { Partner } from "@/models/Partner";

// GET /api/app/chat/unread
//
// Lightweight endpoint used by:
//   • The sidebar's Senior Desk badge — shows total unread across all rooms
//   • The Group/Private toggle pills — per-tab counts
// Returns counts only, never message bodies. Cheap enough that the sidebar
// can poll it on the same cadence as the activity bell.

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

export async function GET(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);
  const userId = new mongoose.Types.ObjectId(guard.ctx.user.id);
  const headers = guard.ctx.isMobile ? corsHeaders() : undefined;

  // Make sure the group room exists so this endpoint never silently
  // misses unread counts on a brand-new partner.
  const partner = await Partner.findById(partnerId).select("name").lean();
  const groupRoom = await getOrCreateGroupRoom(
    partnerId,
    partner?.name || ""
  );

  const privateRooms = await ChatRoom.find({
    partnerId,
    type: "private",
    isDeleted: false,
    members: userId,
  })
    .select("_id")
    .lean();

  const allIds = [groupRoom._id, ...privateRooms.map((r) => r._id)];
  const reads = await ChatRead.find({
    userId,
    roomId: { $in: allIds },
  })
    .select("roomId lastReadMessageId")
    .lean();
  const readMap = new Map(
    reads.map((r) => [String(r.roomId), r.lastReadMessageId])
  );

  async function countUnread(roomId: mongoose.Types.ObjectId): Promise<number> {
    const lastRead = readMap.get(String(roomId));
    const filter: Record<string, unknown> = {
      roomId,
      isDeleted: false,
      senderId: { $ne: userId },
    };
    if (lastRead) filter._id = { $gt: lastRead };
    return ChatMessage.countDocuments(filter);
  }

  const groupUnread = await countUnread(groupRoom._id);
  const privateCounts = await Promise.all(
    privateRooms.map(async (r) => ({
      roomId: String(r._id),
      count: await countUnread(r._id),
    }))
  );

  const privateTotal = privateCounts.reduce((acc, x) => acc + x.count, 0);
  const totalUnread = groupUnread + privateTotal;

  return NextResponse.json(
    {
      totalUnread,
      groupUnread,
      privateUnread: privateTotal,
      byRoomId: {
        [String(groupRoom._id)]: groupUnread,
        ...Object.fromEntries(privateCounts.map((c) => [c.roomId, c.count])),
      },
    },
    { headers }
  );
}
