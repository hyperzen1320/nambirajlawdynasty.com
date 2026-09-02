"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useBoardLiveFeed } from "@/lib/use-board-live-feed";

export type ActivityRow = {
  id: string;
  actorUserId: string | null;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetName: string;
  message: string;
  metadata: Record<string, unknown>;
  boardId: string | null;
  createdAt: string;
};

export type ActivityActor = { id: string; name: string };
export type ActivityBoardOption = {
  id: string;
  title: string;
  color: string;
};

type DateRangeKey = "any" | "today" | "7d" | "30d" | "month" | "custom";

const DATE_RANGE_PRESETS: { key: DateRangeKey; label: string }[] = [
  { key: "any", label: "Any time" },
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "custom", label: "Custom" },
];

// Returns yyyy-mm-dd ISO date strings for the from/to bounds of a preset.
function computeDateRange(
  key: DateRangeKey,
  customFrom?: string,
  customTo?: string
): { from: string; to: string } {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  switch (key) {
    case "any":
      return { from: "", to: "" };
    case "today":
      return { from: iso(today), to: iso(today) };
    case "7d": {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { from: iso(start), to: iso(today) };
    }
    case "30d": {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return { from: iso(start), to: iso(today) };
    }
    case "month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: iso(start), to: iso(today) };
    }
    case "custom":
      return { from: customFrom ?? "", to: customTo ?? "" };
  }
}

const ACTION_FAMILIES: { key: string; label: string; prefix: string }[] = [
  { key: "all", label: "Everything", prefix: "" },
  { key: "task", label: "Cards", prefix: "task." },
  { key: "list", label: "Lists", prefix: "list." },
  { key: "board", label: "Boards", prefix: "board." },
  { key: "checklist", label: "Checklists", prefix: "checklist" }, // catches both checklist. and checklist_item.
  { key: "case", label: "Cases", prefix: "case." },
  { key: "client", label: "Clients", prefix: "client." },
  { key: "court", label: "Courts", prefix: "court." },
  { key: "prompt", label: "Prompts", prefix: "prompt." },
  { key: "chat", label: "Chats", prefix: "chat." },
  { key: "reminder", label: "Reminders", prefix: "reminder." },
  { key: "user", label: "People", prefix: "user." },
  { key: "profile", label: "Profile", prefix: "profile." },
];

