/**
 * True when Supabase couldn't be reached at all (offline, DNS, timeout), as
 * opposed to Supabase answering "no". The two must not be confused: a network
 * blip is not a reason to sign someone out or tell them they can't edit.
 */
export function isNetworkError(
  error: { name?: string; message?: string } | null | undefined
): boolean {
  if (!error) return false;
  if (error.name === "AuthRetryableFetchError") return true;
  return /fetch failed|network|timed? ?out|ECONN|ENOTFOUND|EAI_AGAIN|UND_ERR/i.test(error.message ?? "");
}

export const UNREACHABLE_MESSAGE =
  "Couldn't reach Supabase — check this computer's internet connection and try again.";
