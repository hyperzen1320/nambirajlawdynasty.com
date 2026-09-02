import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { Board } from "@/models/Board";
import { BoardEdge } from "@/models/BoardEdge";
import { DeleteRequest } from "@/models/DeleteRequest";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { canPerform, workflowDeny } from "@/lib/workflow-rbac";
import { logWorkflowActivity } from "@/lib/activity";
import { loadList } from "@/lib/workflow-helpers";
import { canDirectDeleteList } from "@/lib/delete-eligibility";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ listId: string }> }
) {
  const { listId } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  if (!canPerform(guard.ctx.user.role, "listEdit")) {
    return workflowDeny("listEdit", guard.ctx.isMobile, corsHeaders);
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json(
      { error: "Invalid body" },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  await connectDB();
  const list = await loadList(listId, guard.ctx.user.partnerId);
  if (!list) {
    return NextResponse.json(
      { error: "List not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const oldTitle = list.title;
  const oldDescription = list.description || "";
  const oldDateMs = list.listDate ? list.listDate.getTime() : null;
  if (typeof body.title === "string" && body.title.trim()) {
    list.title = body.title.trim();
  }
  if (typeof body.color === "string" || body.color === null) {
    list.color = body.color || null;
  }
  if (typeof body.description === "string") {
    list.description = body.description.trim();
  }
  // listDate: an ISO string sets it; null / "" clears it back to "use the
  // creation date". An unparseable value is ignored rather than nulled.
  if (typeof body.listDate === "string" || body.listDate === null) {
    if (body.listDate === null || body.listDate === "") {
      list.listDate = null;
    } else {
      const d = new Date(body.listDate);
      if (!Number.isNaN(d.getTime())) list.listDate = d;
    }
  }
  if (typeof body.width === "number" && Number.isFinite(body.width)) {
    list.width = Math.max(240, Math.min(560, body.width));
  }
  if (
    body.position &&
    typeof body.position === "object" &&
    typeof (body.position as { x: unknown }).x === "number" &&
    typeof (body.position as { y: unknown }).y === "number"
  ) {
    list.position = {
      x: (body.position as { x: number }).x,
      y: (body.position as { y: number }).y,
    };
  }

  await list.save();

  if (oldTitle !== list.title) {
    await logWorkflowActivity(guard.ctx, {
      action: "list.renamed",
      targetType: "list",
      targetId: String(list._id),
      targetName: list.title,
      boardId: String(list.boardId),
      message: `renamed list **${oldTitle}** → **${list.title}**`,
      metadata: { from: oldTitle, to: list.title },
    });
  }

  // Description / date edits emit list.updated so every other open canvas
  // resyncs (the live feed triggers on any list.* event) — that's how an
  // edit "updates for everyone".
  const newDateMs = list.listDate ? list.listDate.getTime() : null;
  const changedFields: string[] = [];
  if (oldDescription !== (list.description || "")) {
    changedFields.push("description");
  }
  if (oldDateMs !== newDateMs) changedFields.push("date");
  if (changedFields.length > 0) {
    await logWorkflowActivity(guard.ctx, {
      action: "list.updated",
      targetType: "list",
      targetId: String(list._id),
      targetName: list.title,
      boardId: String(list.boardId),
      message: `updated list **${list.title}** (${changedFields.join(", ")})`,
      metadata: { fields: changedFields },
    });
  }

  return NextResponse.json(
    {
      ok: true,
      list: {
        id: String(list._id),
        title: list.title,
        sortOrder: list.sortOrder,
        description: list.description || "",
        listDate: (list.listDate ?? list.createdAt).toISOString(),
      },
    },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ listId: string }> }
) {
  const { listId } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const list = await loadList(listId, guard.ctx.user.partnerId);
  if (!list) {
    return NextResponse.json(
      { error: "List not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  // Smart-delete: admins always allowed; non-admins only if they created
  // the list AND it's empty. Otherwise the client must raise a delete request.
  const eligibility = await canDirectDeleteList(list, {
    isAdmin: guard.ctx.user.role === "admin",
    userId: guard.ctx.user.id,
  });
  if (!eligibility.ok) {
    return NextResponse.json(
      {
        error: eligibility.reason,
        code: "delete_request_required",
        targetType: "list",
        targetId: String(list._id),
        targetName: list.title,
      },
      {
        status: 403,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }

  // Auto-mark any pending delete requests for this list as obsolete
  await DeleteRequest.updateMany(
    {
      partnerId: list.partnerId,
      targetType: "list",
      targetId: list._id,
      status: "pending",
    },
    { $set: { status: "obsolete", reviewerNote: "Target deleted directly." } }
  );

  // Soft delete the list and every task currently inside it.
  list.isDeleted = true;
  await list.save();
  const taskUpdate = await Task.updateMany(
    {
      partnerId: list.partnerId,
      listId: list._id,
      isDeleted: false,
    },
    { $set: { isDeleted: true } }
  );
  // Cascade-soft-delete any edges that touch this list.
  await BoardEdge.updateMany(
    {
      partnerId: list.partnerId,
      $or: [{ sourceListId: list._id }, { targetListId: list._id }],
      isDeleted: false,
    },
    { $set: { isDeleted: true } }
  );

  const board = await Board.findById(list.boardId).select("title").lean();

  await logWorkflowActivity(guard.ctx, {
    action: "list.deleted",
    targetType: "list",
    targetId: String(list._id),
    targetName: list.title,
    boardId: String(list.boardId),
    message: `removed list **${list.title}** from **${board?.title ?? "board"}**`,
    metadata: {
      cardsRemoved: taskUpdate.modifiedCount,
      boardTitle: board?.title,
    },
  });

  return NextResponse.json(
    { ok: true, cardsRemoved: taskUpdate.modifiedCount },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
