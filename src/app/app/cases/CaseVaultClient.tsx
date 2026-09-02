"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  COLUMNS,
  DEFAULT_VISIBLE_COLUMNS,
  filtersFromQuery,
  filtersToQuery,
  type CaseColumnKey,
  type CaseFilters,
  type CaseRow,
  type CaseViewMode,
  type CourtOption,
  type AdvocateOption,
} from "./case-vault-types";
import CaseToolBar from "./CaseToolBar";
import CaseTable from "./CaseTable";
import CaseCards from "./CaseCards";
import { VaultFooter } from "./vault-shared";
import RequestDeleteDialog, {
  type RequestTarget,
} from "@/app/app/workflow/[id]/RequestDeleteDialog";
import ConfirmDeleteDialog from "@/app/app/components/ConfirmDeleteDialog";

export type CaseVaultBootstrap = {
  courts: CourtOption[];
  courtPlaces: string[];
  advocates: AdvocateOption[];
  partnerId: string;
  isAdmin: boolean;
};

// CaseVaultClient — the orchestrator.
//
// Owns:
//   • The filter tuple, mirrored to the URL via router.replace so a
//     copy-pasted link re-opens the same view.
//   • The fetched rows + pagination meta. Re-fetches whenever the URL
//     filters change — and whenever an import fires the
//     "legalezi:cases-changed" event, so freshly imported matters appear
//     without a manual browser refresh.
//   • Column visibility, persisted to localStorage per partner.
//   • Row selection (admin only): per-row ticks, select-all-on-page, and
//     a "select all N matching" mode that spans pages. Drives Export
//     (only the ticked rows) and the bulk Delete.
//   • The Delete-action gate: admins permanently delete (a hard delete
//     that frees the matter's CNR for reuse), confirmed through a proper
//     danger dialog; non-admins route into RequestDeleteDialog so the
//     office admin can approve.

