"use client";

import { useState } from "react";
import Link from "next/link";

type DiffEntry = { field: string; before: unknown; after: unknown };

export type ActivityItem = {
  id: string;
  actorName: string;
  actorEmail: string;
  actorType: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetName: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export default function ActivityRow({
  activity: a,
  delay,
}: {
  activity: ActivityItem;
  delay: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const colors = actionColor(a.action);
  const created = new Date(a.createdAt);
  const dateStr = created.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeStr = created.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const relative = relativeTime(created);
  const targetLink =
    a.targetType === "partner" && a.targetId
      ? `/admin/partners/${a.targetId}`
      : null;

  // Normalise changes — older entries may have string[] (just field names),
  // newer ones have DiffEntry[]. Keep both renderable.
  const rawChanges = (a.metadata?.changes ?? []) as unknown[];
  const diffs: DiffEntry[] = rawChanges
    .filter(
      (c): c is DiffEntry =>
        typeof c === "object" && c !== null && "field" in (c as object)
    );
  const legacyFields: string[] = rawChanges.filter(
    (c): c is string => typeof c === "string"
  );

  const hasDiffs = diffs.length > 0;
  const hasMetadataPills =
    hasDiffs ||
    legacyFields.length > 0 ||
    typeof a.metadata?.plan === "string" ||
    typeof a.metadata?.trialDays === "number";

  return (
    <li
      className="fade-up-sm relative grid grid-cols-[24px_1fr] gap-5 pb-5 last:pb-0"
      style={{ animationDelay: `${delay}s` }}
    >
      {/* Dot */}
      <div className="relative z-10">
        <div
          className={`mt-1 flex h-[22px] w-[22px] items-center justify-center rounded-full border-[3px] bg-admin-bg ${colors.border}`}
        >
          <div className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
        </div>
      </div>

      {/* Card */}
      <div className="rounded-lg border border-admin-border bg-admin-surface transition-shadow hover:shadow-[0_4px_20px_-12px_rgba(14,26,31,0.15)]">
        <div className="p-5">
          {/* Top row */}
          <div className="flex items-start justify-between gap-4">
            <span
              className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${colors.tag}`}
              style={{ fontFamily: "var(--font-plex-mono), monospace" }}
            >
              <span className={`block h-1 w-1 rounded-full ${colors.dot}`} />
              {a.action.replace(/_/g, " ")}
            </span>
            <div className="text-right">
              <div
                className="text-[11px] font-medium tabular-nums text-admin-fg"
                style={{ fontFamily: "var(--font-plex-mono), monospace" }}
              >
                {dateStr}
              </div>
              <div
                className="mt-0.5 text-[11px] tabular-nums text-admin-fg-soft"
                style={{ fontFamily: "var(--font-plex-mono), monospace" }}
              >
                {timeStr} · {relative}
              </div>
            </div>
          </div>

          {/* Actor */}
          <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12px]">
            <span className="font-semibold text-admin-fg">{a.actorName}</span>
            <span
              className="text-admin-fg-soft"
              style={{ fontFamily: "var(--font-plex-mono), monospace" }}
            >
              {a.actorEmail}
            </span>
            <span
              className="rounded-sm border border-admin-border bg-admin-bg px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-admin-fg-muted"
              style={{ fontFamily: "var(--font-plex-mono), monospace" }}
            >
              {a.actorType.replace("_", " ")}
            </span>
          </div>

          {/* Message */}
          <p className="mt-3 text-[14px] leading-6 text-admin-fg">
            {a.message}
          </p>

          {/* Inline change summary (compact) */}
          {hasMetadataPills && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-admin-border-soft pt-3">
              {targetLink && a.targetName && (
                <Link
                  href={targetLink}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-admin-accent transition-colors hover:text-admin-accent-hover"
                >
                  <span>→</span>
                  <span>{a.targetName}</span>
                </Link>
              )}

              {/* Inline summary of diff entries */}
              {diffs.slice(0, 3).map((d, i) => (
                <DiffPill key={i} diff={d} />
              ))}
              {diffs.length > 3 && (
                <span
                  className="text-[10px] tabular-nums text-admin-fg-soft"
                  style={{ fontFamily: "var(--font-plex-mono), monospace" }}
                >
                  +{diffs.length - 3} more
                </span>
              )}

              {/* Legacy string-only entries */}
              {!hasDiffs &&
                legacyFields.map((f, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-sm border border-admin-border-soft bg-admin-bg px-1.5 py-0.5 text-[10px] tabular-nums text-admin-fg-muted"
                    style={{ fontFamily: "var(--font-plex-mono), monospace" }}
                  >
                    <span className="text-admin-fg-soft">changed:</span>
                    <span className="text-admin-fg">{f}</span>
                  </span>
                ))}

              {typeof a.metadata?.plan === "string" && !hasDiffs && (
                <span
                  className="inline-flex items-center gap-1 rounded-sm border border-admin-border-soft bg-admin-bg px-1.5 py-0.5 text-[10px] tabular-nums text-admin-fg-muted"
                  style={{ fontFamily: "var(--font-plex-mono), monospace" }}
                >
                  <span className="text-admin-fg-soft">plan:</span>
                  <span className="text-admin-fg">
                    {String(a.metadata.plan)}
                  </span>
                </span>
              )}

              {/* Expand toggle */}
              {hasDiffs && (
                <button
                  type="button"
                  onClick={() => setExpanded((e) => !e)}
                  className="ml-auto inline-flex items-center gap-1 rounded-md border border-admin-border bg-admin-bg px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-admin-fg-muted transition-colors hover:border-admin-fg-soft hover:text-admin-fg"
                  style={{ fontFamily: "var(--font-plex-mono), monospace" }}
                >
                  <span>{expanded ? "Hide" : "Show"} diff</span>
                  <span
                    className="transition-transform"
                    style={{
                      transform: expanded ? "rotate(180deg)" : "rotate(0)",
                    }}
                  >
                    ▾
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Expanded — full diff table */}
        {expanded && hasDiffs && (
          <div className="border-t border-admin-border-soft bg-admin-bg/40 p-5">
            <div
              className="mb-3 text-[10px] font-medium uppercase tracking-[0.18em] text-admin-fg-soft"
              style={{ fontFamily: "var(--font-plex-mono), monospace" }}
            >
              Changes ({diffs.length})
            </div>
            <div className="space-y-2">
              {diffs.map((d, i) => (
                <DiffRow key={i} diff={d} />
              ))}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

/* ─────────── Diff helpers ─────────── */

function DiffPill({ diff }: { diff: DiffEntry }) {
  const before = formatValue(diff.before);
  const after = formatValue(diff.after);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm border border-admin-border-soft bg-admin-bg px-2 py-0.5 text-[10px] tabular-nums"
      style={{ fontFamily: "var(--font-plex-mono), monospace" }}
    >
      <span className="text-admin-fg-soft">{prettyField(diff.field)}:</span>
      <span className="text-admin-danger line-through opacity-70 max-w-[140px] truncate">
        {before}
      </span>
      <span className="text-admin-fg-soft">→</span>
      <span className="text-admin-accent font-medium max-w-[140px] truncate">
        {after}
      </span>
    </span>
  );
}

function DiffRow({ diff }: { diff: DiffEntry }) {
  // Special case: features array — show count diff + list comparison
  if (diff.field === "features" && Array.isArray(diff.before) && Array.isArray(diff.after)) {
    const before = diff.before as string[];
    const after = diff.after as string[];
    const added = after.filter((x) => !before.includes(x));
    const removed = before.filter((x) => !after.includes(x));
    return (
      <div className="rounded-md border border-admin-border bg-admin-surface p-3">
        <div className="flex items-baseline justify-between">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-admin-fg"
            style={{ fontFamily: "var(--font-plex-mono), monospace" }}
          >
            features
          </span>
          <span
            className="text-[10px] text-admin-fg-soft"
            style={{ fontFamily: "var(--font-plex-mono), monospace" }}
          >
            {before.length} → {after.length}
          </span>
        </div>
        {(added.length > 0 || removed.length > 0) && (
          <div className="mt-2 space-y-1">
            {added.map((x, i) => (
              <div
                key={`a-${i}`}
                className="flex items-baseline gap-2 text-[12px] text-admin-accent"
              >
                <span className="font-mono text-[10px]">+</span>
                <span>{x}</span>
              </div>
            ))}
            {removed.map((x, i) => (
              <div
                key={`r-${i}`}
                className="flex items-baseline gap-2 text-[12px] text-admin-danger line-through opacity-70"
              >
                <span className="font-mono text-[10px]">−</span>
                <span>{x}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Booleans — render with chips
  if (typeof diff.before === "boolean" && typeof diff.after === "boolean") {
    return (
      <div className="grid grid-cols-[160px_1fr_24px_1fr] items-center gap-3 rounded-md border border-admin-border bg-admin-surface px-3 py-2.5">
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-admin-fg"
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          {prettyField(diff.field)}
        </span>
        <span
          className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${
            diff.before
              ? "bg-admin-accent-soft text-admin-accent"
              : "bg-admin-border-soft text-admin-fg-soft"
          }`}
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          {diff.before ? "On" : "Off"}
        </span>
        <span className="text-center text-admin-fg-soft">→</span>
        <span
          className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${
            diff.after
              ? "bg-admin-accent-soft text-admin-accent"
              : "bg-admin-border-soft text-admin-fg-soft"
          }`}
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          {diff.after ? "On" : "Off"}
        </span>
      </div>
    );
  }

  // Date strings
  if (
    diff.field.toLowerCase().includes("date") &&
    typeof diff.before === "string" &&
    typeof diff.after === "string"
  ) {
    const fmt = (s: string) =>
      new Date(s).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    return (
      <div className="grid grid-cols-[160px_1fr_24px_1fr] items-center gap-3 rounded-md border border-admin-border bg-admin-surface px-3 py-2.5">
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-admin-fg"
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          {prettyField(diff.field)}
        </span>
        <span
          className="font-mono text-[11px] text-admin-fg-muted line-through opacity-70 truncate"
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          {fmt(diff.before)}
        </span>
        <span className="text-center text-admin-fg-soft">→</span>
        <span
          className="font-mono text-[11px] font-semibold text-admin-accent truncate"
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          {fmt(diff.after)}
        </span>
      </div>
    );
  }

  // Generic — string / number / etc.
  const before = formatValue(diff.before);
  const after = formatValue(diff.after);
  const isLong = before.length > 60 || after.length > 60;

  if (isLong) {
    return (
      <div className="rounded-md border border-admin-border bg-admin-surface p-3">
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-admin-fg"
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          {prettyField(diff.field)}
        </span>
        <div className="mt-2 grid gap-2">
          <div className="rounded bg-admin-danger-soft/50 px-3 py-2">
            <div
              className="text-[9px] font-medium uppercase tracking-[0.18em] text-admin-danger"
              style={{ fontFamily: "var(--font-plex-mono), monospace" }}
            >
              Was
            </div>
            <div className="mt-1 font-body text-[13px] leading-6 text-admin-fg">
              {before}
            </div>
          </div>
          <div className="rounded bg-admin-accent-soft/60 px-3 py-2">
            <div
              className="text-[9px] font-medium uppercase tracking-[0.18em] text-admin-accent"
              style={{ fontFamily: "var(--font-plex-mono), monospace" }}
            >
              Now
            </div>
            <div className="mt-1 font-body text-[13px] leading-6 text-admin-fg">
              {after}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[160px_1fr_24px_1fr] items-center gap-3 rounded-md border border-admin-border bg-admin-surface px-3 py-2.5">
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.14em] text-admin-fg"
        style={{ fontFamily: "var(--font-plex-mono), monospace" }}
      >
        {prettyField(diff.field)}
      </span>
      <span
        className="text-[12px] tabular-nums text-admin-fg-muted line-through opacity-70 truncate"
        style={{ fontFamily: "var(--font-plex-mono), monospace" }}
      >
        {before}
      </span>
      <span className="text-center text-admin-fg-soft">→</span>
      <span
        className="text-[12px] font-semibold tabular-nums text-admin-accent truncate"
        style={{ fontFamily: "var(--font-plex-mono), monospace" }}
      >
        {after}
      </span>
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return v.toLocaleString("en-IN");
  if (typeof v === "string") return v.length === 0 ? "—" : v;
  if (Array.isArray(v)) return `[${v.length} items]`;
  return JSON.stringify(v);
}

function prettyField(f: string): string {
  const map: Record<string, string> = {
    priceLabel: "Display price",
    priceAmount: "Price (₹)",
    priceSuffix: "Price suffix",
    seatLimit: "Seat limit",
    matterLimit: "Matter limit",
    sortOrder: "Sort order",
    isPopular: "Most popular",
    showOnLanding: "Show on landing",
    isActive: "Active",
    ctaLabel: "CTA label",
    billingCycle: "Billing cycle",
    primaryContactName: "Contact name",
    trialEndDate: "Trial end date",
    trialExtendedBy: "Days extended",
    label: "Plan label",
    tagline: "Tagline",
    description: "Description",
    name: "Name",
    phone: "Phone",
    city: "City",
    state: "State",
    plan: "Plan",
    status: "Status",
    features: "Modules",
  };
  return map[f] ?? f;
}

function actionColor(action: string): {
  border: string;
  dot: string;
  tag: string;
} {
  if (action === "partner_created" || action === "plan_updated") {
    return {
      border: "border-admin-accent",
      dot: "bg-admin-accent",
      tag: "bg-admin-accent-soft text-admin-accent",
    };
  }
  if (action === "partner_password_reset") {
    return {
      border: "border-admin-warning",
      dot: "bg-admin-warning",
      tag: "bg-admin-warning-soft text-admin-warning",
    };
  }
  if (action === "partner_suspended" || action === "partner_deleted") {
    return {
      border: "border-admin-danger",
      dot: "bg-admin-danger",
      tag: "bg-admin-danger-soft text-admin-danger",
    };
  }
  if (
    action === "partner_updated" ||
    action === "partner_plan_changed" ||
    action === "partner_features_changed" ||
    action === "partner_trial_extended" ||
    action === "partner_unsuspended"
  ) {
    return {
      border: "border-admin-saffron",
      dot: "bg-admin-saffron",
      tag: "bg-admin-saffron-soft text-admin-saffron",
    };
  }
  return {
    border: "border-admin-border",
    dot: "bg-admin-fg-soft",
    tag: "bg-admin-bg text-admin-fg-muted",
  };
}

function relativeTime(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const week = Math.floor(day / 7);
  if (week < 5) return `${week}w ago`;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
