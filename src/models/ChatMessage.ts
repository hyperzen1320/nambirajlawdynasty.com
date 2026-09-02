import mongoose, { Schema, Types, type Model } from "mongoose";

// Senior Desk — individual chat messages.
//
// Sender identity is denormalised (senderName, senderRole) so a message
// keeps rendering correctly even after the user is deactivated, removed
// from the office, or has their name/role changed. The live `actorUserId`
// reference is preserved on `senderId` for permission checks (edit/delete).
//
// Two flavours of delete (WhatsApp style):
//   • Delete for everyone — a tombstone: `isDeleted: true` + empty `body`,
//     shown to all as "This message was deleted". Author or admin only.
//   • Delete for me — the user's id is pushed to `deletedFor`; the message
//     list filters those out for that one user, leaving it intact for
//     everyone else.
// Either way the row stays so the message-id chain (reply threads, audit)
// never develops holes.

export type ChatMessageType = "text" | "system";

// A shared file/image attached to a message. The binary lives in GridFS
// (bucket "chat_attachments", see lib/gridfs.ts); this carries what the
// bubble needs to render + a download link without reading the file back.
export interface IChatAttachment {
  gridfsId: Types.ObjectId;
  filename: string;
  contentType: string;
  size: number;
}

export interface IChatMessage {
  _id: Types.ObjectId;
  partnerId: Types.ObjectId;
  roomId: Types.ObjectId;
  senderId: Types.ObjectId | null;
  senderName: string;
  senderRole: string;
  body: string;
  attachments: IChatAttachment[];
  type: ChatMessageType;
  isDeleted: boolean;
  // Users who "deleted for me" — the list endpoint hides the message from
  // each of them; everyone else still sees it.
  deletedFor: Types.ObjectId[];
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ChatAttachmentSchema = new Schema<IChatAttachment>(
  {
    gridfsId: { type: Schema.Types.ObjectId, required: true },
    filename: { type: String, default: "", trim: true },
    contentType: { type: String, default: "application/octet-stream" },
    size: { type: Number, default: 0 },
  },
  { _id: false }
);

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
    },
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    senderName: { type: String, default: "", trim: true },
    senderRole: { type: String, default: "", trim: true },
    // Hard cap at 4000 chars enforced at the API; the schema validator is
    // the last line of defence.
    body: { type: String, default: "", maxlength: 4000 },
    attachments: { type: [ChatAttachmentSchema], default: [] },
    type: {
      type: String,
      enum: ["text", "system"],
      default: "text",
    },
    isDeleted: { type: Boolean, default: false },
    deletedFor: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Paginate a single room's history — newest first, with a `before` cursor
// (`createdAt` desc OR `_id` desc both work because ObjectIds embed time).
ChatMessageSchema.index({ roomId: 1, createdAt: -1 });
// Audit query: "all chat messages this user sent in the last 30 days".
ChatMessageSchema.index({ partnerId: 1, senderId: 1, createdAt: -1 });

export const ChatMessage: Model<IChatMessage> =
  (mongoose.models.ChatMessage as Model<IChatMessage>) ||
  mongoose.model<IChatMessage>("ChatMessage", ChatMessageSchema);
