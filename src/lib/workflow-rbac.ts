import { NextResponse } from "next/server";

// Within an office, EVERY role can interact with Workflow — pan, zoom,
// move lists, create connections, add and edit cards. Only `partner_admin`
// (role=admin) can DELETE: boards, lists, cards, edges. Non-admins use the
// delete-request flow when they want to remove something.

export type WorkflowAction =
  | "view"
  | "boardCreate"
  | "boardEdit"
  | "boardDelete"
  | "listEdit"
  | "listDelete"
  | "taskEdit"
  | "taskDelete";

const WRITE: WorkflowAction[] = [
  "view",
  "boardCreate",
  "boardEdit",
  "listEdit",
  "taskEdit",
];
const ADMIN_ONLY: WorkflowAction[] = [
  ...WRITE,
  "boardDelete",
  "listDelete",
  "taskDelete",
];

const MATRIX: Record<string, Set<WorkflowAction>> = {
  admin: new Set(ADMIN_ONLY),
  advocate: new Set(WRITE),
  junior: new Set(WRITE),
  clerk: new Set(WRITE),
  viewer: new Set(WRITE),
};

export function canPerform(role: string, action: WorkflowAction): boolean {
  return MATRIX[role]?.has(action) ?? false;
}

/** Helper: only admins can hard-delete in workflow. */
export function isAdmin(role: string): boolean {
  return role === "admin";
}

const MESSAGES: Record<WorkflowAction, string> = {
  view: "You don't have access to this board.",
  boardCreate: "You don't have access to create boards.",
  boardEdit: "You don't have access to edit this board.",
  boardDelete: "Only the office admin can delete a board.",
  listEdit: "You don't have access to edit lists.",
  listDelete: "Only the office admin can delete a list.",
  taskEdit: "You don't have access to edit cards.",
  taskDelete: "Only the office admin can delete a card.",
};

export function workflowDeny(
  action: WorkflowAction,
  isMobile: boolean,
  corsHeaders?: () => Record<string, string>
): NextResponse {
  return NextResponse.json(
    { error: MESSAGES[action] },
    {
      status: 403,
      headers: isMobile && corsHeaders ? corsHeaders() : undefined,
    }
  );
}
