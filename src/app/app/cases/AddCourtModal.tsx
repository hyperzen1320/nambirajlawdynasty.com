"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CourtOption } from "./CourtCombobox";

// AddCourtModal — focus-trapped popup over the case form. Triggered from
// the CourtCombobox's "+ Add this court" footer when no matching name
// exists in Court Hub. Posts to /api/app/courts (the existing endpoint
// already logs `court.created` to the activity feed) and hands the
// created court back to the caller via onSaved so the combobox can
// select it without a refetch.

export default function AddCourtModal({
  initialName,
  onClose,
  onSaved,
}: {
  initialName: string;
  onClose: () => void;
  onSaved: (court: CourtOption) => void;
}) {
  const [name, setName] = useState(initialName);
  const [number, setNumber] = useState("");
  const [place, setPlace] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);

  // Focus the name on open; Esc closes; click-outside closes (handled by
  // the backdrop). We deliberately don't trap Tab — the form's only
  // three real fields, Save, and Cancel — native tab order is enough.
  useEffect(() => {
    nameRef.current?.focus();
    // If the name was pre-filled from the combobox, drop the cursor at
    // the end so the user can immediately start typing the number.
    if (initialName && nameRef.current) {
      nameRef.current.setSelectionRange(
        initialName.length,
        initialName.length
      );
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [initialName, onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setMissing(true);
      setError("Court name is required.");
      nameRef.current?.focus();
      return;
    }
    setMissing(false);
    setSubmitting(true);

    try {
      const res = await fetch("/api/app/courts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          number: number.trim(),
          place: place.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Couldn't save this court.");
        setSubmitting(false);
        return;
      }
      // The POST returns the same shape that GET /api/app/courts returns,
      // so we hand it straight back to the combobox.
      onSaved(data.court as CourtOption);
    } catch {
      setError("Network error.");
      setSubmitting(false);
    }
  }

  // Rendered through a portal to document.body — the combobox lives inside
  // the case <form>, and a nested <form> is invalid HTML (the browser drops
  // it), which made "Save & Pick" submit the outer case form instead of this
  // modal, so the court was never created. Portalling lifts the modal's own
  // form out of the case form entirely.
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center px-4 pt-[10vh]"
      style={{ backgroundColor: "rgba(10,17,36,0.55)" }}
      onMouseDown={(e) => {
        // Backdrop clicks close — but only if the click started on the
        // backdrop, not on a child that bubbled up here.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-[520px] overflow-y-auto rounded-2xl"
        style={{
          backgroundColor: "var(--color-app-paper)",
          boxShadow:
            "0 32px 64px -16px rgba(10,17,36,0.40), 0 0 0 1px rgba(10,17,36,0.06)",
        }}
      >
        <div className="px-6 pt-5 pb-4">
          <div
            className="text-[10px] uppercase tracking-[0.22em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-copper-deep)",
            }}
          >
            Court Hub
          </div>
          <h3
            className="mt-1 text-[22px] font-semibold tracking-tight"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            Add court to Court Hub
          </h3>
          <p
            className="mt-2 text-[12.5px] leading-[1.55]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-fg-muted)",
            }}
          >
            This court will be reusable across every case going forward —
            it&rsquo;ll also be auto-picked into the case you&rsquo;re
            filing right now.
          </p>
        </div>

        <div className="space-y-4 px-6 pb-5">
          <Field
            label="Court Name"
            required
            value={name}
            onChange={(v) => {
              setName(v);
              if (missing && v.trim()) setMissing(false);
            }}
            placeholder="District Court"
            invalid={missing}
            inputRef={nameRef}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Court Number"
              value={number}
              onChange={setNumber}
              placeholder="Hall 3"
            />
            <Field
              label="Place"
              value={place}
              onChange={setPlace}
              placeholder="Chennai"
            />
          </div>
          {error ? (
            <div
              className="rounded-md px-3 py-2 text-[12px]"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                backgroundColor: "var(--color-app-danger-soft)",
                color: "var(--color-app-danger)",
              }}
            >
              {error}
            </div>
          ) : null}
        </div>

        <div
          className="flex items-center justify-between gap-3 px-6 py-4"
          style={{
            backgroundColor: "var(--color-app-canvas-2)",
            borderTop: "1px solid var(--color-app-edge-soft)",
          }}
        >
          <span
            className="text-[10px]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-muted)",
              letterSpacing: 0.3,
            }}
          >
            Esc to cancel
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md px-3 py-1.5 text-[12px] font-semibold"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                backgroundColor: "var(--color-app-paper)",
                color: "var(--color-app-fg-soft)",
                border: "1px solid var(--color-app-edge)",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-[12px] font-semibold"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                backgroundColor: "var(--color-app-copper)",
                color: "var(--color-app-copper-text)",
                opacity: submitting ? 0.6 : 1,
                boxShadow: "0 6px 14px -8px rgba(197,133,58,0.6)",
              }}
            >
              {submitting ? "Saving…" : "Save & Pick"}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function Field({
  label,
  required,
  value,
  onChange,
  placeholder,
  invalid,
  inputRef,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div>
      <label
        className="text-[10px] font-semibold uppercase tracking-[0.22em]"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-fg-muted)",
        }}
      >
        {label}
        {required && (
          <span style={{ color: "var(--color-app-copper)", marginLeft: 4 }}>
            *
          </span>
        )}
      </label>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 block w-full rounded-md border px-3 py-2 text-[13.5px] outline-none transition-all"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          borderColor: invalid
            ? "var(--color-app-danger)"
            : "var(--color-app-edge)",
          backgroundColor: "var(--color-app-canvas-2)",
          color: "var(--color-app-ink)",
        }}
        onFocus={(e) => {
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
      />
    </div>
  );
}
