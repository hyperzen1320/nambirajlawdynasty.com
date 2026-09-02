import mongoose, { Schema, Types, type Model } from "mongoose";

export type AccessRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "ignored";

export interface IAccessRequest {
  _id: Types.ObjectId;
  name: string;
  chambers: string;
  email: string;
  phone: string;
  message: string;
  status: AccessRequestStatus;
  source: "mobile" | "web";
  reviewedBy: Types.ObjectId | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AccessRequestSchema = new Schema<IAccessRequest>(
  {
    name: { type: String, required: true, trim: true },
    chambers: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    message: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "ignored"],
      default: "pending",
      required: true,
    },
    source: {
      type: String,
      enum: ["mobile", "web"],
      default: "web",
      required: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

AccessRequestSchema.index({ status: 1, createdAt: -1 });
AccessRequestSchema.index({ email: 1 });

export const AccessRequest: Model<IAccessRequest> =
  (mongoose.models.AccessRequest as Model<IAccessRequest>) ||
  mongoose.model<IAccessRequest>("AccessRequest", AccessRequestSchema);
