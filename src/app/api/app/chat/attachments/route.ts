import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { getChatBucket } from "@/lib/gridfs";
import {
  kindForFilename,
  resolveContentType,
  MAX_DOC_BYTES,
  MAX_DOC_LABEL,
} from "@/lib/case-docs";

// GridFS streaming needs the full Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILES_PER_REQUEST = 6;

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

// POST — upload one or more chat attachments (multipart, field "files").
// Returns metadata the composer holds until the message is sent; the bytes
// live in the chat_attachments GridFS bucket, partner-scoped on download.
export async function POST(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;
  const headers = guard.ctx.isMobile ? corsHeaders() : undefined;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected a multipart/form-data upload." },
      { status: 400, headers }
    );
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No files were attached." }, { status: 400, headers });
  }
  if (files.length > MAX_FILES_PER_REQUEST) {
    return NextResponse.json(
      { error: `Attach up to ${MAX_FILES_PER_REQUEST} files at a time.` },
      { status: 400, headers }
    );
  }

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);
  const uploaderId = guard.ctx.user.id
    ? new mongoose.Types.ObjectId(guard.ctx.user.id)
    : null;
  const bucket = await getChatBucket();

  const attachments: Array<{
    id: string;
    filename: string;
    contentType: string;
    size: number;
  }> = [];
  const errors: string[] = [];

  for (const file of files) {
    if (!kindForFilename(file.name)) {
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
          uploadedByUserId: uploaderId ? String(uploaderId) : null,
          contentType,
        },
      });
      await new Promise<void>((resolve, reject) => {
        uploadStream.on("error", reject);
        uploadStream.on("finish", () => resolve());
        uploadStream.end(buffer);
      });
      attachments.push({
        id: String(uploadStream.id),
        filename: file.name,
        contentType,
        size: file.size,
      });
    } catch (err) {
      console.error(`[chat-attachments] upload failed for ${file.name}:`, err);
      errors.push(`${file.name}: couldn't be stored. Try again.`);
    }
  }

  if (attachments.length === 0) {
    return NextResponse.json(
      { error: errors[0] || "No files were stored.", errors },
      { status: 400, headers }
    );
  }

  return NextResponse.json({ ok: true, attachments, errors }, { status: 201, headers });
}
