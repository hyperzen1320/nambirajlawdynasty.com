import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { ChatMessage } from "@/models/ChatMessage";
import { ChatRoom } from "@/models/ChatRoom";
import { previewFromBody, userCanReadRoom } from "@/lib/chat-rooms";

// PATCH  /api/app/chat/messages/[id]    { body: string }
// DELETE /api/app/chat/messages/[id]
//
// Edit window: 5 minutes after creation, author-only. Soft delete: the
// message author OR the partner admin can wipe a message; the row stays
// (so reply chains and audit don't break) but `body` reads as empty
// and `isDeleted` flips true.

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

const EDIT_WINDOW_MS = 5 * 60_000;
const MAX_BODY = 4000;

async function loadMessage(
  id: string,
  partnerId: mongoose.Types.ObjectId
) {
  if (!mongoose.isValidObjectId(id)) return null;
  return ChatMessage.findOne({
    _id: new mongoose.Types.ObjectId(id),
    partnerId,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json(
      { error: "Invalid body" },
      {
        status: 400,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }
  const text = typeof body.body === "string" ? body.body : "";
  const trimmed = text.trim();
  if (!trimmed) {
    return NextResponse.json(
      { error: "Message body is required." },
      {
        status: 400,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }
  if (trimmed.length > MAX_BODY) {
    return NextResponse.json(
      { error: `Messages can be at most ${MAX_BODY} characters.` },
      {
        status: 400,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);
  const userId = new mongoose.Types.ObjectId(guard.ctx.user.id);

  const msg = await loadMessage(id, partnerId);
  if (!msg) {
    return NextResponse.json(
      { error: "Message not found" },
      {
        status: 404,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }
  // Membership check — even if you have the id, you can't edit a message
  // in a room you can't read. Belt-and-braces against id-guessing.
  const room = await ChatRoom.findOne({ _id: msg.roomId, partnerId }).lean();
  if (!room || !userCanReadRoom(room, partnerId, userId)) {
    return NextResponse.json(
      { error: "Message not found" },
      {
        status: 404,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }
  if (!msg.senderId || String(msg.senderId) !== guard.ctx.user.id) {
    return NextResponse.json(
      { error: "You can only edit your own messages." },
      {
        status: 403,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }
  if (msg.isDeleted) {
    return NextResponse.json(
      { error: "This message has been deleted." },
      {
        status: 400,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }
  const ageMs = Date.now() - new Date(msg.createdAt).getTime();
  if (ageMs > EDIT_WINDOW_MS) {
    return NextResponse.json(
      { error: "Edits are only allowed within 5 minutes of sending." },
      {
        status: 400,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }

  msg.body = trimmed;
  msg.editedAt = new Date();
  await msg.save();

  // If this was the most recent message in the room, refresh the preview.
  if (
    room.lastMessageAuthorId &&
    String(room.lastMessageAuthorId) === guard.ctx.user.id &&
    room.lastMessageAt &&
    new Date(room.lastMessageAt).getTime() ===
      new Date(msg.createdAt).getTime()
  ) {
    await ChatRoom.updateOne(
      { _id: msg.roomId },
      { $set: { lastMessagePreview: previewFromBody(trimmed) } }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: {
        id: String(msg._id),
        body: msg.body,
        editedAt: msg.editedAt ? msg.editedAt.toISOString() : null,
      },
    },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);
  const userId = new mongoose.Types.ObjectId(guard.ctx.user.id);

  const msg = await loadMessage(id, partnerId);
  if (!msg) {
    return NextResponse.json(
      { error: "Message not found" },
      {
        status: 404,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }
  const room = await ChatRoom.findOne({ _id: msg.roomId, partnerId }).lean();
  if (!room || !userCanReadRoom(room, partnerId, userId)) {
    return NextResponse.json(
      { error: "Message not found" },
      {
        status: 404,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }

  // ?scope=me deletes the message for just this user (WhatsApp "Delete for
  // me"); anything else is the "Delete for everyone" tombstone. Default
  // stays "everyone" so older clients keep their prior behaviour.
  const scope =
    new URL(request.url).searchParams.get("scope") === "me"
      ? "me"
      : "everyone";

  if (scope === "me") {
    // Anyone who can read the room may hide a message from their own thread;
    // the message itself is untouched for everyone else.
    await ChatMessage.updateOne(
      { _id: msg._id },
      { $addToSet: { deletedFor: userId } }
    );
    return NextResponse.json(
      { ok: true, scope: "me" },
      { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  // "Delete for everyone" — the author, or the office admin (moderation).
  const isAuthor =
    msg.senderId && String(msg.senderId) === guard.ctx.user.id;
  const isAdmin = guard.ctx.user.userType === "partner_admin";
  if (!isAuthor && !isAdmin) {
    return NextResponse.json(
      { error: "You can only delete your own messages for everyone." },
      {
        status: 403,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }
  // A message carrying a FILE is office property once it's been shared —
  // removing it takes a paper out of everyone's hands, so only the admin
  // may. Plain text stays author-deletable, which is what people expect
  // from a chat. ("Delete for me" above is unaffected: hiding a file from
  // your own thread takes nothing away from anyone else.)
  if (!isAdmin && (msg.attachments?.length ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "Shared files can only be removed by the office admin. You can still delete this message for yourself.",
        code: "admin_only_attachment",
      },
      {
        status: 403,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }
  if (msg.isDeleted) {
    return NextResponse.json(
      { ok: true, alreadyDeleted: true },
      { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  msg.isDeleted = true;
  msg.body = "";
  await msg.save();

  // If we just deleted the room's preview message, recompute it from the
  // newest non-deleted message in the room. Cheap (indexed) and keeps the
  // rail honest after a delete.
  if (
    room.lastMessageAuthorId &&
    room.lastMessageAt &&
    new Date(room.lastMessageAt).getTime() ===
      new Date(msg.createdAt).getTime()
  ) {
    const newest = await ChatMessage.findOne({
      roomId: msg.roomId,
      isDeleted: false,
    })
      .sort({ _id: -1 })
      .select("_id senderId createdAt body")
      .lean();
    await ChatRoom.updateOne(
      { _id: msg.roomId },
      {
        $set: {
          lastMessageAt: newest ? newest.createdAt : null,
          lastMessagePreview: newest ? previewFromBody(newest.body) : "",
          lastMessageAuthorId: newest ? newest.senderId : null,
        },
      }
    );
  }

  return NextResponse.json(
    { ok: true },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
