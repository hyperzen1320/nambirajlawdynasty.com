"use client";

import { useEffect, useRef, useState } from "react";

// Editable combobox for a matter's Status / Stage. Same idea as the
// "Appearing For" combobox: a free-text input the advocate can type anything
// into, plus a dropdown of the canonical stages (filtered by what's typed).
// When the typed value isn't one of the defaults, a "Use '…'" row lets the
// advocate commit their custom wording. Free text always wins.

export const STATUS_OPTIONS = [
  "Filed",
  "Notice",
  "Evidence",
  "Arguments",
  "Reserved",
  "Disposed",
];

export default function StatusCombobox({
  id,
  label = "Status",
  value,
  onChange,
  placeholder = "Filed, Evidence… or type your own",
}: {
  id: string;
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  const trimmed = value.trim();
  const q = trimmed.toLowerCase();
  const exact = STATUS_OPTIONS.some((o) => o.toLowerCase() === q);
  const matches =
    !q || exact
      ? [...STATUS_OPTIONS]
      : STATUS_OPTIONS.filter((o) => o.toLowerCase().includes(q));
  const showUseCustom = trimmed.length > 0 && !exact;

  return (
    <div ref={rootRef} className="relative">
      <label
        htmlFor={id}
        className="text-[10px] font-semibold uppercase tracking-[0.22em]"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-fg-muted)",
        }}
      >
        {label}
      </label>
      <div className="relative mt-2">
        <input
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          className="block w-full rounded-md border px-3.5 py-2.5 text-[14px] outline-none transition-all"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            borderColor: "var(--color-app-edge)",
            backgroundColor: "var(--color-app-paper)",
            color: "var(--color-app-ink)",
            paddingRight: 36,
          }}
          onFocusCapture={(e) => {
            e.currentTarget.style.borderColor = "var(--color-app-copper)";
            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(197,133,58,0.15)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--color-app-edge)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
        <button
          type="button"
          aria-label={open ? "Hide stages" : "Show stages"}
          tabIndex={-1}
          onClick={() => setOpen((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
          style={{ color: "var(--color-app-fg-muted)" }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            style={{
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform 150ms",
            }}
          >
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {open && (matches.length > 0 || showUseCustom) ? (
          <ul
            id={`${id}-listbox`}
            role="listbox"
            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[240px] overflow-auto rounded-md py-1"
            style={{
              backgroundColor: "var(--color-app-paper)",
              border: "1px solid var(--color-app-edge)",
              boxShadow: "0 16px 32px -12px rgba(10,17,36,0.25)",
            }}
          >
            {showUseCustom ? (
              <li role="option" aria-selected>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(trimmed);
                    setOpen(false);
                  }}
                  className="block w-full px-3.5 py-2 text-left text-[13.5px] transition-colors"
                  style={{
                    fontFamily: "var(--font-manrope), sans-serif",
                    color: "var(--color-app-copper-deep)",
                    fontWeight: 600,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      "var(--color-app-canvas-2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  Use &ldquo;{trimmed}&rdquo;
                </button>
              </li>
            ) : null}
            {matches.map((opt) => {
              const active = opt.toLowerCase() === q;
              return (
                <li key={opt} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onChange(opt);
                      setOpen(false);
                    }}
                    className="block w-full px-3.5 py-2 text-left text-[13.5px] transition-colors"
                    style={{
                      fontFamily: "var(--font-manrope), sans-serif",
                      color: "var(--color-app-ink)",
                      backgroundColor: active
                        ? "var(--color-app-canvas-2)"
                        : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--color-app-canvas-2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = active
                        ? "var(--color-app-canvas-2)"
                        : "transparent";
                    }}
                  >
                    {opt}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
