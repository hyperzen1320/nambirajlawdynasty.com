import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { connectDB } from "@/lib/db";
import { CaseDocument } from "@/models/CaseDocument";
import { DeleteRequest } from "@/models/DeleteRequest";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { canDirectDeleteGeneric } from "@/lib/delete-eligibility";
import { logWorkflowActivity } from "@/lib/activity";
import { getDocsBucket } from "@/lib/gridfs";

// GridFS streaming + Node stream interop need the full Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

async function loadDoc(
  caseId: string,
  docId: string,
  partnerId: mongoose.Types.ObjectId
) {
  if (!mongoose.isValidObjectId(caseId) || !mongoose.isValidObjectId(docId)) {
    return null;
  }
  return CaseDocument.findOne({
    _id: new mongoose.Types.ObjectId(docId),
    caseId: new mongoose.Types.ObjectId(caseId),
    partnerId,
    isDeleted: false,
  });
}

// RFC 6266 / 5987 — keep a plain-ASCII fallback for old clients plus the
// UTF-8 form so names with Indian-language characters survive.
function contentDisposition(type: "inline" | "attachment", name: string) {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(
    name
  )}`;
}

// GET — stream the file. Inline by default (so PDFs/images preview in a new
// tab); ?download=1 forces a save dialog.
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  const { id, docId } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);

  const doc = await loadDoc(id, docId, partnerId);
  if (!doc) {
    return NextResponse.json(
      { error: "Document not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const bucket = await getDocsBucket();

  // Confirm the binary is actually present before we open a streaming
  // response (once bytes start flowing we can't switch to a clean 404).
  const fileEntry = await bucket
    .find({ _id: doc.gridfsId })
    .limit(1)
    .toArray();
  if (fileEntry.length === 0) {
    return NextResponse.json(
      { error: "The stored file is missing." },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const url = new URL(request.url);
  const asAttachment = url.searchParams.get("download") === "1";

  // Downloading the raw file is office-admin only. Everyone else can still
  // view inline (the in-app viewer renders the bytes with a watermark and
  // no save button), but a forced "save to disk" is gated.
  if (asAttachment && guard.ctx.user.role !== "admin") {
    return NextResponse.json(
      { error: "Only the office admin can download documents." },
      { status: 403, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const nodeStream = bucket.openDownloadStream(doc.gridfsId);
  const webStream = Readable.toWeb(
    nodeStream
  ) as unknown as ReadableStream<Uint8Array>;

  return new Response(webStream as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": doc.contentType || "application/octet-stream",
      "Content-Disposition": contentDisposition(
        asAttachment ? "attachment" : "inline",
        doc.filename
      ),
      "Content-Length": String(doc.size),
      "Cache-Control": "private, max-age=0, must-revalidate",
      // Defence-in-depth for user-supplied files served from our origin.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      ...(guard.ctx.isMobile ? corsHeaders() : {}),
    },
  });
}

// DELETE — admin removes directly; everyone else files a delete request
// the admin reviews. Soft-delete keeps the metadata (and the GridFS
// binary) recoverable, consistent with the rest of the app.
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  const { id, docId } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);

  const doc = await loadDoc(id, docId, partnerId);
  if (!doc) {
    return NextResponse.json(
      { error: "Document not found" },
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
        targetType: "case_document",
        targetId: String(doc._id),
        targetName: doc.filename,
      },
      { status: 403, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  await DeleteRequest.updateMany(
    {
      partnerId,
      targetType: "case_document",
      targetId: doc._id,
      status: "pending",
    },
    { $set: { status: "obsolete", reviewerNote: "Target deleted directly." } }
  );

  doc.isDeleted = true;
  await doc.save();

  await logWorkflowActivity(guard.ctx, {
    action: "case_document.deleted" as never,
    targetType: "case",
    targetId: String(doc.caseId),
    targetName: doc.filename,
    message: `removed document **${doc.filename}**`,
    metadata: { documentId: String(doc._id), size: doc.size },
  });

  return NextResponse.json(
    { ok: true },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
