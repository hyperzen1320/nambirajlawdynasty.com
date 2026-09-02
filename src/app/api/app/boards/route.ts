import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Board, type BoardColor } from "@/models/Board";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { BOARD_COLORS, BOARD_DEFAULTS } from "@/lib/board-defaults";
import { logWorkflowActivity } from "@/lib/activity";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

async function ensureSeeded(partnerId: mongoose.Types.ObjectId) {
  const count = await Board.countDocuments({ partnerId, isDeleted: false });
  if (count > 0) return;

  await Board.insertMany(
    BOARD_DEFAULTS.map((b, idx) => ({
      partnerId,
      title: b.title,
      description: b.description,
      color: b.color,
      sortOrder: idx,
      isSeeded: true,
    }))
  );
}

export async function GET(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);

  await ensureSeeded(partnerId);

  const url = new URL(request.url);
  const sort = url.searchParams.get("sort") || "recent";

  const sortSpec: Record<string, 1 | -1> =
    sort === "name"
      ? { title: 1 }
      : sort === "created"
        ? { createdAt: -1 }
        : { updatedAt: -1, sortOrder: 1 };

  const docs = await Board.find({ partnerId, isDeleted: false })
    .sort(sortSpec)
    .lean();

  const boards = docs.map((b) => ({
    id: String(b._id),
    title: b.title,
    description: b.description,
    color: b.color,
    isSeeded: b.isSeeded,
    cardCount: 0, // wires in once Tasks model lands (Phase 2)
    updatedAt: b.updatedAt.toISOString(),
    createdAt: b.createdAt.toISOString(),
  }));

  return NextResponse.json(
    { boards },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}

export async function POST(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

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

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json(
      { error: "Board title is required." },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const colorIn =
    typeof body.color === "string" ? body.color.trim().toLowerCase() : "";
  const color = (
    BOARD_COLORS.includes(colorIn as BoardColor) ? colorIn : "copper"
  ) as BoardColor;

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);

  const last = await Board.findOne({ partnerId, isDeleted: false })
    .sort({ sortOrder: -1 })
    .select("sortOrder")
    .lean();
  const sortOrder = (last?.sortOrder ?? -1) + 1;

  const doc = await Board.create({
    partnerId,
    title,
    description,
    color,
    sortOrder,
    isSeeded: false,
    createdBy: guard.ctx.user.id
      ? new mongoose.Types.ObjectId(guard.ctx.user.id)
      : null,
  });

  await logWorkflowActivity(guard.ctx, {
    action: "board.created",
    targetType: "board",
    targetId: String(doc._id),
    targetName: doc.title,
    boardId: String(doc._id),
    message: `created board **${doc.title}**`,
    metadata: { color: doc.color, description: doc.description },
  });

  return NextResponse.json(
    {
      ok: true,
      board: {
        id: String(doc._id),
        title: doc.title,
        description: doc.description,
        color: doc.color,
        isSeeded: false,
        cardCount: 0,
        updatedAt: doc.updatedAt.toISOString(),
        createdAt: doc.createdAt.toISOString(),
      },
    },
    { status: 201, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
