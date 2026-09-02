"use client";

import { useEffect, useState } from "react";
import type { CaseVaultBootstrap } from "./CaseVaultClient";
import {
  EMPTY_FILTERS,
  LIMIT_OPTIONS,
  SORT_OPTIONS,
  type CaseColumnKey,
  type CaseFilters,
  type CaseViewMode,
} from "./case-vault-types";
import type { CaseSort } from "@/lib/case-sort";
import ColumnVisibilityMenu from "./ColumnVisibilityMenu";
import ExportMenu from "./ExportMenu";

// CaseToolBar — one unified surface that holds every Case Vault control.
// Replaces the old two-card layout (CaseFilterBar + CaseSearchBar) so
// the page reads as a single tool instead of two disconnected strips.
//
// Top row  : structural filters (place / court / advocate / date range)
//            plus Apply + Clear. These need an explicit commit because
//            changing a court mid-edit and silently refetching would
//            be jarring.
// Bottom row: search input that always hits all searchable fields,
//             page-size dropdown, column visibility, and export menu.
//             Search commits on blur / Enter; the rest commit
//             immediately because their values are atomic choices.
//
// Filter state lives in the URL (mirrored by CaseVaultClient). This
// component only holds a small `draft` copy for the inputs while the
// user is mid-edit.

