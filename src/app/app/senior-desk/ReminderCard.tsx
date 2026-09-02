"use client";

// Single reminder row. Shows priority dot, title, description, due-date
// pill (red if overdue, copper if today), assigned-to + creator chips,
// and a check-off button. Delete lives in a hover-revealed control on
// the right.

export type ReminderDTO = {
  id: string;
  title: string;
  description: string;
  dueDate: string | null;
  priority: "low" | "normal" | "high";
  assignedToUserId: string;
  assignedToName: string;
  createdByUserId: string;
  createdByName: string;
  status: "pending" | "done";
  completedAt: string | null;
  isMine: boolean;
  isOverdue: boolean;
  isDueToday: boolean;
  createdAt: string;
};

export default function ReminderCard({
  reminder,
  callerId,
  isAdmin,
  onToggle,
  onDelete,
}: {
  reminder: ReminderDTO;
  callerId: string;
  isAdmin: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const r = reminder;
  const canDelete = r.createdByUserId === callerId || isAdmin;
  const isDone = r.status === "done";
  const dueLabel = r.dueDate ? formatDue(r.dueDate, r.isOverdue, r.isDueToday) : null;

  const dueColor = r.isOverdue
    ? { bg: "var(--color-app-danger-soft)", fg: "var(--color-app-danger)" }
    : r.isDueToday
      ? {
          bg: "rgba(197,133,58,0.18)",
          fg: "var(--color-app-copper-deep)",
        }
      : { bg: "var(--color-app-canvas-2)", fg: "var(--color-app-fg-soft)" };

  return (
    <li
      className="group flex items-start gap-4 rounded-xl px-5 py-4"
      style={{
        backgroundColor: "var(--color-app-paper)",
        boxShadow: "0 1px 0 var(--color-app-edge)",
        opacity: isDone ? 0.62 : 1,
      }}
    >
      <button
        onClick={onToggle}
        aria-label={isDone ? "Mark as pending" : "Mark as done"}
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors"
        style={{
          backgroundColor: isDone
            ? "var(--color-app-copper)"
            : "var(--color-app-paper)",
          border: isDone
            ? "1.5px solid var(--color-app-copper)"
            : "1.5px solid var(--color-app-edge)",
        }}
      >
        {isDone ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12l5 5L20 7"
              stroke="var(--color-app-copper-text)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {r.priority !== "normal" ? <PriorityDot priority={r.priority} /> : null}
          <h4
            className="text-[14px] font-semibold leading-tight"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-ink)",
              textDecoration: isDone ? "line-through" : "none",
              textDecorationColor: "var(--color-app-fg-muted)",
            }}
          >
            {r.title}
          </h4>
        </div>
        {r.description ? (
          <p
            className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-[1.55]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-fg-soft)",
            }}
          >
            {r.description}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          {dueLabel ? (
            <span
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                backgroundColor: dueColor.bg,
                color: dueColor.fg,
                letterSpacing: 0.3,
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <rect
                  x="4"
                  y="6"
                  width="16"
                  height="14"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M8 4v4M16 4v4M4 11h16"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
              {dueLabel}
            </span>
          ) : null}
          {r.assignedToUserId !== r.createdByUserId ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                backgroundColor: "var(--color-app-canvas-2)",
                color: "var(--color-app-fg-soft)",
                letterSpacing: 0.3,
              }}
            >
              <span style={{ color: "var(--color-app-fg-muted)" }}>
                Assigned to
              </span>
              <span style={{ color: "var(--color-app-ink)", fontWeight: 600 }}>
                {r.assignedToUserId === callerId ? "you" : r.assignedToName}
              </span>
            </span>
          ) : null}
          {r.createdByUserId !== callerId ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                backgroundColor: "var(--color-app-canvas-2)",
                color: "var(--color-app-fg-muted)",
                letterSpacing: 0.3,
              }}
            >
              from {r.createdByName}
            </span>
          ) : null}
          {isDone && r.completedAt ? (
            <span
              className="text-[11px]"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                color: "var(--color-app-fg-muted)",
              }}
            >
              Done {formatRelative(r.completedAt)}
            </span>
          ) : null}
        </div>
      </div>

      {canDelete ? (
        <button
          onClick={onDelete}
          aria-label="Delete reminder"
          className="opacity-0 transition-opacity group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-md hover:bg-[var(--color-app-canvas-2)]"
          style={{ color: "var(--color-app-fg-muted)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M7 7l1 13a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-13"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : null}
    </li>
  );
}

function PriorityDot({ priority }: { priority: "low" | "high" }) {
  const color = priority === "high" ? "var(--color-app-danger)" : "var(--color-app-fg-muted)";
  return (
    <span
      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      title={`${priority} priority`}
    />
  );
}

function formatDue(iso: string, overdue: boolean, today: boolean): string {
  const d = new Date(iso);
  if (overdue) {
    const days = Math.floor(
      (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days === 0) return "Overdue · today";
    if (days === 1) return "Overdue · yesterday";
    return `Overdue · ${days}d ago`;
  }
  if (today) return "Today";
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dCmp = new Date(d);
  dCmp.setHours(0, 0, 0, 0);
  if (dCmp.getTime() === tomorrow.getTime()) return "Tomorrow";
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffH = Math.round((now.getTime() - d.getTime()) / (1000 * 60 * 60));
  if (diffH < 1) return "just now";
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 30) return `${diffD}d ago`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}
