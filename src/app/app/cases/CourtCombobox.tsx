"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AddCourtModal from "./AddCourtModal";

// CourtCombobox — typeahead + dropdown over the partner's Court Hub.
//
// Behaviour:
//   • Pre-fetches /api/app/courts on mount once. Filter, key handling,
//     and "no match" detection are all client-side after that — the
//     list per partner is small.
//   • Typing filters by name OR number OR place (whichever the advocate
//     remembers first about a court).
//   • Picking a row fills name + number + place + courtId atomically;
//     the caller passes onChange, the controlled tuple flows out.
//   • Typing after picking clears courtId (the user is editing free-
//     form text) but keeps the last-picked number/place so they don't
//     vanish on an accidental keystroke. The caller decides whether to
//     keep them in the final payload.
//   • When the typed text has no exact name match, the dropdown ends in
//     a "+ Add this court to Court Hub" footer that opens AddCourtModal
//     pre-filled with the typed text. Saving returns the new court here
//     and selects it.

export type CourtOption = {
  id: string;
  name: string;
  number: string;
  place: string;
};

export type CourtComboboxValue = {
  courtId: string | null;
  courtName: string;
  courtNumber: string;
  courtPlace: string;
};

export default function CourtCombobox({
  value,
  onChange,
  required,
  invalid,
  placeholder = "District Court, Chennai",
  id = "court",
}: {
  value: CourtComboboxValue;
  onChange: (next: CourtComboboxValue) => void;
  required?: boolean;
  invalid?: boolean;
  placeholder?: string;
  id?: string;
}) {
  const [courts, setCourts] = useState<CourtOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [modalOpen, setModalOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  // Initial fetch. We hold the list locally; AddCourtModal calls back to
  // mutate the list when the user adds a new court — no refetch needed.
  useEffect(() => {
    let alive = true;
    fetch("/api/app/courts", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data?.courts) return;
        setCourts(data.courts as CourtOption[]);
        setLoaded(true);
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Filtered suggestions. An empty input shows the full list; otherwise
  // a token-match on name/number/place. Case-insensitive throughout.
  const filtered = useMemo(() => {
    const q = value.courtName.trim().toLowerCase();
    if (!q) return courts;
    return courts.filter((c) => {
      return (
        c.name.toLowerCase().includes(q) ||
        c.number.toLowerCase().includes(q) ||
        c.place.toLowerCase().includes(q)
      );
    });
  }, [courts, value.courtName]);

  // Exact match on the name = "they're pointing at this court", so we
  // hide the "+ Add" CTA. Number-only or place-only matches still leave
  // the CTA visible — the user may want a brand-new bench in a known
  // place.
  const exactMatch = useMemo(() => {
    const q = value.courtName.trim().toLowerCase();
    if (!q) return null;
    return (
      courts.find((c) => c.name.toLowerCase() === q) ?? null
    );
  }, [courts, value.courtName]);

  const showAddCta = loaded && !exactMatch && value.courtName.trim().length > 0;

  // Close on outside click. We add a listener only while the dropdown is
  // open so background pages aren't paying for it.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Reset active index when the filter changes so the highlight doesn't
  // point at a row that disappeared.
  useEffect(() => {
    setActiveIndex(filtered.length > 0 ? 0 : -1);
  }, [filtered.length]);

  const selectCourt = useCallback(
    (c: CourtOption) => {
      onChange({
        courtId: c.id,
        courtName: c.name,
        courtNumber: c.number || "",
        courtPlace: c.place || "",
      });
      setOpen(false);
      inputRef.current?.blur();
    },
    [onChange]
  );

  function handleNameChange(name: string) {
    // Typing after a pick = user is editing — break the link to the
    // Court Hub master so the case carries the free-form string rather
    // than a stale association. Keep the last-picked number + place so
    // a single typo doesn't blow them away.
    onChange({
      courtId: null,
      courtName: name,
      courtNumber: value.courtNumber,
      courtPlace: value.courtPlace,
    });
    setOpen(true);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) =>
        filtered.length === 0 ? -1 : Math.min(i + 1, filtered.length - 1)
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) =>
        filtered.length === 0 ? -1 : Math.max(i - 1, 0)
      );
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && filtered[activeIndex]) {
        e.preventDefault();
        selectCourt(filtered[activeIndex]);
      } else if (showAddCta) {
        e.preventDefault();
        setOpen(false);
        setModalOpen(true);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    }
  }

  // Keep the active row scrolled into view while the user keyboards
  // through the list.
  useEffect(() => {
    if (!open || activeIndex < 0 || !listRef.current) return;
    const el = listRef.current.children[activeIndex] as
      | HTMLElement
      | undefined;
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  return (
    <div className="relative" ref={rootRef}>
      <label
        htmlFor={id}
        className="text-[10px] font-semibold uppercase tracking-[0.22em]"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-fg-muted)",
        }}
      >
        Court
        {required && (
          <span style={{ color: "var(--color-app-copper)", marginLeft: 4 }}>
            *
          </span>
        )}
      </label>
      <div className="relative mt-2">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value.courtName}
          onChange={(e) => handleNameChange(e.target.value)}
          onFocus={(e) => {
            setOpen(true);
            e.currentTarget.style.borderColor = "var(--color-app-copper)";
            e.currentTarget.style.boxShadow =
              "0 0 0 3px rgba(197,133,58,0.15)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = invalid
              ? "var(--color-app-danger)"
              : "var(--color-app-edge)";
            e.currentTarget.style.boxShadow = "none";
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={`${id}-list`}
          className="block w-full rounded-md border bg-transparent px-3.5 py-2.5 pr-10 text-[14px] outline-none transition-all"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            borderColor: invalid
              ? "var(--color-app-danger)"
              : "var(--color-app-edge)",
            backgroundColor: "var(--color-app-paper)",
            color: "var(--color-app-ink)",
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 transition-transform"
          style={{
            color: "var(--color-app-fg-muted)",
            transform: open
              ? "translateY(-50%) rotate(180deg)"
              : "translateY(-50%)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        {open ? (
          <div
            className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-md"
            style={{
              backgroundColor: "var(--color-app-paper)",
              border: "1px solid var(--color-app-edge)",
              boxShadow:
                "0 16px 32px -12px rgba(10,17,36,0.25), 0 0 0 1px rgba(10,17,36,0.04)",
            }}
          >
            {!loaded ? (
              <div
                className="px-4 py-3 text-[12px]"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  color: "var(--color-app-fg-muted)",
                }}
              >
                Loading courts…
              </div>
            ) : filtered.length === 0 && !showAddCta ? (
              <div
                className="px-4 py-3 text-[12px]"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  color: "var(--color-app-fg-muted)",
                }}
              >
                No courts in Court Hub yet — type a court name and the
                option to add it will appear here.
              </div>
            ) : (
              <ul
                ref={listRef}
                id={`${id}-list`}
                role="listbox"
                className="max-h-[260px] overflow-y-auto"
              >
                {filtered.map((c, i) => {
                  const active = i === activeIndex;
                  return (
                    <li
                      key={c.id}
                      role="option"
                      aria-selected={active}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectCourt(c);
                      }}
                      onMouseEnter={() => setActiveIndex(i)}
                      className="cursor-pointer px-4 py-2.5"
                      style={{
                        backgroundColor: active
                          ? "var(--color-app-canvas-2)"
                          : "transparent",
                      }}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span
                          className="truncate text-[13.5px] font-semibold"
                          style={{
                            fontFamily: "var(--font-manrope), sans-serif",
                            color: "var(--color-app-ink)",
                          }}
                        >
                          {c.name}
                        </span>
                        {c.number ? (
                          <span
                            className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
                            style={{
                              fontFamily:
                                "var(--font-dm-mono), monospace",
                              backgroundColor: "var(--color-app-canvas-2)",
                              color: "var(--color-app-copper-deep)",
                            }}
                          >
                            {c.number}
                          </span>
                        ) : null}
                      </div>
                      {c.place ? (
                        <div
                          className="mt-0.5 text-[11px]"
                          style={{
                            fontFamily:
                              "var(--font-dm-mono), monospace",
                            color: "var(--color-app-fg-muted)",
                          }}
                        >
                          {c.place}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}

            {showAddCta ? (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  setModalOpen(true);
                }}
                className="flex w-full items-center justify-between gap-2 border-t px-4 py-2.5 text-left transition-colors"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  borderColor: "var(--color-app-edge-soft)",
                  backgroundColor: "var(--color-app-canvas-2)",
                  color: "var(--color-app-ink)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "rgba(197,133,58,0.10)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "var(--color-app-canvas-2)";
                }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
                    style={{
                      fontFamily: "var(--font-dm-mono), monospace",
                      backgroundColor: "var(--color-app-copper)",
                      color: "var(--color-app-copper-text)",
                    }}
                  >
                    +
                  </span>
                  <span className="min-w-0 truncate text-[13px]">
                    Add{" "}
                    <span style={{ fontWeight: 600 }}>
                      &ldquo;{value.courtName.trim()}&rdquo;
                    </span>{" "}
                    to Court Hub
                  </span>
                </span>
                <span
                  className="text-[10px] uppercase tracking-[0.16em]"
                  style={{
                    fontFamily: "var(--font-dm-mono), monospace",
                    color: "var(--color-app-fg-muted)",
                  }}
                >
                  →
                </span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {modalOpen ? (
        <AddCourtModal
          initialName={value.courtName.trim()}
          onClose={() => setModalOpen(false)}
          onSaved={(created) => {
            setCourts((prev) => [created, ...prev]);
            selectCourt(created);
            setModalOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
