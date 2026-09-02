"use client";

import { useEffect, useState } from "react";

// Polls /api/app/chat/unread to drive the Senior Desk unread indicators that
// live in two places — the sidebar nav badge and the dashboard desk tile.
// Sharing one hook keeps both surfaces showing the exact same number.
//
// The endpoint is cheap (one indexed count per room), so a 12s cadence is
// comfortable. We pause while the tab is hidden and re-fire immediately on
// focus, so a backgrounded tab costs nothing and a returning user sees a
// fresh count right away.
export function useChatUnread(): number {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (!alive) return;
      if (typeof document !== "undefined" && document.hidden) {
        timer = setTimeout(tick, 30_000);
        return;
      }
      try {
        const res = await fetch("/api/app/chat/unread", { cache: "no-store" });
        if (alive && res.ok) {
          const data = await res.json();
          setUnread(Number(data?.totalUnread || 0));
        }
      } catch {
        /* network hiccup — keep the last known count, try again next tick */
      }
      if (alive) timer = setTimeout(tick, 12_000);
    }

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

  return unread;
}
