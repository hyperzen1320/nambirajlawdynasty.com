"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RequestDeleteDialog from "@/app/app/workflow/[id]/RequestDeleteDialog";

// "Delete" on a case = move it to Disposed Cases.
//
//   • Admins call PATCH directly — the matter moves to the archive and
//     can be reopened from the disposed-case detail page.
//   • Non-admins open RequestDeleteDialog instead; the actual dispose
//     happens when the office admin approves the request from Activity
//     → Delete Requests or the bell-icon dropdown.
//
// The button label still reads "Delete this matter" — that's the verb
// the user reaches for. The dialog copy tells them what'll actually
// happen.

export default function DeleteCaseButton({
  caseId,
  caseNo,
  isAdmin,
}: {
  caseId: string;
  caseNo: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  async function onDelete() {
    setError(null);
    setWorking(true);
    try {
      const res = await fetch(`/api/app/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Disposed" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The server's PATCH endpoint may still 403 us with a
        // delete_request_required code (e.g. if the user's role record
        // is stale and they tried to bypass the request flow). Pivot
        // into the request dialog instead of just surfacing the error.
        if (data?.code === "delete_request_required") {
          setConfirming(false);
          setRequestOpen(true);
          setWorking(false);
          return;
        }
        setError(data?.error ?? "Couldn't move this matter to Disposed.");
        setWorking(false);
        return;
      }
      router.push("/app/cases");
      router.refresh();
    } catch {
      setError("Network error.");
      setWorking(false);
    }
  }

  function startConfirm() {
    if (!isAdmin) {
      setRequestOpen(true);
      return;
    }
    setConfirming(true);
  }

  if (requestSent) {
    return (
      <div
        className="rounded-xl px-5 py-4"
        style={{
          backgroundColor: "var(--color-app-paper)",
          border: "1px solid var(--color-app-aqua)",
        }}
      >
        <p
          className="text-[13px]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-ink)",
          }}
        >
          Delete request for{" "}
          <span style={{ fontWeight: 600 }}>{caseNo}</span> sent. The
          office admin will review it shortly.
        </p>
      </div>
    );
  }

  if (!confirming) {
    return (
      <>
        <button
          type="button"
          onClick={startConfirm}
          className="inline-flex items-center gap-2 rounded-md border px-5 py-2.5 text-[13px] font-medium transition-colors"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            borderColor: "var(--color-app-danger)",
            backgroundColor: "transparent",
            color: "var(--color-app-danger)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor =
              "var(--color-app-danger-soft)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <TrashIcon /> {isAdmin ? "Delete this matter" : "Request to delete"}
        </button>
        {requestOpen ? (
          <RequestDeleteDialog
            target={{
              type: "case",
              id: caseId,
              name: caseNo,
              hint: "Only the office admin can dispose a matter directly.",
            }}
            onClose={() => setRequestOpen(false)}
            onSubmitted={() => {
              setRequestOpen(false);
              setRequestSent(true);
            }}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <div
        className="w-full max-w-md rounded-xl p-5"
        style={{
          backgroundColor: "var(--color-app-paper)",
          border: "1px solid var(--color-app-danger)",
        }}
      >
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            color: "var(--color-app-danger)",
          }}
        >
          Move {caseNo} to Disposed?
        </div>
        <p
          className="mt-2 text-[13px] leading-[1.55]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-fg-soft)",
          }}
        >
          The matter will be archived to{" "}
          <span style={{ color: "var(--color-app-ink)", fontWeight: 600 }}>
            Disposed Cases
          </span>{" "}
          and disappear from the Case Vault, Hearing Track and dashboard. You
          can reopen it any time from the disposed-case detail page — nothing
          is lost.
        </p>

        {error ? (
          <p
            className="mt-3 text-[12px]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-danger)",
            }}
          >
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={working}
            className="rounded-md border px-4 py-2 text-[13px] font-medium"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              borderColor: "var(--color-app-edge)",
              backgroundColor: "var(--color-app-paper)",
              color: "var(--color-app-fg-soft)",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={working}
            className="rounded-md px-4 py-2 text-[13px] font-semibold"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              backgroundColor: "var(--color-app-danger)",
              color: "white",
              opacity: working ? 0.6 : 1,
            }}
          >
            {working ? "Moving…" : "Yes, move to Disposed"}
          </button>
        </div>
      </div>
      {requestOpen ? (
        <RequestDeleteDialog
          target={{
            type: "case",
            id: caseId,
            name: caseNo,
            hint: "Only the office admin can dispose a matter directly.",
          }}
          onClose={() => setRequestOpen(false)}
          onSubmitted={() => {
            setRequestOpen(false);
            setRequestSent(true);
          }}
        />
      ) : null}
    </>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
