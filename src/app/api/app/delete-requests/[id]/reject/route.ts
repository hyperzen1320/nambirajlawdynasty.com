import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { DeleteRequest } from "@/models/DeleteRequest";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { logWorkflowActivity } from "@/lib/activity";
import { sendPush } from "@/lib/push";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

// POST — admin rejects a pending delete request (with optional note)
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  if (guard.ctx.user.role !== "admin") {
    return NextResponse.json(
      { error: "Only the office admin can reject delete requests." },
      { status: 403, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json(
      { error: "Invalid id" },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    note?: string;
  };

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);
  const req = await DeleteRequest.findOne({
    _id: new mongoose.Types.ObjectId(id),
    partnerId,
  });
  if (!req) {
    return NextResponse.json(
      { error: "Request not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }
  if (req.status !== "pending") {
    return NextResponse.json(
      { error: `This request is already ${req.status}.` },
      { status: 409, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  req.status = "rejected";
  req.reviewedByUserId = new mongoose.Types.ObjectId(guard.ctx.user.id);
  req.reviewedByName =
    `${guard.ctx.user.firstName} ${guard.ctx.user.lastName}`.trim() ||
    guard.ctx.user.email;
  req.reviewedAt = new Date();
  req.reviewerNote = (body.note || "").trim();
  await req.save();

  await logWorkflowActivity(guard.ctx, {
    action: "delete_request.rejected" as never,
    targetType: req.targetType === "user" ? "user" : "task",
    targetId: String(req.targetId),
    targetName: req.targetName,
    boardId: req.boardId ? String(req.boardId) : null,
    message: `rejected the request to delete ${req.targetType} **${req.targetName}** (requested by ${req.requesterName})`,
    metadata: {
      requestId: String(req._id),
      requesterName: req.requesterName,
      reason: req.reason,
      reviewerNote: req.reviewerNote,
    },
  });

  // Same courtesy as an approval: the answer goes to the person who
  // asked, with the reason if one was given.
  void sendPush(guard.ctx.user.partnerId, [String(req.requesterUserId)], {
    title: "Delete request declined",
    body: req.reviewerNote
      ? `${req.reviewedByName}: “${req.reviewerNote}”`
      : `${req.reviewedByName} declined deleting ${req.targetName}`,
    data: { kind: "delete_request", requestId: String(req._id) },
  });

  return NextResponse.json(
    {
      ok: true,
      request: {
        id: String(req._id),
        status: req.status,
        reviewedAt: req.reviewedAt.toISOString(),
        reviewedByName: req.reviewedByName,
        reviewerNote: req.reviewerNote,
      },
    },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
