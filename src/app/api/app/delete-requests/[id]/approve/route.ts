import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { DeleteRequest } from "@/models/DeleteRequest";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { performSoftDelete } from "@/lib/delete-target";
import { logWorkflowActivity } from "@/lib/activity";
import { sendPush } from "@/lib/push";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

// POST — admin approves a pending delete request
// Performs the actual soft-delete on the target, then marks the request approved.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  if (guard.ctx.user.role !== "admin") {
    return NextResponse.json(
      { error: "Only the office admin can approve delete requests." },
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

  // Perform the actual soft-delete on the target
  const result = await performSoftDelete({
    partnerId: guard.ctx.user.partnerId,
    targetType: req.targetType,
    targetId: String(req.targetId),
  });

  if (!result.ok) {
    // Target may have been already deleted — mark obsolete instead of approved
    req.status = "obsolete";
    req.reviewedByUserId = new mongoose.Types.ObjectId(guard.ctx.user.id);
    req.reviewedByName =
      `${guard.ctx.user.firstName} ${guard.ctx.user.lastName}`.trim() ||
      guard.ctx.user.email;
    req.reviewedAt = new Date();
    req.reviewerNote = "Target no longer exists.";
    await req.save();
    return NextResponse.json(
      {
        ok: false,
        error: "Target no longer exists; marked obsolete.",
        request: {
          id: String(req._id),
          status: req.status,
        },
      },
      { status: 410, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  req.status = "approved";
  req.reviewedByUserId = new mongoose.Types.ObjectId(guard.ctx.user.id);
  req.reviewedByName =
    `${guard.ctx.user.firstName} ${guard.ctx.user.lastName}`.trim() ||
    guard.ctx.user.email;
  req.reviewedAt = new Date();
  req.reviewerNote = (body.note || "").trim();
  await req.save();

  // Activity entry: request approved + the underlying delete
  await logWorkflowActivity(guard.ctx, {
    action: "delete_request.approved" as never,
    targetType: req.targetType === "user" ? "user" : "task",
    targetId: String(req.targetId),
    targetName: result.targetName || req.targetName,
    boardId: result.boardId,
    message: `approved deletion of ${req.targetType} **${result.targetName || req.targetName}** (requested by ${req.requesterName})`,
    metadata: {
      requestId: String(req._id),
      requesterName: req.requesterName,
      reason: req.reason,
      reviewerNote: req.reviewerNote,
    },
  });

  // The person who asked has been waiting on an answer — tell their
  // phone rather than making them re-open the bell to find out.
  void sendPush(guard.ctx.user.partnerId, [String(req.requesterUserId)], {
    title: "Delete request approved",
    body: `${req.reviewedByName} approved deleting ${result.targetName || req.targetName}`,
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
      },
    },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
