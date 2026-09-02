"use client";

import { useEffect, useRef } from "react";

// ConfirmDeleteDialog — the house style for irreversible "permanently
// delete" confirmations across the product app (Case Vault row + bulk
// delete, Disposed Cases). Replaces the browser window.confirm() with a
// proper danger-styled sheet: red action, an explicit "can't be undone"
// line, Esc / click-outside to cancel, and a focus-trapped primary
// button so a stray Enter doesn't fire the destructive action.

export default function ConfirmDeleteDialog({
  title,
  message,
  confirmLabel = "Delete permanently",
  busy = false,
  error = null,
  onConfirm,
  onClose,
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Focus Cancel-adjacent primary so keyboard users land inside the
    // dialog, but DON'T auto-fire on Enter from the page behind it.
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(10,17,36,0.55)" }}
      onClick={() => {
        if (!busy) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] overflow-hidden rounded-2xl"
        style={{
          backgroundColor: "var(--color-app-paper)",
          boxShadow:
            "0 32px 64px -16px rgba(10,17,36,0.40), 0 0 0 1px rgba(10,17,36,0.06)",
          animation: "cdq-pop 220ms cubic-bezier(0.2, 0.7, 0.1, 1) both",
        }}
      >
        <style>{`
          @keyframes cdq-pop {
            from { opacity: 0; transform: translateY(8px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>

        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start gap-3.5">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: "var(--color-app-danger-soft)",
                color: "var(--color-app-danger)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h3
                className="text-[19px] font-semibold leading-snug tracking-tight"
                style={{
                  fontFamily: "var(--font-crimson), Georgia, serif",
                  color: "var(--color-app-ink)",
                }}
              >
                {title}
              </h3>
              <div
                className="mt-1.5 text-[13.5px] leading-[1.55]"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  color: "var(--color-app-fg-soft)",
                }}
              >
                {message}
              </div>
            </div>
          </div>

          {error ? (
            <p
              className="mt-4 rounded-md px-3 py-2 text-[12.5px]"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                backgroundColor: "var(--color-app-danger-soft)",
                color: "var(--color-app-danger)",
              }}
            >
              {error}
            </p>
          ) : null}
        </div>

        <div
          className="flex items-center justify-end gap-2 px-6 py-4"
          style={{
            backgroundColor: "var(--color-app-canvas-2)",
            borderTop: "1px solid var(--color-app-edge-soft)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-60"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              borderColor: "var(--color-app-edge)",
              backgroundColor: "var(--color-app-paper)",
              color: "var(--color-app-fg-soft)",
            }}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md px-5 py-2 text-[13px] font-semibold transition-all disabled:opacity-70"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              backgroundColor: "var(--color-app-danger)",
              color: "#ffffff",
              boxShadow: "0 6px 16px -8px rgba(176,42,42,0.6)",
            }}
          >
            {busy ? (
              <>
                <span
                  className="inline-block h-3 w-3 animate-spin rounded-full"
                  style={{
                    borderWidth: 1.5,
                    borderStyle: "solid",
                    borderColor: "rgba(255,255,255,0.4)",
                    borderTopColor: "#ffffff",
                  }}
                />
                Deleting…
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
