import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { connectDB } from "@/lib/db";
import { TutorialMedia } from "@/models/TutorialMedia";
import { requireAdmin } from "@/lib/admin-auth";
import { corsHeaders } from "@/lib/cors";
import { getTutorialBucket } from "@/lib/gridfs";

// GridFS streaming + Node stream interop need the full Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

// RFC 6266 / 5987 — plain-ASCII fallback for old clients plus the UTF-8 form.
function contentDisposition(name: string) {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(
    name
  )}`;
}

// GET — stream the binary inline for the admin preview.
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requireAdmin(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json(
      { error: "Tutorial not found" },
      { status: 404, headers: corsHeaders() }
    );
  }

  const tutorial = await TutorialMedia.findOne({
    _id: new mongoose.Types.ObjectId(id),
    isDeleted: false,
  }).lean();
  if (!tutorial) {
    return NextResponse.json(
      { error: "Tutorial not found" },
      { status: 404, headers: corsHeaders() }
    );
  }

  const bucket = await getTutorialBucket();

  // Confirm the binary is present before we open a streaming response (once
  // bytes start flowing we can't switch to a clean 404).
  const fileEntry = await bucket
    .find({ _id: tutorial.gridfsId })
    .limit(1)
    .toArray();
  if (fileEntry.length === 0) {
    return NextResponse.json(
      { error: "The stored file is missing." },
      { status: 404, headers: corsHeaders() }
    );
  }

  const nodeStream = bucket.openDownloadStream(tutorial.gridfsId);
  const webStream = Readable.toWeb(
    nodeStream
  ) as unknown as ReadableStream<Uint8Array>;

  return new Response(webStream as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": tutorial.contentType || "application/octet-stream",
      "Content-Disposition": contentDisposition(
        tutorial.filename || tutorial.title
      ),
      "Content-Length": String(fileEntry[0].length ?? tutorial.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=0, must-revalidate",
      // Defence-in-depth for admin-supplied files served from our origin.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      ...(guard.ctx.isMobile ? corsHeaders() : {}),
    },
  });
}