export default function CaseToolBar({
  bootstrap,
  appliedFilters,
  visibleColumns,
  viewMode,
  selectedIds,
  selectAllMatching,
  onApply,
  onColumnsChange,
  onViewModeChange,
}: {
  bootstrap: CaseVaultBootstrap;
  appliedFilters: CaseFilters;
  visibleColumns: CaseColumnKey[];
  viewMode: CaseViewMode;
  selectedIds: string[];
  selectAllMatching: boolean;
  onApply: (next: CaseFilters) => void;
  onColumnsChange: (next: CaseColumnKey[]) => void;
  onViewModeChange: (next: CaseViewMode) => void;
}) {
  // Draft holds the structural filters (top row) while the user is
  // composing — flushes on Apply. Search / limit are committed
  // immediately so they're not in the draft.
  const [draft, setDraft] = useState<CaseFilters>(appliedFilters);
  const appliedKey = JSON.stringify({
    courtId: appliedFilters.courtId,
    courtPlace: appliedFilters.courtPlace,
    advocateId: appliedFilters.advocateId,
    fromDate: appliedFilters.fromDate,
    toDate: appliedFilters.toDate,
  });
  useEffect(() => {
    setDraft(appliedFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedKey]);

  // Local search draft so we don't push to the URL on every keystroke.
  const [searchDraft, setSearchDraft] = useState(appliedFilters.search);
  const appliedSearch = appliedFilters.search;
  useEffect(() => {
    setSearchDraft(appliedSearch);
  }, [appliedSearch]);

  function setDraftField<K extends keyof CaseFilters>(
    key: K,
    value: CaseFilters[K]
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function applyDraft() {
    onApply({ ...appliedFilters, ...stripStructural(draft) });
  }

  function clearStructural() {
    const cleared: CaseFilters = {
      ...EMPTY_FILTERS,
      // Preserve search and limit — Clear only resets the structural
      // filters at the top of the bar, not the page-size or the search
      // input below.
      search: appliedFilters.search,
      limit: appliedFilters.limit,
    };
    setDraft(cleared);
    onApply(cleared);
  }

  function commitSearch() {
    if (searchDraft === appliedFilters.search) return;
    onApply({ ...appliedFilters, search: searchDraft });
  }

  function clearSearch() {
    setSearchDraft("");
    if (appliedFilters.search) {
      onApply({ ...appliedFilters, search: "" });
    }
  }

  function setLimit(value: number) {
    if (value === appliedFilters.limit) return;
    onApply({ ...appliedFilters, limit: value });
  }

  function setSort(value: CaseSort) {
    if (value === appliedFilters.sort) return;
    // Back to page one — page 4 of the old order is a different set of
    // matters in the new one.
    onApply({ ...appliedFilters, sort: value, page: 1 });
  }

  const hasStructuralFilters = Boolean(
    appliedFilters.courtId ||
      appliedFilters.courtPlace ||
      appliedFilters.advocateId ||
      appliedFilters.fromDate ||
      appliedFilters.toDate
  );

  return (
    <section
      aria-label="Case Vault filters and tools"
      className="rounded-2xl"
      style={{
        backgroundColor: "var(--color-app-paper)",
        boxShadow:
          "0 1px 0 var(--color-app-edge), 0 16px 32px -24px rgba(10,17,36,0.12)",
      }}
    >
      {/* Top — structural filters. Single row that flows: the five
          filter inputs + Clear (when applicable) + Apply. The min-w-0
          on the input wrapper lets each field shrink past its label
          width when the viewport is tight, so the row stays on one
          line as long as the screen reasonably allows. */}
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-end gap-2.5">
          <SelectField
            label="Court Place"
            value={draft.courtPlace}
            onChange={(v) => setDraftField("courtPlace", v)}
            placeholder="Any place"
            options={bootstrap.courtPlaces.map((p) => ({
              value: p,
              label: p,
            }))}
          />
          <SelectField
            label="Court Name"
            value={draft.courtId}
            onChange={(v) => setDraftField("courtId", v)}
            placeholder="Any court"
            options={bootstrap.courts.map((c) => ({
              value: c.id,
              label: c.number ? `${c.name} · ${c.number}` : c.name,
              sub: c.place || undefined,
            }))}
          />
          <SelectField
            label="Advocate"
            value={draft.advocateId}
            onChange={(v) => setDraftField("advocateId", v)}
            placeholder="Any advocate"
            options={bootstrap.advocates.map((a) => ({
              value: a.id,
              label: a.name,
              sub: a.role,
            }))}
          />
          <DateField
            label="Start Date"
            value={draft.fromDate}
            onChange={(v) => setDraftField("fromDate", v)}
          />
          <DateField
            label="End Date"
            value={draft.toDate}
            onChange={(v) => setDraftField("toDate", v)}
          />

          {/* Spacer eats remaining horizontal room so Apply hugs the
              right edge regardless of which sub-rows the filters land on. */}
          <div className="hidden flex-1 basis-0 sm:block" />

          {hasStructuralFilters ? (
            <button
              type="button"
              onClick={clearStructural}
              className="h-9 rounded-md px-2.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] transition-colors"
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
          ) : null}
          <button
            type="button"
            onClick={applyDraft}
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-3.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-all hover:-translate-y-0.5"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              backgroundColor: "var(--color-app-copper)",
              color: "var(--color-app-copper-text)",
              boxShadow: "0 6px 14px -8px rgba(197,133,58,0.55)",
            }}
          >
            <FilterIcon />
            Apply
          </button>
        </div>
      </div>

      {/* Hairline divider — single card, but the eye still parses the
          two functional groups. */}
      <div
        className="mx-5 h-px"
        style={{ backgroundColor: "var(--color-app-edge-soft)" }}
      />

      {/* Bottom — search + tools */}
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
            <span
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--color-app-fg-muted)" }}
            >
              <SearchIcon />
            </span>
            <input
              type="text"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitSearch();
                }
              }}
              onBlur={commitSearch}
              placeholder="Search across the rolls — file no., case no., CNR, client, court…"
              className="block w-full rounded-md border bg-transparent py-2.5 pl-10 pr-9 text-[13.5px] outline-none transition-all"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                borderColor: searchDraft
                  ? "var(--color-app-copper)"
                  : "var(--color-app-edge)",
                backgroundColor: "var(--color-app-paper)",
                color: "var(--color-app-ink)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--color-app-copper)";
                e.currentTarget.style.boxShadow =
                  "0 0 0 3px rgba(197,133,58,0.15)";
              }}
            />
            {searchDraft ? (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[12px]"
                style={{ color: "var(--color-app-fg-muted)" }}
                aria-label="Clear search"
              >
                ×
              </button>
            ) : null}
          </div>

          {/* Order. Defaults to newest-filed first, so a matter added
              minutes ago — here or on the phone — is the first row. */}
          <div className="relative">
            <select
              value={appliedFilters.sort}
              onChange={(e) => setSort(e.target.value as CaseSort)}
              aria-label="Sort cases"
              className="block appearance-none rounded-md border bg-transparent py-2.5 pl-3.5 pr-9 text-[12.5px] outline-none transition-all"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                borderColor: "var(--color-app-edge)",
                backgroundColor: "var(--color-app-paper)",
                color: "var(--color-app-ink)",
                minWidth: 150,
              }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span
              aria-hidden
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--color-app-fg-muted)" }}
            >
              <ChevronDown />
            </span>
          </div>

          <div className="relative">
            <select
              value={appliedFilters.limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              aria-label="Rows per page"
              className="block appearance-none rounded-md border bg-transparent py-2.5 pl-3.5 pr-9 text-[12.5px] outline-none transition-all"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                borderColor: "var(--color-app-edge)",
                backgroundColor: "var(--color-app-paper)",
                color: "var(--color-app-ink)",
                minWidth: 110,
              }}
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
            <span
              aria-hidden
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--color-app-fg-muted)" }}
            >
              <ChevronDown />
            </span>
          </div>

          <ViewToggle value={viewMode} onChange={onViewModeChange} />

          {/* The column picker drives the table layout AND the export
              field set. In Cards view it only affects export, so we keep
              it for admins (who can export) but drop it for everyone else
              to avoid a control that would do nothing. */}
          {viewMode === "table" || bootstrap.isAdmin ? (
            <ColumnVisibilityMenu
              visible={visibleColumns}
              onChange={onColumnsChange}
            />
          ) : null}
          {/* Export is office-admin only — the endpoint 403s anyone else,
              so there's no point showing the menu to them. */}
          {bootstrap.isAdmin ? (
            <ExportMenu
              filters={appliedFilters}
              visibleColumns={visibleColumns}
              selectedIds={selectedIds}
              selectAllMatching={selectAllMatching}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

type SelectOption = {
  value: string;
  label: string;
  sub?: string;
};

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
}) {
  return (
    // Compact filter cell. The min-w-0 lets it shrink past the label
    // width when the toolbar runs out of horizontal room — the row
    // wraps cleanly instead of forcing the parent wider.
    <div className="min-w-0 basis-full flex-1 sm:basis-[150px]">
      <label
        className="block text-[9px] font-semibold uppercase tracking-[0.18em]"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-fg-muted)",
        }}
      >
        {label}
      </label>
      <div className="relative mt-1">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="block h-9 w-full appearance-none rounded-md border bg-transparent px-2.5 pr-8 text-[12.5px] outline-none transition-all"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            borderColor: value
              ? "var(--color-app-copper)"
              : "var(--color-app-edge)",
            backgroundColor: "var(--color-app-paper)",
            color: value
              ? "var(--color-app-ink)"
              : "var(--color-app-fg-soft)",
          }}
        >
          <option value="">{placeholder || "—"}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.sub ? `${opt.label} — ${opt.sub}` : opt.label}
            </option>
          ))}
        </select>
        <span
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
          style={{ color: "var(--color-app-fg-muted)" }}
        >
          <ChevronDown />
        </span>
      </div>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="min-w-0 basis-full flex-1 sm:basis-[140px]">
      <label
        className="block text-[9px] font-semibold uppercase tracking-[0.18em]"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-fg-muted)",
        }}
      >
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block h-9 w-full rounded-md border px-2.5 text-[12.5px] outline-none transition-all"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          borderColor: value
            ? "var(--color-app-copper)"
            : "var(--color-app-edge)",
          backgroundColor: "var(--color-app-paper)",
          color: value ? "var(--color-app-ink)" : "var(--color-app-fg-soft)",
        }}
      />
    </div>
  );
}

