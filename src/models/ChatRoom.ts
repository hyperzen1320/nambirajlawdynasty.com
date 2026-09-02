import mongoose, { Schema, Types, type Model } from "mongoose";

// Senior Desk — chat rooms.
//
// Two flavours live in the same collection:
//   • type: "group"   → exactly one per partner. Membership is implicit
//                       (every active user in the office is a member);
//                       `members` stays empty and `pairKey` is null.
//   • type: "private" → one per pair of users in the same partner.
//                       `members` is the two ObjectIds, `pairKey` is the
//                       sorted "smaller:larger" string used to enforce
//                       atomic get-or-create via a unique index.
//
// We never "delete" a room — `isDeleted` is reserved for admin moderation
// (e.g. wiping a private thread between two ex-employees). Day-to-day,
// rooms live forever; messages inside them get soft-deleted instead.

export type ChatRoomType = "group" | "private";

export interface IChatRoom {
  _id: Types.ObjectId;
  partnerId: Types.ObjectId;
  type: ChatRoomType;
  title: string;
  members: Types.ObjectId[];
  // Sorted pair key for private rooms ("idA:idB" with idA < idB
  // lexicographically). null for group rooms — combined with the unique
  // sparse index this guarantees only one private room ever exists per pair.
  pairKey: string | null;
  // Denormalised "last message" so the room rail can render a preview row
  // without a per-room secondary query. Kept in sync by the message POST
  // handler.
  lastMessageAt: Date | null;
  lastMessagePreview: string;
  lastMessageAuthorId: Types.ObjectId | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ChatRoomSchema = new Schema<IChatRoom>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
    },
    type: {
      type: String,
      enum: ["group", "private"],
      required: true,
    },
    title: { type: String, default: "", trim: true },
    members: [{ type: Schema.Types.ObjectId, ref: "User" }],
    pairKey: { type: String, default: null },
    lastMessageAt: { type: Date, default: null },
    lastMessagePreview: { type: String, default: "", trim: true },
    lastMessageAuthorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Room rail query: list private rooms for a user, sorted by recency.
ChatRoomSchema.index({ partnerId: 1, type: 1, lastMessageAt: -1 });
// Atomic get-or-create for a pair. Sparse so the null pairKey on the
// group room doesn't collide.
ChatRoomSchema.index(
  { partnerId: 1, pairKey: 1 },
  { unique: true, sparse: true }
);
// "Find the group room for this partner" — single doc per partner.
ChatRoomSchema.index(
  { partnerId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "group" },
  }
);
// "Which private rooms does user X belong to?" — used by the rail when we
// want to scope to the calling user.
ChatRoomSchema.index({ partnerId: 1, members: 1, lastMessageAt: -1 });

export const ChatRoom: Model<IChatRoom> =
  (mongoose.models.ChatRoom as Model<IChatRoom>) ||
  mongoose.model<IChatRoom>("ChatRoom", ChatRoomSchema);
