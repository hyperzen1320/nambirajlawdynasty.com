import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Board } from "@/models/Board";
import { BoardList } from "@/models/BoardList";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import { Partner } from "@/models/Partner";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { summarizeChecklists } from "@/lib/workflow-helpers";
import {
  generateBoardXlsx,
  type BoardExportRow,
  type BoardExportInput,
} from "@/lib/board-export";

// exceljs runs on the full Node runtime, never edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

// Download → "Data (Excel)". The PNG/PDF options are captured client-side
// from the rendered canvas; only the spreadsheet needs the server because
// it reads the authoritative board state (not whatever happens to be in
// view). Any member who can open the board can export it — it's the same
// data they already see on-screen, so there's nothing extra to gate here
// (unlike the full case register, which is admin-only).
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json(
      { error: "Invalid board id" },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "xlsx";
  if (format !== "xlsx") {
    return NextResponse.json(
      { error: "Unsupported format. The board data export is xlsx." },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  await connectDB();
  const partnerObjId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);
  const boardObjId = new mongoose.Types.ObjectId(id);

  const board = await Board.findOne({
    _id: boardObjId,
    partnerId: partnerObjId,
    isDeleted: false,
  }).lean();
  if (!board) {
    return NextResponse.json(
      { error: "Board not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const [lists, tasks, members, partner] = await Promise.all([
    BoardList.find({
      partnerId: partnerObjId,
      boardId: boardObjId,
      isDeleted: false,
    })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean(),
    Task.find({
      partnerId: partnerObjId,
      boardId: boardObjId,
      isDeleted: false,
    })
      .sort({ listId: 1, sortOrder: 1, createdAt: 1 })
      .lean(),
    User.find({ partnerId: partnerObjId, isDeleted: false })
      .select("firstName lastName email")
      .lean(),
    Partner.findById(partnerObjId).select("name branding.officeName").lean(),
  ]);

  const memberName = new Map<string, string>();
  for (const m of members) {
    const name =
      `${m.firstName || ""} ${m.lastName || ""}`.trim() || m.email || "";
    memberName.set(String(m._id), name);
  }

  // Group tasks under their list so the sheet reads list-by-list, in the
  // same top-to-bottom order the lists sit on the canvas.
  const tasksByList = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const key = String(t.listId);
    const bucket = tasksByList.get(key);
    if (bucket) bucket.push(t);
    else tasksByList.set(key, [t]);
  }

  const rows: BoardExportRow[] = [];
  for (const list of lists) {
    const listTasks = tasksByList.get(String(list._id)) || [];
    for (const t of listTasks) {
      const sum = summarizeChecklists(t.checklists || []);
      rows.push({
        listTitle: list.title,
        cardTitle: t.title,
        assignee: t.assignedToUserId
          ? memberName.get(String(t.assignedToUserId)) || ""
          : "",
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        priority: t.priority || "",
        checklist:
          sum.totalItems > 0 ? `${sum.doneItems}/${sum.totalItems}` : "",
        description: (t.description || "").trim(),
      });
    }
  }

  const exportInput: BoardExportInput = {
    boardTitle: board.title,
    partner: {
      name: partner?.name || "",
      officeName: partner?.branding?.officeName || "",
    },
    rows,
    generatedAt: new Date(),
  };

  let buffer: Buffer;
  try {
    buffer = await generateBoardXlsx(exportInput);
  } catch (err) {
    console.error(
      `[board-export] xlsx generator failed for board ${id}:`,
      err
    );
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Couldn't generate the board export. ${detail}` },
      { status: 500, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const dateSlug = exportInput.generatedAt
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  const safeBoard =
    board.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "board";
  const filename = `${safeBoard}-board-${dateSlug}.xlsx`;

  return new Response(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
      ...(guard.ctx.isMobile ? corsHeaders() : {}),
    },
  });
}
