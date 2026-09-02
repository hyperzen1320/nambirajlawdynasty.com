import mongoose, { Schema, Types, type Model } from "mongoose";

// A support request raised from the mobile app (More → Support). The office
// user fills a short form; it lands here and surfaces in the Global-Admin
// Support inbox. Email delivery (Gmail API) is wired separately — this ticket
// is the source of truth either way. Attachments (photos / videos) live in
// GridFS and are referenced here.
export type SupportStatus = "open" | "in_progress" | "resolved" | "closed";
export const SUPPORT_STATUSES: SupportStatus[] = [
  "open",
  "in_progress",
  "resolved",
  "closed",
];

export interface ISupportAttachment {
  gridfsId: Types.ObjectId;
  filename: string;
  contentType: string;
  size: number;
}

export interface ISupportTicket {
  _id: Types.ObjectId;
  // The office the reporter belongs to (null only for an unlinked reporter).
  partnerId: Types.ObjectId | null;
  partnerName: string; // denormalised for the admin list
  userId: Types.ObjectId | null;
  reporterName: string;
  reporterEmail: string;
  reporterPhone: string;
  subject: string;
  category: string;
  message: string;
  attachments: ISupportAttachment[];
  status: SupportStatus;
  adminNote: string; // internal note by the global admin
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AttachmentSchema = new Schema<ISupportAttachment>(
  {
    gridfsId: { type: Schema.Types.ObjectId, required: true },
    filename: { type: String, default: "" },
    contentType: { type: String, default: "application/octet-stream" },
    size: { type: Number, default: 0 },
  },
  { _id: false }
);

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: "Partner", default: null },
    partnerName: { type: String, default: "", trim: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reporterName: { type: String, default: "", trim: true },
    reporterEmail: { type: String, default: "", trim: true },
    reporterPhone: { type: String, default: "", trim: true },
    subject: { type: String, default: "", trim: true },
    category: { type: String, default: "Other", trim: true },
    message: { type: String, required: true, trim: true },
    attachments: { type: [AttachmentSchema], default: [] },
    status: {
      type: String,
      enum: SUPPORT_STATUSES,
      default: "open",
    },
    adminNote: { type: String, default: "", trim: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Admin inbox: newest first, filterable by status.
SupportTicketSchema.index({ isDeleted: 1, status: 1, createdAt: -1 });
SupportTicketSchema.index({ partnerId: 1, createdAt: -1 });

export const SupportTicket: Model<ISupportTicket> =
  (mongoose.models.SupportTicket as Model<ISupportTicket>) ||
  mongoose.model<ISupportTicket>("SupportTicket", SupportTicketSchema);
