import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { PromptTemplate } from "@/models/PromptTemplate";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { logWorkflowActivity } from "@/lib/activity";
import { canDirectDeleteGeneric } from "@/lib/delete-eligibility";
import { DeleteRequest } from "@/models/DeleteRequest";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

async function loadOne(id: string, partnerId: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();
  return PromptTemplate.findOne({
    _id: new mongoose.Types.ObjectId(id),
    partnerId: new mongoose.Types.ObjectId(partnerId),
    isDeleted: false,
  });
}

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

  const doc = await loadOne(id, guard.ctx.user.partnerId);
  if (!doc) {
    return NextResponse.json(
      { error: "Prompt not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const beforeTitle = doc.title;
  const beforeBody = doc.body;
  const beforeCategory = doc.category;

  if (typeof body.title === "string" && body.title.trim()) {
    doc.title = body.title.trim();
  }
  if (typeof body.body === "string") {
    doc.body = body.body;
  }
  if (typeof body.category === "string" && body.category.trim()) {
    doc.category = body.category.trim();
  }

  await doc.save();

  const changed: string[] = [];
  if (beforeTitle !== doc.title) changed.push("title");
  if (beforeBody !== doc.body) changed.push("body");
  if (beforeCategory !== doc.category) changed.push("category");
  if (changed.length > 0) {
    await logWorkflowActivity(guard.ctx, {
      action: "prompt.updated",
      targetType: "prompt",
      targetId: String(doc._id),
      targetName: doc.title,
      message: `updated prompt **${doc.title}** (${changed.join(", ")})`,
      metadata: { fields: changed },
    });
  }

  return NextResponse.json(
    {
      ok: true,
      prompt: {
        id: String(doc._id),
        title: doc.title,
        body: doc.body,
        category: doc.category,
        isSeeded: doc.isSeeded,
        updatedAt: doc.updatedAt.toISOString(),
      },
    },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  const doc = await loadOne(id, guard.ctx.user.partnerId);
  if (!doc) {
    return NextResponse.json(
      { error: "Prompt not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const eligibility = canDirectDeleteGeneric({
    isAdmin: guard.ctx.user.role === "admin",
    userId: guard.ctx.user.id,
  });
  if (!eligibility.ok) {
    return NextResponse.json(
      {
        error: eligibility.reason,
        code: "delete_request_required",
        targetType: "prompt",
        targetId: String(doc._id),
        targetName: doc.title,
      },
      { status: 403, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  await DeleteRequest.updateMany(
    {
      partnerId: doc.partnerId,
      targetType: "prompt",
      targetId: doc._id,
      status: "pending",
    },
    { $set: { status: "obsolete", reviewerNote: "Target deleted directly." } }
  );

  doc.isDeleted = true;
  await doc.save();

  await logWorkflowActivity(guard.ctx, {
    action: "prompt.deleted",
    targetType: "prompt",
    targetId: String(doc._id),
    targetName: doc.title,
    message: `deleted prompt **${doc.title}**`,
    metadata: {},
  });

  return NextResponse.json(
    { ok: true },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
