import mongoose, { Schema, Types, type Model } from "mongoose";

export type EdgeStyle = "solid" | "dashed";

export type EdgeHandle = "top" | "bottom" | "left" | "right";

export interface IBoardEdge {
  _id: Types.ObjectId;
  partnerId: Types.ObjectId;
  boardId: Types.ObjectId;
  sourceListId: Types.ObjectId;
  targetListId: Types.ObjectId;
  sourceHandle: EdgeHandle;
  targetHandle: EdgeHandle;
  label: string;
  color: string | null;
  style: EdgeStyle;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
}

const BoardEdgeSchema = new Schema<IBoardEdge>(
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
    sourceListId: {
      type: Schema.Types.ObjectId,
      ref: "BoardList",
      required: true,
    },
    targetListId: {
      type: Schema.Types.ObjectId,
      ref: "BoardList",
      required: true,
    },
    sourceHandle: {
      type: String,
      enum: ["top", "bottom", "left", "right"],
      default: "right",
    },
    targetHandle: {
      type: String,
      enum: ["top", "bottom", "left", "right"],
      default: "left",
    },
    label: { type: String, default: "", trim: true },
    color: { type: String, default: null },
    style: {
      type: String,
      enum: ["solid", "dashed"],
      default: "solid",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Quick fetch for "all edges on this board"
BoardEdgeSchema.index({
  partnerId: 1,
  boardId: 1,
  isDeleted: 1,
});
// Per-list lookups (used for cascade deletes)
BoardEdgeSchema.index({ sourceListId: 1, isDeleted: 1 });
BoardEdgeSchema.index({ targetListId: 1, isDeleted: 1 });

export const BoardEdge: Model<IBoardEdge> =
  (mongoose.models.BoardEdge as Model<IBoardEdge>) ||
  mongoose.model<IBoardEdge>("BoardEdge", BoardEdgeSchema);
