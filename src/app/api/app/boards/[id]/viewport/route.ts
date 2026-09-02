import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Board } from "@/models/Board";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { loadBoard } from "@/lib/workflow-helpers";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

// PATCH /api/app/boards/[id]/viewport
// Body: { x: number, y: number, zoom: number }
// Persists the user's last pan/zoom for this board so they pick up where
// they left off. No activity log — too noisy.
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
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

  const x = Number(body.x);
  const y = Number(body.y);
  const zoom = Number(body.zoom);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom)) {
    return NextResponse.json(
      { error: "x, y, and zoom must be numbers" },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  await connectDB();
  const board = await loadBoard(id, guard.ctx.user.partnerId);
  if (!board) {
    return NextResponse.json(
      { error: "Board not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  await Board.updateOne(
    { _id: board._id },
    {
      $set: {
        viewport: {
          x,
          y,
          zoom: Math.max(0.2, Math.min(2.5, zoom)),
        },
      },
    }
  );

  return NextResponse.json(
    { ok: true },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
