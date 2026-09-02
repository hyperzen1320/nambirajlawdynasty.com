import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { connectDB } from "@/lib/db";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { getChatBucket } from "@/lib/gridfs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

function contentDisposition(type: "inline" | "attachment", name: string) {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

// GET — stream a chat attachment. Partner-scoped: the GridFS file's metadata
// carries the owning partnerId, and we only serve it to the same chambers.
// Inline by default (images/PDFs preview); ?download=1 forces a save.
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;
  const headers = guard.ctx.isMobile ? corsHeaders() : undefined;

  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  }

  await connectDB();
  const bucket = await getChatBucket();
  const fileId = new mongoose.Types.ObjectId(id);

  const entries = await bucket.find({ _id: fileId }).limit(1).toArray();
  const entry = entries[0];
  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  }
  // Tenant guard — never serve another chambers' attachment.
  const ownerPartner = (entry.metadata as { partnerId?: string } | undefined)?.partnerId;
  if (ownerPartner && ownerPartner !== guard.ctx.user.partnerId) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  }

  const contentType =
    (entry.metadata as { contentType?: string } | undefined)?.contentType ||
    "application/octet-stream";
  const filename = entry.filename || "attachment";
  const asAttachment = new URL(request.url).searchParams.get("download") === "1";

  // Saving a shared file to disk is office-admin only, matching the case
  // briefcase. Everyone in chambers can still VIEW it — images render in
  // the lightbox and PDFs open inline — but pulling the raw file out of
  // the office is a decision that belongs to the admin.
  if (asAttachment && guard.ctx.user.role !== "admin") {
    return NextResponse.json(
      { error: "Only the office admin can download shared files." },
      { status: 403, headers }
    );
  }

  const nodeStream = bucket.openDownloadStream(fileId);
  const webStream = Readable.toWeb(
    nodeStream
  ) as unknown as ReadableStream<Uint8Array>;

  return new Response(webStream as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition(
        asAttachment ? "attachment" : "inline",
        filename
      ),
      "Content-Length": String(entry.length),
      "Cache-Control": "private, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      ...(guard.ctx.isMobile ? corsHeaders() : {}),
    },
  });
}
