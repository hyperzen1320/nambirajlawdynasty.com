"use client";

// RecentChangeOverlay listens to the live activity feed and turns each
// incoming event that targets a list / card / edge on the current board
// into a brief visual highlight on that element + a floating actor label.
//
// Mechanism: we don't render anything inside the canvas tree. Instead we
// add a `data-le-pulse` attribute to the affected DOM element via a
// query against the canvas viewport, and the global CSS animation picks
// it up. This keeps every existing list/card/edge render path untouched
// — the highlight is purely additive and removable.
//
// Coalescing: if the same actor performs many actions on the same target
// type within a 4-second window, we collapse them into a single label so
// the canvas doesn't look like a slot machine when someone bulk-creates.

import { useEffect, useRef, useState } from "react";
import type { LiveActivityRow } from "@/lib/use-board-live-feed";

type Props = {
  newRows: LiveActivityRow[];
  // Don't highlight the current user's own actions; they already see the
  // optimistic UI on their own clicks and an extra glow would be noisy.
  selfUserId: string | null;
};

const PULSE_MS = 2500;
const COALESCE_WINDOW_MS = 4000;

const ROLE_COLOR: Record<string, string> = {
  admin: "var(--color-app-copper)",
  advocate: "var(--color-app-ink)",
  junior: "var(--color-app-aqua)",
  clerk: "#7a5cb8",
  viewer: "var(--color-app-fg-muted)",
};

type FloatingLabel = {
  key: string;
  targetType: "task" | "list";
  targetId: string;
  actorName: string;
  message: string;
  color: string;
  bornAt: number;
};

function isHighlightable(
  row: LiveActivityRow
): row is LiveActivityRow & { targetType: "task" | "list" | "edge" } {
  return (
    !!row.targetId &&
    (row.targetType === "task" ||
      row.targetType === "list" ||
      row.targetType === "edge")
  );
}

function pulseElement(targetType: string, targetId: string): void {
  if (typeof document === "undefined") return;
  const selector =
    targetType === "edge"
      ? `[data-id="${CSS.escape(targetId)}"]`
      : `[data-le-id="${CSS.escape(targetId)}"]`;
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return;
  el.removeAttribute("data-le-pulse");
  // Force reflow so a back-to-back pulse on the same element restarts cleanly.
  void el.offsetWidth;
  el.setAttribute("data-le-pulse", targetType);
  setTimeout(() => {
    if (el.getAttribute("data-le-pulse") === targetType) {
      el.removeAttribute("data-le-pulse");
    }
  }, PULSE_MS);
}

function shortLabel(row: LiveActivityRow): string {
  const stripped = row.message.replace(/\*\*/g, "");
  const cut = stripped.indexOf(".");
  return (cut > 0 ? stripped.slice(0, cut) : stripped).slice(0, 90);
}

function deriveColor(row: LiveActivityRow): string {
  const role =
    typeof row.metadata?.role === "string"
      ? (row.metadata.role as string)
      : "";
  return ROLE_COLOR[role] || ROLE_COLOR.junior;
}

export default function RecentChangeOverlay({ newRows, selfUserId }: Props) {
  const [labels, setLabels] = useState<FloatingLabel[]>([]);
  const lastProcessedRef = useRef(0);
  const lastFireRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const start = lastProcessedRef.current;
    if (start >= newRows.length) return;
    const fresh = newRows.slice(start);
    lastProcessedRef.current = newRows.length;

    const now = Date.now();
    const newLabels: FloatingLabel[] = [];

    for (const row of fresh) {
      if (selfUserId && row.actorUserId === selfUserId) continue;
      if (!isHighlightable(row)) continue;

      const targetId = row.targetId as string;
      const key = `${row.actorUserId ?? "anon"}:${row.targetType}`;
      const last = lastFireRef.current.get(key) ?? 0;
      const coalesce = now - last < COALESCE_WINDOW_MS;
      lastFireRef.current.set(key, now);

      pulseElement(row.targetType, targetId);

      if (!coalesce && row.targetType !== "edge") {
        newLabels.push({
          key: `${row.id}`,
          targetType: row.targetType,
          targetId,
          actorName: row.actorName,
          message: shortLabel(row),
          color: deriveColor(row),
          bornAt: now,
        });
      }
    }

    if (newLabels.length > 0) {
      // setState in an effect is the right pattern here: we are reacting
      // to external prop changes (newRows from the live feed) and the
      // outcome (new labels) is genuinely event-driven, not derivable.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLabels((prev) => {
        const filtered = prev.filter(
          (l) => Date.now() - l.bornAt < PULSE_MS
        );
        return [...filtered, ...newLabels];
      });
    }
  }, [newRows, selfUserId]);

  // Sweep expired labels off the screen.
  useEffect(() => {
    if (labels.length === 0) return;
    const t = setInterval(() => {
      const now = Date.now();
      setLabels((prev) => {
        const next = prev.filter((l) => now - l.bornAt < PULSE_MS);
        return next.length === prev.length ? prev : next;
      });
    }, 500);
    return () => clearInterval(t);
  }, [labels.length]);

  if (labels.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[180]">
      {labels.map((label) => (
        <FloatingActorLabel key={label.key} label={label} />
      ))}
    </div>
  );
}

function FloatingActorLabel({ label }: { label: FloatingLabel }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      if (!ref.current) return;
      const selector = `[data-le-id="${CSS.escape(label.targetId)}"]`;
      const target = document.querySelector(selector) as HTMLElement | null;
      if (!target) {
        ref.current.style.opacity = "0";
      } else {
        const rect = target.getBoundingClientRect();
        ref.current.style.left = `${rect.left + rect.width / 2}px`;
        ref.current.style.top = `${rect.top - 12}px`;
        ref.current.style.opacity = "1";
      }
      raf = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(raf);
  }, [label.targetId]);

  return (
    <div
      ref={ref}
      className="fixed -translate-x-1/2 -translate-y-full select-none rounded-md px-2.5 py-1.5 text-[11px] font-semibold"
      style={{
        fontFamily: "var(--font-manrope), sans-serif",
        backgroundColor: "rgba(10,17,36,0.92)",
        color: label.color,
        animation: "le-actor-fade 2.5s cubic-bezier(0.2, 0.7, 0.1, 1) both",
        whiteSpace: "nowrap",
        boxShadow:
          "0 12px 24px -8px rgba(10,17,36,0.40), 0 0 0 1px rgba(245,235,214,0.06)",
      }}
    >
      <span style={{ color: label.color }}>{label.actorName}</span>
      <span
        className="mx-1.5"
        style={{ color: "rgba(245,235,214,0.30)", fontWeight: 400 }}
      >
        ·
      </span>
      <span
        style={{ color: "var(--color-app-ivory)", fontWeight: 400 }}
      >
        {label.message}
      </span>
    </div>
  );
}
