import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { TutorialMedia, type ITutorialMedia } from "@/models/TutorialMedia";
import { requireAdmin } from "@/lib/admin-auth";
import { corsHeaders } from "@/lib/cors";
import { logActivity } from "@/lib/activity";
import { getTutorialBucket } from "@/lib/gridfs";
import {
  kindForContentType,
  kindForFilename,
  resolveTutorialContentType,
  MAX_TUTORIAL_BYTES,
  MAX_TUTORIAL_LABEL,
} from "@/lib/tutorial-media";

// GridFS streaming needs the full Node runtime; never cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

// Admin-facing serialization — carries everything the manager UI renders.
function serialize(t: ITutorialMedia) {
  return {
    id: String(t._id),
    title: t.title,
    description: t.description,
    kind: t.kind,
    filename: t.filename,
    contentType: t.contentType,
    size: t.size,
    order: t.order,
    isActive: t.isActive,
    uploadedByName: t.uploadedByName,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

// GET — list every non-deleted tutorial in display order.
export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const docs = await TutorialMedia.find({ isDeleted: false })
    .sort({ order: 1, createdAt: -1 })
    .lean();

  return NextResponse.json(
    { tutorials: docs.map((d) => serialize(d as ITutorialMedia)) },
    { headers: corsHeaders() }
  );
}

// POST — upload one tutorial (multipart/form-data: title, description, order,
// file). Streams the binary straight into GridFS so a 200 MB video never has
// to be buffered whole in memory.
export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if ("error" in guard) return guard.error;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected a multipart/form-data upload." },
      { status: 400, headers: corsHeaders() }
    );
  }

  const titleRaw = form.get("title");
  const title = typeof titleRaw === "string" ? titleRaw.trim() : "";
  if (!title) {
    return NextResponse.json(
      { error: "A title is required." },
      { status: 400, headers: corsHeaders() }
    );
  }

  const descriptionRaw = form.get("description");
  const description =
    typeof descriptionRaw === "string" ? descriptionRaw.trim() : "";

  const orderRaw = form.get("order");
  const parsedOrder =
    typeof orderRaw === "string" && orderRaw.trim() !== ""
      ? Number.parseInt(orderRaw, 10)
      : 0;
  const order = Number.isFinite(parsedOrder) ? parsedOrder : 0;

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No file was attached." },
      { status: 400, headers: corsHeaders() }
    );
  }
  if (file.size === 0) {
    return NextResponse.json(
      { error: "The file is empty." },
      { status: 400, headers: corsHeaders() }
    );
  }
  if (file.size > MAX_TUTORIAL_BYTES) {
    return NextResponse.json(
      { error: `The file is larger than ${MAX_TUTORIAL_LABEL}.` },
      { status: 413, headers: corsHeaders() }
    );
  }

  // Classify by content type first, fall back to extension so an
  // octet-stream video still lands in the right kind.
  const kind = kindForContentType(file.type) ?? kindForFilename(file.name);
  if (!kind) {
    return NextResponse.json(
      {
        error:
          "Unsupported file type. Upload a video (mp4, mov, webm, m4v), image (jpg, png, webp, gif) or PDF.",
      },
      { status: 400, headers: corsHeaders() }
    );
  }

  const contentType = resolveTutorialContentType(file.name, file.type);
  const uploadedByName =
    `${guard.ctx.user.firstName} ${guard.ctx.user.lastName}`.trim() ||
    guard.ctx.user.email;

  const bucket = await getTutorialBucket();
  const uploadStream = bucket.openUploadStream(file.name, {
    metadata: {
      kind,
      contentType,
      uploadedByName,
      uploadedByUserId: guard.ctx.user.id || null,
    },
  });

  try {
    // Stream File -> GridFS without buffering the whole payload.
    await pipeline(
      Readable.fromWeb(
        file.stream() as unknown as Parameters<typeof Readable.fromWeb>[0]
      ),
      uploadStream
    );
  } catch (err) {
    console.error("[tutorials] upload failed:", err);
    // Best-effort cleanup of the orphaned GridFS file.
    try {
      await bucket.delete(uploadStream.id);
    } catch {
      /* ignore */
    }
    return NextResponse.json(
      { error: "The file couldn't be stored. Try again." },
      { status: 500, headers: corsHeaders() }
    );
  }

  const doc = await TutorialMedia.create({
    title,
    description,
    kind,
    gridfsId: uploadStream.id,
    filename: file.name,
    contentType,
    size: file.size,
    order,
    uploadedByName,
  });

  await logActivity({
    actor: {
      id: guard.ctx.user.id,
      name: uploadedByName,
      email: guard.ctx.user.email,
      type: "global_admin",
    },
    action: "tutorial_created",
    targetType: "system",
    targetId: String(doc._id),
    targetName: doc.title,
    message: `Added tutorial "${doc.title}" (${doc.kind}).`,
    metadata: {
      kind: doc.kind,
      size: doc.size,
      contentType: doc.contentType,
      via: guard.ctx.isMobile ? "mobile" : "web",
    },
    partnerId: null,
  });

  return NextResponse.json(
    { ok: true, tutorial: serialize(doc.toObject() as ITutorialMedia) },
    { status: 201, headers: corsHeaders() }
  );
}
