import mongoose, { Schema, Types, type Model } from "mongoose";

// Tracks who is currently looking at which board. The client beats every
// 15s while focused; the server upserts and reads everyone whose
// `lastBeat` is within 30s.
//
// We rely on a TTL index to expire stale entries automatically so we don't
// have to clean up on disconnect (browsers don't reliably send a "leave"
// signal anyway). `lastBeat` is updated in place; the TTL evaluates from
// that field and removes the doc 60s after the last beat.

export interface IBoardPresence {
  _id: Types.ObjectId;
  partnerId: Types.ObjectId;
  boardId: Types.ObjectId;
  userId: Types.ObjectId;
  userName: string;
  role: string;
  designation: string;
  lastBeat: Date;
}

const BoardPresenceSchema = new Schema<IBoardPresence>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
    },
    boardId: {
      type: Schema.Types.ObjectId,
      ref: "Board",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userName: { type: String, default: "", trim: true },
    role: { type: String, default: "junior", trim: true },
    designation: { type: String, default: "", trim: true },
    lastBeat: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true }
);

// One presence row per (board, user). Upserts collapse duplicates.
BoardPresenceSchema.index({ boardId: 1, userId: 1 }, { unique: true });
// Fast "who is on this board right now" lookup.
BoardPresenceSchema.index({ partnerId: 1, boardId: 1, lastBeat: -1 });
// TTL: drop the doc 60s after the last heartbeat. Client beats every 15s,
// so a comfortable margin avoids flicker if a beat is briefly delayed.
BoardPresenceSchema.index({ lastBeat: 1 }, { expireAfterSeconds: 60 });

export const BoardPresence: Model<IBoardPresence> =
  (mongoose.models.BoardPresence as Model<IBoardPresence>) ||
  mongoose.model<IBoardPresence>("BoardPresence", BoardPresenceSchema);