export default function CaseVaultClient({
  bootstrap,
}: {
  bootstrap: CaseVaultBootstrap;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL → applied filters.
  const appliedFilters: CaseFilters = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    return filtersFromQuery(params);
  }, [searchParams]);

  // Column visibility.
  const visibilityKey = `legaleasy.caseVaultColumns.${bootstrap.partnerId}`;
  const [visibleColumns, setVisibleColumns] = useState<CaseColumnKey[]>(
    DEFAULT_VISIBLE_COLUMNS
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(visibilityKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const valid = parsed.filter((k): k is CaseColumnKey =>
        COLUMNS.some((c) => c.key === k)
      );
      // S.No + Actions stay on regardless of what was saved.
      const always = COLUMNS.filter((c) => !c.togglable).map((c) => c.key);
      const merged = new Set<CaseColumnKey>([...always, ...valid]);
      setVisibleColumns(
        COLUMNS.filter((c) => merged.has(c.key)).map((c) => c.key)
      );
    } catch {
      /* Corrupt localStorage entry — defaults stand. */
    }
  }, [visibilityKey]);

  const persistVisibility = useCallback(
    (next: CaseColumnKey[]) => {
      setVisibleColumns(next);
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(visibilityKey, JSON.stringify(next));
      } catch {
        /* localStorage disabled — accept ephemeral state. */
      }
    },
    [visibilityKey]
  );

  // View mode (cards vs table), persisted per-partner just like the
  // column choices. Cards is the default; the saved preference is read
  // once on mount so a returning user lands back in their last view.
  const viewKey = `legaleasy.caseVaultView.${bootstrap.partnerId}`;
  const [viewMode, setViewMode] = useState<CaseViewMode>("cards");
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(viewKey);
      if (raw === "cards" || raw === "table") setViewMode(raw);
    } catch {
      /* Corrupt entry — default (cards) stands. */
    }
  }, [viewKey]);

  const handleViewModeChange = useCallback(
    (next: CaseViewMode) => {
      setViewMode(next);
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(viewKey, next);
      } catch {
        /* localStorage disabled — accept ephemeral state. */
      }
    },
    [viewKey]
  );

  // Fetched rows + meta + loading state.
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const requestRef = useRef(0);

  // Selection (admin only). `selectedIds` is the explicit per-row set;
  // `selectAllMatching` flips to "every matter matching the current
  // filters", which spans pages and drives a delete/export of the whole
  // result set rather than just the loaded page.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);

  // Delete-request flow state. When non-admin clicks Delete on a row,
  // we open RequestDeleteDialog instead of deleting directly. After
  // the user submits a request, a small confirmation banner takes the
  // place of the dialog until the next refetch.
  const [requestTarget, setRequestTarget] = useState<RequestTarget | null>(
    null
  );
  const [requestSentFor, setRequestSentFor] = useState<{
    caseNo: string;
  } | null>(null);

  // Permanent-delete confirmation (admin). One dialog serves both the
  // single-row trash and the bulk Delete.
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: "row"; row: CaseRow } | { kind: "bulk" } | null
  >(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectAllMatching(false);
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    const seq = ++requestRef.current;
    try {
      const params = filtersToQuery(appliedFilters);
      params.set("limit", String(appliedFilters.limit));
      const res = await fetch(`/api/app/cases?${params.toString()}`, {
        cache: "no-store",
      });
      if (seq !== requestRef.current) return;
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError(data?.error || "Couldn't load cases.");
        setRows([]);
        setTotal(0);
        return;
      }
      setRows((data.cases || []) as CaseRow[]);
      setTotal(Number(data.total || 0));
      setHidden(new Set());
    } catch {
      if (seq !== requestRef.current) return;
      setError("Network error. Try again.");
      setRows([]);
      setTotal(0);
    } finally {
      if (seq === requestRef.current) setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  // A changed filter set means a different result set — any prior
  // selection no longer maps cleanly, so reset it whenever the applied
  // filters change.
  useEffect(() => {
    clearSelection();
  }, [appliedFilters, clearSelection]);

  // Live refresh when matters change elsewhere (the Import modal dispatches
  // this after a successful import). The vault list is client-fetched, so a
  // server router.refresh() alone wouldn't repaint it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onChanged = () => fetchRows();
    window.addEventListener("legalezi:cases-changed", onChanged);
    return () =>
      window.removeEventListener("legalezi:cases-changed", onChanged);
  }, [fetchRows]);

  const writeFiltersToUrl = useCallback(
    (next: CaseFilters) => {
      const params = filtersToQuery(next);
      const qs = params.toString();
      router.replace(qs ? `/app/cases?${qs}` : `/app/cases`, {
        scroll: false,
      });
    },
    [router]
  );

  const handleApply = useCallback(
    (next: CaseFilters) => {
      // Any filter / search / page-size change snaps back to page 1 —
      // staying on "page 5" of a now-smaller result set would show nothing.
      writeFiltersToUrl({ ...next, page: 1 });
    },
    [writeFiltersToUrl]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      writeFiltersToUrl({ ...appliedFilters, page });
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [writeFiltersToUrl, appliedFilters]
  );

  const handleColumnsChange = useCallback(
    (next: CaseColumnKey[]) => {
      persistVisibility(next);
    },
    [persistVisibility]
  );

  const visibleRows = useMemo(
    () => rows.filter((r) => !hidden.has(r.id)),
    [rows, hidden]
  );

  // ── Selection derivations ──
  const isSelected = useCallback(
    (id: string) => selectAllMatching || selectedIds.has(id),
    [selectAllMatching, selectedIds]
  );
  const allPageSelected =
    selectAllMatching ||
    (visibleRows.length > 0 && visibleRows.every((r) => selectedIds.has(r.id)));
  const selectionCount = selectAllMatching ? total : selectedIds.size;
  const moreThanPage = total > visibleRows.length;

  const toggleSelect = useCallback(
    (id: string) => {
      if (selectAllMatching) {
        // Stepping out of "all matching": fall back to the loaded page
        // minus the row the user just unticked.
        setSelectAllMatching(false);
        setSelectedIds(
          new Set(visibleRows.map((r) => r.id).filter((x) => x !== id))
        );
        return;
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [selectAllMatching, visibleRows]
  );

  const toggleSelectAllPage = useCallback(() => {
    if (allPageSelected) {
      clearSelection();
      return;
    }
    setSelectAllMatching(false);
    setSelectedIds(new Set(visibleRows.map((r) => r.id)));
  }, [allPageSelected, visibleRows, clearSelection]);

  const selectAllMatchingNow = useCallback(() => {
    setSelectAllMatching(true);
  }, []);

  const selectedIdsArray = useMemo(
    () => Array.from(selectedIds),
    [selectedIds]
  );

  // ── Delete handlers ──
  const handleDelete = useCallback(
    (row: CaseRow) => {
      // Non-admin path — open the request dialog instead of deleting.
      if (!bootstrap.isAdmin) {
        setRequestTarget({
          type: "case",
          id: row.id,
          name: row.caseNo || row.fileNo || "this matter",
          hint: "Only the office admin can delete a matter directly.",
        });
        return;
      }
      setDeleteError(null);
      setDeleteTarget({ kind: "row", row });
    },
    [bootstrap.isAdmin]
  );

  const handleBulkDelete = useCallback(() => {
    if (!bootstrap.isAdmin || selectionCount === 0) return;
    setDeleteError(null);
    setDeleteTarget({ kind: "bulk" });
  }, [bootstrap.isAdmin, selectionCount]);

  const runDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      if (deleteTarget.kind === "row") {
        const res = await fetch(`/api/app/cases/${deleteTarget.row.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setDeleteError(data?.error || "Couldn't delete that matter.");
          return;
        }
      } else {
        const body: Record<string, unknown> = selectAllMatching
          ? { all: true, filters: filtersToFlat(appliedFilters) }
          : { ids: selectedIdsArray };
        const res = await fetch("/api/app/cases/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setDeleteError(data?.error || "Couldn't delete the selected matters.");
          return;
        }
      }
      setDeleteTarget(null);
      clearSelection();
      await fetchRows();
    } catch {
      setDeleteError("Network error. Try again.");
    } finally {
      setDeleteBusy(false);
    }
  }, [
    deleteTarget,
    selectAllMatching,
    appliedFilters,
    selectedIdsArray,
    clearSelection,
    fetchRows,
  ]);

  const showSelectionBar = bootstrap.isAdmin && visibleRows.length > 0;

  return (
    <div className="mt-7 space-y-5">
      <CaseToolBar
        bootstrap={bootstrap}
        appliedFilters={appliedFilters}
        visibleColumns={visibleColumns}
        viewMode={viewMode}
        selectedIds={selectedIdsArray}
        selectAllMatching={selectAllMatching}
        onApply={handleApply}
        onColumnsChange={handleColumnsChange}
        onViewModeChange={handleViewModeChange}
      />

      {error ? (
        <div
          className="rounded-md px-4 py-3 text-[13px]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            backgroundColor: "var(--color-app-danger-soft)",
            border: "1px solid var(--color-app-danger)",
            color: "var(--color-app-ink)",
          }}
        >
          {error}
        </div>
      ) : null}

      {requestSentFor ? (
        <div
          className="rounded-md px-4 py-3 text-[13px]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            backgroundColor: "var(--color-app-aqua-soft)",
            border: "1px solid var(--color-app-aqua)",
            color: "var(--color-app-ink)",
          }}
        >
          Delete request for{" "}
          <span style={{ fontWeight: 600 }}>{requestSentFor.caseNo}</span>{" "}
          sent. The office admin will review it shortly.
        </div>
      ) : null}

      {showSelectionBar ? (
        <SelectionBar
          allPageSelected={allPageSelected}
          onToggleSelectAllPage={toggleSelectAllPage}
          selectionCount={selectionCount}
          total={total}
          selectAllMatching={selectAllMatching}
          moreThanPage={moreThanPage}
          onSelectAllMatching={selectAllMatchingNow}
          onClear={clearSelection}
          onBulkDelete={handleBulkDelete}
        />
      ) : null}

      {viewMode === "cards" ? (
        <CaseCards
          rows={visibleRows}
          loading={loading}
          appliedFilters={appliedFilters}
          onDelete={handleDelete}
          selectable={bootstrap.isAdmin}
          isSelected={isSelected}
          onToggleSelect={toggleSelect}
        />
      ) : (
        <CaseTable
          rows={visibleRows}
          loading={loading}
          visibleColumns={visibleColumns}
          appliedFilters={appliedFilters}
          onDelete={handleDelete}
          selectable={bootstrap.isAdmin}
          isSelected={isSelected}
          onToggleSelect={toggleSelect}
          allPageSelected={allPageSelected}
          onToggleSelectAllPage={toggleSelectAllPage}
        />
      )}

      <VaultFooter
        showing={visibleRows.length}
        total={total}
        loading={loading}
        page={appliedFilters.page}
        limit={appliedFilters.limit}
        onPageChange={handlePageChange}
      />

      {requestTarget ? (
        <RequestDeleteDialog
          target={requestTarget}
          onClose={() => setRequestTarget(null)}
          onSubmitted={() => {
            const name = requestTarget.name;
            setRequestTarget(null);
            setRequestSentFor({ caseNo: name });
            // Banner sticks until the next page interaction.
            setTimeout(() => setRequestSentFor(null), 8000);
          }}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmDeleteDialog
          title={
            deleteTarget.kind === "row"
              ? "Delete this matter?"
              : `Delete ${selectionCount} ${
                  selectionCount === 1 ? "matter" : "matters"
                }?`
          }
          message={
            deleteTarget.kind === "row" ? (
              <>
                <span
                  style={{ color: "var(--color-app-ink)", fontWeight: 600 }}
                >
                  {deleteTarget.row.caseNo ||
                    deleteTarget.row.fileNo ||
                    "This matter"}
                </span>{" "}
                will be permanently removed from the database. This frees its
                CNR for reuse and <strong>can&apos;t be undone</strong>. To keep
                a finished matter on record, set its status to{" "}
                <em>Disposed</em> instead.
              </>
            ) : (
              <>
                <span
                  style={{ color: "var(--color-app-ink)", fontWeight: 600 }}
                >
                  {selectionCount} selected{" "}
                  {selectionCount === 1 ? "matter" : "matters"}
                </span>{" "}
                will be permanently removed from the database. This frees their
                CNRs for reuse and <strong>can&apos;t be undone</strong>.
              </>
            )
          }
          confirmLabel={
            deleteTarget.kind === "row"
              ? "Delete permanently"
              : `Delete ${selectionCount}`
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
    </div>
  );
}

// Flatten the filter tuple into the string record the bulk-delete /
// export endpoints read with readCaseFilterParams.
function filtersToFlat(filters: CaseFilters): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of filtersToQuery(filters).entries()) out[k] = v;
  out.limit = String(filters.limit);
  return out;
}

// The contextual selection action bar — appears above the list for admins
// once there are rows. Holds select-all-on-page, the cross-page "select
// all N" escalation, the live count, Clear, and the bulk Delete.
function SelectionBar({
  allPageSelected,
  onToggleSelectAllPage,
  selectionCount,
  total,
  selectAllMatching,
  moreThanPage,
  onSelectAllMatching,
  onClear,
  onBulkDelete,
}: {
  allPageSelected: boolean;
  onToggleSelectAllPage: () => void;
  selectionCount: number;
  total: number;
  selectAllMatching: boolean;
  moreThanPage: boolean;
  onSelectAllMatching: () => void;
  onClear: () => void;
  onBulkDelete: () => void;
}) {
  const active = selectionCount > 0;
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-2.5"
      style={{
        backgroundColor: active
          ? "var(--color-app-canvas-2)"
          : "var(--color-app-paper)",
        boxShadow: active
          ? "inset 0 0 0 1.5px var(--color-app-copper)"
          : "inset 0 0 0 1px var(--color-app-edge)",
      }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={allPageSelected}
            onChange={onToggleSelectAllPage}
            className="h-[18px] w-[18px] cursor-pointer rounded"
            style={{ accentColor: "var(--color-app-copper)" }}
            aria-label="Select all matters on this page"
          />
          <span
            className="text-[12.5px] font-semibold"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: active
                ? "var(--color-app-ink)"
                : "var(--color-app-fg-soft)",
            }}
          >
            {active
              ? `${selectionCount} selected`
              : "Select matters"}
          </span>
        </label>

        {/* Escalate from "this page" to "all N matching" when the result
            set spans more than the loaded page. */}
        {active && !selectAllMatching && moreThanPage ? (
          <button
            type="button"
            onClick={onSelectAllMatching}
            className="text-[12px] font-semibold underline-offset-2 hover:underline"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-copper-deep)",
            }}
          >
            Select all {total} matters
          </button>
        ) : null}
        {selectAllMatching ? (
          <span
            className="text-[12px]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-fg-muted)",
            }}
          >
            All {total} matching {total === 1 ? "matter" : "matters"} selected
          </span>
        ) : null}
      </div>

      {active ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              backgroundColor: "transparent",
              color: "var(--color-app-fg-muted)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--color-app-ink)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--color-app-fg-muted)";
            }}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onBulkDelete}
            className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[12px] font-semibold transition-all hover:-translate-y-0.5"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              backgroundColor: "var(--color-app-danger)",
              color: "#ffffff",
              boxShadow: "0 6px 14px -8px rgba(176,42,42,0.6)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
            Delete {selectionCount}
          </button>
        </div>
      ) : null}
    </div>
  );
}
