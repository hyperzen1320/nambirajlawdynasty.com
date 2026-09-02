"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CnrLink from "@/app/app/components/CnrLink";
import ConfirmDeleteDialog from "@/app/app/components/ConfirmDeleteDialog";

export type DisposedCaseRow = {
  id: string;
  caseNo: string;
  fileNo: string;
  cnr: string;
  clientName: string;
  oppositeParty: string;
  courtId: string;
  courtName: string;
  courtPlace: string;
  status: string;
  disposedAt: string | null;
  disposalDate: string | null;
  disposalRemarks: string;
  caStatus: string;
  receivedByClient: boolean;
};

type Format = "xlsx" | "docx" | "pdf";

// Fields the on-screen search scans. Kept identical to the searchScope we
// hand the export endpoint so the file you download matches the list you
// filtered (the server runs the same OR-of-substrings over these keys).
const SEARCH_KEYS: (keyof DisposedCaseRow)[] = [
  "fileNo",
  "caseNo",
  "cnr",
  "clientName",
  "oppositeParty",
  "courtName",
  "courtPlace",
  "status",
];
const SEARCH_SCOPE = "fileNo,caseNo,cnr,clientName,oppositeParty,courtName,courtPlace,status";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function DisposedCasesClient({
  cases,
  isAdmin,
}: {
  cases: DisposedCaseRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [courtFilter, setCourtFilter] = useState(""); // courtId or ""
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Permanent delete (admin) — a disposed matter keeps its CNR locked
  // while it sits in the archive; deleting it here removes it from the
  // database for good and frees the CNR for reuse.
  const [deleteTarget, setDeleteTarget] = useState<DisposedCaseRow | null>(
    null
  );
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Multi-select — admin bulk restore / permanent delete over the archive.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<null | "restore" | "delete">(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  async function runDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/app/cases/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data?.error || "Couldn't delete that matter.");
        return;
      }
      setDeleteTarget(null);
      router.refresh();
    } catch {
      setDeleteError("Network error. Try again.");
    } finally {
      setDeleteBusy(false);
    }
  }

  // Court dropdown is built from the courts actually present in the
  // archive (only those carrying a Court Hub id, so the filter maps to an
  // exact courtId the export can re-query).
  const courts = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of cases) {
      if (!c.courtId) continue;
      if (!map.has(c.courtId)) {
        const label =
          [c.courtName, c.courtPlace].filter(Boolean).join(", ") ||
          "Unnamed court";
        map.set(c.courtId, label);
      }
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [cases]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cases.filter((c) => {
      if (courtFilter && c.courtId !== courtFilter) return false;
      const day = c.disposedAt ? c.disposedAt.slice(0, 10) : "";
      if (fromDate && (!day || day < fromDate)) return false;
      if (toDate && (!day || day > toDate)) return false;
      if (q) {
        const hit = SEARCH_KEYS.some((k) =>
          String(c[k] || "").toLowerCase().includes(q)
        );
        if (!hit) return false;
      }
      return true;
    });
  }, [cases, query, courtFilter, fromDate, toDate]);

  const hasFilters = Boolean(
    query.trim() || courtFilter || fromDate || toDate
  );

  function clearAll() {
    setQuery("");
    setCourtFilter("");
    setFromDate("");
    setToDate("");
  }

  const selectedArray = Array.from(selectedIds);
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (filtered.length > 0 && filtered.every((c) => prev.has(c.id))) {
        filtered.forEach((c) => next.delete(c.id));
      } else {
        filtered.forEach((c) => next.add(c.id));
      }
      return next;
    });
  }
  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
    setBulkError(null);
  }

  async function runBulkRestore() {
    if (selectedArray.length === 0) return;
    setBulkBusy("restore");
    setBulkError(null);
    try {
      const res = await fetch("/api/app/cases/bulk-restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedArray }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBulkError(data?.error || "Couldn't restore those matters.");
        return;
      }
      setSelectedIds(new Set());
      setSelectMode(false);
      router.refresh();
    } catch {
      setBulkError("Network error. Try again.");
    } finally {
      setBulkBusy(null);
    }
  }

  async function runBulkDelete() {
    if (selectedArray.length === 0) return;
    setBulkBusy("delete");
    setBulkError(null);
    try {
      const res = await fetch("/api/app/cases/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedArray }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBulkError(data?.error || "Couldn't delete those matters.");
        return;
      }
      setConfirmBulkDelete(false);
      setSelectedIds(new Set());
      setSelectMode(false);
      router.refresh();
    } catch {
      setBulkError("Network error. Try again.");
    } finally {
      setBulkBusy(null);
    }
  }

  return (
    <>
      {/* Filter bar */}
      <div
        className="mt-7 rounded-xl p-4"
        style={{
          backgroundColor: "var(--color-app-paper)",
          boxShadow: "0 1px 0 var(--color-app-edge)",
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          {/* Search */}
          <div className="min-w-[220px] flex-1">
            <FieldLabel>Search</FieldLabel>
            <div
              className="mt-1.5 flex items-center gap-2 rounded-md border px-3 py-2"
              style={{
                borderColor: "var(--color-app-edge)",
                backgroundColor: "var(--color-app-paper)",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
                style={{ color: "var(--color-app-fg-muted)" }}
              >
                <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6" />
                <path
                  d="M16 16l5 5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="File no., case no., CNR, party, court…"
                className="flex-1 bg-transparent text-[13px] outline-none"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  color: "var(--color-app-ink)",
                }}
              />
            </div>
          </div>

          {/* Court */}
          <div className="min-w-[180px]">
            <FieldLabel>Court</FieldLabel>
            <select
              value={courtFilter}
              onChange={(e) => setCourtFilter(e.target.value)}
              className="mt-1.5 block w-full rounded-md border px-3 py-2 text-[13px] outline-none"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                borderColor: "var(--color-app-edge)",
                backgroundColor: "var(--color-app-paper)",
                color: "var(--color-app-ink)",
              }}
            >
              <option value="">All courts</option>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Disposed from */}
          <div>
            <FieldLabel>Disposed from</FieldLabel>
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1.5 block rounded-md border px-3 py-2 text-[13px] outline-none"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                borderColor: "var(--color-app-edge)",
                backgroundColor: "var(--color-app-paper)",
                color: "var(--color-app-ink)",
              }}
            />
          </div>

          {/* Disposed to */}
          <div>
            <FieldLabel>Disposed to</FieldLabel>
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1.5 block rounded-md border px-3 py-2 text-[13px] outline-none"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                borderColor: "var(--color-app-edge)",
                backgroundColor: "var(--color-app-paper)",
                color: "var(--color-app-ink)",
              }}
            />
          </div>

          {hasFilters ? (
            <button
              onClick={clearAll}
              className="rounded-md px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                backgroundColor: "var(--color-app-canvas-2)",
                color: "var(--color-app-fg-muted)",
              }}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {/* Count + export */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p
          className="text-[12px]"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            color: "var(--color-app-fg-muted)",
          }}
        >
          {hasFilters ? (
            <>
              <span style={{ color: "var(--color-app-ink)", fontWeight: 600 }}>
                {filtered.length}
              </span>{" "}
              of {cases.length} archived
            </>
          ) : (
            <>
              <span style={{ color: "var(--color-app-ink)", fontWeight: 600 }}>
                {cases.length}
              </span>{" "}
              archived {cases.length === 1 ? "matter" : "matters"}
            </>
          )}
        </p>
        {isAdmin ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.18em] transition-all hover:-translate-y-0.5"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                backgroundColor: selectMode
                  ? "var(--color-app-canvas-2)"
                  : "var(--color-app-paper)",
                color: "var(--color-app-ink)",
                border: "1px solid var(--color-app-edge)",
              }}
            >
              {selectMode ? "Cancel" : "Select"}
            </button>
            <DisposedExportMenu
              courtId={courtFilter}
              fromDate={fromDate}
              toDate={toDate}
              search={query}
              disabled={filtered.length === 0}
            />
          </div>
        ) : null}
      </div>

      {selectMode ? (
        <div
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"
          style={{
            backgroundColor: "var(--color-app-ink)",
            boxShadow: "0 10px 26px -18px rgba(10,17,36,0.5)",
          }}
        >
          <button
            type="button"
            onClick={toggleSelectAll}
            className="inline-flex items-center gap-2 text-[12px] font-semibold"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-ivory)",
            }}
          >
            <span
              className="flex h-5 w-5 items-center justify-center rounded-[5px] border"
              style={{
                borderColor: allFilteredSelected
                  ? "var(--color-app-copper)"
                  : "var(--color-app-ivory-dim)",
                backgroundColor: allFilteredSelected
                  ? "var(--color-app-copper)"
                  : "transparent",
              }}
            >
              {allFilteredSelected ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 12l5 5L20 7"
                    stroke="var(--color-app-copper-text)"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
            </span>
            {allFilteredSelected ? "Deselect all" : "Select all"}
            <span
              className="ml-1 rounded-full px-2 py-0.5 text-[11px] tabular-nums"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                backgroundColor: "var(--color-app-ink-2)",
                color: "var(--color-app-copper-bright)",
              }}
            >
              {selectedIds.size} selected
            </span>
          </button>

          <div className="flex items-center gap-2">
            {bulkError ? (
              <span
                className="text-[11px]"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  color: "var(--color-app-copper-bright)",
                }}
              >
                {bulkError}
              </span>
            ) : null}
            <button
              type="button"
              onClick={runBulkRestore}
              disabled={selectedIds.size === 0 || Boolean(bulkBusy)}
              className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[12px] font-semibold transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                backgroundColor: "var(--color-app-paper)",
                color: "var(--color-app-ink)",
                opacity: selectedIds.size === 0 || bulkBusy ? 0.55 : 1,
              }}
            >
              {bulkBusy === "restore" ? "Restoring…" : "Restore"}
            </button>
            <button
              type="button"
              onClick={() => {
                setBulkError(null);
                setConfirmBulkDelete(true);
              }}
              disabled={selectedIds.size === 0 || Boolean(bulkBusy)}
              className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[12px] font-semibold transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                backgroundColor: "var(--color-app-danger)",
                color: "#ffffff",
                opacity: selectedIds.size === 0 || bulkBusy ? 0.55 : 1,
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div
          className="mt-5 rounded-xl px-5 py-12 text-center"
          style={{
            backgroundColor: "var(--color-app-paper)",
            border: "1px dashed var(--color-app-edge)",
          }}
        >
          <p
            className="text-[14px]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-fg-muted)",
            }}
          >
            No archived matters match the current filters.
          </p>
          {hasFilters ? (
            <button
              onClick={clearAll}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[12px] font-semibold"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                backgroundColor: "var(--color-app-canvas-2)",
                color: "var(--color-app-ink)",
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {filtered.map((c, i) => (
            <DisposedCard
              key={c.id}
              c={c}
              index={i}
              isAdmin={isAdmin}
              selectMode={selectMode}
              selected={selectedIds.has(c.id)}
              onToggleSelect={() => toggleSelect(c.id)}
              onDelete={() => {
                setDeleteError(null);
                setDeleteTarget(c);
              }}
            />
          ))}
        </div>
      )}

      {deleteTarget ? (
        <ConfirmDeleteDialog
          title="Delete this matter?"
          message={
            <>
              <span style={{ color: "var(--color-app-ink)", fontWeight: 600 }}>
                {deleteTarget.caseNo || deleteTarget.fileNo || "This matter"}
              </span>{" "}
              will be permanently removed from the archive and the database.
              This frees its CNR for reuse and{" "}
              <strong>can&apos;t be undone</strong>.
            </>
          }
          busy={deleteBusy}
          error={deleteError}
          onConfirm={runDelete}
          onClose={() => {
            if (deleteBusy) return;
            setDeleteTarget(null);
            setDeleteError(null);
          }}
        />
      ) : null}

      {confirmBulkDelete ? (
        <ConfirmDeleteDialog
          title={`Delete ${selectedIds.size} matter${
            selectedIds.size === 1 ? "" : "s"
          }?`}
          message={
            <>
              These{" "}
              <span style={{ color: "var(--color-app-ink)", fontWeight: 600 }}>
                {selectedIds.size}
              </span>{" "}
              archived {selectedIds.size === 1 ? "matter" : "matters"} will be
              permanently removed from the database. This frees their CNRs for
              reuse and <strong>can&apos;t be undone</strong>.
            </>
          }
          busy={bulkBusy === "delete"}
          error={bulkError}
          onConfirm={runBulkDelete}
          onClose={() => {
            if (bulkBusy) return;
            setConfirmBulkDelete(false);
            setBulkError(null);
          }}
        />
      ) : null}
    </>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="text-[10px] font-semibold uppercase tracking-[0.18em]"
      style={{
        fontFamily: "var(--font-dm-mono), monospace",
        color: "var(--color-app-fg-muted)",
      }}
    >
      {children}
    </label>
  );
}

