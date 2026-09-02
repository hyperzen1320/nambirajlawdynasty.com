"use client";

import { useState } from "react";
import Link from "next/link";

type Value = { maintenanceMode: boolean; maintenanceMessage: string };

export default function SettingsClient({ initial }: { initial: Value }) {
  const [baseline, setBaseline] = useState<Value>(initial);
  const [on, setOn] = useState(initial.maintenanceMode);
  const [message, setMessage] = useState(initial.maintenanceMessage);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    on !== baseline.maintenanceMode || message !== baseline.maintenanceMessage;

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maintenanceMode: on,
          maintenanceMessage: message,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Couldn't save.");
      } else {
        setBaseline({ maintenanceMode: on, maintenanceMessage: message });
        setSaved(true);
      }
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[900px] px-6 py-8 lg:px-10">
      <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-admin-fg-soft">
        Settings
      </div>
      <h1 className="text-[26px] font-semibold tracking-tight text-admin-fg">
        Platform settings
      </h1>
      <p className="mt-2 max-w-xl text-[14px] text-admin-fg-muted">
        Controls that affect every chambers on Legalezi.
      </p>

      {/* Maintenance mode */}
      <div className="mt-6 rounded-lg border border-admin-border bg-admin-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[15px] font-semibold text-admin-fg">
              Maintenance mode
            </div>
            <p className="mt-1 max-w-md text-[13px] text-admin-fg-muted">
              When on, every chambers user sees a holding screen instead of the
              office app. You keep full access to this admin console.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            onClick={() => setOn((v) => !v)}
            className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
            style={{
              backgroundColor: on
                ? "var(--color-admin-accent)"
                : "var(--color-admin-border)",
            }}
            aria-label="Toggle maintenance mode"
          >
            <span
              className="inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
              style={{ transform: on ? "translateX(22px)" : "translateX(2px)" }}
            />
          </button>
        </div>

        {on ? (
          <div
            className="mt-4 rounded-md border px-3 py-2 text-[12.5px]"
            style={{
              backgroundColor: "var(--color-admin-warning-soft)",
              borderColor: "var(--color-admin-warning)",
              color: "var(--color-admin-warning)",
            }}
          >
            Maintenance mode is ON — chambers users are locked out of the office
            app right now.
          </div>
        ) : null}

        <div className="mt-4">
          <label
            htmlFor="maintMsg"
            className="text-[11px] font-medium uppercase tracking-[0.12em] text-admin-fg-soft"
            style={{ fontFamily: "var(--font-plex-mono), monospace" }}
          >
            Message shown to users (optional)
          </label>
          <textarea
            id="maintMsg"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Back shortly — we're upgrading Legalezi."
            className="mt-2 block w-full resize-y rounded-md border border-admin-border bg-admin-bg px-3 py-2 text-[13.5px] text-admin-fg outline-none"
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-md px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--color-admin-accent)",
              opacity: !dirty || saving ? 0.5 : 1,
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {saved && !dirty ? (
            <span className="text-[12.5px] text-admin-accent">Saved ✓</span>
          ) : null}
          {error ? (
            <span className="text-[12.5px] text-admin-danger">{error}</span>
          ) : null}
        </div>
      </div>

      {/* Shortcuts to the other managed areas */}
      <div className="mt-6 rounded-lg border border-admin-border bg-admin-surface p-5">
        <div className="text-[13px] font-semibold text-admin-fg">
          Manage content
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <SettingsLink
            href="/admin/support"
            title="Support"
            sub="Tickets from the app"
          />
          <SettingsLink
            href="/admin/tutorials"
            title="Tutorials"
            sub="In-app media library"
          />
          <SettingsLink
            href="/admin/subscriptions"
            title="Subscriptions"
            sub="Plans & pricing"
          />
        </div>
      </div>

      {/* Roadmap */}
      <div className="mt-6 rounded-lg border border-dashed border-admin-border p-5">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-admin-fg">
            Invoices & billing
          </span>
          <span
            className="rounded-sm border border-admin-border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-admin-fg-soft"
            style={{ fontFamily: "var(--font-plex-mono), monospace" }}
          >
            Soon
          </span>
        </div>
        <p className="mt-1 text-[13px] text-admin-fg-muted">
          An editable invoice template and downloadable payment history are on
          the roadmap.
        </p>
      </div>
    </div>
  );
}

function SettingsLink({
  href,
  title,
  sub,
}: {
  href: string;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-md border border-admin-border px-3 py-2.5 transition-colors hover:border-admin-accent"
    >
      <div className="text-[13px] font-semibold text-admin-fg">{title}</div>
      <div className="text-[11.5px] text-admin-fg-muted">{sub}</div>
    </Link>
  );
}
