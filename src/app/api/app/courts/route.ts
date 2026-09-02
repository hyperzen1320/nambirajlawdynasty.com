import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Court } from "@/models/Court";
import { Case } from "@/models/Case";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { logWorkflowActivity } from "@/lib/activity";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

export async function GET(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);

  const docs = await Court.find({ partnerId, isDeleted: false })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  // Aggregate case counts per court — by id (preferred), with name fallback.
  const caseAgg = await Case.aggregate<{
    _id: { id: mongoose.Types.ObjectId | null; name: string };
    count: number;
  }>([
    // Active cases only — the "X matters" badge on a court card means
    // active matters before that bench, not the lifetime archive.
    { $match: { partnerId, isDeleted: false, disposedAt: null } },
    {
      $group: {
        _id: { id: "$courtId", name: { $toLower: "$courtName" } },
        count: { $sum: 1 },
      },
    },
  ]);

  const byId = new Map<string, number>();
  const byName = new Map<string, number>();
  for (const row of caseAgg) {
    if (row._id.id) {
      byId.set(String(row._id.id), (byId.get(String(row._id.id)) ?? 0) + row.count);
    }
    if (row._id.name) {
      byName.set(row._id.name, (byName.get(row._id.name) ?? 0) + row.count);
    }
  }

  const courts = docs.map((c) => {
    const byIdCount = byId.get(String(c._id)) ?? 0;
    const byNameCount = byName.get((c.name || "").toLowerCase()) ?? 0;
    const caseCount = byIdCount > 0 ? byIdCount : byNameCount;
    return {
      id: String(c._id),
      name: c.name,
      number: c.number,
      place: c.place,
      caseCount,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  });

  return NextResponse.json(
    { courts },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}

export async function POST(request: Request) {
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

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json(
      { error: "Court name is required." },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const str = (k: string): string =>
    typeof body[k] === "string" ? (body[k] as string).trim() : "";

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);

  const doc = await Court.create({
    partnerId,
    name,
    number: str("number"),
    place: str("place"),
    createdBy: guard.ctx.user.id
      ? new mongoose.Types.ObjectId(guard.ctx.user.id)
      : null,
  });

  await logWorkflowActivity(guard.ctx, {
    action: "court.created",
    targetType: "court",
    targetId: String(doc._id),
    targetName: doc.name,
    message: `added court **${doc.name}**${doc.place ? `, ${doc.place}` : ""}`,
    metadata: { number: doc.number, place: doc.place },
  });

  return NextResponse.json(
    {
      ok: true,
      court: {
        id: String(doc._id),
        name: doc.name,
        number: doc.number,
        place: doc.place,
        caseCount: 0,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
      },
    },
    { status: 201, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
