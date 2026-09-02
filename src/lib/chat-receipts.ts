import mongoose from "mongoose";
import { ChatRead } from "@/models/ChatRead";
import { ChatRoom, type IChatRoom } from "@/models/ChatRoom";
import { User } from "@/models/User";

// WhatsApp-style delivery / read state for messages YOU sent.
//
//   sent       ✓     stored on the server; nobody has opened the room since
//   delivered  ✓✓    at least one other member has had the room open since
//   read       ✓✓    every other member has acknowledged past this message
//                    (rendered in aqua)
//
// Only your own messages carry a receipt — the state of somebody else's
// message is nobody's business but theirs.
//
// The whole page's receipts are computed from ONE ChatRead query. An
// office is a couple of dozen people, so the marker rows for a room fit
// comfortably in memory and each message is then a pair of comparisons —
// no per-message database work, which is what would actually hurt on a
// two-second poll.

export type Receipt = "sent" | "delivered" | "read";

export type ReceiptResolver = {
  /** Members other than the sender who could receive a message here. */
  audience: number;
  receiptFor: (messageId: mongoose.Types.ObjectId, createdAt: Date) => Receipt;
};

/**
 * How many people other than `userId` are in this room.
 *
 * Group rooms have implicit membership — everyone active in the office —
 * so they're counted rather than read off the room document.
 */
async function audienceSize(
  room: Pick<IChatRoom, "_id" | "type" | "members" | "partnerId">,
  userId: mongoose.Types.ObjectId
): Promise<number> {
  if (room.type === "private") {
    return room.members.filter((m) => String(m) !== String(userId)).length;
  }
  const total = await User.countDocuments({
    partnerId: room.partnerId,
    isDeleted: false,
    active: true,
  });
  return Math.max(0, total - 1);
}

export async function buildReceiptResolver(args: {
  room: Pick<IChatRoom, "_id" | "type" | "members" | "partnerId">;
  userId: mongoose.Types.ObjectId;
}): Promise<ReceiptResolver> {
  const { room, userId } = args;

  const [audience, markers] = await Promise.all([
    audienceSize(room, userId),
    ChatRead.find({ roomId: room._id, userId: { $ne: userId } })
      .select("lastReadMessageId lastSeenAt")
      .lean(),
  ]);

  return {
    audience,
    receiptFor(messageId, createdAt) {
      if (audience === 0) return "sent";

      let readCount = 0;
      let delivered = false;
      for (const m of markers) {
        // ObjectIds embed a timestamp and a counter, so ">= this message"
        // is a straight id comparison — no extra lookup to order them.
        if (
          m.lastReadMessageId &&
          String(m.lastReadMessageId) >= String(messageId)
        ) {
          readCount += 1;
          delivered = true;
          continue;
        }
        if (m.lastSeenAt && m.lastSeenAt.getTime() >= createdAt.getTime()) {
          delivered = true;
        }
      }

      if (readCount >= audience) return "read";
      return delivered ? "delivered" : "sent";
    },
  };
}

// A poll every couple of seconds must not mean a write every couple of
// seconds. Thirty seconds of granularity is far finer than a human reads
// a tick, and the conditional update usually matches nothing at all.
const SEEN_THROTTLE_MS = 30_000;

/**
 * Records that `userId` currently has `roomId` open. Fire-and-forget: a
 * failure here costs a tick, never the message list.
 */
export async function touchSeen(
  partnerId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  roomId: mongoose.Types.ObjectId
): Promise<void> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - SEEN_THROTTLE_MS);
  try {
    // One atomic upsert via an update pipeline: create the marker row if
    // this user has opened the room but never marked it read, and move
    // lastSeenAt only when it's actually stale. Doing the throttle inside
    // the write avoids the read-then-write race two open tabs would hit.
    await ChatRead.updateOne(
      { userId, roomId },
      [
        {
          $set: {
            partnerId: { $ifNull: ["$partnerId", partnerId] },
            lastReadMessageId: { $ifNull: ["$lastReadMessageId", null] },
            lastReadAt: { $ifNull: ["$lastReadAt", now] },
            lastSeenAt: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$lastSeenAt", null] },
                    { $lte: ["$lastSeenAt", cutoff] },
                  ],
                },
                now,
                "$lastSeenAt",
              ],
            },
          },
        },
      ],
      { upsert: true }
    );
  } catch {
    // A duplicate-key race (two tabs upserting at once) is harmless — the
    // other tab wrote the row we wanted. A tick is never worth failing the
    // message list over.
  }
}

/** Re-export so callers don't need the model import just for typing. */
export type { IChatRoom };
export { ChatRoom };
