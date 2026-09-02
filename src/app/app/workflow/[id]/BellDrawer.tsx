"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { LiveActivityRow } from "@/lib/use-board-live-feed";

type ActivityRow = {
  id: string;
  actorName: string;
  action: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type RequestRow = {
  id: string;
  requesterName: string;
  targetType: string;
  targetId: string;
  targetName: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "obsolete";
  createdAt: string;
  reviewedByName?: string;
  reviewerNote?: string;
};

export default function BellDrawer({
  boardId,
  isAdmin,
  totalLists,
  totalCards,
  perListBreakdown,
  onClose,
  liveRows,
  onMarkSeen,
}: {
  boardId: string;
  isAdmin: boolean;
  totalLists: number;
  totalCards: number;
  perListBreakdown: { id: string; title: string; count: number }[];
  onClose: () => void;
  // Rows that have arrived via the canvas-level live feed since this
  // session began. We merge them with the historical rows we fetch on
  // open so the drawer is always live without running its own poll.
  liveRows?: LiveActivityRow[];
  onMarkSeen?: () => void;
}) {
  const [tab, setTab] = useState<"activity" | "requests">("activity");
  const [history, setHistory] = useState<ActivityRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [showBreakdown, setShowBreakdown] = useState(false);
  const requestsPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Merge: historical rows from the initial fetch + live rows arriving
  // afterwards. Dedupe by id so a live row that arrived after the fetch
  // started doesn't show twice. Newest first for the drawer feed.
  const activity = useMemo<ActivityRow[]>(() => {
    const seen = new Set<string>();
    const merged: ActivityRow[] = [];
    const live = (liveRows ?? []).slice().reverse();
    for (const r of live) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      merged.push(r as unknown as ActivityRow);
    }
    for (const r of history) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      merged.push(r);
    }
    return merged;
  }, [liveRows, history]);

  const loadHistory = useCallback(async () => {
    const res = await fetch(`/api/app/activity?board=${boardId}&limit=80`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      setHistory(data.activity ?? []);
    }
  }, [boardId]);

  const loadRequests = useCallback(async () => {
    const res = await fetch(
      `/api/app/delete-requests?status=pending&boardId=${boardId}&limit=80`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json();
      setRequests(data.requests ?? []);
    }
  }, [boardId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadHistory(), loadRequests()]).finally(() =>
      setLoading(false)
    );
    // Mark the activity tab as seen on open so the bell badge clears.
    onMarkSeen?.();

    // Pending delete requests are state, not events — keep a slow poll
    // on them so the admin's review changes propagate without forcing a
    // page reload. Activity rides the live feed and doesn't need polling.
    requestsPollRef.current = setInterval(loadRequests, 8000);
    return () => {
      if (requestsPollRef.current) clearInterval(requestsPollRef.current);
    };
  }, [loadHistory, loadRequests, onMarkSeen]);

  // ESC closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function approve(id: string) {
    setReviewingId(id);
    try {
      const res = await fetch(`/api/app/delete-requests/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: reviewNote.trim() }),
      });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== id));
        setReviewNote("");
      }
    } finally {
      setReviewingId(null);
    }
  }

  async function reject(id: string) {
    setReviewingId(id);
    try {
      const res = await fetch(`/api/app/delete-requests/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: reviewNote.trim() }),
      });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== id));
        setReviewNote("");
      }
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[150]"
      style={{ backgroundColor: "rgba(10,17,36,0.35)" }}
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="ml-auto h-full w-full max-w-[480px] flex flex-col"
        style={{
          backgroundColor: "var(--color-app-canvas)",
          boxShadow: "-12px 0 32px -8px rgba(10,17,36,0.20)",
          animation:
            "drawer-in 260ms cubic-bezier(0.2, 0.7, 0.1, 1) both",
        }}
      >
        <style>{`
          @keyframes drawer-in {
            from { transform: translateX(24px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}</style>

        {/* Header */}
        <div
          className="px-5 py-4"
          style={{
            backgroundColor: "var(--color-app-paper)",
            borderBottom: "1px solid var(--color-app-edge)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-md"
                style={{
                  backgroundColor: "var(--color-app-canvas-2)",
                  color: "var(--color-app-copper-deep)",
                }}
              >
                <BellIcon />
              </span>
              <div>
                <div
                  className="text-[14px] font-semibold tracking-tight leading-none"
                  style={{
                    fontFamily: "var(--font-crimson), Georgia, serif",
                    color: "var(--color-app-ink)",
                  }}
                >
                  Board pulse
                </div>
                <div
                  className="mt-0.5 text-[10px] uppercase tracking-[0.22em]"
                  style={{
                    fontFamily: "var(--font-dm-mono), monospace",
                    color: "var(--color-app-fg-muted)",
                  }}
                >
                  Live · refreshes every 3s
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-app-canvas-2)]"
              style={{ color: "var(--color-app-fg-muted)" }}
            >
              <CloseIcon />
            </button>
          </div>

          {/* Stats row */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowBreakdown((v) => !v)}
              className="text-left rounded-lg px-3 py-2.5 transition-colors"
              style={{
                backgroundColor: "var(--color-app-canvas-2)",
                border: "1px solid var(--color-app-edge-soft)",
              }}
            >
              <div
                className="text-[10px] uppercase tracking-[0.18em]"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  color: "var(--color-app-fg-muted)",
                }}
              >
                Lists
              </div>
              <div
                className="mt-0.5 text-[20px] font-semibold tabular-nums"
                style={{
                  fontFamily: "var(--font-crimson), Georgia, serif",
                  color: "var(--color-app-ink)",
                }}
              >
                {totalLists}
              </div>
            </button>
            <button
              onClick={() => setShowBreakdown((v) => !v)}
              className="text-left rounded-lg px-3 py-2.5 transition-colors"
              style={{
                backgroundColor: "var(--color-app-canvas-2)",
                border: "1px solid var(--color-app-edge-soft)",
              }}
            >
              <div
                className="text-[10px] uppercase tracking-[0.18em]"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  color: "var(--color-app-fg-muted)",
                }}
              >
                Cards
              </div>
              <div
                className="mt-0.5 text-[20px] font-semibold tabular-nums"
                style={{
                  fontFamily: "var(--font-crimson), Georgia, serif",
                  color: "var(--color-app-ink)",
                }}
              >
                {totalCards}
              </div>
            </button>
          </div>

          {showBreakdown && perListBreakdown.length > 0 ? (
            <div
              className="mt-2 rounded-lg p-2"
              style={{
                backgroundColor: "var(--color-app-canvas-2)",
                border: "1px solid var(--color-app-edge-soft)",
              }}
            >
              <ul className="space-y-1">
                {perListBreakdown.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between px-2 py-1 text-[12px]"
                    style={{ fontFamily: "var(--font-manrope), sans-serif" }}
                  >
                    <span
                      style={{
                        color: "var(--color-app-ink)",
                        fontWeight: 500,
                      }}
                    >
                      {l.title}
                    </span>
                    <span
                      className="tabular-nums"
                      style={{
                        fontFamily: "var(--font-dm-mono), monospace",
                        color: "var(--color-app-fg-muted)",
                        letterSpacing: 0.4,
                      }}
                    >
                      {l.count} card{l.count === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Tabs */}
          <div className="mt-4 flex gap-1.5">
            <Tab
              active={tab === "activity"}
              onClick={() => setTab("activity")}
              label="Activity"
              count={activity.length > 0 ? activity.length : undefined}
            />
            <Tab
              active={tab === "requests"}
              onClick={() => setTab("requests")}
              label={isAdmin ? "Requests" : "My requests"}
              count={requests.length > 0 ? requests.length : undefined}
              accent={requests.length > 0}
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="flex items-center justify-center pt-12">
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
          ) : tab === "activity" ? (
            activity.length === 0 ? (
              <Empty title="No activity yet" />
            ) : (
              <ul className="space-y-2">
                {activity.map((a, i) => (
                  <li
                    key={a.id}
                    className="rounded-lg px-3 py-2.5 transition-colors"
                    style={{
                      backgroundColor: "var(--color-app-paper)",
                      border: "1px solid var(--color-app-edge-soft)",
                      animation: `fade-in 220ms cubic-bezier(0.2,0.7,0.1,1) both ${Math.min(i, 8) * 25}ms`,
                    }}
                  >
                    <style>{`@keyframes fade-in { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: translateY(0); } }`}</style>
                    <div className="flex items-start gap-2.5">
                      <span
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[8.5px] font-semibold"
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
                          className="text-[12px] leading-[1.5]"
                          style={{
                            fontFamily:
                              "var(--font-manrope), sans-serif",
                            color: "var(--color-app-ink)",
                          }}
                          dangerouslySetInnerHTML={{
                            __html: renderMessage(a.actorName, a.message),
                          }}
                        />
                        <div
                          className="mt-0.5 text-[10px]"
                          style={{
                            fontFamily:
                              "var(--font-dm-mono), monospace",
                            color: "var(--color-app-fg-muted)",
                            letterSpacing: 0.3,
                          }}
                        >
                          {fmtRelative(a.createdAt)}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : requests.length === 0 ? (
            <Empty
              title={isAdmin ? "No pending requests" : "Nothing pending"}
              subtitle={
                isAdmin
                  ? "You'll see deletion requests from the team here."
                  : "Your delete requests show up here while admin reviews."
              }
            />
          ) : (
            <ul className="space-y-2">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl p-3"
                  style={{
                    backgroundColor: "var(--color-app-paper)",
                    border: "1px solid var(--color-app-edge-soft)",
                    boxShadow: "0 1px 0 var(--color-app-edge)",
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[8.5px] font-semibold"
                      style={{
                        fontFamily:
                          "var(--font-crimson), Georgia, serif",
                        backgroundColor: "var(--color-app-ink)",
                        color: "var(--color-app-ivory)",
                      }}
                    >
                      {initials(r.requesterName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div
                        className="text-[12px] leading-[1.4]"
                        style={{
                          fontFamily: "var(--font-manrope), sans-serif",
                          color: "var(--color-app-ink)",
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>
                          {r.requesterName}
                        </span>{" "}
                        wants to delete {r.targetType}{" "}
                        <span style={{ fontWeight: 600 }}>
                          {r.targetName}
                        </span>
                      </div>
                      <div
                        className="mt-1 rounded-md px-2 py-1.5 text-[11.5px] leading-[1.45] italic"
                        style={{
                          fontFamily: "var(--font-manrope), sans-serif",
                          backgroundColor: "var(--color-app-canvas-2)",
                          color: "var(--color-app-fg-soft)",
                        }}
                      >
                        “{r.reason}”
                      </div>
                      <div
                        className="mt-1 text-[10px]"
                        style={{
                          fontFamily:
                            "var(--font-dm-mono), monospace",
                          color: "var(--color-app-fg-muted)",
                          letterSpacing: 0.3,
                        }}
                      >
                        {fmtRelative(r.createdAt)}
                      </div>
                    </div>
                  </div>
                  {isAdmin ? (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => reject(r.id)}
                        disabled={reviewingId === r.id}
                        className="flex-1 rounded-md border px-3 py-1.5 text-[11.5px] font-semibold transition-colors"
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
                        onClick={() => approve(r.id)}
                        disabled={reviewingId === r.id}
                        className="flex-1 rounded-md px-3 py-1.5 text-[11.5px] font-semibold transition-all"
                        style={{
                          fontFamily: "var(--font-manrope), sans-serif",
                          backgroundColor: "var(--color-app-danger)",
                          color: "white",
                          boxShadow:
                            "0 6px 16px -8px rgba(193,74,55,0.5)",
                        }}
                      >
                        {reviewingId === r.id ? "…" : "Approve & delete"}
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 text-center"
          style={{
            backgroundColor: "var(--color-app-paper)",
            borderTop: "1px solid var(--color-app-edge)",
          }}
        >
          <Link
            href={`/app/activity?board=${boardId}`}
            className="text-[11px] uppercase tracking-[0.18em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-copper-deep)",
              fontWeight: 600,
            }}
          >
            View full Activity →
          </Link>
        </div>
      </aside>
    </div>
  );
}

/* ─── Tab pill ─── */

function Tab({
  active,
  onClick,
  label,
  count,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all"
      style={{
        fontFamily: "var(--font-manrope), sans-serif",
        backgroundColor: active
          ? "var(--color-app-ink)"
          : "var(--color-app-canvas-2)",
        color: active
          ? "var(--color-app-ivory)"
          : "var(--color-app-fg-soft)",
        boxShadow: active
          ? "0 6px 16px -10px rgba(10,17,36,0.45)"
          : "none",
      }}
    >
      {label}
      {count !== undefined ? (
        <span
          className="rounded-full px-1.5 text-[10px] tabular-nums"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            backgroundColor: active
              ? "var(--color-app-copper)"
              : accent
                ? "var(--color-app-danger)"
                : "rgba(10,17,36,0.10)",
            color: active
              ? "var(--color-app-copper-text)"
              : accent
                ? "white"
                : "var(--color-app-fg-muted)",
            fontWeight: 600,
            minWidth: 18,
            textAlign: "center",
          }}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function Empty({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center pt-16 px-5">
      <div
        className="h-12 w-12 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: "var(--color-app-canvas-2)",
          color: "var(--color-app-fg-muted)",
        }}
      >
        <BellIcon />
      </div>
      <p
        className="mt-4 text-[14px] font-semibold tracking-tight"
        style={{
          fontFamily: "var(--font-crimson), Georgia, serif",
          color: "var(--color-app-ink)",
        }}
      >
        {title}
      </p>
      {subtitle ? (
        <p
          className="mt-1 text-[12px] text-center max-w-[280px]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-fg-muted)",
          }}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function fmtRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) {
    const m = Math.floor(diff / 60_000);
    return `${m} min${m === 1 ? "" : "s"} ago`;
  }
  if (diff < 86_400_000) {
    const h = Math.floor(diff / 3_600_000);
    return `${h} hr${h === 1 ? "" : "s"} ago`;
  }
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
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

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 21a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M6 18L18 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
