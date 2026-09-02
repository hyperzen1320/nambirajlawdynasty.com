// "Appearing for" roster — the side a chambers represents in a matter.
// Kept as one shared list so the Add-Case and Edit-Case forms can never
// drift apart, and broad enough to cover civil, appellate and criminal
// work (a plain Petitioner/Respondent/Plaintiff/Defendant set left
// criminal and appeal matters with nothing accurate to pick).
export const APPEARING_OPTIONS = [
  "Petitioner",
  "Respondent",
  "Plaintiff",
  "Defendant",
  "Appellant",
  "Complainant",
  "Accused",
  "Applicant",
] as const;

// Builds the option list for a dropdown that must also be able to show a
// value already saved on a record — e.g. an older case whose role isn't
// in the standard roster. Returns the canonical list, prepending the
// current value when it's non-empty and not already present, so editing
// never silently rewrites a role the form couldn't represent.
export function appearingOptionsWith(current: string): string[] {
  const trimmed = (current || "").trim();
  if (trimmed && !APPEARING_OPTIONS.includes(trimmed as never)) {
    return [trimmed, ...APPEARING_OPTIONS];
  }
  return [...APPEARING_OPTIONS];
}
