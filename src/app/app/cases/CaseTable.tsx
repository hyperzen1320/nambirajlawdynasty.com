"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  COLUMNS,
  type CaseColumnKey,
  type CaseFilters,
  type CaseRow,
} from "./case-vault-types";
import CnrLink from "@/app/app/components/CnrLink";
import { EmptyVault, hasAnyFilter } from "./vault-shared";

// The main table. Renders one row per case with the visible-columns
// subset, plus a sticky Actions column on the right. Rows are tabbable
// — pressing Enter on a focused row opens the case detail page, just
// like the old card list did. Inline action buttons stop propagation
// so the open-on-click behaviour doesn't fire when the user clicks
// Edit or Delete.

export default function CaseTable({
  rows,
  loading,
  visibleColumns,
  appliedFilters,
  onDelete,
  selectable = false,
  isSelected,
  onToggleSelect,
  allPageSelected = false,
  onToggleSelectAllPage,
}: {
  rows: CaseRow[];
  loading: boolean;
  visibleColumns: CaseColumnKey[];
  appliedFilters: CaseFilters;
  onDelete: (row: CaseRow) => void;
  selectable?: boolean;
  isSelected?: (id: string) => boolean;
  onToggleSelect?: (id: string) => void;
  allPageSelected?: boolean;
  onToggleSelectAllPage?: () => void;
}) {
  const cols = useMemo(
    () =>
      visibleColumns
        .map((k) => COLUMNS.find((c) => c.key === k))
        .filter((c): c is (typeof COLUMNS)[number] => Boolean(c)),
    [visibleColumns]
  );
  // The select column sits outside the toggleable column set so it can't
  // be hidden and doesn't appear in the Columns menu.
  const totalColSpan = cols.length + (selectable ? 1 : 0);

  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{
        backgroundColor: "var(--color-app-paper)",
        boxShadow:
          "0 1px 0 var(--color-app-edge), inset 0 0 0 1px var(--color-app-edge)",
      }}
    >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--color-app-edge)",
                  backgroundColor: "var(--color-app-canvas-2)",
                }}
              >
                {selectable ? (
                  <th
                    scope="col"
                    className="px-4 py-3"
                    style={{ width: 44, textAlign: "center" }}
                  >
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={() => onToggleSelectAllPage?.()}
                      className="h-[18px] w-[18px] cursor-pointer rounded align-middle"
                      style={{ accentColor: "var(--color-app-copper)" }}
                      aria-label="Select all matters on this page"
                      title="Select all on this page"
                    />
                  </th>
                ) : null}
                {cols.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.22em]"
                    style={{
                      fontFamily: "var(--font-dm-mono), monospace",
                      color: "var(--color-app-copper-deep)",
                      minWidth: col.minWidth,
                      textAlign: col.align || "left",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <SkeletonRows colCount={totalColSpan} />
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={totalColSpan}
                    className="px-6 py-16 text-center"
                  >
                    <EmptyVault hasFilters={hasAnyFilter(appliedFilters)} />
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <CaseTableRow
                    key={row.id}
                    row={row}
                    sno={i + 1}
                    cols={cols}
                    onDelete={onDelete}
                    selectable={selectable}
                    selected={Boolean(isSelected?.(row.id))}
                    onToggleSelect={onToggleSelect}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
  );
}

function CaseTableRow({
  row,
  sno,
  cols,
  onDelete,
  selectable,
  selected,
  onToggleSelect,
}: {
  row: CaseRow;
  sno: number;
  cols: (typeof COLUMNS)[number][];
  onDelete: (row: CaseRow) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  // Use a regular row but mark it as a link target via the file/case
  // number cells. The whole row is hoverable for visual feedback; the
  // actions cell stops propagation so its buttons stay isolated.
  const baseBg = selected ? "var(--color-app-canvas-2)" : "transparent";
  return (
    <tr
      className="group"
      style={{
        borderBottom: "1px solid var(--color-app-edge-soft)",
        backgroundColor: baseBg,
        transition: "background-color 120ms ease",
        boxShadow: selected
          ? "inset 3px 0 0 var(--color-app-copper)"
          : "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor =
          "rgba(245,235,214,0.55)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = baseBg;
      }}
    >
      {selectable ? (
        <td className="px-4 py-3 align-middle" style={{ textAlign: "center" }}>
          <input
            type="checkbox"
            checked={Boolean(selected)}
            onChange={() => onToggleSelect?.(row.id)}
            className="h-[18px] w-[18px] cursor-pointer rounded align-middle"
            style={{ accentColor: "var(--color-app-copper)" }}
            aria-label={`Select ${row.caseNo || "matter"}`}
          />
        </td>
      ) : null}
      {cols.map((col) => (
        <td
          key={col.key}
          className="px-4 py-3 align-middle"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-ink)",
            textAlign: col.align || "left",
            verticalAlign: "middle",
          }}
        >
          {renderCell(col.key, row, sno, onDelete)}
        </td>
      ))}
    </tr>
  );
}

