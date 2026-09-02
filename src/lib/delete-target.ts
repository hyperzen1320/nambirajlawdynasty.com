// Performs the actual soft-delete on a target (list, task, board, etc.) when
// an admin approves a delete request. Mirrors the cascade logic from the
// per-resource DELETE endpoints so behaviour stays consistent.

import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Board } from "@/models/Board";
import { BoardList } from "@/models/BoardList";
import { BoardEdge } from "@/models/BoardEdge";
import { Task } from "@/models/Task";
import { Client } from "@/models/Client";
import { Court } from "@/models/Court";
import { Case } from "@/models/Case";
import { CaseDocument } from "@/models/CaseDocument";
import { User } from "@/models/User";
import { PromptTemplate } from "@/models/PromptTemplate";
import type { DeleteRequestTargetType } from "@/models/DeleteRequest";

export async function performSoftDelete(args: {
  partnerId: string;
  targetType: DeleteRequestTargetType;
  targetId: string;
}): Promise<{ ok: boolean; targetName: string; boardId: string | null }> {
  const partnerId = new mongoose.Types.ObjectId(args.partnerId);
  const targetId = new mongoose.Types.ObjectId(args.targetId);
  await connectDB();

  switch (args.targetType) {
    case "list": {
      const list = await BoardList.findOne({ _id: targetId, partnerId });
      if (!list) return { ok: false, targetName: "", boardId: null };
      list.isDeleted = true;
      await list.save();
      await Task.updateMany(
        { partnerId, listId: list._id, isDeleted: false },
        { $set: { isDeleted: true } }
      );
      await BoardEdge.updateMany(
        {
          partnerId,
          $or: [{ sourceListId: list._id }, { targetListId: list._id }],
          isDeleted: false,
        },
        { $set: { isDeleted: true } }
      );
      return {
        ok: true,
        targetName: list.title,
        boardId: String(list.boardId),
      };
    }
    case "task": {
      const task = await Task.findOne({ _id: targetId, partnerId });
      if (!task) return { ok: false, targetName: "", boardId: null };
      task.isDeleted = true;
      await task.save();
      return {
        ok: true,
        targetName: task.title,
        boardId: String(task.boardId),
      };
    }
    case "board": {
      const board = await Board.findOne({ _id: targetId, partnerId });
      if (!board) return { ok: false, targetName: "", boardId: null };
      board.isDeleted = true;
      await board.save();
      // Cascade to lists, tasks, and edges
      await BoardList.updateMany(
        { partnerId, boardId: board._id, isDeleted: false },
        { $set: { isDeleted: true } }
      );
      await Task.updateMany(
        { partnerId, boardId: board._id, isDeleted: false },
        { $set: { isDeleted: true } }
      );
      await BoardEdge.updateMany(
        { partnerId, boardId: board._id, isDeleted: false },
        { $set: { isDeleted: true } }
      );
      return {
        ok: true,
        targetName: board.title,
        boardId: String(board._id),
      };
    }
    case "client": {
      const client = await Client.findOne({ _id: targetId, partnerId });
      if (!client) return { ok: false, targetName: "", boardId: null };
      client.isDeleted = true;
      await client.save();
      return { ok: true, targetName: client.name, boardId: null };
    }
    case "court": {
      const court = await Court.findOne({ _id: targetId, partnerId });
      if (!court) return { ok: false, targetName: "", boardId: null };
      court.isDeleted = true;
      await court.save();
      return { ok: true, targetName: court.name, boardId: null };
    }
    case "case": {
      // "Delete" on a case = move to Disposed Cases (not hide). Keeps
      // the matter recoverable via the Reopen action and stays
      // consistent with the direct admin Delete button on the table /
      // detail page, both of which set status="Disposed" via PATCH.
      const c = await Case.findOne({ _id: targetId, partnerId });
      if (!c) return { ok: false, targetName: "", boardId: null };
      if (!c.disposedAt) {
        c.disposedAt = new Date();
      }
      if (c.status !== "Disposed") {
        c.status = "Disposed";
      }
      await c.save();
      return {
        ok: true,
        targetName: c.caseNo || c.fileNo || "",
        boardId: null,
      };
    }
    case "user": {
      const u = await User.findOne({ _id: targetId, partnerId });
      if (!u) return { ok: false, targetName: "", boardId: null };
      // Block deleting another partner_admin or self
      if (u.userType === "partner_admin") {
        return { ok: false, targetName: u.email, boardId: null };
      }
      u.isDeleted = true;
      u.active = false;
      await u.save();
      return {
        ok: true,
        targetName: `${u.firstName} ${u.lastName}`.trim() || u.email,
        boardId: null,
      };
    }
    case "prompt": {
      const p = await PromptTemplate.findOne({ _id: targetId, partnerId });
      if (!p) return { ok: false, targetName: "", boardId: null };
      p.isDeleted = true;
      await p.save();
      return { ok: true, targetName: p.title, boardId: null };
    }
    case "case_document": {
      // Soft-delete the metadata row; the GridFS binary is left in place
      // (consistent with the rest of the app's recoverable soft-deletes).
      const d = await CaseDocument.findOne({ _id: targetId, partnerId });
      if (!d) return { ok: false, targetName: "", boardId: null };
      d.isDeleted = true;
      await d.save();
      return { ok: true, targetName: d.filename, boardId: null };
    }
    default:
      return { ok: false, targetName: "", boardId: null };
  }
}
