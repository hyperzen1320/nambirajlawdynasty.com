import mongoose, { Schema, Types, type Model } from "mongoose";

export interface IClient {
  _id: Types.ObjectId;
  partnerId: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  notes: string;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
}

const ClientSchema = new Schema<IClient>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    phone: { type: String, default: "", trim: true },
    whatsapp: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    notes: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ClientSchema.index({ partnerId: 1, isDeleted: 1, name: 1 });

export const Client: Model<IClient> =
  (mongoose.models.Client as Model<IClient>) ||
  mongoose.model<IClient>("Client", ClientSchema);
