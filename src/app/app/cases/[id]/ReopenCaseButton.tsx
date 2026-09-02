"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Admin-only "Reopen" action shown on disposed case detail pages.
 * Sends a PATCH that flips status away from "Disposed" — the case
 * route's transition-detection then clears `disposedAt` and writes a
 * `case.reopened` activity row, after which the matter rejoins Case
 * Vault, Hearing Track and the dashboard automatically.
 */
export default function ReopenCaseButton({
  caseId,
  caseNo,
}: {
  caseId: string;
  caseNo: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reopen() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/app/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Default to "Filed" — admin can refine the active stage from
        // the Update Hearing form once the case re-appears in Vault.
        body: JSON.stringify({ status: "Filed" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Couldn't reopen the matter.");
        setSubmitting(false);
        return;
      }
      // The case is no longer disposed → push the user back to Case
      // Vault so they can see it has rejoined the active list.
      router.push("/app/cases");
      router.refresh();
    } catch {
      setError("Network error.");
      setSubmitting(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-[12px] font-semibold transition-colors"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          backgroundColor: "var(--color-app-copper)",
          color: "var(--color-app-copper-text)",
        }}
        aria-label={`Reopen ${caseNo}`}
      >
        <ReopenIcon />
        Reopen case
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-2 rounded-md px-3 py-2"
      style={{
        backgroundColor: "rgba(245,235,214,0.08)",
        border: "1px solid rgba(245,235,214,0.18)",
      }}
    >
      <span
        className="text-[11px]"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          color: "rgba(245,235,214,0.78)",
        }}
      >
        Reopen <span style={{ fontWeight: 600 }}>{caseNo}</span>?
      </span>
      <button
        type="button"
        onClick={reopen}
        disabled={submitting}
        className="rounded px-3 py-1.5 text-[11px] font-semibold"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          backgroundColor: "var(--color-app-copper)",
          color: "var(--color-app-copper-text)",
          opacity: submitting ? 0.6 : 1,
        }}
      >
        {submitting ? "Reopening…" : "Yes, reopen"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={submitting}
        className="text-[11px] uppercase tracking-[0.16em]"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "rgba(245,235,214,0.6)",
        }}
      >
        Cancel
      </button>
      {error ? (
        <span
          className="ml-2 text-[11px]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "#ff8a8a",
          }}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}

function ReopenIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 12a9 9 0 1 0 3.5-7.1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M3 4v5h5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
