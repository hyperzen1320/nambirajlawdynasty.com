import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { ChatRoom } from "@/models/ChatRoom";
import { ChatMessage } from "@/models/ChatMessage";
import { ChatRead } from "@/models/ChatRead";
import { userCanReadRoom } from "@/lib/chat-rooms";

// POST /api/app/chat/rooms/[id]/read   { messageId?: string }
//
// Marks the room as read up to `messageId` for the calling user. If no
// messageId is supplied we default to the room's most recent message —
// useful for "I scrolled to the bottom" without the client having to
// know the exact id.
//
// Idempotent: an upsert on (userId, roomId) means repeated calls just
// bump `lastReadAt`.

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json(
      { error: "Invalid room id" },
      {
        status: 400,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const messageIdInput =
    typeof body?.messageId === "string" ? body.messageId : "";

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);
  const userId = new mongoose.Types.ObjectId(guard.ctx.user.id);

  const room = await ChatRoom.findOne({
    _id: new mongoose.Types.ObjectId(id),
    partnerId,
    isDeleted: false,
  }).lean();
  if (!room) {
    return NextResponse.json(
      { error: "Room not found" },
      {
        status: 404,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }
  if (!userCanReadRoom(room, partnerId, userId)) {
    return NextResponse.json(
      { error: "Room not found" },
      {
        status: 404,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }

  let lastReadMessageId: mongoose.Types.ObjectId | null = null;
  if (messageIdInput && mongoose.isValidObjectId(messageIdInput)) {
    lastReadMessageId = new mongoose.Types.ObjectId(messageIdInput);
  } else {
    // Default: most recent message in the room.
    const last = await ChatMessage.findOne({ roomId: room._id })
      .sort({ _id: -1 })
      .select("_id")
      .lean();
    lastReadMessageId = last ? last._id : null;
  }

  await ChatRead.findOneAndUpdate(
    { userId, roomId: room._id },
    {
      $set: {
        partnerId,
        userId,
        roomId: room._id,
        lastReadMessageId,
        lastReadAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  return NextResponse.json(
    {
      ok: true,
      lastReadMessageId: lastReadMessageId ? String(lastReadMessageId) : null,
    },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
