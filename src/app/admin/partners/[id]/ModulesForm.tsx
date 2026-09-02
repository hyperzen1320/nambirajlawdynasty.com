"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FEATURES,
  type FeatureKey,
  type FeatureMeta,
} from "@/lib/features";

// Which parts of Legalezi this chambers can reach.
//
// The form always submits the FULL map, every key with an explicit
// boolean, so a switch-off can't be lost to a missing field on the way
// across. Save is disabled until something actually moves.

const GROUP_ORDER: FeatureMeta["group"][] = [
  "Workspace",
  "Collaboration",
  "Office",
  "Data",
];

export default function ModulesForm({
  partnerId,
  partnerName,
  initialFeatures,
}: {
  partnerId: string;
  partnerName: string;
  initialFeatures: Record<FeatureKey, boolean>;
}) {
  const router = useRouter();
  const [features, setFeatures] =
    useState<Record<FeatureKey, boolean>>(initialFeatures);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = useMemo(
    () =>
      FEATURES.some((f) => features[f.key] !== initialFeatures[f.key]),
    [features, initialFeatures]
  );

  const offCount = FEATURES.filter((f) => !features[f.key]).length;

  const grouped = useMemo(() => {
    return GROUP_ORDER.map((group) => ({
      group,
      items: FEATURES.filter((f) => f.group === group),
    })).filter((g) => g.items.length > 0);
  }, []);

  function toggle(key: FeatureKey) {
    setSaved(false);
    setError(null);
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/partners/${partnerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Couldn't save those modules.");
        setSaving(false);
        return;
      }
      setSaved(true);
      setSaving(false);
      // Re-render the server component so a reload shows the saved state
      // as the new baseline rather than a stale "dirty" form.
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setSaving(false);
    }
  }

  return (
    <section className="fade-up-sm rounded-lg border border-admin-border bg-admin-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-[18px] font-semibold tracking-tight text-admin-fg">
            Modules
          </h3>
          <p className="mt-1.5 max-w-xl text-[13px] text-admin-fg-muted">
            What {partnerName} can open. Switching a module off hides it from
            their sidebar, redirects the page, and blocks its API — nothing is
            deleted, so switching it back on restores everything untouched.
          </p>
        </div>
        <div
          className="text-[11px] uppercase tracking-[0.14em] text-admin-fg-soft"
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          {offCount === 0
            ? "All modules on"
            : `${offCount} switched off`}
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {grouped.map(({ group, items }) => (
          <div key={group}>
            <div
              className="text-[10px] font-medium uppercase tracking-[0.18em] text-admin-accent"
              style={{ fontFamily: "var(--font-plex-mono), monospace" }}
            >
              {group}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {items.map((f) => (
                <ModuleToggle
                  key={f.key}
                  meta={f}
                  on={features[f.key]}
                  changed={features[f.key] !== initialFeatures[f.key]}
                  onToggle={() => toggle(f.key)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {error ? (
        <div className="mt-5 rounded-md border border-admin-danger/30 bg-admin-danger-soft px-4 py-3 text-[13px] text-admin-danger">
          {error}
        </div>
      ) : null}

      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-2 rounded-md bg-admin-accent px-5 py-2.5 text-[13px] font-medium text-white shadow-sm transition-all enabled:hover:bg-admin-accent-hover enabled:hover:shadow disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save modules"}
        </button>
        {saved && !dirty ? (
          <span
            className="text-[12px] text-admin-accent"
            style={{ fontFamily: "var(--font-plex-mono), monospace" }}
          >
            ✓ Saved
          </span>
        ) : dirty ? (
          <span className="text-[12px] text-admin-fg-muted">
            Unsaved changes.
          </span>
        ) : null}
      </div>
    </section>
  );
}

function ModuleToggle({
  meta,
  on,
  changed,
  onToggle,
}: {
  meta: FeatureMeta;
  on: boolean;
  changed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="flex items-start gap-3 rounded-md border p-3.5 text-left transition-colors"
      style={{
        borderColor: changed
          ? "var(--color-admin-saffron)"
          : "var(--color-admin-border)",
        backgroundColor: on
          ? "var(--color-admin-surface)"
          : "var(--color-admin-bg)",
      }}
    >
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors"
        style={{
          backgroundColor: on
            ? "var(--color-admin-accent)"
            : "var(--color-admin-border)",
        }}
      >
        <span
          className="block h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
          style={{ transform: on ? "translateX(16px)" : "translateX(0)" }}
        />
      </span>
      <span className="min-w-0">
        <span
          className="block text-[13px] font-medium"
          style={{
            color: on
              ? "var(--color-admin-fg)"
              : "var(--color-admin-fg-muted)",
          }}
        >
          {meta.label}
        </span>
        <span className="mt-0.5 block text-[11.5px] leading-[1.5] text-admin-fg-muted">
          {meta.description}
        </span>
      </span>
    </button>
  );
}
