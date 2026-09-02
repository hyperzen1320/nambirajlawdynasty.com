import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Partner } from "@/models/Partner";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { loadHearingsBucket, type Bucket } from "@/lib/hearings-bucket";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

export async function GET(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  const url = new URL(request.url);
  const bucketParam = url.searchParams.get("bucket");
  const bucket: Bucket =
    bucketParam === "tomorrow" || bucketParam === "pending"
      ? bucketParam
      : "today";

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);

  const [{ items, counts }, partner] = await Promise.all([
    loadHearingsBucket(partnerId, bucket),
    Partner.findById(partnerId).lean(),
  ]);

  const officeName = partner?.branding?.officeName || partner?.name || "";

  return NextResponse.json(
    { bucket, items, counts, officeName },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
