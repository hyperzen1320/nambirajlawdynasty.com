import mongoose from "mongoose";
import { Board } from "@/models/Board";
import { BoardList } from "@/models/BoardList";
import { Task } from "@/models/Task";

export function isObjectId(id: string): boolean {
  return mongoose.isValidObjectId(id);
}

export async function loadBoard(boardId: string, partnerId: string) {
  if (!isObjectId(boardId)) return null;
  return Board.findOne({
    _id: new mongoose.Types.ObjectId(boardId),
    partnerId: new mongoose.Types.ObjectId(partnerId),
    isDeleted: false,
  });
}

export async function loadList(listId: string, partnerId: string) {
  if (!isObjectId(listId)) return null;
  return BoardList.findOne({
    _id: new mongoose.Types.ObjectId(listId),
    partnerId: new mongoose.Types.ObjectId(partnerId),
    isDeleted: false,
  });
}

export async function loadTask(taskId: string, partnerId: string) {
  if (!isObjectId(taskId)) return null;
  return Task.findOne({
    _id: new mongoose.Types.ObjectId(taskId),
    partnerId: new mongoose.Types.ObjectId(partnerId),
    isDeleted: false,
  });
}

// Slim, displayable shape used by the canvas
export type SerializedTask = {
  id: string;
  listId: string;
  title: string;
  description: string;
  sortOrder: number;
  assignee: {
    id: string;
    name: string;
    role: string;
  } | null;
  dueDate: string | null;
  priority: "low" | "medium" | "high" | null;
  checklistSummary: {
    totalChecklists: number;
    totalItems: number;
    doneItems: number;
  };
  hasDescription: boolean;
  updatedAt: string;
};

export type SerializedTaskFull = SerializedTask & {
  checklists: {
    id: string;
    title: string;
    sortOrder: number;
    items: {
      id: string;
      text: string;
      done: boolean;
      sortOrder: number;
    }[];
  }[];
};

export function summarizeChecklists(checklists: { items: { done: boolean }[] }[]) {
  let totalItems = 0;
  let doneItems = 0;
  for (const c of checklists) {
    for (const it of c.items) {
      totalItems++;
      if (it.done) doneItems++;
    }
  }
  return {
    totalChecklists: checklists.length,
    totalItems,
    doneItems,
  };
}
