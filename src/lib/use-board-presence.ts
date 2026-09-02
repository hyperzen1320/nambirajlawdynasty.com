"use client";

// useBoardPresence — beats every 15s while focused, returns the list of
// users currently on this board. Pairs with the BoardPresence Mongo model
// which TTLs idle rows after 60s, so this hook doesn't need to send any
// "leave" signal — closing the tab is enough.

import { useEffect, useState } from "react";

const BEAT_INTERVAL_MS = 15_000;

export type ActiveUser = {
  userId: string;
  name: string;
  role: string;
  designation: string;
  lastBeat: string;
  isYou: boolean;
};

export function useBoardPresence(boardId: string): ActiveUser[] {
  const [active, setActive] = useState<ActiveUser[]>([]);

  useEffect(() => {
    if (!boardId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function beat() {
      if (cancelled) return;
      // Don't beat when the tab is hidden — saves a request every 15s
      // for backgrounded canvases.
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        timer = setTimeout(beat, BEAT_INTERVAL_MS);
        return;
      }
      try {
        const res = await fetch(`/api/app/boards/${boardId}/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as { active: ActiveUser[] };
          if (!cancelled) setActive(data.active ?? []);
        }
      } catch {
        // network errors are fine — we'll try again at the next beat
      }
      if (cancelled) return;
      timer = setTimeout(beat, BEAT_INTERVAL_MS);
    }

    beat();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [boardId]);

  return active;
}
