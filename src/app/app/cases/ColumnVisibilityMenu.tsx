"use client";

import { useEffect, useRef, useState } from "react";
import {
  COLUMNS,
  DEFAULT_VISIBLE_COLUMNS,
  type CaseColumnKey,
} from "./case-vault-types";

// Small popover with one checkbox per togglable column. S.No is always
// on and renders as a disabled row. The Actions column is always shown
// in the table too, but is intentionally omitted from this menu (it is
// not a data column the user would export or hide). A Reset link
// restores the default set.

export default function ColumnVisibilityMenu({
  visible,
  onChange,
}: {
  visible: CaseColumnKey[];
  onChange: (next: CaseColumnKey[]) => void;
}) {
  const [open, setOpen] = useState(false);
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

  const visibleSet = new Set(visible);

  function toggle(key: CaseColumnKey) {
    const col = COLUMNS.find((c) => c.key === key);
    if (!col || !col.togglable) return;
    const next = new Set(visibleSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    // Preserve master column order so the rendered columns stay
    // predictable even after the user toggles in random sequence.
    onChange(COLUMNS.filter((c) => next.has(c.key)).map((c) => c.key));
  }

  function reset() {
    onChange(DEFAULT_VISIBLE_COLUMNS);
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          borderColor: open
            ? "var(--color-app-copper)"
            : "var(--color-app-edge)",
          backgroundColor: "var(--color-app-paper)",
          color: "var(--color-app-fg-soft)",
        }}
      >
        <ColumnsIcon />
        Columns
        <span
          className="text-[9px]"
          style={{ color: "var(--color-app-fg-muted)" }}
        >
          ({visible.length - 2}/{COLUMNS.filter((c) => c.togglable).length})
        </span>
      </button>

      {open ? (
        <div
          className="absolute left-0 z-30 mt-2 w-[240px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-md sm:left-auto sm:right-0"
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
            <div className="flex items-center justify-between">
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  color: "var(--color-app-fg-muted)",
                }}
              >
                Visible columns
              </span>
              <button
                type="button"
                onClick={reset}
                className="text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  color: "var(--color-app-copper-deep)",
                }}
              >
                Reset
              </button>
            </div>
          </div>
          <ul className="max-h-[360px] overflow-y-auto py-1">
            {COLUMNS.filter((col) => col.key !== "actions").map((col) => {
              const checked = visibleSet.has(col.key);
              const disabled = !col.togglable;
              return (
                <li key={col.key}>
                  <label
                    className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[12.5px] transition-colors"
                    style={{
                      fontFamily: "var(--font-manrope), sans-serif",
                      color: disabled
                        ? "var(--color-app-fg-muted)"
                        : "var(--color-app-ink)",
                      cursor: disabled ? "not-allowed" : "pointer",
                      opacity: disabled ? 0.55 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (disabled) return;
                      e.currentTarget.style.backgroundColor =
                        "var(--color-app-canvas-2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <span
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] transition-colors"
                      style={{
                        backgroundColor: checked
                          ? "var(--color-app-copper)"
                          : "var(--color-app-paper)",
                        border: checked
                          ? "1px solid var(--color-app-copper)"
                          : "1.5px solid var(--color-app-edge)",
                      }}
                    >
                      {checked ? (
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden
                        >
                          <path
                            d="M5 12l5 5L20 7"
                            stroke="var(--color-app-copper-text)"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                    </span>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(col.key)}
                      className="sr-only"
                    />
                    {col.label}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ColumnsIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="4"
        width="6"
        height="16"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <rect
        x="15"
        y="4"
        width="6"
        height="16"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}
