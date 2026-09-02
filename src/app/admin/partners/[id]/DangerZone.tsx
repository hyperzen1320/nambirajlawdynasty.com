"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DangerZone({
  partnerId,
  partnerName,
  status,
}: {
  partnerId: string;
  partnerName: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"suspend" | "unsuspend" | "delete" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  async function suspend() {
    setBusy("suspend");
    setError(null);
    try {
      const res = await fetch(`/api/admin/partners/${partnerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionStatus: "suspended" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not suspend.");
      } else {
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function unsuspend() {
    setBusy("unsuspend");
    setError(null);
    try {
      const res = await fetch(`/api/admin/partners/${partnerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionStatus: "active" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not unsuspend.");
      } else {
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function deletePartner() {
    if (
      !confirm(
        `Delete ${partnerName}? Their partner-admin and all users will be locked out immediately. This is a soft-delete and can be reversed from the database, but cannot be undone from the UI.`
      )
    ) {
      return;
    }
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(`/api/admin/partners/${partnerId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not delete.");
        setBusy(null);
      } else {
        router.push("/admin/partners");
        router.refresh();
      }
    } catch {
      setError("Network error.");
      setBusy(null);
    }
  }

  const isSuspended = status === "suspended";

  return (
    <div className="rounded-lg border border-admin-danger/30 bg-admin-danger-soft/40 p-7">
      <div className="border-b border-admin-danger/20 pb-5">
        <div
          className="text-[10px] font-medium uppercase tracking-[0.18em] text-admin-danger"
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          Danger Zone
        </div>
        <h3 className="mt-2 text-[16px] font-semibold tracking-tight text-admin-fg">
          Restrict access
        </h3>
        <p className="mt-1 text-[13px] text-admin-fg-muted">
          Suspend logs everyone out and blocks login until reversed. Delete
          marks the chambers as deleted (soft) and locks all users permanently
          from the UI.
        </p>
      </div>

      {error && (
        <div className="mt-5 rounded-md border border-admin-danger/40 bg-white px-4 py-3">
          <p className="text-[13px] text-admin-danger">{error}</p>
        </div>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-admin-danger/30 bg-white p-4">
          <h4 className="text-[14px] font-semibold text-admin-fg">
            {isSuspended ? "Unsuspend chambers" : "Suspend chambers"}
          </h4>
          <p className="mt-1 text-[12px] text-admin-fg-muted">
            {isSuspended
              ? "Restore login access for all users in this chambers."
              : "Block login for everyone until you unsuspend."}
          </p>
          <button
            onClick={isSuspended ? unsuspend : suspend}
            disabled={busy !== null}
            className={`mt-4 inline-flex items-center gap-2 rounded-md px-4 py-2 text-[12px] font-medium transition-all disabled:opacity-60 ${
              isSuspended
                ? "border border-admin-accent bg-white text-admin-accent hover:bg-admin-accent hover:text-white"
                : "border border-admin-danger bg-white text-admin-danger hover:bg-admin-danger hover:text-white"
            }`}
          >
            {busy === "suspend"
              ? "Suspending…"
              : busy === "unsuspend"
                ? "Unsuspending…"
                : isSuspended
                  ? "Unsuspend"
                  : "Suspend"}
          </button>
        </div>

        <div className="rounded-md border border-admin-danger/30 bg-white p-4">
          <h4 className="text-[14px] font-semibold text-admin-fg">
            Delete chambers
          </h4>
          <p className="mt-1 text-[12px] text-admin-fg-muted">
            Soft-delete. Locks all users out. Won&rsquo;t appear in the list
            anymore.
          </p>
          <button
            onClick={deletePartner}
            disabled={busy !== null}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-admin-danger bg-admin-danger px-4 py-2 text-[12px] font-medium text-white transition-all hover:bg-admin-danger/90 disabled:opacity-60"
          >
            {busy === "delete" ? "Deleting…" : "Delete chambers"}
          </button>
        </div>
      </div>
    </div>
  );
}
