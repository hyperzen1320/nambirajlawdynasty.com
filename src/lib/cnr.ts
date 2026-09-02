import mongoose from "mongoose";
import { Case } from "@/models/Case";

// CNR (Case Number Record) is the 16-character nationally-unique
// identifier the Indian eCourts system stamps on every matter. Because
// it's unique *nationally*, it must be unique within a single chambers
// too — two matters in the same office can share a client name, a file
// number, parties, anything, but never a CNR. A duplicate CNR is always
// a data-entry error (usually the same case keyed twice).
//
// Enforcement is two-layered:
//   1. This module's findCnrConflict() runs before every create/update
//      so the user gets a clear, specific error naming the matter the
//      CNR already belongs to.
//   2. A partial unique index on the Case collection (see Case.ts) is
//      the race-condition backstop — two simultaneous writes that both
//      pass the app check still can't both land.

// Canonical form stored on write. CNRs are conventionally all-uppercase
// alphanumeric, so upper-casing is canonicalisation, not mutation — it
// also means the unique index doesn't need a case-insensitive collation
// to treat "tnch01…" and "TNCH01…" as the same code.
export function normalizeCnr(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toUpperCase() : "";
}

// Looks for another live (non-deleted) case in the same chambers that
// already carries this CNR. The match is case-insensitive via collation
// so it also catches any legacy rows stored before normalisation began.
// Returns the conflicting matter's identifying fields, or null when the
// CNR is free (or blank — blank CNRs are never deduplicated).
export async function findCnrConflict(opts: {
  partnerId: mongoose.Types.ObjectId;
  cnr: string;
  excludeId?: mongoose.Types.ObjectId | null;
}): Promise<{ id: string; caseNo: string; fileNo: string } | null> {
  const cnr = opts.cnr.trim();
  if (!cnr) return null;

  const query: Record<string, unknown> = {
    partnerId: opts.partnerId,
    isDeleted: false,
    cnr,
  };
  if (opts.excludeId) {
    query._id = { $ne: opts.excludeId };
  }

  const dup = await Case.findOne(query)
    .collation({ locale: "en", strength: 2 })
    .select("caseNo fileNo")
    .lean();

  return dup
    ? { id: String(dup._id), caseNo: dup.caseNo, fileNo: dup.fileNo }
    : null;
}

// Shared phrasing so the POST and PATCH endpoints surface an identical,
// specific message ("…already used by O.S. 100/2025 · File F-2025/001").
export function cnrConflictMessage(conflict: {
  caseNo: string;
  fileNo: string;
}): string {
  const ref =
    [conflict.caseNo, conflict.fileNo ? `File ${conflict.fileNo}` : ""]
      .filter(Boolean)
      .join(" · ") || "another matter";
  return `That CNR is already on record under ${ref}. A CNR can belong to only one matter — check the number, or open that case to update it.`;
}

// True when a thrown error is a MongoDB duplicate-key violation. Used to
// translate the unique-index backstop firing into the same friendly 409
// the app-level check would have returned.
export function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}
