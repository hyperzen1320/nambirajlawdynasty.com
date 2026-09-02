"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

// Topbar bell dropdown — surfaces pending delete requests so admins can
// review them without having to bounce to the Activity page. Non-admins
// get a read-only view of their own pending requests so they can see
// "still waiting" at a glance.
//
// The count badge polls /api/app/delete-requests/count every 12s. The
// full list is only fetched when the dropdown opens (cheap GET that
// returns ≤50 most recent pending requests scoped to the caller).
//
// In-canvas pages already have a separate live-activity feed elsewhere
// — this bell is dedicated to delete requests, which is the one signal
// that needs admin action across every other page in the app.

type RequestRow = {
  id: string;
  requesterName: string;
  requesterEmail: string;
  targetType: string;
  targetId: string;
  targetName: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "obsolete";
  createdAt: string;
};

const POLL_MS = 12_000;

export default function BellDropdown() {
  const [count, setCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState<{
    id: string;
    mode: "approve" | "reject";
  } | null>(null);
  const [note, setNote] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Polling. The endpoint is cheap (one indexed countDocuments) and
  // already scoped per caller. We stop polling while the tab is hidden
  // so an idle session doesn't burn requests.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      if (!alive) return;
      if (typeof document !== "undefined" && document.hidden) {
        timer = setTimeout(tick, 30_000);
        return;
      }
      try {
        const res = await fetch("/api/app/delete-requests/count", {
          cache: "no-store",
        });
        if (alive && res.ok) {
          const data = await res.json();
          setCount(Number(data?.count || 0));
        }
      } catch {
        /* ignore — try again next tick */
      }
      if (alive) timer = setTimeout(tick, POLL_MS);
    };
    tick();
    const onFocus = () => {
      if (timer) clearTimeout(timer);
      tick();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // Close on outside click / Esc.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        "/api/app/delete-requests?status=pending&limit=20",
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        setRequests((data.requests || []) as RequestRow[]);
        setIsAdmin(Boolean(data.isAdmin));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  function toggle() {
    if (!open) fetchList();
    setOpen((v) => !v);
  }

  async function decide(
    id: string,
    mode: "approve" | "reject",
    noteText: string
  ) {
    setActing(id);
    try {
      const res = await fetch(`/api/app/delete-requests/${id}/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteText }),
      });
      if (res.ok) {
        // Remove the row optimistically and decrement the count.
        setRequests((prev) => prev.filter((r) => r.id !== id));
        setCount((c) => Math.max(0, c - 1));
        setNoteOpen(null);
        setNote("");
      }
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={toggle}
        aria-label="Notifications"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-md transition-all"
        style={{
          color: "var(--color-app-fg-soft)",
          backgroundColor: open
            ? "var(--color-app-paper)"
            : "transparent",
        }}
        onMouseEnter={(e) => {
          if (open) return;
          e.currentTarget.style.backgroundColor = "var(--color-app-paper)";
          e.currentTarget.style.color = "var(--color-app-ink)";
        }}
        onMouseLeave={(e) => {
          if (open) return;
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = "var(--color-app-fg-soft)";
        }}
      >
        <BellIcon />
      </button>
      {count > 0 ? (
        <span
          className="pointer-events-none absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            backgroundColor: "var(--color-app-danger)",
            color: "white",
            boxShadow: "0 0 0 2px var(--color-app-canvas)",
          }}
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}

      {open ? (
        <div
          className="absolute right-0 z-40 mt-2 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-xl"
          style={{
            backgroundColor: "var(--color-app-paper)",
            border: "1px solid var(--color-app-edge)",
            boxShadow:
              "0 24px 48px -16px rgba(10,17,36,0.30), 0 0 0 1px rgba(10,17,36,0.04)",
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{
              borderBottom: "1px solid var(--color-app-edge-soft)",
              backgroundColor: "var(--color-app-canvas-2)",
            }}
          >
            <div>
              <div
                className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  color: "var(--color-app-copper-deep)",
                }}
              >
                Delete requests
              </div>
              <div
                className="mt-0.5 text-[12px]"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  color: "var(--color-app-fg-muted)",
                }}
              >
                {isAdmin
                  ? count === 0
                    ? "Nothing pending — inbox zero."
                    : `${count} pending — your call.`
                  : count === 0
                    ? "No requests sent."
                    : `${count} of yours waiting on the admin.`}
              </div>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div
                  className="h-5 w-5 animate-spin rounded-full"
                  style={{
                    borderWidth: 2,
                    borderStyle: "solid",
                    borderColor: "var(--color-app-edge)",
                    borderTopColor: "var(--color-app-copper)",
                  }}
                />
              </div>
            ) : requests.length === 0 ? (
              <div
                className="px-4 py-8 text-center text-[12.5px]"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  color: "var(--color-app-fg-muted)",
                }}
              >
                {isAdmin
                  ? "No pending delete requests."
                  : "You haven't sent any delete requests."}
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: "var(--color-app-edge-soft)" }}>
                {requests.map((r) => (
                  <li key={r.id} className="px-4 py-3">
                    <div className="flex items-start gap-2.5">
                      <span
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                        style={{
                          fontFamily:
                            "var(--font-crimson), Georgia, serif",
                          backgroundColor: "var(--color-app-ink)",
                          color: "var(--color-app-ivory)",
                        }}
                        title={r.requesterName}
                      >
                        {initials(r.requesterName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div
                          className="text-[12.5px] leading-[1.5]"
                          style={{
                            fontFamily:
                              "var(--font-manrope), sans-serif",
                            color: "var(--color-app-ink)",
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>
                            {isAdmin ? r.requesterName : "You"}
                          </span>{" "}
                          requested deletion of{" "}
                          <span
                            style={{
                              fontWeight: 600,
                              color: "var(--color-app-copper-deep)",
                            }}
                          >
                            {r.targetName}
                          </span>{" "}
                          <span
                            className="ml-1 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]"
                            style={{
                              fontFamily:
                                "var(--font-dm-mono), monospace",
                              backgroundColor:
                                "var(--color-app-canvas-2)",
                              color: "var(--color-app-fg-soft)",
                            }}
                          >
                            {r.targetType}
                          </span>
                        </div>
                        {r.reason ? (
                          <p
                            className="mt-1.5 rounded-md px-2.5 py-1.5 text-[12px] italic leading-[1.5]"
                            style={{
                              fontFamily:
                                "var(--font-manrope), sans-serif",
                              backgroundColor:
                                "var(--color-app-canvas-2)",
                              color: "var(--color-app-fg-soft)",
                            }}
                          >
                            &ldquo;{r.reason}&rdquo;
                          </p>
                        ) : null}
                        <div
                          className="mt-1 text-[10px]"
                          style={{
                            fontFamily:
                              "var(--font-dm-mono), monospace",
                            color: "var(--color-app-fg-muted)",
                            letterSpacing: 0.3,
                          }}
                        >
                          {timeAgo(r.createdAt)}
                        </div>

                        {/* Admin action row */}
                        {isAdmin ? (
                          noteOpen?.id === r.id ? (
                            <div
                              className="mt-2 rounded-md p-2"
                              style={{
                                backgroundColor:
                                  "var(--color-app-canvas-2)",
                              }}
                            >
                              <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Note for the requester (optional)"
                                rows={2}
                                className="block w-full resize-none rounded border px-2 py-1.5 text-[11.5px] outline-none"
                                style={{
                                  fontFamily:
                                    "var(--font-manrope), sans-serif",
                                  borderColor: "var(--color-app-edge)",
                                  backgroundColor:
                                    "var(--color-app-paper)",
                                  color: "var(--color-app-ink)",
                                }}
                              />
                              <div className="mt-2 flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNoteOpen(null);
                                    setNote("");
                                  }}
                                  className="rounded border px-2.5 py-1 text-[11px] font-semibold"
                                  style={{
                                    fontFamily:
                                      "var(--font-manrope), sans-serif",
                                    borderColor:
                                      "var(--color-app-edge)",
                                    color:
                                      "var(--color-app-fg-soft)",
                                    backgroundColor:
                                      "var(--color-app-paper)",
                                  }}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    decide(r.id, noteOpen.mode, note)
                                  }
                                  disabled={acting === r.id}
                                  className="rounded px-2.5 py-1 text-[11px] font-semibold"
                                  style={{
                                    fontFamily:
                                      "var(--font-manrope), sans-serif",
                                    backgroundColor:
                                      noteOpen.mode === "approve"
                                        ? "var(--color-app-danger)"
                                        : "var(--color-app-fg-soft)",
                                    color: "white",
                                    opacity:
                                      acting === r.id ? 0.6 : 1,
                                  }}
                                >
                                  {acting === r.id
                                    ? "…"
                                    : noteOpen.mode === "approve"
                                      ? "Approve & delete"
                                      : "Reject"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2 flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setNoteOpen({
                                    id: r.id,
                                    mode: "reject",
                                  });
                                  setNote("");
                                }}
                                className="rounded-md border px-3 py-1 text-[11px] font-semibold"
                                style={{
                                  fontFamily:
                                    "var(--font-manrope), sans-serif",
                                  borderColor: "var(--color-app-edge)",
                                  backgroundColor:
                                    "var(--color-app-paper)",
                                  color: "var(--color-app-fg-soft)",
                                }}
                              >
                                Reject
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setNoteOpen({
                                    id: r.id,
                                    mode: "approve",
                                  });
                                  setNote("");
                                }}
                                className="rounded-md px-3 py-1 text-[11px] font-semibold"
                                style={{
                                  fontFamily:
                                    "var(--font-manrope), sans-serif",
                                  backgroundColor:
                                    "var(--color-app-danger)",
                                  color: "white",
                                  boxShadow:
                                    "0 4px 12px -6px rgba(193,74,55,0.45)",
                                }}
                              >
                                Approve
                              </button>
                            </div>
                          )
                        ) : (
                          <div
                            className="mt-2 text-[10px] uppercase tracking-[0.18em]"
                            style={{
                              fontFamily:
                                "var(--font-dm-mono), monospace",
                              color: "var(--color-app-copper-deep)",
                            }}
                          >
                            Pending admin review
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{
              borderTop: "1px solid var(--color-app-edge-soft)",
              backgroundColor: "var(--color-app-canvas-2)",
            }}
          >
            <Link
              href="/app/activity"
              onClick={() => setOpen(false)}
              className="text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                color: "var(--color-app-copper-deep)",
              }}
            >
              View all in Activity →
            </Link>
            <span
              className="text-[10px]"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                color: "var(--color-app-fg-muted)",
                letterSpacing: 0.3,
              }}
            >
              Esc to close
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9a6 6 0 1 1 12 0c0 5 2 7 2 7H4s2-2 2-7z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M10 19a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
