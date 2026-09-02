import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import {
  SupportTicket,
  SUPPORT_STATUSES,
  type SupportStatus,
} from "@/models/SupportTicket";
import { requireAdmin } from "@/lib/admin-auth";
import { corsHeaders } from "@/lib/cors";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

async function load(id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();
  return SupportTicket.findOne({
    _id: new mongoose.Types.ObjectId(id),
    isDeleted: false,
  });
}

// PATCH /api/admin/support/[id] — update a ticket's status and/or the
// admin's internal note.
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requireAdmin(request);
  if ("error" in guard) return guard.error;
  const cors = guard.ctx.isMobile ? corsHeaders() : undefined;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json(
      { error: "Invalid body" },
      { status: 400, headers: cors }
    );
  }

  const doc = await load(id);
  if (!doc) {
    return NextResponse.json(
      { error: "Ticket not found" },
      { status: 404, headers: cors }
    );
  }

  if (typeof body.status === "string") {
    const next = body.status.trim();
    if (!SUPPORT_STATUSES.includes(next as SupportStatus)) {
      return NextResponse.json(
        { error: "Invalid status." },
        { status: 400, headers: cors }
      );
    }
    doc.status = next as SupportStatus;
  }
  if (typeof body.adminNote === "string") {
    doc.adminNote = body.adminNote.trim();
  }

  await doc.save();
  return NextResponse.json(
    { ok: true, status: doc.status, adminNote: doc.adminNote },
    { headers: cors }
  );
}

// DELETE /api/admin/support/[id] — soft-delete a ticket (spam / resolved
// clutter). Kept as isDeleted so nothing is lost.
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requireAdmin(request);
  if ("error" in guard) return guard.error;
  const cors = guard.ctx.isMobile ? corsHeaders() : undefined;

  const doc = await load(id);
  if (!doc) {
    return NextResponse.json(
      { error: "Ticket not found" },
      { status: 404, headers: cors }
    );
  }

  doc.isDeleted = true;
  await doc.save();
  return NextResponse.json({ ok: true }, { headers: cors });
}
