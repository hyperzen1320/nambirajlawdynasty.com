"use client";

import { useEffect, useRef, useState } from "react";
import {
  filtersToQuery,
  type CaseColumnKey,
  type CaseFilters,
} from "./case-vault-types";

type Format = "xlsx" | "docx" | "pdf";

// Small dropdown that triggers POST /api/app/cases/export with the
// current filter tuple + the user's chosen column subset, then forces
// a download of the binary the server returns. We avoid window.open()
// in favour of an off-document `<a download>` so the response's
// Content-Disposition header is honoured and the filename comes
// through cleanly.

export default function ExportMenu({
  filters,
  visibleColumns,
  selectedIds = [],
  selectAllMatching = false,
}: {
  filters: CaseFilters;
  visibleColumns: CaseColumnKey[];
  // Individually-ticked rows. When present (and not "select all matching"),
  // the export carries exactly these ids instead of the filter query.
  selectedIds?: string[];
  // True when the user chose "Select all N matters" — export then falls
  // back to the filter query (which already returns the whole set).
  selectAllMatching?: boolean;
}) {
  // A concrete selection narrows the export; "all matching" does not.
  const exportIds = selectAllMatching ? [] : selectedIds;
  const hasSelection = exportIds.length > 0;
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function trigger(format: Format) {
    setError(null);
    setWorking(format);
    try {
      // Send the filter set as a flat record under `filters` so the
      // export endpoint can reuse readCaseFilterParams on it. We pass
      // `columns` separately — the export doesn't need URL parity
      // there because columns live in localStorage.
      const filtersObj: Record<string, string> = {};
      const params = filtersToQuery(filters);
      for (const [k, v] of params.entries()) filtersObj[k] = v;
      // Always include the explicit limit so the export carries the
      // same row count the user is looking at.
      filtersObj.limit = String(filters.limit);

      const res = await fetch("/api/app/cases/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          filters: filtersObj,
          columns: visibleColumns,
          ...(hasSelection ? { selectedIds: exportIds } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Couldn't generate that export.");
        setWorking(null);
        return;
      }

      // Pull the filename out of Content-Disposition so the download
      // shows up named the way the server intended.
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = /filename="?([^";]+)"?/i.exec(disposition);
      const filename =
        (match && match[1]) ||
        `case-report.${format}`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setOpen(false);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={Boolean(working)}
        className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.18em] transition-all hover:-translate-y-0.5"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          backgroundColor: "var(--color-app-ink)",
          color: "var(--color-app-ivory)",
          boxShadow: "0 8px 18px -10px rgba(10,17,36,0.45)",
          opacity: working ? 0.7 : 1,
        }}
      >
        {working ? (
          <>
            <Spinner />
            Generating…
          </>
        ) : (
          <>
            <DownloadIcon />
            {hasSelection
              ? `Export (${exportIds.length})`
              : selectAllMatching
                ? "Export all"
                : "Export"}
            <span
              aria-hidden
              className="ml-0.5 text-[10px]"
              style={{ opacity: 0.75 }}
            >
              ▾
            </span>
          </>
        )}
      </button>

      {open && !working ? (
        <div
          className="absolute left-0 z-30 mt-2 w-[260px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-md sm:left-auto sm:right-0"
          style={{
            backgroundColor: "var(--color-app-paper)",
            border: "1px solid var(--color-app-edge)",
            boxShadow:
              "0 16px 32px -12px rgba(10,17,36,0.25), 0 0 0 1px rgba(10,17,36,0.04)",
          }}
        >
          <div
            className="px-3 py-2"
            style={{
              borderBottom: "1px solid var(--color-app-edge-soft)",
              backgroundColor: "var(--color-app-canvas-2)",
            }}
          >
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                color: "var(--color-app-fg-muted)",
              }}
            >
              {hasSelection
                ? `Download ${exportIds.length} selected as`
                : selectAllMatching
                  ? "Download all matching as"
                  : "Download as"}
            </span>
          </div>
          <ul className="py-1">
            {(["xlsx", "docx", "pdf"] as const).map((f) => (
              <li key={f}>
                <button
                  type="button"
                  onClick={() => trigger(f)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
                  style={{
                    fontFamily: "var(--font-manrope), sans-serif",
                    backgroundColor: "transparent",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      "var(--color-app-canvas-2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <FormatBadge format={f} />
                  <div className="min-w-0">
                    <div
                      className="text-[13px] font-semibold"
                      style={{
                        color: "var(--color-app-ink)",
                      }}
                    >
                      {LABELS[f].title}
                    </div>
                    <div
                      className="mt-0.5 text-[10.5px]"
                      style={{
                        fontFamily: "var(--font-dm-mono), monospace",
                        color: "var(--color-app-fg-muted)",
                        letterSpacing: 0.4,
                      }}
                    >
                      {LABELS[f].subtitle}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {error ? (
            <div
              className="px-3 py-2 text-[11px]"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                backgroundColor: "var(--color-app-danger-soft)",
                color: "var(--color-app-danger)",
                borderTop: "1px solid var(--color-app-edge-soft)",
              }}
            >
              {error}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const LABELS: Record<Format, { title: string; subtitle: string }> = {
  xlsx: {
    title: "Excel (.xlsx)",
    subtitle: "Branded sheet · Frozen header · Zebra rows",
  },
  docx: {
    title: "Word (.docx)",
    subtitle: "Landscape · Letter-style report · Editable",
  },
  pdf: {
    title: "PDF",
    subtitle: "Landscape · Print-ready · Page numbered",
  },
};

function FormatBadge({ format }: { format: Format }) {
  const palette: Record<Format, { bg: string; fg: string }> = {
    xlsx: { bg: "#1f6f43", fg: "#ffffff" },
    docx: { bg: "#2b5797", fg: "#ffffff" },
    pdf: { bg: "#9a2c2c", fg: "#ffffff" },
  };
  const p = palette[format];
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold uppercase tracking-[0.16em]"
      style={{
        fontFamily: "var(--font-dm-mono), monospace",
        backgroundColor: p.bg,
        color: p.fg,
      }}
    >
      {format}
    </span>
  );
}

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4v12m-5-5l5 5 5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 18v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-3 w-3 animate-spin rounded-full"
      style={{
        borderWidth: 1.5,
        borderStyle: "solid",
        borderColor: "rgba(245,235,214,0.35)",
        borderTopColor: "var(--color-app-copper)",
      }}
    />
  );
}
