import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Case } from "@/models/Case";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { logWorkflowActivity } from "@/lib/activity";

// Bulk restore (reopen) for the Disposed archive. Office-admin only — the
// same gate the bulk delete + export use. Each selected matter is brought
// back into the live vault: disposedAt is cleared and the status reset to
// "Filed", mirroring the single Reopen button. A disposed matter keeps its
// CNR locked while archived (the unique index scopes to isDeleted:false,
// which disposed-but-not-deleted rows satisfy), so restoring it cannot
// collide — but we still restore per-row and report any write that fails,
// so one bad row never sinks the whole batch.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

const MAX_BULK = 5000;

type Body = { ids?: unknown };

export async function POST(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  if (guard.ctx.user.role !== "admin") {
    return NextResponse.json(
      { error: "Only the office admin can restore matters." },
      { status: 403, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);

  const ids = Array.isArray(body.ids)
    ? body.ids
        .filter(
          (x): x is string =>
            typeof x === "string" && mongoose.isValidObjectId(x)
        )
        .slice(0, MAX_BULK)
        .map((x) => new mongoose.Types.ObjectId(x))
    : [];
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "No matters selected to restore." },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  // Only this partner's archived (disposed, non-deleted) matters are eligible.
  const targets = await Case.find({
    partnerId,
    isDeleted: false,
    disposedAt: { $ne: null },
    _id: { $in: ids },
  })
    .select("_id caseNo")
    .limit(MAX_BULK)
    .lean();

  if (targets.length === 0) {
    return NextResponse.json(
      { ok: true, restored: 0, skipped: 0 },
      { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  let restored = 0;
  let firstName = "";
  const skipped: string[] = [];
  for (const t of targets) {
    try {
      await Case.updateOne(
        {
          _id: t._id,
          partnerId,
          isDeleted: false,
          disposedAt: { $ne: null },
        },
        { $set: { status: "Filed", disposedAt: null } }
      );
      restored++;
      if (!firstName) firstName = t.caseNo || "a matter";
    } catch {
      skipped.push(t.caseNo || String(t._id));
    }
  }

  if (restored > 0) {
    await logWorkflowActivity(guard.ctx, {
      action: "case.reopened",
      targetType: "case",
      targetId: String(targets[0]._id),
      targetName: restored === 1 ? firstName : `${restored} matters`,
      message:
        restored === 1
          ? `reopened case **${firstName}**`
          : `reopened **${restored} matters** from the archive`,
      metadata: { count: restored, skipped: skipped.length },
    });
  }

  return NextResponse.json(
    { ok: true, restored, skipped: skipped.length, skippedNames: skipped },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
