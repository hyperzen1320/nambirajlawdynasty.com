import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Case } from "@/models/Case";
import { Partner } from "@/models/Partner";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { logWorkflowActivity } from "@/lib/activity";
import { canDirectDeleteGeneric } from "@/lib/delete-eligibility";
import { DeleteRequest } from "@/models/DeleteRequest";
import {
  normalizeCnr,
  findCnrConflict,
  cnrConflictMessage,
  isDuplicateKeyError,
} from "@/lib/cnr";

const VALID_STATUSES = [
  "Filed",
  "Notice",
  "Pleadings",
  "Issues",
  "Evidence",
  "Arguments",
  "Reserved",
  "Judgment",
  "Disposed",
];

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

async function loadCaseForPartner(
  id: string,
  partnerId: string
) {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();
  const partnerObj = new mongoose.Types.ObjectId(partnerId);
  const doc = await Case.findOne({
    _id: new mongoose.Types.ObjectId(id),
    partnerId: partnerObj,
    isDeleted: false,
  });
  return doc;
}

function serialize(c: NonNullable<Awaited<ReturnType<typeof loadCaseForPartner>>>) {
  return {
    id: String(c._id),
    caseNo: c.caseNo,
    fileNo: c.fileNo,
    cnr: c.cnr,
    title: c.title,
    clientName: c.clientName,
    clientPhone: c.clientPhone,
    clientWhatsapp: c.clientWhatsapp,
    clientAddress: c.clientAddress,
    oppositeParty: c.oppositeParty,
    appearingFor: c.appearingFor,
    oppositeAdvocate: c.oppositeAdvocate,
    iaNumbers: c.iaNumbers,
    courtId: c.courtId ? String(c.courtId) : null,
    courtName: c.courtName,
    courtNumber: c.courtNumber || "",
    courtHall: c.courtHall,
    courtPlace: c.courtPlace,
    status: c.status,
    nextHearingDate: c.nextHearingDate ? c.nextHearingDate.toISOString() : null,
    lastHearingDate: c.lastHearingDate ? c.lastHearingDate.toISOString() : null,
    hearings: c.hearings.map((h) => ({
      date: h.date.toISOString(),
      status: h.status,
      outcome: h.outcome,
      nextDate: h.nextDate ? h.nextDate.toISOString() : null,
    })),
    disposedAt: c.disposedAt ? c.disposedAt.toISOString() : null,
    disposalDate: c.disposalDate ? c.disposalDate.toISOString() : null,
    disposalRemarks: c.disposalRemarks || "",
    caStatus: c.caStatus || "",
    receivedByClient: Boolean(c.receivedByClient),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  const doc = await loadCaseForPartner(id, guard.ctx.user.partnerId);
  if (!doc) {
    return NextResponse.json(
      { error: "Case not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const partner = await Partner.findById(
    new mongoose.Types.ObjectId(guard.ctx.user.partnerId)
  ).lean();
  const officeName =
    partner?.branding?.officeName || partner?.name || "";

  return NextResponse.json(
    { case: serialize(doc), officeName },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
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

  const doc = await loadCaseForPartner(id, guard.ctx.user.partnerId);
  if (!doc) {
    return NextResponse.json(
      { error: "Case not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const before = {
    caseNo: doc.caseNo,
    status: doc.status,
    disposedAt: doc.disposedAt ? doc.disposedAt.toISOString() : null,
    nextHearingDate: doc.nextHearingDate
      ? doc.nextHearingDate.toISOString()
      : null,
    fieldsSnapshot: {
      fileNo: doc.fileNo,
      cnr: doc.cnr,
      title: doc.title,
      clientName: doc.clientName,
      clientPhone: doc.clientPhone,
      clientWhatsapp: doc.clientWhatsapp,
      clientAddress: doc.clientAddress,
      oppositeParty: doc.oppositeParty,
      appearingFor: doc.appearingFor,
      oppositeAdvocate: doc.oppositeAdvocate,
      iaNumbers: doc.iaNumbers,
      courtName: doc.courtName,
      courtHall: doc.courtHall,
      courtPlace: doc.courtPlace,
    } as Record<string, string>,
  };

  const stringFields = [
    "caseNo",
    "fileNo",
    "cnr",
    "title",
    "clientName",
    "clientPhone",
    "clientWhatsapp",
    "clientAddress",
    "oppositeParty",
    "appearingFor",
    "oppositeAdvocate",
    "iaNumbers",
    "courtName",
    "courtNumber",
    "courtHall",
    "courtPlace",
  ] as const;

  for (const f of stringFields) {
    if (typeof body[f] === "string") {
      doc[f] = (body[f] as string).trim();
    }
  }

  // CNR is normalised to its canonical upper-case form, then checked for
  // a clash with any OTHER live matter in the chambers. Only runs when
  // the CNR actually changed and isn't blank — editing a case without
  // touching its CNR must never trip over itself.
  if (typeof body.cnr === "string") {
    doc.cnr = normalizeCnr(body.cnr);
  }
  const cnrChanged =
    doc.cnr !== normalizeCnr(before.fieldsSnapshot.cnr);
  if (doc.cnr && cnrChanged) {
    const conflict = await findCnrConflict({
      partnerId: doc.partnerId,
      cnr: doc.cnr,
      excludeId: doc._id,
    });
    if (conflict) {
      return NextResponse.json(
        { error: cnrConflictMessage(conflict), code: "cnr_conflict" },
        {
          status: 409,
          headers: guard.ctx.isMobile ? corsHeaders() : undefined,
        }
      );
    }
  }

  // courtId is set/unset separately from the denormalised strings. The
  // form sends `courtId: "<id>"` when the user picks a court from the
  // Court Hub combobox, `courtId: null` to explicitly unlink, and just
  // omits the field when the user is only renaming the freeform string.
  if (typeof body.courtId === "string" && mongoose.isValidObjectId(body.courtId)) {
    doc.courtId = new mongoose.Types.ObjectId(body.courtId);
  } else if (body.courtId === null) {
    doc.courtId = null;
  }

  // Status — validate against known list but allow custom strings as well.
  // The one exception is "Disposed": that's the deletion lever and admins
  // are the only people authorised to pull it. Non-admins get a 403 with
  // a `delete_request_required` code so the client can pivot into the
  // Request-Delete flow (admin reviews + approves, then dispose happens).
  // Reopening a disposed case stays admin-only too — handled via the
  // status moving away from "Disposed" while currently disposed.
  if (typeof body.status === "string" && body.status.trim()) {
    const nextStatus = body.status.trim();
    const wantsToDispose =
      nextStatus === "Disposed" && doc.status !== "Disposed";
    const wantsToReopen =
      doc.status === "Disposed" && nextStatus !== "Disposed";
    const isAdmin = guard.ctx.user.role === "admin";
    if ((wantsToDispose || wantsToReopen) && !isAdmin) {
      return NextResponse.json(
        {
          error: wantsToDispose
            ? "Only the office admin can dispose a matter. Send a delete request and the admin will review."
            : "Only the office admin can reopen a disposed matter.",
          code: "delete_request_required",
          targetType: "case",
          targetId: String(doc._id),
          targetName: doc.caseNo,
        },
        {
          status: 403,
          headers: guard.ctx.isMobile ? corsHeaders() : undefined,
        }
      );
    }
    doc.status = nextStatus;
  }

  // Optional disposal remarks — captured when admin marks a case as
  // disposed and explains the order. Free-form, persisted regardless
  // of whether status itself changed (so admin can edit the remarks
  // later without re-disposing).
  if (typeof body.disposalRemarks === "string") {
    doc.disposalRemarks = body.disposalRemarks.trim();
  }

  // C.A. (certified-copy application) status + received-by-client flag —
  // the rest of the disposal record. Editable by an admin on an already-
  // disposed matter, same as the remarks, so they can track copies moving
  // Applied → Ready → Delivered after the matter is closed.
  if (typeof body.caStatus === "string") {
    doc.caStatus = body.caStatus.trim();
  }
  if (typeof body.receivedByClient === "boolean") {
    doc.receivedByClient = body.receivedByClient;
  }
  // The recorded disposal date — distinct from disposedAt (the system
  // archive timestamp): editable via the disposal form's date picker, and
  // what the archive shows/sorts by.
  if (typeof body.disposalDate === "string" || body.disposalDate === null) {
    doc.disposalDate =
      typeof body.disposalDate === "string" && body.disposalDate
        ? new Date(body.disposalDate)
        : null;
  }

  // Disposal lifecycle. The single source of truth for "is this case
  // archived" is `disposedAt`. We derive its value from status:
  //   • status transitions TO "Disposed"  → stamp disposedAt = now
  //   • status transitions AWAY            → clear disposedAt
  // Setting status to "Disposed" again on an already-disposed case
  // does NOT bump the timestamp, so the archive's chronology stays
  // honest. Active queries everywhere filter on disposedAt: null.
  const wasDisposed = before.status === "Disposed";
  const willBeDisposed = doc.status === "Disposed";
  if (!wasDisposed && willBeDisposed) {
    doc.disposedAt = new Date();
    // Default the recorded disposal date to today when the admin didn't
    // pick one, so the archive always has a date to show and sort by.
    if (!doc.disposalDate) doc.disposalDate = doc.disposedAt;
  } else if (wasDisposed && !willBeDisposed) {
    doc.disposedAt = null;
  }

  // Update next hearing — when changed, push the OLD nextHearingDate to
  // the hearings history and set lastHearingDate.
  if (typeof body.nextHearingDate === "string" || body.nextHearingDate === null) {
    const newNext =
      body.nextHearingDate && typeof body.nextHearingDate === "string"
        ? new Date(body.nextHearingDate)
        : null;
    const oldNext = doc.nextHearingDate;
    if (
      (oldNext && (!newNext || newNext.getTime() !== oldNext.getTime())) ||
      (!oldNext && newNext)
    ) {
      // archive previous hearing if there was one
      if (oldNext) {
        doc.hearings.push({
          date: oldNext,
          status: doc.status,
          outcome: "",
          nextDate: newNext,
        });
        doc.lastHearingDate = oldNext;
      }
      doc.nextHearingDate = newNext;
    }
  }

  // Explicit lastHearingDate edits — applied AFTER the auto-archival above
  // so that when the user edits a case retroactively (e.g. fixing a typo
  // in the previous date from the EditCaseForm), their value wins over
  // whatever the next-hearing change would have inferred.
  if (
    typeof body.lastHearingDate === "string" ||
    body.lastHearingDate === null
  ) {
    doc.lastHearingDate =
      typeof body.lastHearingDate === "string" && body.lastHearingDate
        ? new Date(body.lastHearingDate)
        : null;
  }

  try {
    await doc.save();
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      const conflict = doc.cnr
        ? await findCnrConflict({
            partnerId: doc.partnerId,
            cnr: doc.cnr,
            excludeId: doc._id,
          })
        : null;
      return NextResponse.json(
        {
          error: conflict
            ? cnrConflictMessage(conflict)
            : "That CNR is already on record under another matter.",
          code: "cnr_conflict",
        },
        {
          status: 409,
          headers: guard.ctx.isMobile ? corsHeaders() : undefined,
        }
      );
    }
    throw err;
  }

  // Activity logs — emit specific events for the noteworthy bits
  const changedFields: string[] = [];
  for (const f of stringFields) {
    if ((doc[f] || "") !== (before.fieldsSnapshot[f] || "")) {
      changedFields.push(f);
    }
  }
  if (changedFields.length > 0) {
    await logWorkflowActivity(guard.ctx, {
      action: "case.updated",
      targetType: "case",
      targetId: String(doc._id),
      targetName: doc.caseNo,
      message: `updated case **${doc.caseNo}** (${changedFields.join(", ")})`,
      metadata: { fields: changedFields },
    });
  }
  if (before.status !== doc.status) {
    await logWorkflowActivity(guard.ctx, {
      action: "case.status_changed",
      targetType: "case",
      targetId: String(doc._id),
      targetName: doc.caseNo,
      message: `set status of **${doc.caseNo}** to **${doc.status}**`,
      metadata: { from: before.status, to: doc.status },
    });
  }
  // Distinct life-cycle events on top of status_changed so the audit
  // feed surfaces "disposed" / "reopened" as their own headline rows
  // rather than just another status flip.
  if (!wasDisposed && willBeDisposed) {
    await logWorkflowActivity(guard.ctx, {
      action: "case.disposed",
      targetType: "case",
      targetId: String(doc._id),
      targetName: doc.caseNo,
      message: `disposed case **${doc.caseNo}**`,
      metadata: {
        disposedAt: doc.disposedAt?.toISOString() ?? null,
        remarks: doc.disposalRemarks || undefined,
      },
    });
  } else if (wasDisposed && !willBeDisposed) {
    await logWorkflowActivity(guard.ctx, {
      action: "case.reopened",
      targetType: "case",
      targetId: String(doc._id),
      targetName: doc.caseNo,
      message: `reopened case **${doc.caseNo}** (now **${doc.status}**)`,
      metadata: {
        previouslyDisposedAt: before.disposedAt,
        toStatus: doc.status,
      },
    });
  }
  const newNextIso = doc.nextHearingDate
    ? doc.nextHearingDate.toISOString()
    : null;
  if (before.nextHearingDate !== newNextIso) {
    await logWorkflowActivity(guard.ctx, {
      action: "case.hearing_updated",
      targetType: "case",
      targetId: String(doc._id),
      targetName: doc.caseNo,
      message: newNextIso
        ? `set next hearing for **${doc.caseNo}** to ${doc.nextHearingDate!.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
        : `cleared the next hearing on **${doc.caseNo}**`,
      metadata: { from: before.nextHearingDate, to: newNextIso },
    });
  }

  return NextResponse.json(
    { ok: true, case: serialize(doc) },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  const doc = await loadCaseForPartner(id, guard.ctx.user.partnerId);
  if (!doc) {
    return NextResponse.json(
      { error: "Case not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  // Cases are top-level — admin always; non-admin must raise a delete request.
  const eligibility = canDirectDeleteGeneric({
    isAdmin: guard.ctx.user.role === "admin",
    userId: guard.ctx.user.id,
  });
  if (!eligibility.ok) {
    return NextResponse.json(
      {
        error: eligibility.reason,
        code: "delete_request_required",
        targetType: "case",
        targetId: String(doc._id),
        targetName: doc.caseNo,
      },
      {
        status: 403,
        headers: guard.ctx.isMobile ? corsHeaders() : undefined,
      }
    );
  }

  await DeleteRequest.updateMany(
    {
      partnerId: doc.partnerId,
      targetType: "case",
      targetId: doc._id,
      status: "pending",
    },
    { $set: { status: "obsolete", reviewerNote: "Target deleted directly." } }
  );

  doc.isDeleted = true;
  await doc.save();

  await logWorkflowActivity(guard.ctx, {
    action: "case.deleted",
    targetType: "case",
    targetId: String(doc._id),
    targetName: doc.caseNo,
    message: `deleted case **${doc.caseNo}**`,
    metadata: { caseNo: doc.caseNo, fileNo: doc.fileNo, cnr: doc.cnr },
  });

  return NextResponse.json(
    { ok: true },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}

// Export valid statuses for clients that want them (the form uses its own list)
export { VALID_STATUSES };
