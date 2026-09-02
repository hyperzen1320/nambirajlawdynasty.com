import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { DeleteRequest } from "@/models/DeleteRequest";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

// GET /api/app/delete-requests/count?boardId=
// Admin: count of pending requests across the office (or scoped to a board)
// Non-admin: count of their own pending requests (so the requester sees a
// "1 pending" hint until reviewed)
export async function GET(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);
  const url = new URL(request.url);
  const boardId = url.searchParams.get("boardId");

  const filter: Record<string, unknown> = {
    partnerId,
    status: "pending",
  };
  if (boardId && mongoose.isValidObjectId(boardId)) {
    filter.boardId = new mongoose.Types.ObjectId(boardId);
  }
  if (guard.ctx.user.role !== "admin") {
    filter.requesterUserId = new mongoose.Types.ObjectId(guard.ctx.user.id);
  }

  const count = await DeleteRequest.countDocuments(filter);
  return NextResponse.json(
    { count },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