function renderCell(
  key: CaseColumnKey,
  row: CaseRow,
  sno: number,
  onDelete: (row: CaseRow) => void
): React.ReactNode {
  switch (key) {
    case "sno":
      return (
        <span
          className="text-[12px] tabular-nums"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            color: "var(--color-app-fg-muted)",
          }}
        >
          {sno}
        </span>
      );
    case "fileNo":
      return (
        <Link
          href={`/app/cases/${row.id}`}
          className="text-[13px] font-semibold transition-colors hover:opacity-70"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            color: "var(--color-app-copper-deep)",
          }}
        >
          {row.fileNo || "—"}
        </Link>
      );
    case "caseNo":
      return (
        <Link
          href={`/app/cases/${row.id}`}
          className="text-[13.5px] font-semibold transition-colors hover:opacity-70"
          style={{
            fontFamily: "var(--font-crimson), Georgia, serif",
            color: "var(--color-app-ink)",
          }}
        >
          {row.caseNo || "—"}
        </Link>
      );
    case "clientName":
      return (
        <span style={{ fontWeight: 600, color: "var(--color-app-ink)" }}>
          {row.clientName || "—"}
        </span>
      );
    case "oppositeParty":
      return row.oppositeParty || muted("—");
    case "oppositeAdvocate":
      return row.oppositeAdvocate || muted("—");
    case "appearingFor":
      return row.appearingFor || muted("—");
    case "clientPhone":
      return row.clientPhone ? mono(row.clientPhone) : muted("—");
    case "clientWhatsapp":
      return row.clientWhatsapp ? mono(row.clientWhatsapp) : muted("—");
    case "cnr":
      return row.cnr ? <CnrLink cnr={row.cnr} /> : muted("—");
    case "iaNumbers":
      return row.iaNumbers ? mono(row.iaNumbers) : muted("—");
    case "courtName":
      return row.courtName ? (
        <span>
          <span style={{ color: "var(--color-app-ink)" }}>{row.courtName}</span>
          {row.courtNumber ? (
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
        </span>
      ) : (
        muted("—")
      );
    case "courtNumber":
      return row.courtNumber ? mono(row.courtNumber) : muted("—");
    case "courtPlace":
      return row.courtPlace || muted("—");
    case "status":
      return row.status ? (
        <span
          className="inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            backgroundColor: "var(--color-app-aqua-soft)",
            color: "var(--color-app-aqua)",
          }}
        >
          {row.status}
        </span>
      ) : (
        muted("—")
      );
    case "advocateName":
      return row.advocateName || muted("—");
    case "lastHearingDate":
    case "nextHearingDate": {
      const iso = row[key];
      if (!iso) {
        return key === "nextHearingDate" ? (
          <span
            className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              backgroundColor: "var(--color-app-copper)",
              color: "var(--color-app-copper-text)",
            }}
          >
            Pending
          </span>
        ) : (
          muted("—")
        );
      }
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return muted("—");
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isOverdue = key === "nextHearingDate" && d < today;
      const isToday =
        key === "nextHearingDate" &&
        d.toDateString() === new Date().toDateString();
      return (
        <span
          className="text-[12.5px] tabular-nums"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            fontWeight: isOverdue || isToday ? 700 : 500,
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
            year: "2-digit",
          })}
        </span>
      );
    }
    case "actions":
      return (
        <div className="flex items-center justify-center gap-1">
          <Link
            href={`/app/cases/${row.id}`}
            aria-label="Open case"
            title="Open case"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors"
            style={{
              color: "var(--color-app-fg-soft)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "var(--color-app-canvas-2)";
              e.currentTarget.style.color = "var(--color-app-ink)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--color-app-fg-soft)";
            }}
          >
            <OpenIcon />
          </Link>
          <Link
            href={`/app/cases/${row.id}/edit`}
            aria-label="Edit case"
            title="Edit case"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors"
            style={{
              color: "var(--color-app-fg-soft)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "var(--color-app-canvas-2)";
              e.currentTarget.style.color = "var(--color-app-ink)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--color-app-fg-soft)";
            }}
          >
            <PencilIcon />
          </Link>
          <button
            type="button"
            onClick={() => onDelete(row)}
            aria-label="Delete matter"
            title="Delete permanently"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors"
            style={{
              color: "var(--color-app-danger)",
            }}
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
      );
    default:
      return null;
  }
}

function muted(label: string): React.ReactNode {
  return (
    <span style={{ color: "var(--color-app-fg-muted)" }}>{label}</span>
  );
}

function mono(text: string): React.ReactNode {
  return (
    <span
      className="text-[12.5px]"
      style={{
        fontFamily: "var(--font-dm-mono), monospace",
        color: "var(--color-app-ink)",
      }}
    >
      {text}
    </span>
  );
}

function SkeletonRows({ colCount }: { colCount: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr
          key={i}
          style={{
            borderBottom: "1px solid var(--color-app-edge-soft)",
          }}
        >
          {Array.from({ length: colCount }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div
                className="h-3 rounded animate-pulse"
                style={{
                  backgroundColor: "var(--color-app-canvas-2)",
                  width: j === 0 ? "20px" : j === colCount - 1 ? "60px" : "70%",
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function OpenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 17L17 7M9 7h8v8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
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
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
