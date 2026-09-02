import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { User } from "@/models/User";
import { getOrCreatePrivateRoom } from "@/lib/chat-rooms";

// POST /api/app/chat/private   { withUserId: string }
//
// Atomically gets-or-creates the private chat room between the calling
// user and `withUserId`. Both users must belong to the same partner.
// Returns the room object so the client can navigate straight to it.
//
// Self-chat is rejected. Inactive / removed users are rejected up-front
// to keep stale entries out of the rail. The room itself is brand-new
// the first time, so we emit a chat.private_started activity (visible
// only to the two parties via metadata, but not filtered server-side
// since the activity feed already scopes by partner).

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

export async function POST(request: Request) {
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

  const withUserId =
    typeof body.withUserId === "string" ? body.withUserId : "";
  if (!withUserId || !mongoose.isValidObjectId(withUserId)) {
    return NextResponse.json(
      { error: "Pick a teammate to chat with." },
      {
        status: 400,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }
  if (withUserId === guard.ctx.user.id) {
    return NextResponse.json(
      { error: "You can't start a chat with yourself." },
      {
        status: 400,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);
  const userId = new mongoose.Types.ObjectId(guard.ctx.user.id);
  const otherId = new mongoose.Types.ObjectId(withUserId);

  // Same-tenant check + active check on the other user.
  const other = await User.findOne({
    _id: otherId,
    partnerId,
    isDeleted: false,
  })
    .select("firstName lastName email role active")
    .lean();
  if (!other) {
    return NextResponse.json(
      { error: "That teammate isn't in your office." },
      {
        status: 404,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }
  if (other.active === false) {
    return NextResponse.json(
      { error: "That teammate's account is deactivated." },
      {
        status: 400,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }

  // Atomic upsert keyed on the sorted pair — guaranteed single room per pair.
  const room = await getOrCreatePrivateRoom(partnerId, userId, otherId);
  const created = !room.lastMessageAt && !room.updatedAt
    ? true
    : Math.abs(Date.now() - new Date(room.createdAt).getTime()) < 1500;

  return NextResponse.json(
    {
      ok: true,
      room: {
        id: String(room._id),
        type: "private" as const,
        title:
          `${other.firstName} ${other.lastName}`.trim() || other.email,
        otherUser: {
          id: String(other._id),
          name:
            `${other.firstName} ${other.lastName}`.trim() || other.email,
          role: other.role || "junior",
          // Already proven `true` by the early-return guard above.
          active: true,
        },
        lastMessageAt: room.lastMessageAt
          ? room.lastMessageAt.toISOString()
          : null,
        lastMessagePreview: room.lastMessagePreview,
        lastMessageAuthorId: room.lastMessageAuthorId
          ? String(room.lastMessageAuthorId)
          : null,
      },
      created,
    },
    {
      status: created ? 201 : 200,
      headers: guard.ctx.isMobile ? corsHeaders() : undefined,
    }
  );
}
