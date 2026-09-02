import mongoose, { Schema, Types, type Model } from "mongoose";

// Senior Desk — reminders. Lifted straight from the original requirements
// doc ("personal reminders + assignable nudges"). Two access modes via
// `assignedToUserId`:
//
//   • assignedToUserId === createdByUserId  → personal reminder (default
//                                              for "+ New" with no assignee)
//   • assignedToUserId !== createdByUserId  → delegated nudge — visible
//                                              to both parties, marked
//                                              done by the assignee
//
// `status` flips to "done" when checked off; the row is never hard-deleted
// from a "completed" action — only the explicit Delete button removes it.

export type ReminderPriority = "low" | "normal" | "high";
export type ReminderStatus = "pending" | "done";

export interface IReminder {
  _id: Types.ObjectId;
  partnerId: Types.ObjectId;
  title: string;
  description: string;
  // null means "no due date set" — appears in My Reminders without a date
  // pill. Sorting puts undated reminders after dated ones.
  dueDate: Date | null;
  priority: ReminderPriority;
  // Both ids are denormalised with cached display names so the card
  // doesn't need a User lookup per render.
  assignedToUserId: Types.ObjectId;
  assignedToName: string;
  createdByUserId: Types.ObjectId;
  createdByName: string;
  status: ReminderStatus;
  // Stamped when status transitions pending → done. Cleared on un-check.
  completedAt: Date | null;
  completedByUserId: Types.ObjectId | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReminderSchema = new Schema<IReminder>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 240 },
    description: { type: String, default: "", maxlength: 4000 },
    dueDate: { type: Date, default: null },
    priority: {
      type: String,
      enum: ["low", "normal", "high"],
      default: "normal",
    },
    assignedToUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedToName: { type: String, default: "", trim: true },
    createdByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdByName: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["pending", "done"],
      default: "pending",
    },
    completedAt: { type: Date, default: null },
    completedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// "My reminders" tab — active items assigned to me, soonest first.
ReminderSchema.index({
  partnerId: 1,
  assignedToUserId: 1,
  status: 1,
  dueDate: 1,
});
// "Office" tab (admin) — every active reminder, recently created first.
ReminderSchema.index({ partnerId: 1, status: 1, createdAt: -1 });
// Due-today / overdue sweep for the dashboard widget.
ReminderSchema.index({ partnerId: 1, status: 1, dueDate: 1 });

export const Reminder: Model<IReminder> =
  (mongoose.models.Reminder as Model<IReminder>) ||
  mongoose.model<IReminder>("Reminder", ReminderSchema);
