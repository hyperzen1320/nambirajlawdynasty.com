import mongoose from "mongoose";

// Shared filter builder for the Case Vault list and the export endpoint.
// Both surfaces have to apply the same set of filters — court, advocate,
// date range, search — so the table on screen and the file the user
// downloads always agree. Keeping the logic here means the API routes
// don't drift apart over time.

export type CaseScope = "active" | "disposed";

export type CaseFilterInput = {
  partnerId: mongoose.Types.ObjectId;
  // "active" (default) keeps the historic behaviour — Case Vault, Hearing
  // Track, dashboard. "disposed" flips to the archive: only matters with a
  // disposal date, and the date range applies to `disposedAt` instead of
  // the next hearing date.
  scope?: CaseScope | null;
  courtId?: string | null;
  courtPlace?: string | null;
  advocateId?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  search?: string | null;
  searchScope?: string | null;
};

const SEARCH_FIELDS = [
  "fileNo",
  "caseNo",
  "iaNumbers",
  "cnr",
  "clientName",
  "clientPhone",
  "clientWhatsapp",
  "appearingFor",
  "oppositeParty",
  "oppositeAdvocate",
  "courtName",
  "courtNumber",
  "courtHall",
  "courtPlace",
  "status",
] as const;

export type CaseSearchField = (typeof SEARCH_FIELDS)[number];

// Everything a matter gets remembered by. The opposite party, the
// opposing counsel and who we appear for were searchable columns the
// search never actually looked at — so typing the other side's name
// found nothing and the matter read as missing.
export const DEFAULT_SEARCH_SCOPE: CaseSearchField[] = [
  "fileNo",
  "caseNo",
  "iaNumbers",
  "cnr",
  "clientName",
  "clientPhone",
  "clientWhatsapp",
  "appearingFor",
  "oppositeParty",
  "oppositeAdvocate",
  "courtName",
  "courtNumber",
  "courtHall",
  "courtPlace",
  "status",
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Returns a Mongo filter document for the Case collection. Defaults to
// the active-case constraints (not deleted, not disposed); pass
// scope: "disposed" to query the archive instead.
export function buildCaseFilter(
  input: CaseFilterInput
): Record<string, unknown> {
  const scope: CaseScope = input.scope === "disposed" ? "disposed" : "active";
  const filter: Record<string, unknown> = {
    partnerId: input.partnerId,
    isDeleted: false,
  };
  // disposedAt is set below — for active it's null; for disposed it's
  // { $ne: null }, optionally narrowed by the disposal-date range.

  if (input.courtId && mongoose.isValidObjectId(input.courtId)) {
    filter.courtId = new mongoose.Types.ObjectId(input.courtId);
  }

  if (input.courtPlace && input.courtPlace.trim()) {
    // Case-insensitive exact match on the trimmed place. Court Hub seeds
    // give the same string for cases in the same town, so equality is
    // good enough; if a chambers has typos we'd surface that in the
    // dropdown by showing both.
    filter.courtPlace = new RegExp(
      `^${escapeRegex(input.courtPlace.trim())}$`,
      "i"
    );
  }

  if (input.advocateId && mongoose.isValidObjectId(input.advocateId)) {
    // The "by which advocate is handling how many cases" filter uses
    // the createdBy field — that's the user who filed the matter in
    // the system, which is the closest proxy we have for "the advocate
    // owning it." When (if) an explicit assignee field gets added we
    // swap this line.
    filter.createdBy = new mongoose.Types.ObjectId(input.advocateId);
  }

  const dateRange: Record<string, Date> = {};
  if (input.fromDate) {
    const d = parseDate(input.fromDate);
    if (d) dateRange.$gte = d;
  }
  if (input.toDate) {
    const d = parseDate(input.toDate);
    if (d) {
      // Inclusive — capture the full end-of-day so a matter listed at
      // 11pm on the toDate still shows.
      d.setHours(23, 59, 59, 999);
      dateRange.$lte = d;
    }
  }
  const hasRange = Object.keys(dateRange).length > 0;

  if (scope === "disposed") {
    // Archive: disposed matters only. A date range narrows by disposal
    // date (a range already excludes nulls, so it implies "disposed").
    filter.disposedAt = hasRange ? dateRange : { $ne: null };
  } else {
    // Active: never disposed; a date range narrows by next hearing date.
    filter.disposedAt = null;
    if (hasRange) filter.nextHearingDate = dateRange;
  }

  const query = (input.search || "").trim();
  if (query) {
    const scope = parseScope(input.searchScope);
    const pattern = new RegExp(escapeRegex(query), "i");
    filter.$or = scope.map((f) => ({ [f]: pattern }));
  }

  return filter;
}

function parseDate(value: string): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseScope(raw: string | null | undefined): CaseSearchField[] {
  if (!raw) return DEFAULT_SEARCH_SCOPE;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as CaseSearchField[];
  const valid = parts.filter((p): p is CaseSearchField =>
    (SEARCH_FIELDS as readonly string[]).includes(p)
  );
  return valid.length > 0 ? valid : DEFAULT_SEARCH_SCOPE;
}

// One-shot accessor used by both endpoints to read the param tuple off
// a URL or a JSON body. Keeps the parsing logic from being duplicated.
export function readCaseFilterParams(
  source: URLSearchParams | Record<string, unknown>
): Omit<CaseFilterInput, "partnerId"> {
  const get = (k: string): string | null => {
    if (source instanceof URLSearchParams) return source.get(k);
    const v = source[k];
    return typeof v === "string" ? v : null;
  };
  const scopeRaw = get("scope");
  return {
    scope: scopeRaw === "disposed" ? "disposed" : "active",
    courtId: get("courtId"),
    courtPlace: get("courtPlace"),
    advocateId: get("advocateId"),
    fromDate: get("fromDate"),
    toDate: get("toDate"),
    search: get("search"),
    searchScope: get("searchScope"),
  };
}
