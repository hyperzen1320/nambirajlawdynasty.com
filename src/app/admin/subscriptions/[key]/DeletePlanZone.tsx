"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeletePlanZone({
  planKey,
  planLabel,
  isCanonical,
}: {
  planKey: string;
  planLabel: string;
  isCanonical: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deletePlan() {
    if (
      !confirm(
        `Delete the “${planLabel}” plan? It disappears from the catalogue and the landing page. If any office is still on it, the delete will be refused.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/subscriptions/${planKey}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not delete this plan.");
        setBusy(false);
      } else {
        router.push("/admin/subscriptions");
        router.refresh();
      }
    } catch {
      setError("Network error.");
      setBusy(false);
    }
  }

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
          Delete this plan
        </h3>
        <p className="mt-1 text-[13px] text-admin-fg-muted">
          Removes the plan from the catalogue, the landing page and the
          partner-creation form. Offices currently on this plan block the
          delete — reassign them to another plan first.
        </p>
      </div>

      {isCanonical && (
        <div className="mt-5 rounded-md border border-admin-border bg-admin-bg px-4 py-3">
          <p className="text-[12px] leading-6 text-admin-fg-muted">
            <strong className="text-admin-fg">Heads up:</strong>{" "}
            <span
              className="text-admin-fg"
              style={{ fontFamily: "var(--font-plex-mono), monospace" }}
            >
              /{planKey}
            </span>{" "}
            is a built-in plan — the seed script re-creates it on the next
            deploy, so deleting it here is only temporary. To hide it instead,
            turn <em>Active</em> off above.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-md border border-admin-danger/40 bg-white px-4 py-3">
          <p className="text-[13px] text-admin-danger">{error}</p>
        </div>
      )}

      <div className="mt-5">
        <button
          onClick={deletePlan}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md border border-admin-danger bg-admin-danger px-4 py-2 text-[12px] font-medium text-white transition-all hover:bg-admin-danger/90 disabled:opacity-60"
        >
          {busy ? "Deleting…" : "Delete plan"}
        </button>
      </div>
    </div>
  );
}
