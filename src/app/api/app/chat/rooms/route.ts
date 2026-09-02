import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { ChatRoom } from "@/models/ChatRoom";
import { ChatMessage } from "@/models/ChatMessage";
import { ChatRead } from "@/models/ChatRead";
import { User } from "@/models/User";
import { Partner } from "@/models/Partner";
import { getOrCreateGroupRoom } from "@/lib/chat-rooms";

// GET /api/app/chat/rooms
//
// Returns the chat room list for the calling user:
//   • The single group room (auto-created on first request).
//   • Every private room they're a member of, sorted by most-recent
//     activity. Each row carries the other party's name + role + active
//     flag, the last message preview, and the user's unread count.
//
// Counts are derived from ChatRead via index-only queries — never scans
// the whole ChatMessage collection.

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

type RoomDTO = {
  id: string;
  type: "group" | "private";
  title: string;
  // For private rooms only — the OTHER user (not the caller). Group rooms
  // leave this null.
  otherUser: {
    id: string;
    name: string;
    role: string;
    active: boolean;
  } | null;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  lastMessageAuthorId: string | null;
  unreadCount: number;
};

export async function GET(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);
  const userId = new mongoose.Types.ObjectId(guard.ctx.user.id);
  const headers = guard.ctx.isMobile ? corsHeaders() : undefined;

  // Group room is lazy-seeded on first visit. Use the partner's display
  // name as the title (falls back to "Group Chat" inside the helper).
  const partner = await Partner.findById(partnerId).select("name").lean();
  const groupRoom = await getOrCreateGroupRoom(
    partnerId,
    partner?.name || ""
  );

  // All private rooms the user belongs to. Index hit:
  // (partnerId, members, lastMessageAt: -1).
  const privateRooms = await ChatRoom.find({
    partnerId,
    type: "private",
    isDeleted: false,
    members: userId,
  })
    .sort({ lastMessageAt: -1, _id: -1 })
    .lean();

  // Pull the "other user" info for every private room in one round-trip.
  const otherIds = new Set<string>();
  for (const r of privateRooms) {
    for (const m of r.members) {
      if (String(m) !== String(userId)) otherIds.add(String(m));
    }
  }
  const others = otherIds.size
    ? await User.find({
        _id: {
          $in: Array.from(otherIds).map(
            (id) => new mongoose.Types.ObjectId(id)
          ),
        },
        partnerId,
      })
        .select("firstName lastName email role active isDeleted")
        .lean()
    : [];
  const userById = new Map(others.map((u) => [String(u._id), u]));

  // Read markers for every room we're about to render.
  const allRoomIds = [groupRoom._id, ...privateRooms.map((r) => r._id)];
  const reads = await ChatRead.find({
    userId,
    roomId: { $in: allRoomIds },
  })
    .select("roomId lastReadMessageId")
    .lean();
  const lastReadByRoom = new Map(
    reads.map((r) => [String(r.roomId), r.lastReadMessageId])
  );

  // Unread counts — one indexed query per room with $gt on the last-read
  // message id (or "all of them" when the user has never opened the room).
  // For a 25-user office this is at most ~25 queries; in practice most
  // users carry only a handful of private rooms.
  async function unreadFor(roomId: mongoose.Types.ObjectId): Promise<number> {
    const lastRead = lastReadByRoom.get(String(roomId));
    const filter: Record<string, unknown> = {
      roomId,
      isDeleted: false,
      // Don't count your own messages as unread.
      senderId: { $ne: userId },
    };
    if (lastRead) {
      filter._id = { $gt: lastRead };
    }
    return ChatMessage.countDocuments(filter);
  }

  const groupUnread = await unreadFor(groupRoom._id);
  const privateUnreads = await Promise.all(
    privateRooms.map((r) => unreadFor(r._id))
  );

  const rooms: RoomDTO[] = [
    {
      id: String(groupRoom._id),
      type: "group",
      title: groupRoom.title || partner?.name || "Group Chat",
      otherUser: null,
      lastMessageAt: groupRoom.lastMessageAt
        ? groupRoom.lastMessageAt.toISOString()
        : null,
      lastMessagePreview: groupRoom.lastMessagePreview,
      lastMessageAuthorId: groupRoom.lastMessageAuthorId
        ? String(groupRoom.lastMessageAuthorId)
        : null,
      unreadCount: groupUnread,
    },
    ...privateRooms.map((r, i): RoomDTO => {
      const otherId = r.members.find((m) => String(m) !== String(userId));
      const other = otherId ? userById.get(String(otherId)) : null;
      const otherName = other
        ? `${other.firstName} ${other.lastName}`.trim() || other.email
        : "Removed user";
      return {
        id: String(r._id),
        type: "private",
        title: otherName,
        otherUser: other
          ? {
              id: String(other._id),
              name: otherName,
              role: other.role || "junior",
              active: !other.isDeleted && other.active !== false,
            }
          : null,
        lastMessageAt: r.lastMessageAt ? r.lastMessageAt.toISOString() : null,
        lastMessagePreview: r.lastMessagePreview,
        lastMessageAuthorId: r.lastMessageAuthorId
          ? String(r.lastMessageAuthorId)
          : null,
        unreadCount: privateUnreads[i],
      };
    }),
  ];

  const totalUnread = rooms.reduce((acc, r) => acc + r.unreadCount, 0);

  return NextResponse.json({ rooms, totalUnread }, { headers });
}
