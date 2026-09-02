import mongoose, { Schema, Types, type Model } from "mongoose";

export interface IPromptTemplate {
  _id: Types.ObjectId;
  partnerId: Types.ObjectId;
  title: string;
  body: string;
  category: string;
  sortOrder: number;
  isSeeded: boolean; // true for the office's seeded defaults; false for partner-added
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
}

const PromptTemplateSchema = new Schema<IPromptTemplate>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, default: "", trim: false },
    category: { type: String, default: "General", trim: true },
    sortOrder: { type: Number, default: 0 },
    isSeeded: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

PromptTemplateSchema.index({ partnerId: 1, isDeleted: 1, sortOrder: 1 });

export const PromptTemplate: Model<IPromptTemplate> =
  (mongoose.models.PromptTemplate as Model<IPromptTemplate>) ||
  mongoose.model<IPromptTemplate>("PromptTemplate", PromptTemplateSchema);
