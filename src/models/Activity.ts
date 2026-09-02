import mongoose, { Schema, Types, type Model } from "mongoose";

// Global admin / system actions (existing)
export type AdminActivityAction =
  | "partner_created"
  | "partner_updated"
  | "partner_password_reset"
  | "partner_suspended"
  | "partner_unsuspended"
  | "partner_plan_changed"
  | "partner_trial_extended"
  | "partner_deleted"
  | "user_login"
  | "system";

// Partner-side workflow actions (new)
export type WorkflowActivityAction =
  | "board.created"
  | "board.renamed"
  | "board.recolored"
  | "board.deleted"
  | "list.created"
  | "list.renamed"
  | "list.updated"
  | "list.reordered"
  | "list.deleted"
  | "task.created"
  | "task.renamed"
  | "task.described"
  | "task.assigned"
  | "task.unassigned"
  | "task.due_set"
  | "task.due_cleared"
  | "task.priority_set"
  | "task.moved"
  | "task.reordered"
  | "task.deleted"
  | "checklist.added"
  | "checklist.renamed"
  | "checklist.removed"
  | "checklist_item.added"
  | "checklist_item.checked"
  | "checklist_item.unchecked"
  | "checklist_item.renamed"
  | "checklist_item.removed";

// Cross-module actions (cases, clients, courts, prompts, profile, users)
export type CrossModuleActivityAction =
  | "case.created"
  | "case.updated"
  | "case.hearing_updated"
  | "case.status_changed"
  | "case.disposed"
  | "case.reopened"
  | "case.deleted"
  | "client.created"
  | "client.updated"
  | "client.deleted"
  | "court.created"
  | "court.updated"
  | "court.deleted"
  | "prompt.created"
  | "prompt.updated"
  | "prompt.deleted"
  | "profile.updated"
  | "user.invited"
  | "user.updated"
  | "user.role_changed"
  | "user.activated"
  | "user.deactivated"
  | "user.removed";

// Senior Desk — chat + reminders. We deliberately keep these high-level
// (one row per "Tejas sent N messages in Group Chat over the last minute"
// rather than one row per keystroke) to avoid drowning the activity feed.
export type SeniorDeskActivityAction =
  | "chat.message"
  | "chat.private_started"
  | "reminder.created"
  | "reminder.assigned"
  | "reminder.completed"
  | "reminder.reopened"
  | "reminder.deleted";

// Attendance — admin marks / unmarks a user's day. Two action keys is
// enough granularity; the metadata carries the (userId, date, status)
// detail so the activity feed reads naturally.
export type AttendanceActivityAction =
  | "attendance.marked"
  | "attendance.cleared";

export type ActivityAction =
  | AdminActivityAction
  | WorkflowActivityAction
  | CrossModuleActivityAction
  | SeniorDeskActivityAction
  | AttendanceActivityAction;

export type ActivityTargetType =
  | "partner"
  | "user"
  | "system"
  | "board"
  | "list"
  | "task"
  | "checklist"
  | "case"
  | "client"
  | "court"
  | "hearing"
  | "prompt"
  | "profile"
  | "chat_room"
  | "chat_message"
  | "reminder"
  | "attendance";

export interface IActivity {
  _id: Types.ObjectId;
  actorUserId: Types.ObjectId | null;
  actorName: string;
  actorEmail: string;
  actorType: "global_admin" | "partner_admin" | "user" | "system";
  action: ActivityAction;
  targetType: ActivityTargetType;
  targetId: Types.ObjectId | null;
  targetName: string;
  message: string;
  metadata: Record<string, unknown>;
  partnerId: Types.ObjectId | null;
  // For workflow events: which board this happened in (so we can scope
  // a feed to one board cheaply). Null for non-workflow events.
  boardId: Types.ObjectId | null;
  createdAt: Date;
}

const ActivitySchema = new Schema<IActivity>(
  {
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    actorName: { type: String, required: true },
    actorEmail: { type: String, required: true, lowercase: true },
    actorType: {
      type: String,
      enum: ["global_admin", "partner_admin", "user", "system"],
      required: true,
    },
    action: { type: String, required: true },
    targetType: {
      type: String,
      enum: [
        "partner",
        "user",
        "system",
        "board",
        "list",
        "task",
        "checklist",
        "case",
        "client",
        "court",
        "hearing",
        "prompt",
        "profile",
        "attendance",
        "chat_room",
        "chat_message",
        "reminder",
      ],
      required: true,
    },
    targetId: { type: Schema.Types.ObjectId, default: null },
    targetName: { type: String, default: "" },
    message: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      default: null,
    },
    boardId: {
      type: Schema.Types.ObjectId,
      ref: "Board",
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ActivitySchema.index({ createdAt: -1 });
ActivitySchema.index({ partnerId: 1, createdAt: -1 });
ActivitySchema.index({ actorUserId: 1, createdAt: -1 });
ActivitySchema.index({ action: 1, createdAt: -1 });
// Quick "history of this card / list / board" queries
ActivitySchema.index({ partnerId: 1, targetType: 1, targetId: 1, createdAt: -1 });
ActivitySchema.index({ partnerId: 1, boardId: 1, createdAt: -1 });

export const Activity: Model<IActivity> =
  (mongoose.models.Activity as Model<IActivity>) ||
  mongoose.model<IActivity>("Activity", ActivitySchema);
