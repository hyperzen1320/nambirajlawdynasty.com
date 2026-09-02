"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SeniorDeskMember } from "./SeniorDeskClient";

// Modal: pick a teammate to start a private chat with. Filters out
// inactive users. Members the caller already has a thread with show
// "Open chat" — it routes to the existing room (idempotent on the API
// side, no new room is created).

export default function NewChatPicker({
  members,
  existingRoomMembers,
  onPick,
  onClose,
}: {
  members: SeniorDeskMember[];
  existingRoomMembers: Set<string>;
  onPick: (userId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = members.filter((m) => m.active);
    if (!q) return active;
    return active.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q)
    );
  }, [members, query]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center px-4 pt-[10vh]"
      style={{ backgroundColor: "rgba(10,17,36,0.55)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] overflow-hidden rounded-2xl"
        style={{
          backgroundColor: "var(--color-app-paper)",
          boxShadow:
            "0 32px 64px -16px rgba(10,17,36,0.40), 0 0 0 1px rgba(10,17,36,0.06)",
        }}
      >
        <div
          className="px-5 pt-5 pb-3"
          style={{ borderBottom: "1px solid var(--color-app-edge-soft)" }}
        >
          <div
            className="text-[10px] uppercase tracking-[0.22em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-copper-deep)",
            }}
          >
            New private chat
          </div>
          <h3
            className="mt-1 text-[20px] font-semibold tracking-tight"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            Pick a teammate
          </h3>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or role…"
            className="mt-3 block w-full rounded-md border px-3 py-2 text-[13px] outline-none"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              borderColor: "var(--color-app-edge)",
              backgroundColor: "var(--color-app-canvas-2)",
              color: "var(--color-app-ink)",
            }}
          />
        </div>

        <div className="max-h-[min(420px,52vh)] overflow-y-auto px-2 py-2">
          {filtered.length === 0 ? (
            <div
              className="px-4 py-8 text-center text-[12.5px]"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                color: "var(--color-app-fg-muted)",
              }}
            >
              No teammates match that search.
            </div>
          ) : (
            <ul>
              {filtered.map((m) => {
                const existing = existingRoomMembers.has(m.id);
                return (
                  <li key={m.id}>
                    <button
                      onClick={() => onPick(m.id)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-app-canvas-2)]"
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                        style={{
                          fontFamily:
                            "var(--font-crimson), Georgia, serif",
                          backgroundColor: "var(--color-app-ink)",
                          color: "var(--color-app-ivory)",
                        }}
                      >
                        {initials(m.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="truncate text-[13.5px] font-semibold"
                            style={{
                              fontFamily:
                                "var(--font-manrope), sans-serif",
                              color: "var(--color-app-ink)",
                            }}
                          >
                            {m.name}
                          </span>
                          <span
                            className="rounded-sm px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em]"
                            style={{
                              fontFamily:
                                "var(--font-dm-mono), monospace",
                              backgroundColor: "var(--color-app-canvas-2)",
                              color: "var(--color-app-fg-soft)",
                            }}
                          >
                            {m.role}
                          </span>
                        </div>
                        <div
                          className="mt-0.5 truncate text-[11px]"
                          style={{
                            fontFamily:
                              "var(--font-dm-mono), monospace",
                            color: "var(--color-app-fg-muted)",
                            letterSpacing: 0.3,
                          }}
                        >
                          {m.email}
                        </div>
                      </div>
                      <span
                        className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                        style={{
                          fontFamily:
                            "var(--font-dm-mono), monospace",
                          color: existing
                            ? "var(--color-app-fg-muted)"
                            : "var(--color-app-copper-deep)",
                        }}
                      >
                        {existing ? "Open chat" : "Start chat"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div
          className="flex items-center justify-between gap-3 px-5 py-3"
          style={{
            backgroundColor: "var(--color-app-canvas-2)",
            borderTop: "1px solid var(--color-app-edge-soft)",
          }}
        >
          <div
            className="text-[10px]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-muted)",
              letterSpacing: 0.3,
            }}
          >
            Esc to close
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-[12px] font-semibold"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              backgroundColor: "var(--color-app-paper)",
              color: "var(--color-app-fg-soft)",
              border: "1px solid var(--color-app-edge)",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
