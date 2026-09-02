"use client";

// Avatar stack for the canvas top bar showing who is currently on the
// same board. Hover any avatar to see their name, role, and designation
// — the same metadata the highlight labels use.

import { useState } from "react";
import type { ActiveUser } from "@/lib/use-board-presence";

const ROLE_COLOR: Record<string, string> = {
  admin: "var(--color-app-copper)",
  advocate: "var(--color-app-ink)",
  junior: "var(--color-app-aqua)",
  clerk: "#7a5cb8",
  viewer: "var(--color-app-fg-muted)",
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  advocate: "Advocate",
  junior: "Junior",
  clerk: "Clerk",
  viewer: "Viewer",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function PresenceDock({ active }: { active: ActiveUser[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  // Self stays as the first chip (so users can recognise their own avatar);
  // others sorted by most recent beat.
  const sorted = [...active].sort((a, b) => {
    if (a.isYou !== b.isYou) return a.isYou ? -1 : 1;
    return b.lastBeat.localeCompare(a.lastBeat);
  });

  if (sorted.length === 0) return null;

  // Show up to 4 avatars; the rest collapse into a "+N" chip.
  const visible = sorted.slice(0, 4);
  const overflow = sorted.length - visible.length;

  return (
    <div
      className="flex items-center gap-2 rounded-full px-2 py-1.5"
      style={{
        backgroundColor: "rgba(255,255,255,0.92)",
        boxShadow:
          "0 6px 16px -8px rgba(10,17,36,0.18), 0 0 0 1px rgba(10,17,36,0.06)",
        backdropFilter: "blur(8px)",
      }}
    >
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.18em]"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-fg-muted)",
        }}
      >
        On board
      </span>
      <div className="flex items-center -space-x-2">
        {visible.map((u) => {
          const color = ROLE_COLOR[u.role] || ROLE_COLOR.junior;
          const isHover = hovered === u.userId;
          return (
            <div
              key={u.userId}
              onMouseEnter={() => setHovered(u.userId)}
              onMouseLeave={() => setHovered(null)}
              className="relative"
            >
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold transition-transform"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  backgroundColor: color,
                  color:
                    color === "var(--color-app-copper)"
                      ? "var(--color-app-copper-text)"
                      : "var(--color-app-ivory)",
                  border: "2px solid #fff",
                  boxShadow:
                    "0 2px 6px -2px rgba(10,17,36,0.25)",
                  transform: isHover ? "translateY(-2px)" : "translateY(0)",
                  zIndex: isHover ? 5 : 1,
                }}
              >
                {initials(u.name)}
              </div>
              {isHover ? (
                <div
                  className="absolute left-1/2 top-full z-[60] mt-2 -translate-x-1/2 whitespace-nowrap rounded-md px-3 py-2 text-[11px]"
                  style={{
                    fontFamily: "var(--font-manrope), sans-serif",
                    backgroundColor: "var(--color-app-ink)",
                    color: "var(--color-app-ivory)",
                    boxShadow:
                      "0 12px 28px -10px rgba(10,17,36,0.40), 0 0 0 1px rgba(245,235,214,0.04)",
                  }}
                >
                  <div style={{ color, fontWeight: 600 }}>
                    {u.name}
                    {u.isYou ? (
                      <span
                        className="ml-1.5 text-[9px] uppercase tracking-[0.16em]"
                        style={{
                          fontFamily: "var(--font-dm-mono), monospace",
                          color: "rgba(245,235,214,0.55)",
                        }}
                      >
                        you
                      </span>
                    ) : null}
                  </div>
                  <div
                    className="mt-0.5 text-[10px] uppercase tracking-[0.14em]"
                    style={{
                      fontFamily: "var(--font-dm-mono), monospace",
                      color: "rgba(245,235,214,0.55)",
                    }}
                  >
                    {ROLE_LABEL[u.role] || u.role}
                    {u.designation ? ` · ${u.designation}` : ""}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
        {overflow > 0 ? (
          <div
            className="flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              backgroundColor: "var(--color-app-canvas-2)",
              color: "var(--color-app-fg-soft)",
              border: "2px solid #fff",
            }}
          >
            +{overflow}
          </div>
        ) : null}
      </div>
    </div>
  );
}
