"use client";

import { useMemo, useState } from "react";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type TicketRow = {
  id: string;
  partnerName: string;
  reporterName: string;
  reporterEmail: string;
  reporterPhone: string;
  subject: string;
  category: string;
  message: string;
  status: TicketStatus;
  adminNote: string;
  createdAt: string;
};

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_ORDER: TicketStatus[] = [
  "open",
  "in_progress",
  "resolved",
  "closed",
];

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SupportInbox({
  tickets: initial,
  counts,
}: {
  tickets: TicketRow[];
  counts: Record<string, number>;
}) {
  const [tickets, setTickets] = useState(initial);
  const [tab, setTab] = useState<"all" | TicketStatus>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const visible = useMemo(
    () => (tab === "all" ? tickets : tickets.filter((t) => t.status === tab)),
    [tickets, tab]
  );

  const tabCounts: Record<string, number> = {
    all: tickets.length,
    ...counts,
  };

  async function setStatus(id: string, status: TicketStatus) {
    setBusyId(id);
    // Optimistic — revert on failure.
    const prev = tickets;
    setTickets((ts) => ts.map((t) => (t.id === id ? { ...t, status } : t)));
    try {
      const res = await fetch(`/api/admin/support/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) setTickets(prev);
    } catch {
      setTickets(prev);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this ticket? It will be hidden from the inbox."))
      return;
    setBusyId(id);
    const prev = tickets;
    setTickets((ts) => ts.filter((t) => t.id !== id));
    try {
      const res = await fetch(`/api/admin/support/${id}`, { method: "DELETE" });
      if (!res.ok) setTickets(prev);
    } catch {
      setTickets(prev);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-8 lg:px-10">
      <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-admin-fg-soft">
        Support
      </div>
      <h1 className="text-[26px] font-semibold tracking-tight text-admin-fg">
        Support inbox
      </h1>
      <p className="mt-2 max-w-xl text-[14px] text-admin-fg-muted">
        Issues reported from the mobile app. Update the status as you work
        through them; delete spam.
      </p>

      {/* Status tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {(["all", ...STATUS_ORDER] as const).map((key) => {
          const active = tab === key;
          const label = key === "all" ? "All" : STATUS_LABEL[key];
          const n = tabCounts[key] ?? 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={[
                "rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                active
                  ? "bg-admin-accent-soft text-admin-accent"
                  : "text-admin-fg-muted hover:bg-admin-border-soft hover:text-admin-fg",
              ].join(" ")}
            >
              {label}
              <span className="ml-1.5 text-[11px] text-admin-fg-soft">{n}</span>
            </button>
          );
        })}
      </div>

      {/* Tickets */}
      <div className="mt-5 space-y-3">
        {visible.length === 0 ? (
          <div className="rounded-lg border border-dashed border-admin-border px-6 py-12 text-center text-[14px] text-admin-fg-muted">
            No {tab === "all" ? "" : STATUS_LABEL[tab as TicketStatus].toLowerCase()}{" "}
            tickets.
          </div>
        ) : (
          visible.map((t) => (
            <TicketCard
              key={t.id}
              t={t}
              busy={busyId === t.id}
              onStatus={(s) => setStatus(t.id, s)}
              onDelete={() => remove(t.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TicketCard({
  t,
  busy,
  onStatus,
  onDelete,
}: {
  t: TicketRow;
  busy: boolean;
  onStatus: (s: TicketStatus) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const long = t.message.length > 180;

  return (
    <div
      className="rounded-lg border border-admin-border bg-admin-surface p-4"
      style={{ opacity: busy ? 0.6 : 1 }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-sm bg-admin-border-soft px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-admin-fg-soft"
              style={{ fontFamily: "var(--font-plex-mono), monospace" }}
            >
              {t.category}
            </span>
            <span className="text-[14px] font-semibold text-admin-fg">
              {t.subject || "(no subject)"}
            </span>
          </div>
          <div className="mt-1 text-[12px] text-admin-fg-muted">
            {t.reporterName || "Someone"}
            {t.partnerName ? ` · ${t.partnerName}` : ""} · {fmt(t.createdAt)}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <select
            value={t.status}
            disabled={busy}
            onChange={(e) => onStatus(e.target.value as TicketStatus)}
            className="rounded-md border border-admin-border bg-admin-bg px-2 py-1.5 text-[12.5px] text-admin-fg"
            aria-label="Ticket status"
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="rounded-md border border-admin-border px-2 py-1.5 text-[12.5px] text-admin-fg-soft transition-colors hover:border-admin-danger hover:text-admin-danger"
            aria-label="Delete ticket"
            title="Delete ticket"
          >
            Delete
          </button>
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed text-admin-fg">
        {open || !long ? t.message : `${t.message.slice(0, 180)}…`}
      </p>
      {long ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1 text-[12px] font-medium text-admin-accent"
        >
          {open ? "Show less" : "Show more"}
        </button>
      ) : null}

      {t.reporterEmail || t.reporterPhone ? (
        <div
          className="mt-3 flex flex-wrap gap-4 border-t border-admin-border-soft pt-3 text-[12px] text-admin-fg-muted"
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          {t.reporterEmail ? (
            <a
              href={`mailto:${t.reporterEmail}`}
              className="hover:text-admin-accent"
            >
              {t.reporterEmail}
            </a>
          ) : null}
          {t.reporterPhone ? <span>{t.reporterPhone}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
