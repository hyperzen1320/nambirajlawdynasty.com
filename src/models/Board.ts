import mongoose, { Schema, Types, type Model } from "mongoose";
// The one list of valid colours. It lives beside the swatch styles (which
// client components import) rather than here, because a client bundle must
// never pull mongoose in just to render a picker. The import back the other
// way is type-only, so there is no runtime cycle.
import { BOARD_COLORS } from "@/lib/board-defaults";

export type BoardColor =
  | "forest"
  | "copper"
  | "sea"
  | "terracotta"
  | "ochre"
  | "plum"
  | "ink"
  // Three added for the offices that ran out of distinguishable tiles:
  // a cool grey, a muted olive and a violet — the hues the original
  // seven never covered.
  | "slate"
  | "olive"
  | "indigo";

export interface IBoard {
  _id: Types.ObjectId;
  partnerId: Types.ObjectId;
  title: string;
  description: string;
  color: BoardColor;
  sortOrder: number;
  isSeeded: boolean;
  // Last canvas pan/zoom — persisted so the user picks up where they left off
  viewport: { x: number; y: number; zoom: number };
  // Whether the canvas has been touched at least once. Used to gate the
  // initial auto-layout pass on first open.
  layoutInitialized: boolean;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
}

const BoardSchema = new Schema<IBoard>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    color: {
      type: String,
      enum: BOARD_COLORS,
      default: "copper",
      required: true,
    },
    sortOrder: { type: Number, default: 0 },
    isSeeded: { type: Boolean, default: false },
    viewport: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      zoom: { type: Number, default: 1 },
    },
    layoutInitialized: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

BoardSchema.index({ partnerId: 1, isDeleted: 1, sortOrder: 1, updatedAt: -1 });

export const Board: Model<IBoard> =
  (mongoose.models.Board as Model<IBoard>) ||
  mongoose.model<IBoard>("Board", BoardSchema);
