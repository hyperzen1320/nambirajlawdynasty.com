import mongoose, { Schema, Types, type Model } from "mongoose";

export type DeleteRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "obsolete";

export type DeleteRequestTargetType =
  | "list"
  | "task"
  | "board"
  | "client"
  | "court"
  | "case"
  | "case_document"
  | "user"
  | "prompt";

export interface IDeleteRequest {
  _id: Types.ObjectId;
  partnerId: Types.ObjectId;
  requesterUserId: Types.ObjectId;
  requesterName: string;
  requesterEmail: string;
  targetType: DeleteRequestTargetType;
  targetId: Types.ObjectId;
  targetName: string;
  // Optional board context — for workflow-targets it's the board; null for
  // out-of-workflow targets (a client, case, etc.)
  boardId: Types.ObjectId | null;
  reason: string;
  status: DeleteRequestStatus;
  reviewedByUserId: Types.ObjectId | null;
  reviewedByName: string;
  reviewedAt: Date | null;
  reviewerNote: string;
  createdAt: Date;
  updatedAt: Date;
}

const DeleteRequestSchema = new Schema<IDeleteRequest>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
    },
    requesterUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    requesterName: { type: String, required: true, trim: true },
    requesterEmail: { type: String, required: true, lowercase: true, trim: true },
    targetType: {
      type: String,
      enum: [
        "list",
        "task",
        "board",
        "client",
        "court",
        "case",
        "case_document",
        "user",
        "prompt",
      ],
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    targetName: { type: String, default: "", trim: true },
    boardId: {
      type: Schema.Types.ObjectId,
      ref: "Board",
      default: null,
    },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "obsolete"],
      default: "pending",
      required: true,
    },
    reviewedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedByName: { type: String, default: "" },
    reviewedAt: { type: Date, default: null },
    reviewerNote: { type: String, default: "" },
  },
  { timestamps: true }
);

// Pending-requests inbox for admin
DeleteRequestSchema.index({
  partnerId: 1,
  status: 1,
  createdAt: -1,
});
// "My submitted requests" view
DeleteRequestSchema.index({
  partnerId: 1,
  requesterUserId: 1,
  createdAt: -1,
});
// Per-board pending count for canvas badge
DeleteRequestSchema.index({
  partnerId: 1,
  boardId: 1,
  status: 1,
});
// Auto-mark-obsolete lookup when a target is direct-deleted
DeleteRequestSchema.index({
  partnerId: 1,
  targetType: 1,
  targetId: 1,
  status: 1,
});

export const DeleteRequest: Model<IDeleteRequest> =
  (mongoose.models.DeleteRequest as Model<IDeleteRequest>) ||
  mongoose.model<IDeleteRequest>("DeleteRequest", DeleteRequestSchema);
