"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import type { ChatMessageDTO } from "@/lib/use-chat-room";

// Scrollable thread of messages with day separators. Auto-scrolls to the
// bottom on new messages UNLESS the user has scrolled up themselves —
// otherwise the page would yank itself down while they're reading older
// messages, which is one of the worst chat UX antipatterns.

const NEAR_BOTTOM_PX = 80;

export default function MessageList({
  messages,
  loading,
  hasMore,
  loadingOlder,
  isAdmin,
  emptyLabel,
  onLoadOlder,
  onEdit,
  onDelete,
  onScrolledToBottom,
}: {
  messages: ChatMessageDTO[];
  loading: boolean;
  hasMore: boolean;
  loadingOlder: boolean;
  isAdmin: boolean;
  emptyLabel: string;
  onLoadOlder: () => Promise<void>;
  onEdit: (id: string, body: string) => Promise<boolean>;
  onDelete: (id: string, scope: "me" | "everyone") => Promise<boolean>;
  onScrolledToBottom?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const lastIdRef = useRef<string | null>(null);

  // Track scroll position to decide if we should auto-stick to the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = dist < NEAR_BOTTOM_PX;
      setIsAtBottom(atBottom);
      if (atBottom && onScrolledToBottom) onScrolledToBottom();
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [onScrolledToBottom]);

  // Auto-scroll on new messages when the user is already at the bottom.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const newest = messages[messages.length - 1]?.id ?? null;
    if (newest && newest !== lastIdRef.current) {
      lastIdRef.current = newest;
      if (isAtBottom) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [messages, isAtBottom]);

  // First render: jump to bottom (we don't want to start at the top of
  // the loaded history page).
  useEffect(() => {
    if (loading) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setIsAtBottom(true);
  }, [loading]);

  const grouped = useMemo(() => groupByDay(messages), [messages]);

  // Loading + empty states use flex-1 instead of a fixed min-height so
  // the composer below always stays inside the panel — previously the
  // 400px min-height could push the composer past the bottom edge on
  // shorter laptop viewports, which is why the user saw only a sliver
  // of the Send button.
  if (loading) {
    return (
      <div
        className="flex flex-1 items-center justify-center min-h-0"
        style={{ color: "var(--color-app-fg-muted)" }}
      >
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
    );
  }

  if (messages.length === 0) {
    return (
      <div
        className="flex flex-1 min-h-0 flex-col items-center justify-center px-8 text-center"
        style={{ color: "var(--color-app-fg-muted)" }}
      >
        <div
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
          style={{
            backgroundColor: "var(--color-app-canvas-2)",
            color: "var(--color-app-copper-deep)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 7h14M5 12h10M5 17h7"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <p
          className="text-[14px] leading-[1.6] max-w-sm"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
          }}
        >
          {emptyLabel}
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto px-6 py-4"
        style={{
          scrollBehavior: "auto",
        }}
      >
        {hasMore ? (
          <div className="mb-4 flex justify-center">
            <button
              onClick={onLoadOlder}
              disabled={loadingOlder}
              className="rounded-md px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em]"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                backgroundColor: "var(--color-app-canvas-2)",
                color: "var(--color-app-fg-soft)",
                opacity: loadingOlder ? 0.6 : 1,
              }}
            >
              {loadingOlder ? "Loading…" : "Load older"}
            </button>
          </div>
        ) : null}

        <div className="space-y-6">
          {grouped.map((g, gi) => (
            <div key={g.label}>
              <div className="mb-3 flex items-center gap-3">
                <div
                  className="h-px flex-1"
                  style={{ backgroundColor: "var(--color-app-edge-soft)" }}
                />
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                  style={{
                    fontFamily: "var(--font-dm-mono), monospace",
                    color: "var(--color-app-fg-muted)",
                  }}
                >
                  {g.label}
                </span>
                <div
                  className="h-px flex-1"
                  style={{ backgroundColor: "var(--color-app-edge-soft)" }}
                />
              </div>
              <div className="space-y-3">
                {g.rows.map((m, i) => {
                  const prev = g.rows[i - 1];
                  // "Show the sender" if the previous message is from
                  // someone else, or there's a gap of more than 2 minutes.
                  const showSender =
                    !prev ||
                    prev.senderId !== m.senderId ||
                    new Date(m.createdAt).getTime() -
                      new Date(prev.createdAt).getTime() >
                      2 * 60_000;
                  return (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      isAdmin={isAdmin}
                      showSender={showSender}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  );
                })}
              </div>
            </div>
          ))}
          <div data-bottom-anchor className="h-1" />
        </div>
      </div>

      {!isAtBottom ? (
        <button
          onClick={() => {
            const el = scrollRef.current;
            if (el) {
              el.scrollTop = el.scrollHeight;
              setIsAtBottom(true);
            }
          }}
          className="absolute bottom-4 right-6 flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            backgroundColor: "var(--color-app-ink)",
            color: "var(--color-app-ivory)",
            boxShadow: "0 8px 18px -8px rgba(10,17,36,0.45)",
          }}
        >
          Jump to latest
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

function groupByDay(
  rows: ChatMessageDTO[]
): { label: string; rows: ChatMessageDTO[] }[] {
  const groups: Record<string, { label: string; rows: ChatMessageDTO[] }> = {};
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