export default function ActivityClient({
  initialActivity,
  initialNextCursor,
  actors,
  boards,
  isAdmin,
  retentionDays,
}: {
  initialActivity: ActivityRow[];
  initialNextCursor: string | null;
  actors: ActivityActor[];
  boards: ActivityBoardOption[];
  isAdmin: boolean;
  retentionDays: number | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ActivityRow[]>(initialActivity);
  const [cursor, setCursor] = useState<string | null>(initialNextCursor);
  const [loading, setLoading] = useState(false);

  const [actorId, setActorId] = useState("");
  const [boardId, setBoardId] = useState("");
  const [actionFamily, setActionFamily] = useState("all");
  const [view, setView] = useState<"activity" | "requests">("activity");
  const [selectedRow, setSelectedRow] = useState<ActivityRow | null>(null);

  // Date-range filter. `dateRange` is a preset key the user clicked
  // ("any", "today", "7d", "30d", "custom"); `dateFrom` and `dateTo` hold
  // the actual ISO dates (yyyy-mm-dd) sent to the server. Presets compute
  // the dates on the fly so the user doesn't deal with picker fields
  // unless they want a custom window.
  const [dateRange, setDateRange] = useState<DateRangeKey>("any");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Partner-wide live feed: anything new (across cases, clients, boards,
  // hearings, profile, users) prepends to the visible feed without
  // requiring a page refresh. Filters apply at render time so live rows
  // respect the user's current actor/board/family selections.
  const live = useBoardLiveFeed({
    boardId: null,
    initialSinceId: initialActivity[0]?.id ?? null,
  });

  // Keep track of which live rows we've already merged into `rows` so
  // pagination + filter changes don't replay them.
  const mergedLiveIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (live.newRows.length === 0) return;
    const fresh = live.newRows.filter((r) => !mergedLiveIdsRef.current.has(r.id));
    if (fresh.length === 0) return;
    for (const r of fresh) mergedLiveIdsRef.current.add(r.id);
    setRows((prev) => {
      // Live rows arrive ascending; the feed renders newest-first so we
      // reverse before prepending.
      const ascending = fresh.slice().reverse();
      // Drop any existing rows that share an id with a fresh live row
      // (defence against duplicates from a re-fetch + live race).
      const filtered = prev.filter((p) => !mergedLiveIdsRef.current.has(p.id) || ascending.every((a) => a.id !== p.id));
      return [...ascending, ...filtered];
    });
  }, [live.newRows]);

  const grouped = useMemo(() => groupByDay(rows), [rows]);

  const fetchPage = useCallback(
    async (params: {
      actor?: string;
      board?: string;
      family?: string;
      before?: string | null;
      from?: string;
      to?: string;
      reset?: boolean;
    }) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        if (params.actor) qs.set("actor", params.actor);
        if (params.board) qs.set("board", params.board);
        if (params.family && params.family !== "all") {
          qs.set("actionPrefix", familyToPrefix(params.family));
        }
        if (params.before) qs.set("before", params.before);
        if (params.from) qs.set("from", params.from);
        if (params.to) qs.set("to", params.to);
        qs.set("limit", "50");
        const res = await fetch(`/api/app/activity?${qs.toString()}`);
        const data = await res.json();
        if (res.ok) {
          if (params.reset) {
            setRows(data.activity);
          } else {
            setRows((prev) => [...prev, ...data.activity]);
          }
          setCursor(data.nextCursor);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Apply a date preset. Computes the from/to ISO dates and refetches.
  const applyDateRange = useCallback(
    (key: DateRangeKey, customFrom?: string, customTo?: string) => {
      setDateRange(key);
      const { from, to } = computeDateRange(key, customFrom, customTo);
      setDateFrom(from);
      setDateTo(to);
      fetchPage({
        actor: actorId,
        board: boardId,
        family: actionFamily,
        from,
        to,
        reset: true,
      });
    },
    [actorId, boardId, actionFamily, fetchPage]
  );

  function applyFilters() {
    fetchPage({
      actor: actorId,
      board: boardId,
      family: actionFamily,
      from: dateFrom,
      to: dateTo,
      reset: true,
    });
  }

  function clearFilters() {
    setActorId("");
    setBoardId("");
    setActionFamily("all");
    setDateRange("any");
    setDateFrom("");
    setDateTo("");
    fetchPage({ reset: true });
  }

  function loadMore() {
    if (!cursor) return;
    fetchPage({
      actor: actorId,
      board: boardId,
      family: actionFamily,
      from: dateFrom,
      to: dateTo,
      before: cursor,
    });
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2
            className="text-[30px] font-semibold tracking-tight leading-[1.1] sm:text-[40px]"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            Activity
          </h2>
          <p
            className="mt-2 text-[13px]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-fg-muted)",
            }}
          >
            Office audit log — every change in Work Flow, who did what and
            when.
          </p>
        </div>
        {isAdmin ? <RetentionPill current={retentionDays} /> : null}
      </div>

      {/* View toggle: Activity vs Delete Requests */}
      <div className="mt-7 flex items-center gap-2">
        <button
          onClick={() => setView("activity")}
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-[13px] font-semibold transition-all"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            backgroundColor:
              view === "activity"
                ? "var(--color-app-ink)"
                : "var(--color-app-paper)",
            color:
              view === "activity"
                ? "var(--color-app-ivory)"
                : "var(--color-app-fg-soft)",
            boxShadow:
              view === "activity"
                ? "0 6px 16px -10px rgba(10,17,36,0.45)"
                : "0 1px 0 var(--color-app-edge)",
          }}
        >
          Activity
        </button>
        <button
          onClick={() => setView("requests")}
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-[13px] font-semibold transition-all"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            backgroundColor:
              view === "requests"
                ? "var(--color-app-ink)"
                : "var(--color-app-paper)",
            color:
              view === "requests"
                ? "var(--color-app-ivory)"
                : "var(--color-app-fg-soft)",
            boxShadow:
              view === "requests"
                ? "0 6px 16px -10px rgba(10,17,36,0.45)"
                : "0 1px 0 var(--color-app-edge)",
          }}
        >
          {isAdmin ? "Delete requests" : "My requests"}
          <PendingRequestsBadge isAdmin={isAdmin} />
        </button>
      </div>

      {view === "requests" ? (
        <DeleteRequestsPanel isAdmin={isAdmin} />
      ) : null}

      {selectedRow ? (
        <ActivityDetailModal
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
        />
      ) : null}

      {/* Activity feed (action filters + grouped feed + load more) */}
      <div style={{ display: view === "activity" ? "block" : "none" }}>
      <div className="mt-7">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {ACTION_FAMILIES.map((f) => {
            const active = actionFamily === f.key;
            return (
              <button
                key={f.key}
                onClick={() => {
                  setActionFamily(f.key);
                  fetchPage({
                    actor: actorId,
                    board: boardId,
                    family: f.key,
                    reset: true,
                  });
                }}
                className="rounded-md px-2.5 py-1 text-[11px] font-medium transition-all sm:px-3 sm:py-1.5 sm:text-[12px]"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  backgroundColor: active
                    ? "var(--color-app-ink)"
                    : "var(--color-app-paper)",
                  color: active
                    ? "var(--color-app-ivory)"
                    : "var(--color-app-fg-soft)",
                  boxShadow: active
                    ? "0 6px 16px -10px rgba(10,17,36,0.45)"
                    : "0 1px 0 var(--color-app-edge)",
                }}
              >
                {f.label}
              </button>
            );
          })}

          <div className="mt-2 flex w-full items-center gap-2 sm:ml-auto sm:mt-0 sm:w-auto">
            <select
              value={actorId}
              onChange={(e) => {
                setActorId(e.target.value);
                fetchPage({
                  actor: e.target.value,
                  board: boardId,
                  family: actionFamily,
                  reset: true,
                });
              }}
              className="flex-1 rounded-md border px-3 py-1.5 text-[12px] outline-none sm:flex-none"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                borderColor: "var(--color-app-edge)",
                backgroundColor: "var(--color-app-paper)",
                color: "var(--color-app-ink)",
              }}
            >
              <option value="">Anyone</option>
              {actors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <select
              value={boardId}
              onChange={(e) => {
                setBoardId(e.target.value);
                fetchPage({
                  actor: actorId,
                  board: e.target.value,
                  family: actionFamily,
                  reset: true,
                });
              }}
              className="flex-1 rounded-md border px-3 py-1.5 text-[12px] outline-none sm:flex-none"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                borderColor: "var(--color-app-edge)",
                backgroundColor: "var(--color-app-paper)",
                color: "var(--color-app-ink)",
              }}
            >
              <option value="">All boards</option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
            {(actorId || boardId || actionFamily !== "all" || dateRange !== "any") && (
              <button
                onClick={clearFilters}
                className="text-[11px] uppercase"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  color: "var(--color-app-fg-muted)",
                  letterSpacing: 1.2,
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Date-range row — preset chips + custom range pickers when chosen */}
        <div
          className="mt-3 flex flex-wrap items-center gap-1.5 rounded-xl px-2.5 py-2 sm:gap-2 sm:px-3 sm:py-2.5"
          style={{
            backgroundColor: "var(--color-app-paper)",
            boxShadow: "0 1px 0 var(--color-app-edge)",
          }}
        >
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.18em] mr-1.5"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-muted)",
            }}
          >
            When
          </span>
          {DATE_RANGE_PRESETS.map((p) => {
            const active = dateRange === p.key;
            return (
              <button
                key={p.key}
                onClick={() => applyDateRange(p.key)}
                className="rounded-md px-2.5 py-1 text-[11px] font-medium transition-all sm:px-3 sm:py-1.5 sm:text-[12px]"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  backgroundColor: active
                    ? "var(--color-app-copper)"
                    : "var(--color-app-canvas-2)",
                  color: active
                    ? "var(--color-app-copper-text)"
                    : "var(--color-app-fg-soft)",
                  boxShadow: active
                    ? "0 6px 14px -8px rgba(197,133,58,0.55)"
                    : undefined,
                }}
              >
                {p.label}
              </button>
            );
          })}
          {dateRange === "custom" ? (
            <div className="flex items-center gap-1.5 ml-1">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) =>
                  applyDateRange("custom", e.target.value, dateTo)
                }
                className="rounded-md border px-2.5 py-1 text-[12px] outline-none"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  borderColor: "var(--color-app-edge)",
                  backgroundColor: "var(--color-app-paper)",
                  color: "var(--color-app-ink)",
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  color: "var(--color-app-fg-muted)",
                  fontSize: 12,
                }}
              >
                →
              </span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) =>
                  applyDateRange("custom", dateFrom, e.target.value)
                }
                className="rounded-md border px-2.5 py-1 text-[12px] outline-none"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  borderColor: "var(--color-app-edge)",
                  backgroundColor: "var(--color-app-paper)",
                  color: "var(--color-app-ink)",
                }}
              />
            </div>
          ) : dateFrom && dateTo ? (
            <span
              className="ml-1 text-[11px]"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                color: "var(--color-app-fg-muted)",
              }}
            >
              {dateFrom === dateTo
                ? dateFrom
                : `${dateFrom} → ${dateTo}`}
            </span>
          ) : null}
        </div>
      </div>

      {/* Feed */}
      {rows.length === 0 ? (
        <div
          className="mt-7 rounded-xl px-5 py-16 text-center"
          style={{
            backgroundColor: "var(--color-app-paper)",
            border: "1px dashed var(--color-app-edge)",
          }}
        >
          <p
            className="text-[14px]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-fg-muted)",
            }}
          >
            No activity yet — once anyone in your office moves a card or
            checks off an item, it&rsquo;ll show here.
          </p>
        </div>
      ) : (
        <div className="mt-7 space-y-7">
          {grouped.map((g, gi) => (
            <div key={g.label}>
              <h3
                className="sticky top-[68px] z-10 mb-3 text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  color: "var(--color-app-copper-deep)",
                }}
              >
                {g.label}
              </h3>
              <ul
                className="rounded-xl divide-y"
                style={{
                  backgroundColor: "var(--color-app-paper)",
                  boxShadow: "0 1px 0 var(--color-app-edge)",
                }}
              >
                {g.rows.map((a, i) => (
                  <li
                    key={a.id}
                    onClick={() => setSelectedRow(a)}
                    className="fade-up-sm px-5 py-3.5 flex items-start gap-3 cursor-pointer transition-colors hover:bg-[var(--color-app-canvas-2)]"
                    style={{
                      animationDelay: `${Math.min(i, 12) * 25 + gi * 30}ms`,
                      borderColor: "var(--color-app-edge-soft)",
                    }}
                  >
                    <span
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold"
                      style={{
                        fontFamily:
                          "var(--font-crimson), Georgia, serif",
                        backgroundColor: "var(--color-app-ink)",
                        color: "var(--color-app-ivory)",
                      }}
                      title={a.actorName}
                    >
                      {initials(a.actorName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div
                        className="text-[13px] leading-[1.5]"
                        style={{
                          fontFamily: "var(--font-manrope), sans-serif",
                          color: "var(--color-app-ink)",
                        }}
                        dangerouslySetInnerHTML={{
                          __html: renderMessage(a.actorName, a.message),
                        }}
                      />
                      <div className="mt-1 flex items-center gap-2 text-[11px]">
                        <span
                          style={{
                            fontFamily:
                              "var(--font-dm-mono), monospace",
                            color: "var(--color-app-fg-muted)",
                            letterSpacing: 0.3,
                          }}
                        >
                          {fmtTime(a.createdAt)}
                        </span>
                        {a.boardId ? (
                          <Link
                            href={`/app/workflow/${a.boardId}`}
                            className="rounded px-2 py-0.5 transition-colors"
                            style={{
                              fontFamily:
                                "var(--font-dm-mono), monospace",
                              color: "var(--color-app-copper-deep)",
                              backgroundColor:
                                "rgba(197,133,58,0.10)",
                              letterSpacing: 0.3,
                            }}
                          >
                            Open board
                          </Link>
                        ) : null}
                      </div>
                    </div>
                    <ActionChip action={a.action} />
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {cursor ? (
            <div className="flex justify-center">
              <button
                onClick={loadMore}
                disabled={loading}
                className="rounded-md border px-5 py-2 text-[12px] font-semibold transition-colors"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  borderColor: "var(--color-app-edge)",
                  backgroundColor: "var(--color-app-paper)",
                  color: "var(--color-app-fg-soft)",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? "Loading…" : "Load older"}
              </button>
            </div>
          ) : null}
        </div>
      )}
      </div>{/* end legacy hidden wrapper */}
    </>
  );
}

/* ─── Retention pill (admin) ─── */

function RetentionPill({ current }: { current: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const options: { v: number | null; label: string; sub: string }[] = [
    { v: null, label: "Keep forever", sub: "No auto-delete." },
    { v: 90, label: "Auto-delete after 90 days", sub: "Quarterly cleanup." },
    { v: 180, label: "Auto-delete after 180 days", sub: "Half-yearly cleanup." },
    { v: 365, label: "Auto-delete after 365 days", sub: "Yearly cleanup." },
  ];

  // Read the label off the option list so a new choice never needs a second
  // edit here to display correctly.
  const label =
    options.find((o) => o.v === current)?.label ??
    `Auto-delete after ${current} days`;

  async function update(v: number | null) {
    setBusy(true);
    try {
      const res = await fetch("/api/app/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityRetentionDays: v }),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-md border px-3.5 py-2 text-[12px] font-semibold"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          borderColor: "var(--color-app-edge)",
          backgroundColor: "var(--color-app-paper)",
          color: "var(--color-app-ink)",
        }}
      >
        <RetentionIcon />
        {label}
        <ChevronIcon />
      </button>
      {open ? (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute left-0 top-12 z-40 min-w-[280px] max-w-[calc(100vw-2rem)] rounded-xl p-1.5 sm:left-auto sm:right-0"
            style={{
              backgroundColor: "var(--color-app-paper)",
              boxShadow: "0 16px 32px -10px rgba(10,17,36,0.25)",
              border: "1px solid var(--color-app-edge)",
            }}
          >
            {options.map((o) => {
              const active = current === o.v;
              return (
                <button
                  key={o.label}
                  onClick={() => !busy && update(o.v)}
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
                  style={{
                    backgroundColor: active
                      ? "var(--color-app-canvas-2)"
                      : "transparent",
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  <span
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: active
                        ? "var(--color-app-copper)"
                        : "var(--color-app-paper)",
                      border: active
                        ? "1px solid var(--color-app-copper)"
                        : "1.5px solid var(--color-app-edge)",
                    }}
                  >
                    {active ? (
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor: "var(--color-app-copper-text)",
                        }}
                      />
                    ) : null}
                  </span>
                  <div className="min-w-0">
                    <div
                      className="text-[13px] font-semibold"
                      style={{
                        fontFamily: "var(--font-manrope), sans-serif",
                        color: "var(--color-app-ink)",
                      }}
                    >
                      {o.label}
                    </div>
                    <div
                      className="mt-0.5 text-[11px]"
                      style={{
                        fontFamily: "var(--font-manrope), sans-serif",
                        color: "var(--color-app-fg-muted)",
                      }}
                    >
                      {o.sub}
                    </div>
                  </div>
                </button>
              );
            })}
            <div
              className="mx-3 mt-1 mb-2 border-t pt-2 text-[11px]"
              style={{
                borderColor: "var(--color-app-edge-soft)",
                fontFamily: "var(--font-manrope), sans-serif",
                color: "var(--color-app-fg-muted)",
              }}
            >
              Pruning runs lazily on every Activity page load. Existing
              entries older than the chosen window will be removed on the
              next visit.
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ─── Action chip ─── */

function ActionChip({ action }: { action: string }) {
  const verb =
    action.startsWith("task.") || action.startsWith("checklist")
      ? "Card"
      : action.startsWith("list.")
        ? "List"
        : action.startsWith("board.")
          ? "Board"
          : action.startsWith("chat.")
            ? "Chat"
            : action.startsWith("reminder.")
              ? "Reminder"
              : "System";
  const colors: Record<string, { bg: string; fg: string }> = {
    Card: {
      bg: "var(--color-app-aqua-soft)",
      fg: "var(--color-app-aqua)",
    },
    List: {
      bg: "rgba(197,133,58,0.18)",
      fg: "var(--color-app-copper-deep)",
    },
    Board: {
      bg: "rgba(10,17,36,0.10)",
      fg: "var(--color-app-ink)",
    },
    Chat: {
      bg: "rgba(10,17,36,0.10)",
      fg: "var(--color-app-ink)",
    },
    Reminder: {
      bg: "rgba(197,133,58,0.18)",
      fg: "var(--color-app-copper-deep)",
    },
    System: {
      bg: "var(--color-app-canvas-2)",
      fg: "var(--color-app-fg-muted)",
    },
  };
  const c = colors[verb];
  return (
    <span
      className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em]"
      style={{
        fontFamily: "var(--font-dm-mono), monospace",
        backgroundColor: c.bg,
        color: c.fg,
      }}
    >
      {verb}
    </span>
  );
}

/* ─── Helpers ─── */

function familyToPrefix(family: string): string {
  if (family === "task") return "task.";
  if (family === "list") return "list.";
  if (family === "board") return "board.";
  if (family === "checklist") return "checklist";
  if (family === "case") return "case.";
  if (family === "client") return "client.";
  if (family === "court") return "court.";
  if (family === "prompt") return "prompt.";
  if (family === "chat") return "chat.";
  if (family === "reminder") return "reminder.";
  if (family === "user") return "user.";
  if (family === "profile") return "profile.";
  return "";
}

function groupByDay(
  rows: ActivityRow[]
): { label: string; rows: ActivityRow[] }[] {
  const groups: Record<string, { label: string; rows: ActivityRow[] }> = {};
  const order: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  for (const r of rows) {
    const d = new Date(r.createdAt);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString();
    let label: string;
    if (d.getTime() === today.getTime()) label = "Today";
    else if (d.getTime() === yesterday.getTime()) label = "Yesterday";
    else
      label = d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year:
          d.getFullYear() !== new Date().getFullYear()
            ? "numeric"
            : undefined,
      });
    if (!groups[key]) {
      groups[key] = { label, rows: [] };
      order.push(key);
    }
    groups[key].rows.push(r);
  }
  return order.map((k) => groups[k]);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderMessage(actor: string, message: string): string {
  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const safe = escape(message).replace(
    /\*\*([^*]+)\*\*/g,
    (_, inner) =>
      `<strong style="color:var(--color-app-ink);font-weight:600">${inner}</strong>`
  );
  return `<span style="color:var(--color-app-ink);font-weight:600">${escape(actor)}</span> ${safe}`;
}

function RetentionIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 7v5l3 2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Pending requests badge ─── */

function PendingRequestsBadge({ isAdmin }: { isAdmin: boolean }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const fetchCount = async () => {
      try {
        const res = await fetch("/api/app/delete-requests/count");
        if (!res.ok || !alive) return;
        const data = await res.json();
        setCount(data.count || 0);
      } catch {
        // ignore
      }
    };
    fetchCount();
    const t = setInterval(fetchCount, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [isAdmin]);
  if (count === 0) return null;
  return (
    <span
      className="rounded-full px-1.5 text-[10px] font-semibold tabular-nums"
      style={{
        fontFamily: "var(--font-dm-mono), monospace",
        backgroundColor: "var(--color-app-danger)",
        color: "white",
        minWidth: 18,
        textAlign: "center",
      }}
    >
      {count}
    </span>
  );
}

/* ─── Activity detail modal ─── */

function ActivityDetailModal({
  row,
  onClose,
}: {
  row: ActivityRow;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const meta = row.metadata as Record<string, unknown>;
  const metaEntries = Object.entries(meta).filter(
    ([, v]) => v !== null && v !== undefined && v !== ""
  );

  const targetHref = row.boardId
    ? `/app/workflow/${row.boardId}`
    : null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(10,17,36,0.55)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[560px] rounded-2xl overflow-hidden"
        style={{
          backgroundColor: "var(--color-app-paper)",
          boxShadow:
            "0 32px 64px -16px rgba(10,17,36,0.40), 0 0 0 1px rgba(10,17,36,0.06)",
          animation:
            "act-pop 220ms cubic-bezier(0.2, 0.7, 0.1, 1) both",
        }}
      >
        <style>{`
          @keyframes act-pop {
            from { opacity: 0; transform: translateY(8px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>
        <div className="px-6 pt-5 pb-4 flex items-start gap-4">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              backgroundColor: "var(--color-app-ink)",
              color: "var(--color-app-ivory)",
              boxShadow: "0 6px 16px -8px rgba(10,17,36,0.30)",
            }}
          >
            {initials(row.actorName)}
          </span>
          <div className="min-w-0 flex-1">
            <div
              className="text-[13px] uppercase tracking-[0.18em]"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                color: "var(--color-app-copper-deep)",
              }}
            >
              {actionToFamily(row.action)}
            </div>
            <h3
              className="mt-1 text-[20px] font-semibold leading-tight tracking-tight"
              style={{
                fontFamily: "var(--font-crimson), Georgia, serif",
                color: "var(--color-app-ink)",
              }}
            >
              {row.actorName}
            </h3>
            <p
              className="mt-2 text-[13px] leading-[1.5]"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                color: "var(--color-app-fg-soft)",
              }}
              dangerouslySetInnerHTML={{
                __html: renderInline(row.message),
              }}
            />
            <div
              className="mt-2 text-[11px]"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                color: "var(--color-app-fg-muted)",
                letterSpacing: 0.3,
              }}
            >
              {new Date(row.createdAt).toLocaleString("en-IN", {
                weekday: "short",
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {" · "}
              <span style={{ color: "var(--color-app-copper-deep)" }}>
                {row.action}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-app-canvas-2)]"
            style={{ color: "var(--color-app-fg-muted)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 6l12 12M6 18L18 6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {metaEntries.length > 0 ? (
          <div
            className="mx-6 mb-4 rounded-xl p-4"
            style={{
              backgroundColor: "var(--color-app-canvas-2)",
            }}
          >
            <div
              className="text-[10px] uppercase tracking-[0.18em] mb-2"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                color: "var(--color-app-fg-muted)",
                fontWeight: 600,
              }}
            >
              Details
            </div>
            <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-1.5 text-[12px]">
              {metaEntries.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt
                    style={{
                      fontFamily: "var(--font-dm-mono), monospace",
                      color: "var(--color-app-fg-muted)",
                    }}
                  >
                    {humanizeKey(k)}
                  </dt>
                  <dd
                    style={{
                      fontFamily: "var(--font-manrope), sans-serif",
                      color: "var(--color-app-ink)",
                      wordBreak: "break-word",
                    }}
                  >
                    {formatValue(v)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        {targetHref ? (
          <div
            className="px-6 py-4 flex items-center justify-end"
            style={{
              backgroundColor: "var(--color-app-canvas-2)",
              borderTop: "1px solid var(--color-app-edge-soft)",
            }}
          >
            <Link
              href={targetHref}
              className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-semibold transition-all"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                backgroundColor: "var(--color-app-copper)",
                color: "var(--color-app-copper-text)",
                boxShadow: "0 6px 16px -8px rgba(197,133,58,0.55)",
              }}
            >
              Open board →
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function actionToFamily(action: string): string {
  if (action.startsWith("task.") || action.startsWith("checklist"))
    return "Card";
  if (action.startsWith("list.")) return "List";
  if (action.startsWith("board.")) return "Board";
  if (action.startsWith("case.")) return "Case";
  if (action.startsWith("client.")) return "Client";
  if (action.startsWith("court.")) return "Court";
  if (action.startsWith("prompt.")) return "Prompt";
  if (action.startsWith("chat.")) return "Chat";
  if (action.startsWith("reminder.")) return "Reminder";
  if (action.startsWith("user.")) return "People";
  if (action.startsWith("profile.")) return "Profile";
  if (action.startsWith("delete_request")) return "Delete request";
  return "System";
}

function humanizeKey(k: string): string {
  return k
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map((x) => formatValue(x)).join(", ");
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function renderInline(message: string): string {
  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  return escape(message).replace(
    /\*\*([^*]+)\*\*/g,
    (_, inner) =>
      `<strong style="color:var(--color-app-ink);font-weight:600">${inner}</strong>`
  );
}

/* ─── Delete requests panel ─── */

type DRRow = {
  id: string;
  requesterUserId: string;
  requesterName: string;
  requesterEmail: string;
  targetType: string;
  targetId: string;
  targetName: string;
  boardId: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected" | "obsolete";
  reviewedByName: string;
  reviewedAt: string | null;
  reviewerNote: string;
  createdAt: string;
};

function DeleteRequestsPanel({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<
    "pending" | "approved" | "rejected" | "obsolete"
  >("pending");
  const [rows, setRows] = useState<DRRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState<{ id: string; mode: "approve" | "reject" } | null>(
    null
  );
  const [note, setNote] = useState("");

  const load = useCallback(
    async (s: typeof status) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/app/delete-requests?status=${s}&limit=100`);
        if (res.ok) {
          const data = await res.json();
          setRows(data.requests);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load(status);
  }, [status, load]);

  async function decide(
    id: string,
    mode: "approve" | "reject",
    noteText: string
  ) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/app/delete-requests/${id}/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteText }),
      });
      if (res.ok) {
        setRows((prev) => prev.filter((r) => r.id !== id));
        setNoteOpen(null);
        setNote("");
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-7">
      <div className="flex items-center gap-1.5 mb-5">
        {(["pending", "approved", "rejected", "obsolete"] as const).map(
          (s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className="rounded-md px-3 py-1.5 text-[12px] font-medium uppercase tracking-[0.14em] transition-all"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                backgroundColor:
                  status === s
                    ? "var(--color-app-paper)"
                    : "transparent",
                color:
                  status === s
                    ? "var(--color-app-ink)"
                    : "var(--color-app-fg-muted)",
                boxShadow:
                  status === s ? "0 1px 0 var(--color-app-edge)" : "none",
                fontWeight: status === s ? 600 : 500,
              }}
            >
              {s}
            </button>
          )
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div
            className="h-6 w-6 animate-spin rounded-full"
            style={{
              borderWidth: 2.5,
              borderStyle: "solid",
              borderColor: "var(--color-app-edge)",
              borderTopColor: "var(--color-app-copper)",
            }}
          />
        </div>
      ) : rows.length === 0 ? (
        <div
          className="rounded-xl px-5 py-12 text-center"
          style={{
            backgroundColor: "var(--color-app-paper)",
            border: "1px dashed var(--color-app-edge)",
          }}
        >
          <p
            className="text-[14px]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-fg-muted)",
            }}
          >
            {status === "pending"
              ? isAdmin
                ? "No pending delete requests. Inbox zero."
                : "You haven't sent any delete requests."
              : `No ${status} requests.`}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-xl p-5"
              style={{
                backgroundColor: "var(--color-app-paper)",
                boxShadow: "0 1px 0 var(--color-app-edge)",
              }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                  style={{
                    fontFamily: "var(--font-crimson), Georgia, serif",
                    backgroundColor: "var(--color-app-ink)",
                    color: "var(--color-app-ivory)",
                  }}
                  title={r.requesterName}
                >
                  {initials(r.requesterName)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[14px] font-semibold"
                      style={{
                        fontFamily: "var(--font-manrope), sans-serif",
                        color: "var(--color-app-ink)",
                      }}
                    >
                      {r.requesterName}
                    </span>
                    <span
                      className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em]"
                      style={{
                        fontFamily: "var(--font-dm-mono), monospace",
                        backgroundColor: "var(--color-app-canvas-2)",
                        color: "var(--color-app-fg-soft)",
                      }}
                    >
                      {r.targetType}
                    </span>
                    <span
                      className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em]"
                      style={{
                        fontFamily: "var(--font-dm-mono), monospace",
                        backgroundColor:
                          r.status === "pending"
                            ? "rgba(197,133,58,0.18)"
                            : r.status === "approved"
                              ? "var(--color-app-aqua-soft)"
                              : r.status === "rejected"
                                ? "var(--color-app-danger-soft)"
                                : "var(--color-app-canvas-2)",
                        color:
                          r.status === "pending"
                            ? "var(--color-app-copper-deep)"
                            : r.status === "approved"
                              ? "var(--color-app-aqua)"
                              : r.status === "rejected"
                                ? "var(--color-app-danger)"
                                : "var(--color-app-fg-muted)",
                      }}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p
                    className="mt-1 text-[13px]"
                    style={{
                      fontFamily: "var(--font-manrope), sans-serif",
                      color: "var(--color-app-fg-soft)",
                    }}
                  >
                    requested deletion of{" "}
                    <span
                      style={{
                        color: "var(--color-app-ink)",
                        fontWeight: 600,
                      }}
                    >
                      {r.targetName}
                    </span>
                  </p>
                  <div
                    className="mt-2 rounded-md px-3 py-2 text-[12.5px] leading-[1.55] italic"
                    style={{
                      fontFamily: "var(--font-manrope), sans-serif",
                      backgroundColor: "var(--color-app-canvas-2)",
                      color: "var(--color-app-fg-soft)",
                    }}
                  >
                    “{r.reason}”
                  </div>
                  {r.reviewedAt ? (
                    <div
                      className="mt-2 text-[11px]"
                      style={{
                        fontFamily: "var(--font-dm-mono), monospace",
                        color: "var(--color-app-fg-muted)",
                        letterSpacing: 0.3,
                      }}
                    >
                      {r.status} by {r.reviewedByName} ·{" "}
                      {new Date(r.reviewedAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                      })}
                      {r.reviewerNote
                        ? ` · "${r.reviewerNote}"`
                        : ""}
                    </div>
                  ) : null}
                  <div
                    className="mt-1 text-[11px]"
                    style={{
                      fontFamily: "var(--font-dm-mono), monospace",
                      color: "var(--color-app-fg-muted)",
                      letterSpacing: 0.3,
                    }}
                  >
                    {new Date(r.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                {r.boardId ? (
                  <Link
                    href={`/app/workflow/${r.boardId}`}
                    className="text-[11px] uppercase"
                    style={{
                      fontFamily: "var(--font-dm-mono), monospace",
                      color: "var(--color-app-copper-deep)",
                      letterSpacing: 1.2,
                      fontWeight: 600,
                    }}
                  >
                    Open
                  </Link>
                ) : null}
              </div>

              {/* Actions for admin on pending */}
              {isAdmin && r.status === "pending" ? (
                noteOpen?.id === r.id ? (
                  <div
                    className="mt-4 rounded-md p-3"
                    style={{
                      backgroundColor: "var(--color-app-canvas-2)",
                    }}
                  >
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Optional note for the requester…"
                      rows={2}
                      className="block w-full resize-none rounded border bg-app-paper px-3 py-2 text-[12px] outline-none"
                      style={{
                        fontFamily: "var(--font-manrope), sans-serif",
                        borderColor: "var(--color-app-edge)",
                        color: "var(--color-app-ink)",
                        backgroundColor: "var(--color-app-paper)",
                      }}
                    />
                    <div className="mt-2 flex gap-2 justify-end">
                      <button
                        onClick={() => {
                          setNoteOpen(null);
                          setNote("");
                        }}
                        className="rounded-md border px-3 py-1.5 text-[11px] font-medium"
                        style={{
                          fontFamily: "var(--font-manrope), sans-serif",
                          borderColor: "var(--color-app-edge)",
                          color: "var(--color-app-fg-soft)",
                          backgroundColor: "var(--color-app-paper)",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => decide(r.id, noteOpen.mode, note)}
                        disabled={busyId === r.id}
                        className="rounded-md px-3 py-1.5 text-[11px] font-semibold"
                        style={{
                          fontFamily: "var(--font-manrope), sans-serif",
                          backgroundColor:
                            noteOpen.mode === "approve"
                              ? "var(--color-app-danger)"
                              : "var(--color-app-fg-soft)",
                          color: "white",
                          opacity: busyId === r.id ? 0.6 : 1,
                        }}
                      >
                        {busyId === r.id
                          ? "…"
                          : noteOpen.mode === "approve"
                            ? "Approve & delete"
                            : "Reject"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setNoteOpen({ id: r.id, mode: "reject" });
                        setNote("");
                      }}
                      className="rounded-md border px-4 py-1.5 text-[12px] font-semibold"
                      style={{
                        fontFamily: "var(--font-manrope), sans-serif",
                        borderColor: "var(--color-app-edge)",
                        backgroundColor: "var(--color-app-paper)",
                        color: "var(--color-app-fg-soft)",
                      }}
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => {
                        setNoteOpen({ id: r.id, mode: "approve" });
                        setNote("");
                      }}
                      className="rounded-md px-4 py-1.5 text-[12px] font-semibold transition-all"
                      style={{
                        fontFamily: "var(--font-manrope), sans-serif",
                        backgroundColor: "var(--color-app-danger)",
                        color: "white",
                        boxShadow:
                          "0 6px 16px -8px rgba(193,74,55,0.5)",
                      }}
                    >
                      Approve & delete
                    </button>
                  </div>
                )
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
