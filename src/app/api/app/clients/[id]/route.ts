import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Client } from "@/models/Client";
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
  return Client.findOne({
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
      { error: "Client not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  // Name is the one required field — reject a blank rename outright
  // rather than silently keeping the old value, so the user knows the
  // edit didn't fully take.
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json(
        { error: "Client name can't be empty." },
        { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
      );
    }
    doc.name = name;
  }

  const before = {
    name: doc.name,
    email: doc.email,
    phone: doc.phone,
    whatsapp: doc.whatsapp,
    address: doc.address,
  };

  const optionalFields = ["email", "phone", "whatsapp", "address"] as const;
  for (const f of optionalFields) {
    if (typeof body[f] === "string") {
      doc[f] = (body[f] as string).trim();
    }
  }

  await doc.save();

  const changed: string[] = [];
  if (before.name !== doc.name) changed.push("name");
  for (const f of optionalFields) {
    if ((before[f] || "") !== (doc[f] || "")) changed.push(f);
  }
  if (changed.length > 0) {
    await logWorkflowActivity(guard.ctx, {
      action: "client.updated",
      targetType: "client",
      targetId: String(doc._id),
      targetName: doc.name,
      message: `updated client **${doc.name}** (${changed.join(", ")})`,
      metadata: { fields: changed },
    });
  }

  return NextResponse.json(
    {
      ok: true,
      client: {
        id: String(doc._id),
        name: doc.name,
        email: doc.email,
        phone: doc.phone,
        whatsapp: doc.whatsapp,
        address: doc.address,
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
      { error: "Client not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  // Clients are top-level — admin deletes directly; everyone else files
  // a delete request the admin reviews. Deleting a client never touches
  // their cases: each matter keeps its denormalised client name/phone,
  // so the directory entry can go without orphaning anything.
  const eligibility = canDirectDeleteGeneric({
    isAdmin: guard.ctx.user.role === "admin",
    userId: guard.ctx.user.id,
  });
  if (!eligibility.ok) {
    return NextResponse.json(
      {
        error: eligibility.reason,
        code: "delete_request_required",
        targetType: "client",
        targetId: String(doc._id),
        targetName: doc.name,
      },
      { status: 403, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  await DeleteRequest.updateMany(
    {
      partnerId: doc.partnerId,
      targetType: "client",
      targetId: doc._id,
      status: "pending",
    },
    { $set: { status: "obsolete", reviewerNote: "Target deleted directly." } }
  );

  doc.isDeleted = true;
  await doc.save();

  await logWorkflowActivity(guard.ctx, {
    action: "client.deleted",
    targetType: "client",
    targetId: String(doc._id),
    targetName: doc.name,
    message: `deleted client **${doc.name}**`,
    metadata: { phone: doc.phone, email: doc.email },
  });

  return NextResponse.json(
    { ok: true },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
