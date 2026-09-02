import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { TutorialMedia, type ITutorialMedia } from "@/models/TutorialMedia";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

// GET — the mobile tutorial list. Only active, non-deleted items, in display
// order. Each row's binary is fetched from /api/mobile/tutorials/[id]/file.
export async function GET(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const docs = await TutorialMedia.find({ isActive: true, isDeleted: false })
    .sort({ order: 1, createdAt: -1 })
    .lean();

  const tutorials = docs.map((d) => {
    const t = d as ITutorialMedia;
    return {
      id: String(t._id),
      title: t.title,
      description: t.description,
      kind: t.kind,
      size: t.size,
      contentType: t.contentType,
    };
  });

  return NextResponse.json({ tutorials }, { headers: corsHeaders() });
}
