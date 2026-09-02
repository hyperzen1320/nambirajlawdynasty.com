"use client";

import Link from "next/link";
import type { CaseFilters, CaseRow } from "./case-vault-types";
import CnrLink from "@/app/app/components/CnrLink";
import { EmptyVault, hasAnyFilter } from "./vault-shared";

// CaseCards — the default Case Vault view. One card per matter, surfacing
// the same fields the row carries (case/file no., status, advocate,
// client-vs-opposite, court + place, CNR, next date) in a glanceable
// layout. The dense table lives behind the Cards|Table toggle for power
// use; this is the friendly daily-driver view.
//
// All actions mirror the table so nothing is lost in this view:
//   • the case number links to the detail page (open),
//   • Edit routes to the edit form,
//   • the trash icon runs the same dispose / delete-request flow.
// The card itself is NOT a link — the case-number anchor is — so the
// inner buttons don't nest inside an anchor.

export default function CaseCards({
  rows,
  loading,
  appliedFilters,
  onDelete,
  selectable = false,
  isSelected,
  onToggleSelect,
}: {
  rows: CaseRow[];
  loading: boolean;
  appliedFilters: CaseFilters;
  onDelete: (row: CaseRow) => void;
  selectable?: boolean;
  isSelected?: (id: string) => boolean;
  onToggleSelect?: (id: string) => void;
}) {
  if (loading && rows.length === 0) {
    return <SkeletonCards />;
  }

  if (rows.length === 0) {
    return (
      <div
        className="rounded-2xl px-6 py-16 text-center"
        style={{
          backgroundColor: "var(--color-app-paper)",
          boxShadow:
            "0 10px 26px -18px rgba(18,29,53,0.28), inset 0 0 0 1px var(--color-app-edge)",
        }}
      >
        <EmptyVault hasFilters={hasAnyFilter(appliedFilters)} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <CaseCard
          key={row.id}
          row={row}
          onDelete={onDelete}
          selectable={selectable}
          selected={Boolean(isSelected?.(row.id))}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}

function CaseCard({
  row,
  onDelete,
  selectable,
  selected,
  onToggleSelect,
}: {
  row: CaseRow;
  onDelete: (row: CaseRow) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  return (
    <div
      className="group rounded-2xl p-5 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5"
      style={{
        backgroundColor: selected
          ? "var(--color-app-canvas-2)"
          : "var(--color-app-paper)",
        boxShadow: selected
          ? "0 10px 26px -18px rgba(18,29,53,0.28), inset 0 0 0 2px var(--color-app-copper)"
          : "0 10px 26px -18px rgba(18,29,53,0.28), inset 0 0 0 1px var(--color-app-edge)",
      }}
    >
      <div className="flex items-start gap-3.5">
        {selectable ? (
          <label
            className="flex shrink-0 cursor-pointer items-center pt-1"
            title={selected ? "Deselect matter" : "Select matter"}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={Boolean(selected)}
              onChange={() => onToggleSelect?.(row.id)}
              className="h-[18px] w-[18px] cursor-pointer rounded"
              style={{ accentColor: "var(--color-app-copper)" }}
              aria-label={`Select ${row.caseNo || "matter"}`}
            />
          </label>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
        {/* Left — identity, parties, court */}
        <div className="min-w-0 flex-1">
          {/* Heading row: case no · file no · status · advocate */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Link
              href={`/app/cases/${row.id}`}
              className="text-[19px] font-semibold leading-tight tracking-tight transition-colors hover:opacity-70"
              style={{
                fontFamily: "var(--font-crimson), Georgia, serif",
                color: "var(--color-app-ink)",
              }}
            >
              {row.caseNo || "Untitled matter"}
            </Link>
            {row.fileNo ? (
              <span
                className="text-[11.5px]"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  color: "var(--color-app-fg-muted)",
                }}
              >
                {row.fileNo}
              </span>
            ) : null}
            {row.status ? <StatusPill status={row.status} /> : null}
            <AdvocateChip name={row.advocateName} />
          </div>

          {/* Parties */}
          <p
            className="mt-2.5 text-[13.5px]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-fg-soft)",
            }}
          >
            <span style={{ color: "var(--color-app-fg-muted)" }}>Client: </span>
            <span style={{ color: "var(--color-app-ink)", fontWeight: 600 }}>
              {row.clientName || "—"}
            </span>
            {row.oppositeParty ? (
              <>
                <span style={{ color: "var(--color-app-fg-muted)" }}> vs </span>
                <span style={{ color: "var(--color-app-ink)" }}>
                  {row.oppositeParty}
                </span>
              </>
            ) : null}
          </p>

          {/* Court + CNR */}
          <div
            className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-fg-muted)",
            }}
          >
            {row.courtName || row.courtPlace ? (
              <span>
                {row.courtName}
                {row.courtName && row.courtNumber ? (
                  <span
                    className="ml-1.5 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em]"
                    style={{
                      fontFamily: "var(--font-dm-mono), monospace",
                      backgroundColor: "var(--color-app-canvas-2)",
                      color: "var(--color-app-copper-deep)",
                    }}
                  >
                    {row.courtNumber}
                  </span>
                ) : null}
                {row.courtName && row.courtPlace ? ", " : ""}
                {row.courtPlace}
              </span>
            ) : null}
            {(row.courtName || row.courtPlace) && row.cnr ? (
              <span aria-hidden style={{ opacity: 0.6 }}>
                •
              </span>
            ) : null}
            {row.cnr ? (
              <span className="inline-flex items-center gap-1">
                <span
                  className="text-[10px] uppercase tracking-[0.16em]"
                  style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                >
                  CNR
                </span>
                <CnrLink cnr={row.cnr} />
              </span>
            ) : null}
          </div>
        </div>

        {/* Right — next date + actions */}
        <div className="flex shrink-0 items-end justify-between gap-4 sm:flex-col sm:items-end sm:justify-start sm:text-right">
          <NextDate iso={row.nextHearingDate} />
          <div className="flex items-center gap-1.5">
            <Link
              href={`/app/cases/${row.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-semibold transition-colors"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                borderColor: "var(--color-app-edge)",
                color: "var(--color-app-fg-soft)",
                backgroundColor: "var(--color-app-paper)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--color-app-copper)";
                e.currentTarget.style.color = "var(--color-app-copper-deep)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--color-app-edge)";
                e.currentTarget.style.color = "var(--color-app-fg-soft)";
              }}
            >
              <PencilIcon />
              Edit
            </Link>
            <button
              type="button"
              onClick={() => onDelete(row)}
              aria-label="Delete matter"
              title="Delete permanently"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors"
              style={{ color: "var(--color-app-danger)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  "var(--color-app-danger-soft)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}

function NextDate({ iso }: { iso: string | null }) {
  const label = (
    <div
      className="text-[10px] uppercase tracking-[0.18em]"
      style={{
        fontFamily: "var(--font-dm-mono), monospace",
        color: "var(--color-app-fg-muted)",
      }}
    >
      Next date
    </div>
  );

  if (!iso) {
    return (
      <div>
        {label}
        <span
          className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            backgroundColor: "var(--color-app-copper)",
            color: "var(--color-app-copper-text)",
          }}
        >
          Pending
        </span>
      </div>
    );
  }

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return (
      <div>
        {label}
        <div style={{ color: "var(--color-app-fg-muted)" }}>—</div>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = d < today;
  const isToday = d.toDateString() === new Date().toDateString();

  return (
    <div>
      {label}
      <div
        className="mt-0.5 text-[15px] tabular-nums"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          fontWeight: isOverdue || isToday ? 700 : 600,
          color: isOverdue
            ? "var(--color-app-danger)"
            : isToday
              ? "var(--color-app-copper-deep)"
              : "var(--color-app-ink)",
        }}
      >
        {d.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className="inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
      style={{
        fontFamily: "var(--font-dm-mono), monospace",
        backgroundColor: "var(--color-app-aqua-soft)",
        color: "var(--color-app-aqua)",
      }}
    >
      {status}
    </span>
  );
}

function AdvocateChip({ name }: { name: string }) {
  const assigned = Boolean(name && name.trim());
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px]"
      style={{
        fontFamily: "var(--font-manrope), sans-serif",
        backgroundColor: "var(--color-app-canvas-2)",
        color: assigned
          ? "var(--color-app-fg-soft)"
          : "var(--color-app-fg-muted)",
      }}
    >
      <PersonIcon />
      {assigned ? name : "Unassigned"}
    </span>
  );
}

function SkeletonCards() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl p-5"
          style={{
            backgroundColor: "var(--color-app-paper)",
            boxShadow:
              "0 10px 26px -18px rgba(18,29,53,0.28), inset 0 0 0 1px var(--color-app-edge)",
          }}
        >
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0 flex-1 space-y-2.5">
              <div
                className="h-4 animate-pulse rounded"
                style={{
                  backgroundColor: "var(--color-app-canvas-2)",
                  width: "42%",
                }}
              />
              <div
                className="h-3 animate-pulse rounded"
                style={{
                  backgroundColor: "var(--color-app-canvas-2)",
                  width: "60%",
                }}
              />
              <div
                className="h-3 animate-pulse rounded"
                style={{
                  backgroundColor: "var(--color-app-canvas-2)",
                  width: "50%",
                }}
              />
            </div>
            <div
              className="h-8 w-24 animate-pulse rounded-md"
              style={{ backgroundColor: "var(--color-app-canvas-2)" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function PersonIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ flexShrink: 0, opacity: 0.85 }}
    >
      <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5 20c0-3.3 3-5.5 7-5.5s7 2.2 7 5.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4l10-10-4-4L4 16v4z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M14 6l4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
