import mongoose, { Schema, Types, type Model } from "mongoose";

// Metadata record for a global-admin tutorial (video / image / PDF). The
// binary itself lives in GridFS (bucket "tutorial_media"); this row carries
// everything the admin manager and the mobile list/player need without
// reading the file back.
export interface ITutorialMedia {
  _id: Types.ObjectId;
  title: string;
  description: string;
  kind: "video" | "image" | "pdf";
  // The GridFS files._id for the stored binary.
  gridfsId: Types.ObjectId;
  filename: string;
  contentType: string;
  size: number;
  // Manual sort position (ascending). Lower shows first.
  order: number;
  isActive: boolean;
  uploadedByName: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TutorialMediaSchema = new Schema<ITutorialMedia>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    kind: {
      type: String,
      enum: ["video", "image", "pdf"],
      required: true,
    },
    gridfsId: { type: Schema.Types.ObjectId, required: true },
    filename: { type: String, default: "" },
    contentType: { type: String, default: "application/octet-stream" },
    size: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    uploadedByName: { type: String, default: "" },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// "Active tutorials in display order" — the mobile list's only query, and the
// admin list reads the same order (isDeleted-scoped).
TutorialMediaSchema.index({
  isDeleted: 1,
  isActive: 1,
  order: 1,
  createdAt: -1,
});

export const TutorialMedia: Model<ITutorialMedia> =
  (mongoose.models.TutorialMedia as Model<ITutorialMedia>) ||
  mongoose.model<ITutorialMedia>("TutorialMedia", TutorialMediaSchema);
