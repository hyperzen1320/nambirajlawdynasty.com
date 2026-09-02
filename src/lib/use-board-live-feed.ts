"use client";

// useBoardLiveFeed — the single source of "what's happened lately" for
// every UI surface that wants to react to office activity in near-real
// time. One hook owns the polling cadence, the same-tab broadcast bridge,
// the last-seen persistence, and the unread badge — so we don't end up
// with three components each running their own setInterval.
//
// Cadence is adaptive based on Page Visibility + recent activity, which
// matters at scale: a quiet canvas costs ~one request every 6 seconds, a
// busy one costs one per second, a backgrounded tab costs one per 30s.
//
// Consumers receive raw events as they arrive (so an overlay can play a
// pulse animation per row) plus a flat rolling list of recent rows (so a
// drawer can render a feed). Both are exposed.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { publishLocal, subscribeLocal } from "@/lib/broadcast-channel";

export type LiveActivityRow = {
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

type Cadence = "active" | "idle" | "deep-idle" | "background";

const CADENCE_MS: Record<Cadence, number> = {
  active: 1000,
  idle: 3000,
  "deep-idle": 6000,
  background: 30000,
};

const ACTIVE_WINDOW_MS = 30_000; // recent change <30s ago → "active"
const DEEP_IDLE_WINDOW_MS = 2 * 60_000; // no change in 2 min → "deep-idle"
const MAX_BUFFER = 80; // cap how many rows we keep in memory per consumer

type Options = {
  // Scope to a single board for canvas consumers; omit for the office-wide
  // activity page.
  boardId?: string | null;
  // The id of the most recent activity row known to the server when the
  // page was rendered (server-loaded prefetch). The hook starts polling
  // from this point and won't replay old rows on first mount.
  initialSinceId?: string | null;
  // Persist the last-seen id under this key so unread counts survive page
  // refreshes. Caller picks the key (per-board for canvas, single global
  // key for activity page).
  lastSeenStorageKey?: string;
  // When true, the hook publishes locally-originated events to other tabs
  // via BroadcastChannel (default true). Pages that don't trigger writes
  // can leave this on safely; it just means they'll receive others'
  // broadcasts.
  enableBroadcast?: boolean;
  // Optional partner id — if provided, we ignore local broadcasts from
  // other partners (defence in depth; tabs in different orgs shouldn't
  // happen but who knows). Most callers omit.
  partnerId?: string | null;
};

type State = {
  newRows: LiveActivityRow[];
  unreadCount: number;
  isLive: boolean;
  cadence: Cadence;
  latestSeenId: string | null;
};

export function useBoardLiveFeed(opts: Options = {}): State & {
  markSeen: () => void;
  // Fire after a successful local mutation so other tabs of this user
  // update without waiting on their poll cycle.
  publishLocalEvent: (row: LiveActivityRow) => void;
} {
  const {
    boardId = null,
    initialSinceId = null,
    lastSeenStorageKey,
    enableBroadcast = true,
    partnerId = null,
  } = opts;

  const [newRows, setNewRows] = useState<LiveActivityRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLive, setIsLive] = useState(true);
  const [cadence, setCadence] = useState<Cadence>("idle");

  // Refs that the polling loop reads. We avoid putting these in state to
  // prevent the loop from re-creating itself on every event. Numeric
  // refs are initialised to 0 and stamped in the mount effect so the
  // useRef call stays pure (React 19 strict mode).
  const sinceRef = useRef<string | null>(initialSinceId);
  const lastChangeAtRef = useRef<number>(0);
  const visibleRef = useRef<boolean>(true);
  const focusedRef = useRef<boolean>(true);
  const [latestSeenId, setLatestSeenId] = useState<string | null>(
    initialSinceId
  );

  // Prime the unread count from localStorage so the bell badge is
  // accurate across reloads even before the first poll completes.
  useEffect(() => {
    if (!lastSeenStorageKey || typeof window === "undefined") return;
    try {
      const seen = localStorage.getItem(lastSeenStorageKey);
      if (seen && initialSinceId && seen !== initialSinceId) {
        // Caller has unseen events — they'll be filled in on first poll.
      }
    } catch {
      /* ignore */
    }
  }, [lastSeenStorageKey, initialSinceId]);

  const markSeen = useCallback(() => {
    setUnreadCount(0);
    if (lastSeenStorageKey && typeof window !== "undefined") {
      try {
        const id = sinceRef.current;
        if (id) localStorage.setItem(lastSeenStorageKey, id);
      } catch {
        /* ignore */
      }
    }
  }, [lastSeenStorageKey]);

  const ingestRows = useCallback(
    (rows: LiveActivityRow[], options: { fromLocalBroadcast?: boolean } = {}) => {
      if (rows.length === 0) return;
      lastChangeAtRef.current = Date.now();

      // Update sinceRef + the exposed latestSeenId state to the highest
      // id we've now seen.
      const newest = rows[rows.length - 1].id;
      const prev = sinceRef.current;
      if (!prev || newest > prev) {
        sinceRef.current = newest;
        setLatestSeenId(newest);
      }

      setNewRows((current) => {
        // Dedupe by id so a server poll arriving after a local broadcast
        // doesn't double-fire the highlight.
        const seen = new Set(current.map((r) => r.id));
        const filtered = rows.filter((r) => !seen.has(r.id));
        if (filtered.length === 0) return current;
        const merged = [...current, ...filtered].slice(-MAX_BUFFER);
        return merged;
      });

      if (!options.fromLocalBroadcast) {
        setUnreadCount((c) => c + rows.length);
      }
    },
    []
  );

  const publishLocalEvent = useCallback(
    (row: LiveActivityRow) => {
      ingestRows([row], { fromLocalBroadcast: true });
      if (enableBroadcast) {
        publishLocal({
          kind: "activity",
          partnerId: partnerId ?? "",
          boardId,
          row,
        });
      }
    },
    [ingestRows, enableBroadcast, partnerId, boardId]
  );

  // Page-visibility & focus tracking. Drives cadence.
  useEffect(() => {
    if (typeof document === "undefined") return;

    const updateVisibility = () => {
      visibleRef.current = document.visibilityState === "visible";
    };
    const onFocus = () => {
      focusedRef.current = true;
      // Force an immediate poll after refocus so users see what they
      // missed without waiting for the next tick.
      lastChangeAtRef.current = Date.now();
    };
    const onBlur = () => {
      focusedRef.current = false;
    };

    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // The polling loop. Self-scheduling so cadence can change between ticks.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Stamp the activity baseline now (deferred from render so useRef
    // stays pure under React 19 strict mode).
    if (lastChangeAtRef.current === 0) {
      lastChangeAtRef.current = Date.now();
    }

    function pickCadence(): Cadence {
      if (!visibleRef.current) return "background";
      const elapsed = Date.now() - lastChangeAtRef.current;
      if (elapsed < ACTIVE_WINDOW_MS) return "active";
      if (elapsed < DEEP_IDLE_WINDOW_MS) return "idle";
      return "deep-idle";
    }

    async function tick() {
      if (cancelled) return;
      const c = pickCadence();
      setCadence(c);

      try {
        const params = new URLSearchParams();
        if (sinceRef.current) params.set("since", sinceRef.current);
        if (boardId) params.set("board", boardId);
        const res = await fetch(`/api/app/activity/live?${params.toString()}`, {
          // Live polls should never read from the browser cache.
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as {
            events: LiveActivityRow[];
            latestId: string | null;
            probeHit?: boolean;
          };
          if (data.events && data.events.length > 0) {
            ingestRows(data.events);
          } else if (data.latestId && !sinceRef.current) {
            // First poll on a quiet board — adopt the latest id so we
            // don't replay everything next time.
            sinceRef.current = data.latestId;
          }
          if (!isLive) setIsLive(true);
        } else if (res.status === 429) {
          // Back off for a few seconds when rate-limited.
          if (cancelled) return;
          timer = setTimeout(tick, 5000);
          return;
        } else {
          if (isLive) setIsLive(false);
        }
      } catch {
        if (isLive) setIsLive(false);
      }

      if (cancelled) return;
      timer = setTimeout(tick, CADENCE_MS[c]);
    }

    // Kick off immediately, not after the first interval.
    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // We intentionally exclude `isLive` so a transient error doesn't
    // restart the loop. ingestRows is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, ingestRows]);

  // Subscribe to same-tab/cross-tab broadcasts.
  useEffect(() => {
    if (!enableBroadcast) return;
    const off = subscribeLocal((msg) => {
      if (partnerId && msg.partnerId && msg.partnerId !== partnerId) return;
      if (boardId && msg.boardId && msg.boardId !== boardId) return;
      const row = msg.row as LiveActivityRow;
      if (!row || typeof row.id !== "string") return;
      ingestRows([row], { fromLocalBroadcast: true });
    });
    return off;
  }, [enableBroadcast, partnerId, boardId, ingestRows]);

  return useMemo(
    () => ({
      newRows,
      unreadCount,
      isLive,
      cadence,
      latestSeenId,
      markSeen,
      publishLocalEvent,
    }),
    [newRows, unreadCount, isLive, cadence, latestSeenId, markSeen, publishLocalEvent]
  );
}
