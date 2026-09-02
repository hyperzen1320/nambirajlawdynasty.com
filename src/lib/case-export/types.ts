// Shared shape for the export pipeline. Each generator consumes the
// same (cases, partner, filters, columns) tuple so the column list and
// filter summary look identical no matter which format the user picks.

export type CaseExportRow = {
  id: string;
  caseNo: string;
  fileNo: string;
  iaNumbers: string;
  cnr: string;
  clientName: string;
  clientPhone: string;
  clientWhatsapp: string;
  appearingFor: string;
  oppositeParty: string;
  oppositeAdvocate: string;
  courtName: string;
  courtNumber: string;
  courtHall: string;
  courtPlace: string;
  status: string;
  advocateName: string;
  nextHearingDate: string | null;
  lastHearingDate: string | null;
  // Only populated for the Disposed archive export; empty for active rolls.
  disposedAt: string | null;
};

export type CaseExportColumn = {
  key: string;
  label: string;
  // XLSX width is in "character widths"; DOCX expresses widths in
  // 1/20th of a point (twip); pdfkit uses points directly. The
  // generators interpret this number using their own unit — it's a
  // shared "looks-roughly-this-wide" hint, not an absolute value.
  width: number;
  // Optional alignment override. Defaults to left.
  align?: "left" | "center" | "right";
};

// Master column definitions. The UI's Columns menu picks a subset of
// these keys; the export endpoint passes the chosen subset down here
// and each generator uses the matching definitions in order.
export const ALL_COLUMNS: CaseExportColumn[] = [
  { key: "sno", label: "S.No", width: 6, align: "center" },
  { key: "fileNo", label: "File No", width: 14 },
  { key: "caseNo", label: "Case No", width: 16 },
  { key: "iaNumbers", label: "IA No", width: 12 },
  { key: "cnr", label: "CNR No", width: 18 },
  { key: "clientName", label: "Client Name", width: 18 },
  { key: "appearingFor", label: "Appearing For", width: 14 },
  { key: "clientPhone", label: "Mobile 1", width: 14 },
  { key: "clientWhatsapp", label: "Mobile 2", width: 14 },
  { key: "courtName", label: "Court", width: 20 },
  { key: "courtNumber", label: "Court No", width: 10 },
  { key: "courtPlace", label: "Place", width: 14 },
  { key: "status", label: "Status", width: 20 },
  { key: "advocateName", label: "Advocate", width: 16 },
  { key: "oppositeParty", label: "Opposite Party", width: 18 },
  { key: "oppositeAdvocate", label: "Opp. Advocate", width: 16 },
  { key: "lastHearingDate", label: "Prev Date", width: 12, align: "center" },
  { key: "nextHearingDate", label: "Next Date", width: 12, align: "center" },
  { key: "disposedAt", label: "Disposed On", width: 13, align: "center" },
];

// Default selection used when the client doesn't send a `columns` list.
// Mirrors the table's default visible columns so the export feels like
// a "screenshot" of what the user was looking at.
export const DEFAULT_COLUMN_KEYS = [
  "sno",
  "fileNo",
  "caseNo",
  "iaNumbers",
  "cnr",
  "clientName",
  "appearingFor",
  "clientPhone",
  "clientWhatsapp",
  "courtName",
  "status",
  "lastHearingDate",
  "nextHearingDate",
];

// Default columns for the Disposed archive export. Drops the next/prev
// hearing dates (meaningless once a matter is closed) in favour of the
// disposal date, and leads with file/case/CNR + parties + court.
export const DISPOSED_COLUMN_KEYS = [
  "sno",
  "fileNo",
  "caseNo",
  "cnr",
  "clientName",
  "oppositeParty",
  "courtName",
  "courtPlace",
  "status",
  "disposedAt",
];

export type CaseExportPartner = {
  name: string;
  officeName: string;
  primaryContactName: string;
  city: string;
  state: string;
  phone: string;
};

export type CaseExportFilterSummary = {
  // Each entry is a single human-readable filter label, e.g.
  //   "Court: District Court, Krishnagiri"
  //   "Date: 01 Apr 2026 → 30 Apr 2026"
  // The generators render them as a small italic line under the header
  // so the reader of the report knows which slice of the vault this is.
  lines: string[];
};

export type CaseExportInput = {
  cases: CaseExportRow[];
  partner: CaseExportPartner;
  columns: CaseExportColumn[];
  filters: CaseExportFilterSummary;
  generatedAt: Date;
};

// Picks the column list for the export — uses provided keys when the
// client sent them, otherwise falls back to the default order.
export function resolveColumns(
  keys: string[] | null | undefined
): CaseExportColumn[] {
  const requested = (keys && keys.length > 0 ? keys : DEFAULT_COLUMN_KEYS)
    .map((k) => ALL_COLUMNS.find((c) => c.key === k))
    .filter((c): c is CaseExportColumn => Boolean(c));
  // Always keep a sensible default even if the client somehow sent only
  // invalid keys — empty exports are worse than full ones.
  return requested.length > 0
    ? requested
    : ALL_COLUMNS.filter((c) => DEFAULT_COLUMN_KEYS.includes(c.key));
}

// Pulls the displayable value for a column from a row. Centralised here
// so XLSX / DOCX / PDF format dates and missing values the same way.
export function valueFor(
  col: CaseExportColumn,
  row: CaseExportRow,
  index: number
): string {
  if (col.key === "sno") return String(index + 1);
  if (
    col.key === "lastHearingDate" ||
    col.key === "nextHearingDate" ||
    col.key === "disposedAt"
  ) {
    const v = row[col.key];
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
  const raw = (row as unknown as Record<string, unknown>)[col.key];
  if (raw === null || raw === undefined) return "";
  return String(raw);
}

// Compact "company name" used by every generator's header. Office
// branding wins over the partner's registered name so chambers that
// trade under a different display label see what they expect.
export function companyName(p: CaseExportPartner): string {
  return p.officeName?.trim() || p.name?.trim() || "Chambers";
}

// First two letters of the company name, uppercased — used as the
// monogram inside the copper "logo" disc on every export. Falls back
// to "LE" so we never render a blank circle.
export function companyInitials(p: CaseExportPartner): string {
  const name = companyName(p).trim();
  if (!name) return "LE";
  const parts = name.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (
    (parts[0][0] || "") + (parts[1][0] || "")
  ).toUpperCase() || "LE";
}
