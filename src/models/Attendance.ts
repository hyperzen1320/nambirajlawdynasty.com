import mongoose, { Schema, Types, type Model } from "mongoose";

// Per-user-per-day attendance ledger. One document per (partner, user,
// day) — absence of a document for a given day means "not marked".
// That's deliberate: storing a "not marked" row would force us to
// pre-seed every user × every day, and the daily grid on the page can
// derive that state cheaply from the absent rows.
//
// `date` is the IST midnight instant for the day being marked. The API
// + UI normalise to this so two timezones don't accidentally mark the
// same calendar day twice.

export type AttendanceStatus =
  | "present"
  | "absent"
  | "half_day"
  | "leave"
  | "holiday";

export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "present",
  "absent",
  "half_day",
  "leave",
  "holiday",
];

export interface IAttendance {
  _id: Types.ObjectId;
  partnerId: Types.ObjectId;
  userId: Types.ObjectId;
  date: Date;
  status: AttendanceStatus;
  note: string;
  markedByUserId: Types.ObjectId | null;
  markedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: ATTENDANCE_STATUSES,
      required: true,
    },
    note: { type: String, default: "", trim: true, maxlength: 500 },
    markedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    markedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

// One record per user per day — the atomic upsert key. Without this
// the POST handler could create duplicates under concurrent writes
// from two browser tabs.
AttendanceSchema.index(
  { partnerId: 1, userId: 1, date: 1 },
  { unique: true }
);
// "Everyone's attendance on day X" — drives the office-wide grid view.
AttendanceSchema.index({ partnerId: 1, date: 1 });
// "This user's most recent attendance" — for the user-detail surface.
AttendanceSchema.index({ partnerId: 1, userId: 1, date: -1 });

export const Attendance: Model<IAttendance> =
  (mongoose.models.Attendance as Model<IAttendance>) ||
  mongoose.model<IAttendance>("Attendance", AttendanceSchema);
