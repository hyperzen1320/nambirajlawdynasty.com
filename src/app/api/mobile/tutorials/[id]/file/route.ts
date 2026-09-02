import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { connectDB } from "@/lib/db";
import { TutorialMedia } from "@/models/TutorialMedia";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { getTutorialBucket } from "@/lib/gridfs";

// GridFS streaming + Node stream interop need the full Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

type RangeResult =
  | { type: "full" }
  | { type: "unsatisfiable" }
  | { type: "partial"; start: number; end: number };

// Parse a single-range `Range: bytes=start-end` header. Supports open-ended
// (`bytes=500-`) and suffix (`bytes=-500`) forms. Anything malformed, absent,
// or multi-range falls back to serving the whole file (a valid 200 response).
// `end` here is INCLUSIVE (HTTP semantics).
function parseRange(rangeHeader: string, total: number): RangeResult {
  const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!m) return { type: "full" };

  const startStr = m[1];
  const endStr = m[2];
  if (startStr === "" && endStr === "") return { type: "full" };

  let start: number;
  let end: number;

  if (startStr === "") {
    // Suffix range: the final N bytes.
    const suffix = Number.parseInt(endStr, 10);
    if (!Number.isFinite(suffix) || suffix <= 0 || total === 0) {
      return { type: "unsatisfiable" };
    }
    start = Math.max(0, total - suffix);
    end = total - 1;
  } else {
    start = Number.parseInt(startStr, 10);
    end = endStr === "" ? total - 1 : Number.parseInt(endStr, 10);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return { type: "unsatisfiable" };
    }
    if (end > total - 1) end = total - 1;
  }

  if (total === 0 || start < 0 || start >= total || start > end) {
    return { type: "unsatisfiable" };
  }
  return { type: "partial", start, end };
}

// GET — stream the binary. Honours HTTP Range so mobile video players can
// seek. Called with an `Authorization: Bearer <token>` header.
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requirePartner(request);
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
    isActive: true,
    isDeleted: false,
  }).lean();
  if (!tutorial) {
    return NextResponse.json(
      { error: "Tutorial not found" },
      { status: 404, headers: corsHeaders() }
    );
  }

  const bucket = await getTutorialBucket();

  // Confirm the binary is present before we open a streaming response.
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

  // GridFS length is authoritative for range math.
  const total = fileEntry[0].length ?? tutorial.size;
  const contentType = tutorial.contentType || "application/octet-stream";

  const commonHeaders: Record<string, string> = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=0, must-revalidate",
    "X-Content-Type-Options": "nosniff",
    ...corsHeaders(),
  };

  const rangeHeader = request.headers.get("range");
  const parsed = rangeHeader ? parseRange(rangeHeader, total) : { type: "full" as const };

  if (parsed.type === "unsatisfiable") {
    // 416 — tell the client the valid extent.
    return new Response(null, {
      status: 416,
      headers: { ...commonHeaders, "Content-Range": `bytes */${total}` },
    });
  }

  if (parsed.type === "partial") {
    const { start, end } = parsed;
    // GridFS `end` is EXCLUSIVE, so add 1 to the inclusive HTTP end.
    const nodeStream = bucket.openDownloadStream(tutorial.gridfsId, {
      start,
      end: end + 1,
    });
    const webStream = Readable.toWeb(
      nodeStream
    ) as unknown as ReadableStream<Uint8Array>;
    return new Response(webStream as unknown as BodyInit, {
      status: 206,
      headers: {
        ...commonHeaders,
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }

  // Whole file.
  const nodeStream = bucket.openDownloadStream(tutorial.gridfsId);
  const webStream = Readable.toWeb(
    nodeStream
  ) as unknown as ReadableStream<Uint8Array>;
  return new Response(webStream as unknown as BodyInit, {
    status: 200,
    headers: { ...commonHeaders, "Content-Length": String(total) },
  });
}
