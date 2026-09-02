import mongoose, { Schema, Types, type Model } from "mongoose";

export interface ICourt {
  _id: Types.ObjectId;
  partnerId: Types.ObjectId;
  name: string;
  number: string; // hall / court number — e.g. "Hall 3", "Court 12"
  place: string;
  sortOrder: number;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
}

const CourtSchema = new Schema<ICourt>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    number: { type: String, default: "", trim: true },
    place: { type: String, default: "", trim: true },
    sortOrder: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

CourtSchema.index({ partnerId: 1, isDeleted: 1, name: 1 });
CourtSchema.index({ partnerId: 1, isDeleted: 1, sortOrder: 1, createdAt: -1 });

export const Court: Model<ICourt> =
  (mongoose.models.Court as Model<ICourt>) ||
  mongoose.model<ICourt>("Court", CourtSchema);
