import mongoose, { Schema, Types, type Model } from "mongoose";

// Metadata record for a file attached to a case. The binary itself lives
// in GridFS (bucket "case_documents"); this row carries everything the UI
// and the delete-request system need without reading the file back.
export interface ICaseDocument {
  _id: Types.ObjectId;
  partnerId: Types.ObjectId;
  caseId: Types.ObjectId;
  // The GridFS files._id for the stored binary.
  gridfsId: Types.ObjectId;
  filename: string;
  contentType: string;
  size: number;
  uploadedByUserId: Types.ObjectId | null;
  uploadedByName: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CaseDocumentSchema = new Schema<ICaseDocument>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
    },
    caseId: {
      type: Schema.Types.ObjectId,
      ref: "Case",
      required: true,
    },
    gridfsId: { type: Schema.Types.ObjectId, required: true },
    filename: { type: String, required: true, trim: true },
    contentType: { type: String, default: "application/octet-stream" },
    size: { type: Number, default: 0 },
    uploadedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    uploadedByName: { type: String, default: "" },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// "Documents for this case, newest first" — the panel's only query.
CaseDocumentSchema.index({
  partnerId: 1,
  caseId: 1,
  isDeleted: 1,
  createdAt: -1,
});

export const CaseDocument: Model<ICaseDocument> =
  (mongoose.models.CaseDocument as Model<ICaseDocument>) ||
  mongoose.model<ICaseDocument>("CaseDocument", CaseDocumentSchema);
