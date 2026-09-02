"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReminderCard, { type ReminderDTO } from "./ReminderCard";
import NewReminderSheet from "./NewReminderSheet";
import type { SeniorDeskMember } from "./SeniorDeskClient";

// Reminders panel — owns the bucket toggle (Mine | Office) and renders a
// card list, with a "+ New" button up top. Admins can flip to the Office
// bucket to see everyone's pending and completed items.
//
// Buckets are server-driven (see /api/app/reminders) so the same render
// pipeline handles dated, undated, overdue, and done items consistently.

type Bucket = "mine_active" | "mine_done" | "office_active" | "office_done";

export default function RemindersPanel({
  me,
  members,
  isAdmin,
}: {
  me: SeniorDeskMember;
  members: SeniorDeskMember[];
  isAdmin: boolean;
}) {
  const [bucket, setBucket] = useState<Bucket>("mine_active");
  const [items, setItems] = useState<ReminderDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(
    async (b: Bucket) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/app/reminders?bucket=${b}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          setItems((data.reminders || []) as ReminderDTO[]);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load(bucket);
  }, [bucket, load]);

  // Refresh on a slow timer so other people's activity surfaces here too.
  useEffect(() => {
    const t = setInterval(() => load(bucket), 30_000);
    return () => clearInterval(t);
  }, [bucket, load]);

  const grouped = useMemo(() => groupByBucket(items, bucket), [items, bucket]);

  async function toggleStatus(r: ReminderDTO) {
    const next = r.status === "done" ? "pending" : "done";
    const res = await fetch(`/api/app/reminders/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) load(bucket);
  }

  async function deleteReminder(r: ReminderDTO) {
    if (
      !window.confirm(
        `Delete "${r.title}"? This can't be undone.`
      )
    )
      return;
    const res = await fetch(`/api/app/reminders/${r.id}`, {
      method: "DELETE",
    });
    if (res.ok) load(bucket);
  }

  async function createReminder(input: {
    title: string;
    description: string;
    dueDate: string | null;
    priority: "low" | "normal" | "high";
    assignedToUserId: string;
  }): Promise<boolean> {
    const res = await fetch("/api/app/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      load(bucket);
      return true;
    }
    return false;
  }

  return (
    <div
      className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-2xl"
      style={{
        backgroundColor: "var(--color-app-canvas-2)",
        border: "1px solid var(--color-app-edge)",
      }}
    >
      <Header
        bucket={bucket}
        setBucket={setBucket}
        isAdmin={isAdmin}
        onNew={() => setSheetOpen(true)}
        meName={me.name}
      />

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <div
              className="h-7 w-7 animate-spin rounded-full"
              style={{
                borderWidth: 2.5,
                borderStyle: "solid",
                borderColor: "var(--color-app-edge)",
                borderTopColor: "var(--color-app-copper)",
              }}
            />
          </div>
        ) : items.length === 0 ? (
          <Empty bucket={bucket} onNew={() => setSheetOpen(true)} />
        ) : (
          <div className="space-y-7">
            {grouped.map((g) =>
              g.rows.length === 0 ? null : (
                <div key={g.label}>
                  <div
                    className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em]"
                    style={{
                      fontFamily: "var(--font-dm-mono), monospace",
                      color: g.tone === "danger"
                        ? "var(--color-app-danger)"
                        : g.tone === "warn"
                          ? "var(--color-app-copper-deep)"
                          : "var(--color-app-fg-muted)",
                    }}
                  >
                    {g.label} · {g.rows.length}
                  </div>
                  <ul className="space-y-3">
                    {g.rows.map((r) => (
                      <ReminderCard
                        key={r.id}
                        reminder={r}
                        callerId={me.id}
                        isAdmin={isAdmin}
                        onToggle={() => toggleStatus(r)}
                        onDelete={() => deleteReminder(r)}
                      />
                    ))}
                  </ul>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {sheetOpen ? (
        <NewReminderSheet
          me={me}
          members={members}
          onCreate={createReminder}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}
    </div>
  );
}

function Header({
  bucket,
  setBucket,
  isAdmin,
  onNew,
  meName,
}: {
  bucket: Bucket;
  setBucket: (b: Bucket) => void;
  isAdmin: boolean;
  onNew: () => void;
  meName: string;
}) {
  const tabs: { key: Bucket; label: string; show: boolean }[] = [
    { key: "mine_active", label: `${meName.split(" ")[0]}'s pending`, show: true },
    { key: "mine_done", label: "Mine — done", show: true },
    { key: "office_active", label: "Office — pending", show: isAdmin },
    { key: "office_done", label: "Office — done", show: isAdmin },
  ];
  return (
    <div
      className="flex items-center justify-between gap-4 px-6 py-4"
      style={{
        backgroundColor: "var(--color-app-paper)",
        borderBottom: "1px solid var(--color-app-edge)",
      }}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {tabs.filter((t) => t.show).map((t) => {
          const active = bucket === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setBucket(t.key)}
              className="rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                backgroundColor: active
                  ? "var(--color-app-ink)"
                  : "transparent",
                color: active
                  ? "var(--color-app-ivory)"
                  : "var(--color-app-fg-soft)",
                boxShadow: active
                  ? "0 6px 16px -10px rgba(10,17,36,0.45)"
                  : "none",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <button
        onClick={onNew}
        className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[12px] font-semibold uppercase tracking-[0.14em]"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          backgroundColor: "var(--color-app-copper)",
          color: "var(--color-app-copper-text)",
          boxShadow: "0 6px 16px -10px rgba(197,133,58,0.6)",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
        New reminder
      </button>
    </div>
  );
}

function Empty({
  bucket,
  onNew,
}: {
  bucket: Bucket;
  onNew: () => void;
}) {
  const message = (() => {
    switch (bucket) {
      case "mine_done":
        return "Nothing checked off yet — once you mark a reminder as done, it'll move here.";
      case "office_active":
        return "No active reminders across the office.";
      case "office_done":
        return "No completed reminders to show.";
      case "mine_active":
      default:
        return "Inbox zero — nothing to remind you about right now. Tap New to add one.";
    }
  })();
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
      <div
        className="mb-5 flex h-14 w-14 items-center justify-center rounded-full"
        style={{
          backgroundColor: "var(--color-app-paper)",
          color: "var(--color-app-copper-deep)",
          boxShadow: "0 1px 0 var(--color-app-edge)",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 11.5l2 2 4-4.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      </div>
      <p
        className="max-w-md text-[13.5px] leading-[1.6]"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          color: "var(--color-app-fg-muted)",
        }}
      >
        {message}
      </p>
      {bucket === "mine_active" ? (
        <button
          onClick={onNew}
          className="mt-5 inline-flex items-center gap-2 rounded-md px-4 py-2 text-[12px] font-semibold"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            backgroundColor: "var(--color-app-ink)",
            color: "var(--color-app-ivory)",
          }}
        >
          Add a reminder
        </button>
      ) : null}
    </div>
  );
}

type Group = {
  label: string;
  rows: ReminderDTO[];
  tone: "danger" | "warn" | "default";
};

function groupByBucket(rows: ReminderDTO[], bucket: Bucket): Group[] {
  if (bucket === "mine_done" || bucket === "office_done") {
    return [{ label: "Completed", rows, tone: "default" }];
  }
  // Active buckets: split overdue / today / upcoming / undated
  const overdue: ReminderDTO[] = [];
  const today: ReminderDTO[] = [];
  const upcoming: ReminderDTO[] = [];
  const undated: ReminderDTO[] = [];
  for (const r of rows) {
    if (r.isOverdue) overdue.push(r);
    else if (r.isDueToday) today.push(r);
    else if (r.dueDate) upcoming.push(r);
    else undated.push(r);
  }
  return [
    { label: "Overdue", rows: overdue, tone: "danger" },
    { label: "Due today", rows: today, tone: "warn" },
    { label: "Upcoming", rows: upcoming, tone: "default" },
    { label: "No date", rows: undated, tone: "default" },
  ];
}
