import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { ChatRoom } from "@/models/ChatRoom";
import { ChatMessage } from "@/models/ChatMessage";
import {
  userCanReadRoom,
  previewFromBody,
  recipientsOf,
} from "@/lib/chat-rooms";
import { sendPush } from "@/lib/push";
import {
  buildReceiptResolver,
  touchSeen,
  type Receipt,
} from "@/lib/chat-receipts";

// GET  /api/app/chat/rooms/[id]/messages?before=<msgId>&limit=50
// POST /api/app/chat/rooms/[id]/messages   { body: string }
//
// GET returns up to `limit` messages BEFORE the cursor (or the newest
// `limit` if no cursor), oldest-first so the UI can render a normal
// top-to-bottom thread without reversing.
//
// POST writes a message and bumps the room's denormalised last-message
// fields.

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;
const MAX_BODY = 4000;

type AttachmentDTO = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
};

type MessageDTO = {
  id: string;
  roomId: string;
  senderId: string | null;
  senderName: string;
  senderRole: string;
  body: string;
  attachments: AttachmentDTO[];
  type: "text" | "system";
  isDeleted: boolean;
  editedAt: string | null;
  createdAt: string;
  isMine: boolean;
  // Delivery/read state — only ever set on your OWN messages. Somebody
  // else's tick is nobody's business but theirs.
  receipt: Receipt | null;
};

// Normalise the attachment refs the composer sends (it has already uploaded
// the bytes to /api/app/chat/attachments and holds the returned metadata).
function normalizeAttachments(raw: unknown): Array<{
  gridfsId: mongoose.Types.ObjectId;
  filename: string;
  contentType: string;
  size: number;
}> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{
    gridfsId: mongoose.Types.ObjectId;
    filename: string;
    contentType: string;
    size: number;
  }> = [];
  for (const a of raw) {
    if (!a || typeof a !== "object") continue;
    const o = a as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    if (!mongoose.isValidObjectId(id)) continue;
    out.push({
      gridfsId: new mongoose.Types.ObjectId(id),
      filename: typeof o.filename === "string" ? o.filename : "attachment",
      contentType:
        typeof o.contentType === "string" ? o.contentType : "application/octet-stream",
      size: typeof o.size === "number" ? o.size : 0,
    });
    if (out.length >= 6) break;
  }
  return out;
}