// We pluck only the structural fields out of the draft before flushing
// — the page-size + search live elsewhere and could be stale in the
// draft if the user typed in the search input while filters were open.
function stripStructural(draft: CaseFilters) {
  return {
    courtId: draft.courtId,
    courtPlace: draft.courtPlace,
    advocateId: draft.advocateId,
    fromDate: draft.fromDate,
    toDate: draft.toDate,
  };
}

// Cards | Table segmented control. The active segment fills gold; the
// idle one stays quiet so the pair reads as one control, not two buttons.
function ViewToggle({
  value,
  onChange,
}: {
  value: CaseViewMode;
  onChange: (next: CaseViewMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Case Vault layout"
      className="inline-flex items-center gap-0.5 rounded-md border p-0.5"
      style={{
        borderColor: "var(--color-app-edge)",
        backgroundColor: "var(--color-app-paper)",
      }}
    >
      <ViewToggleButton
        active={value === "cards"}
        onClick={() => onChange("cards")}
        label="Cards"
      >
        <CardsIcon />
      </ViewToggleButton>
      <ViewToggleButton
        active={value === "table"}
        onClick={() => onChange("table")}
        label="Table"
      >
        <TableIcon />
      </ViewToggleButton>
    </div>
  );
}

function ViewToggleButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-[12px] font-semibold transition-colors"
      style={{
        fontFamily: "var(--font-manrope), sans-serif",
        backgroundColor: active ? "var(--color-app-copper)" : "transparent",
        color: active
          ? "var(--color-app-copper-text)"
          : "var(--color-app-fg-muted)",
      }}
    >
      {children}
      {label}
    </button>
  );
}

function CardsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="4"
        width="18"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <rect
        x="3"
        y="13"
        width="18"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M3 9.5h18M9 9.5V20"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 6h18M6 12h12M10 18h4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M16 16l5 5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
