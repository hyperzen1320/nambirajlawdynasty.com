// Client-safe hearing types + search. Kept free of any mongoose/model
// imports so the "use client" Hearing Track UI can share the exact same
// row shape and search semantics as the server-side loader without
// dragging server-only code into the browser bundle. hearings-bucket.ts
// re-exports these so existing server imports keep working.

export type Bucket = "today" | "tomorrow" | "pending" | "all";

export type HearingRow = {
  id: string;
  caseNo: string;
  fileNo: string;
  cnr: string;
  clientName: string;
  clientPhone: string;
  clientWhatsapp: string;
  oppositeParty: string;
  courtName: string;
  courtPlace: string;
  status: string;
  nextHearingDate: string | null;
  lastHearingDate: string | null;
};

// Multi-word terms match as AND (so "sharma district" needs both somewhere
// in the row), across the fields a user would reasonably type. Used by the
// Hearing Track search box and the export route so the two always agree on
// what a query selects.
export function filterHearingRows(
  rows: HearingRow[],
  q: string
): HearingRow[] {
  const term = q.trim().toLowerCase();
  if (!term) return rows;
  const terms = term.split(/\s+/).filter(Boolean);
  return rows.filter((r) => {
    const hay = [
      r.caseNo,
      r.fileNo,
      r.cnr,
      r.clientName,
      r.oppositeParty,
      r.courtName,
      r.courtPlace,
      r.status,
    ]
      .join(" ")
      .toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}
