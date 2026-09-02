// Build a person's display name. A surname that is empty or just a
// placeholder (a lone dash / em-dash / dot — junk left over from how a name
// was first entered) is treated as "no surname", so the UI shows a clean
// "Tejas" instead of a dangling "Tejas —", and a real "John Doe" in full
// wherever a name is shown.

const PLACEHOLDER = /^[\s.\-–—_]*$/;

function clean(part?: string | null): string {
  const t = (part ?? "").trim();
  return PLACEHOLDER.test(t) ? "" : t;
}

export function fullName(
  firstName?: string | null,
  lastName?: string | null,
  fallback = "",
): string {
  return [clean(firstName), clean(lastName)].filter(Boolean).join(" ") || fallback;
}

export function initials(
  firstName?: string | null,
  lastName?: string | null,
  fallback = "",
): string {
  const fn = clean(firstName);
  const ln = clean(lastName);
  const out = `${fn[0] ?? ""}${ln[0] ?? ""}`.toUpperCase();
  return out || fallback;
}