/* ─── Export menu (admin) ─── */

function DisposedExportMenu({
  courtId,
  fromDate,
  toDate,
  search,
  disabled,
}: {
  courtId: string;
  fromDate: string;
  toDate: string;
  search: string;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function trigger(format: Format) {
    setError(null);
    setWorking(format);
    try {
      // Same filter tuple the list is using, plus scope=disposed so the
      // server narrows to the archive and dates apply to the disposal
      // date. The server picks the disposed column set automatically.
      const filters: Record<string, string> = { scope: "disposed" };
      if (courtId) filters.courtId = courtId;
      if (fromDate) filters.fromDate = fromDate;
      if (toDate) filters.toDate = toDate;
      if (search.trim()) {
        filters.search = search.trim();
        filters.searchScope = SEARCH_SCOPE;
      }

      const res = await fetch("/api/app/cases/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, filters }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Couldn't generate that export.");
        setWorking(null);
        return;
      }
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = /filename="?([^";]+)"?/i.exec(disposition);
      const filename = (match && match[1]) || `disposed-cases.${format}`;
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

  const LABELS: Record<Format, string> = {
    xlsx: "Excel (.xlsx)",
    docx: "Word (.docx)",
    pdf: "PDF",
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={Boolean(working) || disabled}
        className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.18em] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          backgroundColor: "var(--color-app-ink)",
          color: "var(--color-app-ivory)",
          boxShadow: "0 8px 18px -10px rgba(10,17,36,0.45)",
          opacity: working || disabled ? 0.6 : 1,
        }}
      >
        {working ? (
          <>
            <span
              className="inline-block h-3 w-3 animate-spin rounded-full"
              style={{
                borderWidth: 1.5,
                borderStyle: "solid",
                borderColor: "rgba(245,235,214,0.35)",
                borderTopColor: "var(--color-app-copper)",
              }}
            />
            Generating…
          </>
        ) : (
          <>
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
            Export
            <span aria-hidden className="ml-0.5 text-[10px]" style={{ opacity: 0.75 }}>
              ▾
            </span>
          </>
        )}
      </button>

      {open && !working ? (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            className="absolute right-0 z-30 mt-2 w-[230px] overflow-hidden rounded-md"
            style={{
              backgroundColor: "var(--color-app-paper)",
              border: "1px solid var(--color-app-edge)",
              boxShadow:
                "0 16px 32px -12px rgba(10,17,36,0.25), 0 0 0 1px rgba(10,17,36,0.04)",
            }}
          >
            <div
              className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                color: "var(--color-app-fg-muted)",
                borderBottom: "1px solid var(--color-app-edge-soft)",
                backgroundColor: "var(--color-app-canvas-2)",
              }}
            >
              Download archive
            </div>
            <ul className="py-1">
              {(["xlsx", "docx", "pdf"] as const).map((f) => (
                <li key={f}>
                  <button
                    type="button"
                    onClick={() => trigger(f)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-[13px] font-semibold transition-colors"
                    style={{
                      fontFamily: "var(--font-manrope), sans-serif",
                      color: "var(--color-app-ink)",
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
                    {LABELS[f]}
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
        </>
      ) : null}
    </div>
  );
}

function FormatBadge({ format }: { format: Format }) {
  const palette: Record<Format, { bg: string; fg: string }> = {
    xlsx: { bg: "#1f6f43", fg: "#ffffff" },
    docx: { bg: "#2b5797", fg: "#ffffff" },
    pdf: { bg: "#9a2c2c", fg: "#ffffff" },
  };
  const p = palette[format];
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[9px] font-semibold uppercase tracking-[0.14em]"
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

/* ─── Card ─── */

function DisposedCard({
  c,
  index,
  isAdmin,
  onDelete,
  selectMode,
  selected,
  onToggleSelect,
}: {
  c: DisposedCaseRow;
  index: number;
  isAdmin: boolean;
  onDelete: () => void;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  return (
    <Link
      href={`/app/cases/${c.id}`}
      prefetch
      onClick={(e) => {
        // In select mode the card is a selection toggle, not a navigation.
        if (selectMode) {
          e.preventDefault();
          onToggleSelect();
        }
      }}
      className={`fade-up-sm group grid gap-5 rounded-xl p-5 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 ${
        selectMode ? "grid-cols-[auto_1fr_auto]" : "grid-cols-[1fr_auto]"
      }`}
      style={{
        backgroundColor: selected
          ? "var(--color-app-canvas-2)"
          : "var(--color-app-paper)",
        boxShadow: selected
          ? "inset 0 0 0 1.5px var(--color-app-copper), 0 1px 0 var(--color-app-edge)"
          : "0 1px 0 var(--color-app-edge)",
        // Slate accent on the left edge to visually distinguish archived
        // matters from the copper-accented active vault.
        borderLeft: `3px solid ${
          selected ? "var(--color-app-copper)" : "var(--color-app-fg-muted)"
        }`,
        animationDelay: `${Math.min(index, 12) * 35}ms`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = selected
          ? "inset 0 0 0 1.5px var(--color-app-copper), 0 1px 0 var(--color-app-edge)"
          : "0 12px 28px -18px rgba(10,17,36,0.22), 0 1px 0 var(--color-app-edge)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = selected
          ? "inset 0 0 0 1.5px var(--color-app-copper), 0 1px 0 var(--color-app-edge)"
          : "0 1px 0 var(--color-app-edge)";
      }}
    >
      {selectMode ? (
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center self-start rounded-[5px] border"
          style={{
            borderColor: selected
              ? "var(--color-app-copper)"
              : "var(--color-app-edge)",
            backgroundColor: selected
              ? "var(--color-app-copper)"
              : "transparent",
          }}
          aria-hidden
        >
          {selected ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12l5 5L20 7"
                stroke="var(--color-app-copper-text)"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </span>
      ) : null}
      <div className="min-w-0">
        {/* Top row: case no + file no + DISPOSED pill */}
        <div className="flex flex-wrap items-baseline gap-3">
          <span
            className="text-[22px] font-semibold tracking-tight"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            {c.caseNo}
          </span>
          {c.fileNo ? (
            <span
              className="text-[11px]"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                color: "var(--color-app-fg-muted)",
              }}
            >
              {c.fileNo}
            </span>
          ) : null}
          <span
            className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              backgroundColor: "var(--color-app-ink)",
              color: "var(--color-app-ivory)",
            }}
          >
            Disposed
          </span>
        </div>

        {/* Parties */}
        {(c.clientName || c.oppositeParty) && (
          <div
            className="mt-2 text-[14px]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-fg-soft)",
            }}
          >
            <span style={{ color: "var(--color-app-fg-muted)" }}>Client: </span>
            {c.clientName ? (
              <span style={{ color: "var(--color-app-ink)", fontWeight: 600 }}>
                {c.clientName}
              </span>
            ) : (
              <span style={{ color: "var(--color-app-fg-muted)" }}>—</span>
            )}
            {c.oppositeParty ? (
              <>
                {" "}
                <span style={{ color: "var(--color-app-copper-deep)" }}>vs</span>{" "}
                <span style={{ color: "var(--color-app-ink)", fontWeight: 600 }}>
                  {c.oppositeParty}
                </span>
              </>
            ) : null}
          </div>
        )}

        {/* Court + CNR */}
        {(c.courtName || c.courtPlace || c.cnr) && (
          <div
            className="mt-1 text-[12px]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-muted)",
            }}
          >
            {[c.courtName, c.courtPlace].filter(Boolean).join(", ")}
            {(c.courtName || c.courtPlace) && c.cnr ? (
              <span style={{ color: "var(--color-app-copper-deep)" }}> · </span>
            ) : null}
            {c.cnr ? (
              <span>
                CNR <CnrLink cnr={c.cnr} />
              </span>
            ) : null}
          </div>
        )}

        {/* Disposal remarks if any */}
        {c.disposalRemarks ? (
          <p
            className="mt-2 text-[12px] italic leading-snug"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-fg-soft)",
            }}
          >
            “{c.disposalRemarks}”
          </p>
        ) : null}

        {c.caStatus || c.receivedByClient ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {c.caStatus ? (
              <span
                className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em]"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  backgroundColor: "var(--color-app-canvas-2)",
                  color: "var(--color-app-copper-deep)",
                }}
              >
                C.A. · {c.caStatus}
              </span>
            ) : null}
            {c.receivedByClient ? (
              <span
                className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em]"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  backgroundColor: "var(--color-app-canvas-2)",
                  color: "var(--color-app-aqua)",
                }}
              >
                Received ✓
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Right column: disposal date + (admin) permanent delete */}
      <div className="flex flex-col items-end justify-between text-right">
        <div>
          <div
            className="text-[10px] uppercase tracking-[0.18em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-muted)",
            }}
          >
            Disposed on
          </div>
          <div
            className="mt-1 text-[18px] font-semibold tabular-nums"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            {fmtDate(c.disposalDate ?? c.disposedAt)}
          </div>
        </div>
        {isAdmin && !selectMode ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
            aria-label="Delete matter permanently"
            title="Delete permanently — frees the CNR"
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition-colors"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              borderColor: "var(--color-app-edge)",
              color: "var(--color-app-danger)",
              backgroundColor: "var(--color-app-paper)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "var(--color-app-danger-soft)";
              e.currentTarget.style.borderColor = "var(--color-app-danger)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-app-paper)";
              e.currentTarget.style.borderColor = "var(--color-app-edge)";
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
            Delete
          </button>
        ) : null}
      </div>
    </Link>
  );
}
