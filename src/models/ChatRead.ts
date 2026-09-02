import mongoose, { Schema, Types, type Model } from "mongoose";

// Senior Desk — per-user read + presence markers.
//
// One row per (user, room) pairing. It carries two different facts:
//
//   lastReadMessageId  the last message this user has acknowledged. Drives
//                      the unread badge (`count where _id > lastRead`) and,
//                      read across the room's other members, the blue
//                      double tick on a message you sent.
//
//   lastSeenAt         the last time this user actually had the room open.
//                      Bumped by the message list itself (throttled), which
//                      is the only honest signal a polling client can give
//                      that a message reached them — that's the grey double
//                      tick. Without it "delivered" would be a guess.
//
// Group room is the same shape: every user gets one ChatRead row scoped
// to the partner's group room. Created lazily on first read/open.

export interface IChatRead {
  _id: Types.ObjectId;
  partnerId: Types.ObjectId;
  userId: Types.ObjectId;
  roomId: Types.ObjectId;
  lastReadMessageId: Types.ObjectId | null;
  lastReadAt: Date;
  lastSeenAt: Date | null;
}

const ChatReadSchema = new Schema<IChatRead>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
    },
    lastReadMessageId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    lastReadAt: { type: Date, default: () => new Date() },
    // Null on rows written before delivery was tracked — treated as
    // "never seen", which degrades a tick to "sent" rather than lying.
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: false }
);

// One read marker per (user, room). Atomic upsert keys on this.
ChatReadSchema.index({ userId: 1, roomId: 1 }, { unique: true });
// "Unread totals for me across all rooms" — partner-scoped sweep.
ChatReadSchema.index({ partnerId: 1, userId: 1 });

export const ChatRead: Model<IChatRead> =
  (mongoose.models.ChatRead as Model<IChatRead>) ||
  mongoose.model<IChatRead>("ChatRead", ChatReadSchema);
