// How the Case Vault is ordered.
//
// It used to be next-hearing-date, always, with no way to change it —
// which quietly made the vault unusable for the one thing people came to
// it for. File a matter listed six months out and it lands at the far end
// of a few hundred rows, so "I added it on the web and can't find it on
// the phone" was the list working exactly as written. "recent" is the
// default now: whatever was filed last, wherever it was filed from, is
// the first row in both apps.
//
// Deliberately its own module with no imports. The pickers that use it
// are client components, and the filter builder next door imports
// mongoose — one shared file would drag the whole driver into the
// browser bundle.

export type CaseSort = "recent" | "hearing" | "caseNo";

export const CASE_SORTS: CaseSort[] = ["recent", "hearing", "caseNo"];

export const DEFAULT_CASE_SORT: CaseSort = "recent";

export const CASE_SORT_LABELS: Record<CaseSort, string> = {
  recent: "Recently added",
  hearing: "Next hearing",
  caseNo: "Case number",
};

export function readCaseSort(raw: string | null | undefined): CaseSort {
  return (CASE_SORTS as string[]).includes(raw ?? "")
    ? (raw as CaseSort)
    : DEFAULT_CASE_SORT;
}

/** The mongo sort document for a `CaseSort`. */
export function buildCaseSort(sort: CaseSort): Record<string, 1 | -1> {
  switch (sort) {
    case "hearing":
      // Soonest first. Mongo sorts null before dates ascending, so
      // undated matters lead — the cause-list reading order.
      return { nextHearingDate: 1, updatedAt: -1 };
    case "caseNo":
      return { caseNo: 1, updatedAt: -1 };
    case "recent":
    default:
      return { createdAt: -1 };
  }
}
