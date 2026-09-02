import mongoose, { Schema, Types, type Model } from "mongoose";

export type TaskPriority = "low" | "medium" | "high";

export interface IChecklistItem {
  _id: Types.ObjectId;
  text: string;
  done: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IChecklist {
  _id: Types.ObjectId;
  title: string;
  sortOrder: number;
  items: IChecklistItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ITask {
  _id: Types.ObjectId;
  partnerId: Types.ObjectId;
  boardId: Types.ObjectId;
  listId: Types.ObjectId;

  title: string;
  description: string;

  sortOrder: number;

  // Trello-style: a card has zero or more checklists, each with zero or
  // more checkbox rows. Order is independent within and across checklists.
  checklists: IChecklist[];

  assignedToUserId: Types.ObjectId | null;
  dueDate: Date | null;
  priority: TaskPriority | null;

  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
}

const ChecklistItemSchema = new Schema<IChecklistItem>(
  {
    text: { type: String, required: true, trim: true },
    done: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const ChecklistSchema = new Schema<IChecklist>(
  {
    title: { type: String, required: true, trim: true, default: "Checklist" },
    sortOrder: { type: Number, default: 0 },
    items: { type: [ChecklistItemSchema], default: [] },
  },
  { timestamps: true }
);

const TaskSchema = new Schema<ITask>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
    },
    boardId: {
      type: Schema.Types.ObjectId,
      ref: "Board",
      required: true,
    },
    listId: {
      type: Schema.Types.ObjectId,
      ref: "BoardList",
      required: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 },
    checklists: { type: [ChecklistSchema], default: [] },
    assignedToUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    dueDate: { type: Date, default: null },
    priority: {
      type: String,
      enum: ["low", "medium", "high", null],
      default: null,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Primary canvas query: every card on a board, grouped by list, in order
TaskSchema.index({
  partnerId: 1,
  boardId: 1,
  isDeleted: 1,
  listId: 1,
  sortOrder: 1,
});
// "Tasks assigned to me" + due-date views (future)
TaskSchema.index({ partnerId: 1, assignedToUserId: 1, dueDate: 1 });

export const Task: Model<ITask> =
  (mongoose.models.Task as Model<ITask>) ||
  mongoose.model<ITask>("Task", TaskSchema);
