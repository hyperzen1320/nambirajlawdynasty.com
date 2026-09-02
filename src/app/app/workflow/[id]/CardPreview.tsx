"use client";

import { useState, type CSSProperties } from "react";

export type PreviewTask = {
  id: string;
  listId: string;
  title: string;
  description: string;
  sortOrder: number;
  assignee: { id: string; name: string; role: string } | null;
  dueDate: string | null;
  priority: "low" | "medium" | "high" | null;
  checklistSummary: {
    totalChecklists: number;
    totalItems: number;
    doneItems: number;
  };
  hasDescription: boolean;
  updatedAt: string;
};

export default function CardPreview({
  task,
  onClick,
  isDraggingOverlay,
  accent,
}: {
  task: PreviewTask;
  onClick: () => void;
  isDraggingOverlay?: boolean;
  accent: string;
}) {
  const [hover, setHover] = useState(false);
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = due && due < today;
  const isToday = due && due.toDateString() === new Date().toDateString();

  const dueLabel = due
    ? due.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
    : "";

  const checklistTotal = task.checklistSummary.totalItems;
  const checklistDone = task.checklistSummary.doneItems;
  const checklistPct =
    checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;
  const allDone = checklistTotal > 0 && checklistDone === checklistTotal;

  const priority = task.priority;
  const priorityColor =
    priority === "high"
      ? "#c14a37"
      : priority === "medium"
        ? "#c5853a"
        : priority === "low"
          ? "#56a0a8"
          : null;
  const priorityLabel =
    priority === "high"
      ? "High"
      : priority === "medium"
        ? "Medium"
        : priority === "low"
          ? "Low"
          : null;

  const descPreview = (task.description || "")
    .replace(/\n+/g, " ")
    .trim()
    .slice(0, 140);

  const cardStyle: CSSProperties = {
    backgroundColor: "#ffffff",
    boxShadow: isDraggingOverlay
      ? "0 26px 50px -14px rgba(10,17,36,0.34), 0 8px 16px -8px rgba(10,17,36,0.2)"
      : hover
        ? "0 12px 26px -12px rgba(10,17,36,0.22), 0 2px 5px -2px rgba(10,17,36,0.07)"
        : "0 1px 2px rgba(10,17,36,0.05), 0 1px 3px -1px rgba(10,17,36,0.05)",
    transform: isDraggingOverlay
      ? "rotate(1.5deg) scale(1.02)"
      : hover
        ? "translateY(-2px)"
        : "translateY(0)",
    transition:
      "box-shadow 220ms cubic-bezier(0.2, 0.7, 0.1, 1), transform 220ms cubic-bezier(0.2, 0.7, 0.1, 1)",
    borderRadius: 11,
    cursor: "pointer",
    position: "relative",
    border: "1px solid rgba(10,17,36,0.06)",
    // A colour spine on the left telegraphs priority at a glance even before
    // the eye reaches the tag.
    borderLeft: priorityColor
      ? `3px solid ${priorityColor}`
      : "1px solid rgba(10,17,36,0.06)",
    animation: isDraggingOverlay
      ? undefined
      : "card-pop 260ms cubic-bezier(0.2, 0.7, 0.1, 1) both",
  };

  // Cards with a temp:* id are optimistic — local-only until the server
  // confirms. We mark them with data attributes so the global pending
  // styles (dim + blinking dot) apply automatically.
  const isPending = task.id.startsWith("tmp:");

  return (
    <div
      onClick={isPending ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="nodrag"
      data-le-id={task.id}
      data-le-pending={isPending ? "true" : undefined}
      style={cardStyle}
    >
      <style>{`
        @keyframes card-pop {
          from { opacity: 0; transform: translateY(6px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Hamburger — opens the card popup. Stops propagation so it works
          even if the card body's own click is suppressed. */}
      {!isPending ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          aria-label="Open card"
          title="Open card"
          className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-md"
          style={{
            opacity: hover ? 1 : 0,
            transition: "opacity 150ms",
            backgroundColor: "rgba(10,17,36,0.06)",
            color: "var(--color-app-fg-muted)",
            cursor: "pointer",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}

      <div className="px-3.5 py-3">
        {/* Priority tag — labelled, so the colour spine isn't the only cue. */}
        {priorityLabel && priorityColor ? (
          <span
            className="mb-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              backgroundColor: `${priorityColor}1c`,
              color: priorityColor,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: priorityColor }}
            />
            {priorityLabel}
          </span>
        ) : null}

        {/* Title */}
        <div
          className="text-[14px] leading-[1.34] tracking-tight"
          style={{
            fontFamily: "var(--font-crimson), Georgia, serif",
            color: "var(--color-app-ink)",
            fontWeight: 600,
            // Leave room for the hover hamburger so a long title never tucks
            // under it.
            paddingRight: 18,
          }}
        >
          {task.title}
        </div>

        {/* Description preview */}
        {descPreview ? (
          <p
            className="mt-1.5 text-[11.5px] leading-[1.5]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-fg-soft)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as const,
              overflow: "hidden",
            }}
          >
            {descPreview}
            {(task.description || "").length > 140 ? "…" : ""}
          </p>
        ) : null}

        {/* Checklist progress bar */}
        {checklistTotal > 0 ? (
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold tabular-nums"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  color: allDone
                    ? "var(--color-app-aqua)"
                    : "var(--color-app-fg-muted)",
                  letterSpacing: 0.4,
                }}
              >
                <CheckIcon />
                {checklistDone}/{checklistTotal}
              </span>
              <span
                className="text-[10px] tabular-nums"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  color: "var(--color-app-fg-muted)",
                }}
              >
                {checklistPct}%
              </span>
            </div>
            <div
              className="mt-1 h-1.5 overflow-hidden rounded-full"
              style={{ backgroundColor: "var(--color-app-canvas-2)" }}
            >
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${checklistPct}%`,
                  background: allDone
                    ? "linear-gradient(90deg, #56a0a8, #1f4e54)"
                    : `linear-gradient(90deg, ${accent}, ${accent}cc)`,
                }}
              />
            </div>
          </div>
        ) : null}

        {/* Footer chips */}
        {(due || task.assignee || (task.hasDescription && !descPreview)) && (
          <div className="mt-3 flex items-center gap-1.5">
            {due ? (
              <span
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  backgroundColor: isOverdue
                    ? "var(--color-app-danger-soft)"
                    : isToday
                      ? "rgba(197,133,58,0.16)"
                      : "var(--color-app-canvas-2)",
                  color: isOverdue
                    ? "var(--color-app-danger)"
                    : isToday
                      ? "var(--color-app-copper-deep)"
                      : "var(--color-app-fg-soft)",
                  letterSpacing: 0.3,
                }}
                title={
                  isOverdue ? "Overdue" : isToday ? "Due today" : "Due " + dueLabel
                }
              >
                <ClockIcon />
                {dueLabel}
              </span>
            ) : null}

            {task.hasDescription && !descPreview ? (
              <span
                style={{ color: "var(--color-app-fg-muted)" }}
                title="Has description"
              >
                <DescIcon />
              </span>
            ) : null}

            <div className="ml-auto flex items-center gap-1.5">
              {task.assignee ? (
                <span
                  title={task.assignee.name}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold"
                  style={{
                    fontFamily: "var(--font-crimson), Georgia, serif",
                    backgroundColor: "var(--color-app-ink)",
                    color: "var(--color-app-ivory)",
                    boxShadow: "0 0 0 2px #ffffff, 0 1px 3px rgba(10,17,36,0.18)",
                  }}
                >
                  {initials(task.assignee.name)}
                </span>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12l5 5L20 7"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function DescIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 6h14M5 12h14M5 18h9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
