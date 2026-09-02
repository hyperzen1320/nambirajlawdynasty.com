import {
  CASE_SORTS,
  CASE_SORT_LABELS,
  DEFAULT_CASE_SORT,
  readCaseSort,
  type CaseSort,
} from "@/lib/case-sort";

// Shared types for the Case Vault UI. Lives outside the components so
// the table, toolbar, export menu, etc. can all type-check against the
// same row shape.

export type CaseRow = {
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
  courtId: string | null;
  courtName: string;
  courtNumber: string;
  courtHall: string;
  courtPlace: string;
  status: string;
  advocateId: string | null;
  advocateName: string;
  nextHearingDate: string | null;
  lastHearingDate: string | null;
  updatedAt: string;
};

// Which Case Vault layout is showing. "cards" is the default friendly
// view (one card per matter); "table" is the dense, column-toggleable
// grid for power use. Persisted per-partner in localStorage.
export type CaseViewMode = "cards" | "table";

export type CourtOption = {
  id: string;
  name: string;
  number: string;
  place: string;
};

export type AdvocateOption = {
  id: string;
  name: string;
  role: string;
};

// Master column list for the table. `togglable: false` means the user
// can't hide it via the Columns menu (S.No and Actions are always on).
// `default: true` controls the initial visibility before the user has
// saved any column preferences. The Columns menu drives BOTH the
// visible table columns AND the exported columns — same list, no
// separate "fields to export" dropdown.
export type CaseColumnKey =
  | "sno"
  | "fileNo"
  | "caseNo"
  | "iaNumbers"
  | "cnr"
  | "clientName"
  | "appearingFor"
  | "clientPhone"
  | "clientWhatsapp"
  | "courtName"
  | "courtNumber"
  | "courtPlace"
  | "status"
  | "advocateName"
  | "oppositeParty"
  | "oppositeAdvocate"
  | "lastHearingDate"
  | "nextHearingDate"
  | "actions";

export type CaseColumn = {
  key: CaseColumnKey;
  label: string;
  minWidth: number;
  align?: "left" | "center" | "right";
  togglable: boolean;
  default: boolean;
};

export const COLUMNS: CaseColumn[] = [
  { key: "sno", label: "S.No", minWidth: 50, align: "center", togglable: false, default: true },
  { key: "fileNo", label: "File No", minWidth: 110, togglable: true, default: true },
  { key: "caseNo", label: "Case No", minWidth: 130, togglable: true, default: true },
  { key: "iaNumbers", label: "IA No", minWidth: 90, togglable: true, default: false },
  { key: "cnr", label: "CNR No", minWidth: 140, togglable: true, default: false },
  { key: "clientName", label: "Client Name", minWidth: 140, togglable: true, default: true },
  { key: "appearingFor", label: "Appearing For", minWidth: 110, togglable: true, default: false },
  { key: "clientPhone", label: "Mobile 1", minWidth: 110, togglable: true, default: false },
  { key: "clientWhatsapp", label: "Mobile 2", minWidth: 110, togglable: true, default: false },
  { key: "courtName", label: "Court", minWidth: 140, togglable: true, default: true },
  { key: "courtNumber", label: "Court No", minWidth: 80, togglable: true, default: false },
  { key: "courtPlace", label: "Place", minWidth: 110, togglable: true, default: false },
  { key: "status", label: "Status", minWidth: 110, togglable: true, default: true },
  { key: "advocateName", label: "Advocate", minWidth: 130, togglable: true, default: false },
  { key: "oppositeParty", label: "Opposite Party", minWidth: 140, togglable: true, default: false },
  { key: "oppositeAdvocate", label: "Opp. Advocate", minWidth: 130, togglable: true, default: false },
  { key: "lastHearingDate", label: "Prev Date", minWidth: 100, align: "center", togglable: true, default: false },
  { key: "nextHearingDate", label: "Next Date", minWidth: 100, align: "center", togglable: true, default: true },
  { key: "actions", label: "Actions", minWidth: 100, align: "center", togglable: false, default: true },
];

export const DEFAULT_VISIBLE_COLUMNS: CaseColumnKey[] = COLUMNS
  .filter((c) => c.default)
  .map((c) => c.key);

export const LIMIT_OPTIONS = [25, 50, 100, 200, 500] as const;
export const DEFAULT_LIMIT = 50;

// How the vault is ordered. Mirrors CaseSort in lib/case-filter.ts — the
// server owns the actual sort documents; this is just the picker.
export const SORT_OPTIONS: { value: CaseSort; label: string }[] =
  CASE_SORTS.map((value) => ({ value, label: CASE_SORT_LABELS[value] }));

// The filter tuple that drives the case list. Search is always across
// every searchable column server-side — no per-field scope toggle, since
// "search everything" is what users actually want and the previous UI
// surface was confusing them into thinking it controlled export.
export type CaseFilters = {
  courtId: string;
  courtPlace: string;
  advocateId: string;
  fromDate: string;
  toDate: string;
  search: string;
  // `limit` is the page size; `page` is the 1-based page index.
  limit: number;
  page: number;
  sort: CaseSort;
};

export const EMPTY_FILTERS: CaseFilters = {
  courtId: "",
  courtPlace: "",
  advocateId: "",
  fromDate: "",
  toDate: "",
  search: "",
  limit: DEFAULT_LIMIT,
  page: 1,
  sort: DEFAULT_CASE_SORT,
};

export function filtersFromQuery(params: URLSearchParams): CaseFilters {
  const limitRaw = Number(params.get("limit") || "");
  const limit = (LIMIT_OPTIONS as readonly number[]).includes(limitRaw)
    ? limitRaw
    : DEFAULT_LIMIT;
  const pageRaw = Number(params.get("page") || "");
  const page = Number.isFinite(pageRaw) && pageRaw > 1 ? Math.floor(pageRaw) : 1;
  return {
    courtId: params.get("courtId") || "",
    courtPlace: params.get("courtPlace") || "",
    advocateId: params.get("advocateId") || "",
    fromDate: params.get("fromDate") || "",
    toDate: params.get("toDate") || "",
    search: params.get("search") || "",
    limit,
    page,
    sort: readCaseSort(params.get("sort")),
  };
}

export function filtersToQuery(filters: CaseFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.courtId) params.set("courtId", filters.courtId);
  if (filters.courtPlace) params.set("courtPlace", filters.courtPlace);
  if (filters.advocateId) params.set("advocateId", filters.advocateId);
  if (filters.fromDate) params.set("fromDate", filters.fromDate);
  if (filters.toDate) params.set("toDate", filters.toDate);
  if (filters.search) params.set("search", filters.search);
  if (filters.limit !== DEFAULT_LIMIT) {
    params.set("limit", String(filters.limit));
  }
  if (filters.page && filters.page > 1) {
    params.set("page", String(filters.page));
  }
  if (filters.sort !== DEFAULT_CASE_SORT) {
    params.set("sort", filters.sort);
  }
  return params;
}
