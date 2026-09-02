import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Case } from "@/models/Case";
import { CaseDocument, type ICaseDocument } from "@/models/CaseDocument";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { logWorkflowActivity } from "@/lib/activity";
import { getDocsBucket } from "@/lib/gridfs";
import {
  kindForFilename,
  resolveContentType,
  MAX_DOC_BYTES,
  MAX_DOC_LABEL,
} from "@/lib/case-docs";

// GridFS streaming needs the full Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Up to this many files in one request. Total per case is unlimited — this
// only bounds how much we buffer in memory per upload; the UI tells the
// user to send the rest in another batch.
const MAX_FILES_PER_REQUEST = 12;

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

function serialize(d: ICaseDocument) {
  return {
    id: String(d._id),
    filename: d.filename,
    contentType: d.contentType,
    size: d.size,
    uploadedByName: d.uploadedByName,
    uploadedByUserId: d.uploadedByUserId ? String(d.uploadedByUserId) : null,
    createdAt: d.createdAt.toISOString(),
  };
}

async function loadCase(id: string, partnerId: mongoose.Types.ObjectId) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Case.findOne({
    _id: new mongoose.Types.ObjectId(id),
    partnerId,
    isDeleted: false,
  })
    .select("_id")
    .lean();
}

// GET — list the case's documents, newest first.
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);

  const theCase = await loadCase(id, partnerId);
  if (!theCase) {
    return NextResponse.json(
      { error: "Case not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const docs = await CaseDocument.find({
    partnerId,
    caseId: theCase._id,
    isDeleted: false,
  })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json(
    { documents: docs.map((d) => serialize(d as ICaseDocument)) },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}

// POST — upload one or more files (multipart/form-data, field "files").
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);

  const theCase = await loadCase(id, partnerId);
  if (!theCase) {
    return NextResponse.json(
      { error: "Case not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected a multipart/form-data upload." },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const files = form
    .getAll("files")
    .filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json(
      { error: "No files were attached." },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }
  if (files.length > MAX_FILES_PER_REQUEST) {
    return NextResponse.json(
      {
        error: `Please upload up to ${MAX_FILES_PER_REQUEST} files at a time.`,
      },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const uploadedByName =
    `${guard.ctx.user.firstName} ${guard.ctx.user.lastName}`.trim() ||
    guard.ctx.user.email;
  const uploadedByUserId = guard.ctx.user.id
    ? new mongoose.Types.ObjectId(guard.ctx.user.id)
    : null;

  const bucket = await getDocsBucket();
  const created: ReturnType<typeof serialize>[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const kind = kindForFilename(file.name);
    if (!kind) {
      errors.push(`${file.name}: unsupported type (use PDF, Word or images).`);
      continue;
    }
    if (file.size === 0) {
      errors.push(`${file.name}: the file is empty.`);
      continue;
    }
    if (file.size > MAX_DOC_BYTES) {
      errors.push(`${file.name}: larger than ${MAX_DOC_LABEL}.`);
      continue;
    }

    const contentType = resolveContentType(file.name, file.type);

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const uploadStream = bucket.openUploadStream(file.name, {
        metadata: {
          partnerId: String(partnerId),
          caseId: String(theCase._id),
          uploadedByUserId: uploadedByUserId ? String(uploadedByUserId) : null,
          // The driver dropped the top-level contentType option; we keep
          // the authoritative copy on the CaseDocument row (served on
          // download) and stash one here for completeness.
          contentType,
        },
      });
      await new Promise<void>((resolve, reject) => {
        uploadStream.on("error", reject);
        uploadStream.on("finish", () => resolve());
        uploadStream.end(buffer);
      });

      const doc = await CaseDocument.create({
        partnerId,
        caseId: theCase._id,
        gridfsId: uploadStream.id,
        filename: file.name,
        contentType,
        size: file.size,
        uploadedByUserId,
        uploadedByName,
      });
      created.push(serialize(doc.toObject() as ICaseDocument));
    } catch (err) {
      console.error(`[case-docs] upload failed for ${file.name}:`, err);
      errors.push(`${file.name}: couldn't be stored. Try again.`);
    }
  }

  if (created.length === 0) {
    return NextResponse.json(
      { error: errors[0] || "No files were stored.", errors },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  // One audit line per upload batch (not per file) so the activity feed
  // reads naturally.
  await logWorkflowActivity(guard.ctx, {
    action: "case_document.added" as never,
    targetType: "case",
    targetId: String(theCase._id),
    targetName: created.length === 1 ? created[0].filename : `${created.length} files`,
    message:
      created.length === 1
        ? `added document **${created[0].filename}**`
        : `added **${created.length}** documents`,
    metadata: { count: created.length },
  });

  return NextResponse.json(
    { ok: true, documents: created, errors },
    { status: 201, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
