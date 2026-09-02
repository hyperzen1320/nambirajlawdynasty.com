import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Case } from "@/models/Case";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { logWorkflowActivity } from "@/lib/activity";
import { DeleteRequest } from "@/models/DeleteRequest";
import {
  buildCaseFilter,
  readCaseFilterParams,
  type CaseFilterInput,
} from "@/lib/case-filter";

// Permanent bulk delete for the Case Vault. Office-admin only — the same
// gate the per-row DELETE and the export endpoint use. A deleted matter
// is flipped to isDeleted:true, which removes it from every list AND
// frees its CNR (the unique index + lib/cnr both scope to isDeleted:false),
// so the partner can re-enter a matter under a previously-used CNR.
//
// Two modes:
//   • { ids: [...] }            — delete an explicit selection.
//   • { all: true, filters }    — delete every ACTIVE matter matching the
//                                 current Case Vault filter tuple (this is
//                                 the "Select all N matters → Delete" path
//                                 that spans pages). buildCaseFilter already
//                                 scopes to active (isDeleted:false,
//                                 disposedAt:null), so the archive is never
//                                 touched.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

// Hard ceiling on a single bulk delete. Matches the export cap so the two
// power operations behave consistently on a large register.
const MAX_BULK = 5000;

type Body = {
  ids?: unknown;
  all?: unknown;
  filters?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  // partner_admin is coerced to role "admin"; everyone else is blocked so
  // a crafted POST can't wipe matters without the office admin's hand.
  if (guard.ctx.user.role !== "admin") {
    return NextResponse.json(
      { error: "Only the office admin can delete matters." },
      { status: 403, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);

  let filter: Record<string, unknown>;
  if (body.all === true) {
    const filterInput: CaseFilterInput = {
      partnerId,
      ...readCaseFilterParams(
        body.filters && typeof body.filters === "object" ? body.filters : {}
      ),
      // Force active scope — bulk delete only ever touches the live vault,
      // never the disposed archive (which has its own per-row delete).
      scope: "active",
    };
    filter = buildCaseFilter(filterInput);
  } else {
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
        { error: "No matters selected to delete." },
        { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
      );
    }
    filter = { partnerId, isDeleted: false, _id: { $in: ids } };
  }

  // Resolve the exact set first: we need the ids for the delete-request
  // cleanup and an honest count for the response + activity line.
  const targets = await Case.find(filter)
    .select("_id caseNo")
    .limit(MAX_BULK)
    .lean();

  if (targets.length === 0) {
    return NextResponse.json(
      { ok: true, deleted: 0 },
      { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const targetIds = targets.map((t) => t._id);

  await Case.updateMany(
    { partnerId, _id: { $in: targetIds }, isDeleted: false },
    { $set: { isDeleted: true } }
  );

  // Any pending delete-requests for these matters are now moot.
  await DeleteRequest.updateMany(
    {
      partnerId,
      targetType: "case",
      targetId: { $in: targetIds },
      status: "pending",
    },
    { $set: { status: "obsolete", reviewerNote: "Target deleted directly." } }
  );

  const count = targets.length;
  await logWorkflowActivity(guard.ctx, {
    action: "case.deleted",
    targetType: "case",
    targetId: String(targetIds[0]),
    targetName:
      count === 1 ? targets[0].caseNo || "a matter" : `${count} matters`,
    message:
      count === 1
        ? `deleted case **${targets[0].caseNo || "a matter"}**`
        : `permanently deleted **${count} matters**`,
    metadata: { count },
  });

  return NextResponse.json(
    { ok: true, deleted: count },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
