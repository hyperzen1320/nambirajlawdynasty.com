// Delete rule:
//  - Admins can always delete directly.
//  - Everyone else must raise a delete request — nothing (a case, client,
//    document, board, list or card) is removed without the office admin
//    approving it. The admin reviews requests from the bell.

import type { IBoardList } from "@/models/BoardList";
import type { ITask } from "@/models/Task";

type RoleCheck = { isAdmin: boolean; userId: string };

export async function canDirectDeleteList(
  _list: IBoardList,
  who: RoleCheck
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (who.isAdmin) return { ok: true };
  return {
    ok: false,
    reason:
      "Only the office admin can delete a list. Please raise a delete request.",
  };
}

export function canDirectDeleteTask(
  _task: ITask,
  who: RoleCheck
): { ok: true } | { ok: false; reason: string } {
  if (who.isAdmin) return { ok: true };
  return {
    ok: false,
    reason:
      "Only the office admin can delete a card. Please raise a delete request.",
  };
}

export function canDirectDeleteBoard(who: RoleCheck): {
  ok: true | false;
  reason?: string;
} {
  // Boards always require admin to delete (too consequential).
  if (who.isAdmin) return { ok: true };
  return {
    ok: false,
    reason:
      "Only the office admin can delete a whole board. Please raise a delete request.",
  };
}

// Generic: top-level objects (clients, courts, cases, users, prompts)
// — non-admins must always request.
export function canDirectDeleteGeneric(who: RoleCheck): {
  ok: true | false;
  reason?: string;
} {
  if (who.isAdmin) return { ok: true };
  return {
    ok: false,
    reason:
      "Only the office admin can delete this. Please raise a delete request.",
  };
}