async function loadRoom(
  id: string,
  partnerId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
) {
  if (!mongoose.isValidObjectId(id)) return null;
  const room = await ChatRoom.findOne({
    _id: new mongoose.Types.ObjectId(id),
    partnerId,
    isDeleted: false,
  }).lean();
  if (!room) return null;
  if (!userCanReadRoom(room, partnerId, userId)) return null;
  return room;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);
  const userId = new mongoose.Types.ObjectId(guard.ctx.user.id);
  const headers = guard.ctx.isMobile ? corsHeaders() : undefined;

  const room = await loadRoom(id, partnerId, userId);
  if (!room) {
    return NextResponse.json(
      { error: "Room not found" },
      { status: 404, headers }
    );
  }

  const url = new URL(request.url);
  const before = url.searchParams.get("before");
  const limitParam = Number(url.searchParams.get("limit") ?? "");
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(limitParam, MAX_LIMIT)
      : DEFAULT_LIMIT;

  const filter: Record<string, unknown> = {
    roomId: room._id,
    // Hide anything this user has "deleted for me" — gone from their thread,
    // untouched for everyone else.
    deletedFor: { $ne: userId },
  };
  if (before && mongoose.isValidObjectId(before)) {
    filter._id = { $lt: new mongoose.Types.ObjectId(before) };
  }

  // Newest-first then reverse — gives "the last N before cursor" without
  // a skip(), which would be O(N) and miserable on long threads.
  const docs = await ChatMessage.find(filter)
    .sort({ _id: -1 })
    .limit(limit)
    .lean();
  docs.reverse();

  // Asking for this room's messages IS the honest signal that the room is
  // open, so it's what marks messages delivered for everyone else. Fire and
  // forget — the write is throttled server-side and a failed tick must
  // never cost the caller their messages.
  void touchSeen(partnerId, userId, room._id);

  // One marker query for the whole page; each message is then a couple of
  // comparisons rather than a round-trip.
  const receipts = await buildReceiptResolver({ room, userId });

  const messages: MessageDTO[] = docs.map((m) => ({
    id: String(m._id),
    roomId: String(m.roomId),
    senderId: m.senderId ? String(m.senderId) : null,
    senderName: m.senderName,
    senderRole: m.senderRole,
    body: m.isDeleted ? "" : m.body,
    attachments: m.isDeleted
      ? []
      : (m.attachments || []).map((a) => ({
          id: String(a.gridfsId),
          filename: a.filename,
          contentType: a.contentType,
          size: a.size,
        })),
    type: m.type,
    isDeleted: m.isDeleted,
    editedAt: m.editedAt ? m.editedAt.toISOString() : null,
    createdAt: m.createdAt.toISOString(),
    isMine: m.senderId ? String(m.senderId) === guard.ctx.user.id : false,
    receipt:
      m.senderId && String(m.senderId) === guard.ctx.user.id && !m.isDeleted
        ? receipts.receiptFor(m._id, m.createdAt)
        : null,
  }));

  return NextResponse.json(
    {
      messages,
      hasMore: docs.length === limit,
      room: {
        id: String(room._id),
        type: room.type,
        title: room.title,
      },
    },
    { headers }
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  // Viewers in the office still get to chat — communication isn't a
  // privileged operation. The only role-gated thing is admin moderation
  // (delete someone else's message), which lives in the message PATCH/DELETE.

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
  const attachments = normalizeAttachments(body.attachments);
  // A message must carry text OR at least one attachment.
  if (!trimmed && attachments.length === 0) {
    return NextResponse.json(
      { error: "Type a message or attach a file." },
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

  const room = await loadRoom(id, partnerId, userId);
  if (!room) {
    return NextResponse.json(
      { error: "Room not found" },
      {
        status: 404,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }

  const senderName =
    `${guard.ctx.user.firstName} ${guard.ctx.user.lastName}`.trim() ||
    guard.ctx.user.email;
  // Attachment-only messages still need a room preview line.
  const attachmentPreview =
    attachments.length === 1
      ? `📎 ${attachments[0].filename}`
      : `📎 ${attachments.length} files`;
  const preview = trimmed ? previewFromBody(trimmed) : attachmentPreview;

  const msg = await ChatMessage.create({
    partnerId,
    roomId: room._id,
    senderId: userId,
    senderName,
    senderRole: guard.ctx.user.role,
    body: trimmed,
    attachments,
    type: "text",
    isDeleted: false,
    editedAt: null,
  });

  // Bump the room's last-message fields atomically. We don't conditionally
  // check whether this message is "newer" than the existing lastMessageAt —
  // a write committed now is always newer than what was committed before.
  await ChatRoom.updateOne(
    { _id: room._id },
    {
      $set: {
        lastMessageAt: msg.createdAt,
        lastMessagePreview: preview,
        lastMessageAuthorId: userId,
      },
    }
  );

  // Announce it to everyone else's phone. Not awaited: the message is
  // already saved, and a slow push service must not hold the sender's
  // keyboard. Failures inside sendPush are swallowed by design.
  void (async () => {
    const to = await recipientsOf(room, partnerId, userId);
    await sendPush(String(partnerId), to, {
      // Group rooms are the office desk; a private thread is the person.
      title:
        room.type === "group"
          ? `${senderName} · ${room.title || "Senior Desk"}`
          : senderName,
      body: preview,
      data: { kind: "chat", roomId: String(room._id) },
    });
  })();

  return NextResponse.json(
    {
      ok: true,
      message: {
        id: String(msg._id),
        roomId: String(msg.roomId),
        senderId: String(userId),
        senderName,
        senderRole: guard.ctx.user.role,
        body: trimmed,
        attachments: attachments.map((a) => ({
          id: String(a.gridfsId),
          filename: a.filename,
          contentType: a.contentType,
          size: a.size,
        })),
        type: "text" as const,
        isDeleted: false,
        editedAt: null,
        createdAt: msg.createdAt.toISOString(),
        isMine: true,
        receipt: "sent" as const,
      },
    },
    {
      status: 201,
      headers: guard.ctx.isMobile ? corsHeaders() : undefined,
    }
  );
}
