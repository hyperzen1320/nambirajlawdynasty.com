import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Case } from "@/models/Case";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { logWorkflowActivity } from "@/lib/activity";
import { normalizeCnr, findCnrConflict, isDuplicateKeyError } from "@/lib/cnr";
import type { ParsedCaseRow } from "@/lib/case-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hard cap so a malformed payload can't ask us to insert tens of thousands
// of rows in one go.
const MAX_IMPORT_ROWS = 1000;

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

function dateFromIso(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

// POST — commit the reviewed rows. caseNo is required; a non-blank CNR that
// collides (with the chambers or earlier in this batch) is skipped, mirroring
// the single-case create flow. Returns a created/skipped summary.
export async function POST(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;
  const headers = guard.ctx.isMobile ? corsHeaders() : undefined;

  const payload = (await request.json().catch(() => null)) as {
    rows?: ParsedCaseRow[];
    advocateId?: string | null;
  } | null;
  if (!payload || !Array.isArray(payload.rows)) {
    return NextResponse.json({ error: "Expected { rows: [...] }." }, {
      status: 400,
      headers,
    });
  }
  if (payload.rows.length === 0) {
    return NextResponse.json({ error: "No rows to import." }, { status: 400, headers });
  }
  if (payload.rows.length > MAX_IMPORT_ROWS) {
    return NextResponse.json(
      { error: `Import up to ${MAX_IMPORT_ROWS} cases at a time.` },
      { status: 400, headers }
    );
  }

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);
  // Who the imported matters belong to. The reviewer chooses this on the
  // import screen (default: unassigned). Previously every imported row was
  // blindly stamped with the uploader as its advocate.
  const createdBy =
    typeof payload.advocateId === "string" &&
    mongoose.isValidObjectId(payload.advocateId)
      ? new mongoose.Types.ObjectId(payload.advocateId)
      : null;

  const created: string[] = [];
  const skipped: Array<{ caseNo: string; reason: string }> = [];
  const seenCnr = new Set<string>();

  for (const raw of payload.rows) {
    const caseNo = str(raw.caseNo);
    if (!caseNo) {
      skipped.push({ caseNo: caseNo || "(blank)", reason: "No case number" });
      continue;
    }

    const cnr = normalizeCnr(raw.cnr);
    if (cnr) {
      if (seenCnr.has(cnr)) {
        skipped.push({ caseNo, reason: "Duplicate CNR within import" });
        continue;
      }
      const conflict = await findCnrConflict({ partnerId, cnr });
      if (conflict) {
        skipped.push({ caseNo, reason: "CNR already on record" });
        continue;
      }
    }

    try {
      const doc = await Case.create({
        partnerId,
        caseNo,
        fileNo: str(raw.fileNo),
        cnr,
        title: "",
        clientName: str(raw.clientName),
        clientPhone: str(raw.clientPhone),
        clientWhatsapp: str(raw.clientWhatsapp),
        clientAddress: str(raw.clientAddress),
        oppositeParty: str(raw.oppositeParty),
        oppositeAdvocate: str(raw.oppositeAdvocate),
        appearingFor: str(raw.appearingFor),
        iaNumbers: str(raw.iaNumbers),
        courtId: null,
        courtName: str(raw.courtName),
        courtPlace: str(raw.courtPlace),
        courtHall: str(raw.courtHall),
        status: str(raw.status) || "Filed",
        nextHearingDate: dateFromIso(raw.nextHearingDate),
        lastHearingDate: dateFromIso(raw.lastHearingDate),
        createdBy,
      });
      created.push(String(doc._id));
      if (cnr) seenCnr.add(cnr);
    } catch (err) {
      // The unique index fired between our check and the insert.
      if (isDuplicateKeyError(err)) {
        skipped.push({ caseNo, reason: "CNR already on record" });
        continue;
      }
      skipped.push({ caseNo, reason: "Couldn't be saved" });
    }
  }

  if (created.length > 0) {
    await logWorkflowActivity(guard.ctx, {
      action: "case.created",
      targetType: "case",
      targetId: created[0],
      targetName: `${created.length} cases`,
      message: `imported **${created.length}** case${created.length === 1 ? "" : "s"}`,
      metadata: { imported: created.length, skipped: skipped.length },
    });
  }

  return NextResponse.json(
    { ok: true, created: created.length, skipped },
    { status: 201, headers }
  );
}
