"use client";

import { useEffect, useRef, useState } from "react";

export type RequestTargetType =
  | "list"
  | "task"
  | "board"
  | "case"
  | "case_document"
  | "client"
  | "court"
  | "prompt"
  | "user";

export type RequestTarget = {
  type: RequestTargetType;
  id: string;
  name: string;
  hint?: string; // server-provided reason why direct delete was blocked
};

const TYPE_LABEL: Record<RequestTargetType, string> = {
  list: "list",
  task: "card",
  board: "board",
  case: "case",
  case_document: "document",
  client: "client",
  court: "court",
  prompt: "prompt",
  user: "user",
};

export default function RequestDeleteDialog({
  target,
  onClose,
  onSubmitted,
}: {
  target: RequestTarget;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    setError(null);
    if (reason.trim().length < 4) {
      setError("Please write at least a few words about why.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/app/delete-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: target.type,
          targetId: target.id,
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't send the request.");
        setSubmitting(false);
        return;
      }
      onSubmitted();
    } catch {
      setError("Network error.");
      setSubmitting(false);
    }
  }

  const targetLabel = TYPE_LABEL[target.type] ?? target.type;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(10,17,36,0.55)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-2xl"
        style={{
          backgroundColor: "var(--color-app-paper)",
          boxShadow:
            "0 32px 64px -16px rgba(10,17,36,0.40), 0 0 0 1px rgba(10,17,36,0.06)",
          animation:
            "rdq-pop 220ms cubic-bezier(0.2, 0.7, 0.1, 1) both",
        }}
      >
        <style>{`
          @keyframes rdq-pop {
            from { opacity: 0; transform: translateY(8px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>

        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: "var(--color-app-danger-soft)",
                color: "var(--color-app-danger)",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 9v4M12 17v.5M5 21h14a2 2 0 0 0 1.7-3l-7-12a2 2 0 0 0-3.4 0l-7 12A2 2 0 0 0 5 21z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h3
                className="text-[18px] font-semibold tracking-tight leading-snug"
                style={{
                  fontFamily: "var(--font-crimson), Georgia, serif",
                  color: "var(--color-app-ink)",
                }}
              >
                Request to delete {targetLabel}
              </h3>
              <p
                className="mt-1 text-[13px] leading-[1.5]"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  color: "var(--color-app-fg-muted)",
                }}
              >
                <span style={{ color: "var(--color-app-ink)", fontWeight: 600 }}>
                  {target.name}
                </span>
                {target.hint
                  ? ` · ${target.hint}`
                  : " · The office admin will review your request."}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-5">
          <label
            className="text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-muted)",
            }}
          >
            Why?
          </label>
          <textarea
            ref={inputRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Two-line reason — admin reads this before approving."
            rows={4}
            className="mt-2 block w-full resize-y rounded-md border px-3.5 py-2.5 text-[13px] outline-none transition-all"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              borderColor: error
                ? "var(--color-app-danger)"
                : "var(--color-app-edge)",
              backgroundColor: "var(--color-app-paper)",
              color: "var(--color-app-ink)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--color-app-copper)";
              e.currentTarget.style.boxShadow =
                "0 0 0 3px rgba(197,133,58,0.15)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = error
                ? "var(--color-app-danger)"
                : "var(--color-app-edge)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
          {error ? (
            <p
              className="mt-2 text-[12px]"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
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
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border px-4 py-2 text-[13px] font-medium"
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
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-md px-5 py-2 text-[13px] font-semibold transition-all"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              backgroundColor: "var(--color-app-copper)",
              color: "var(--color-app-copper-text)",
              opacity: submitting ? 0.6 : 1,
              boxShadow: "0 6px 16px -8px rgba(197,133,58,0.55)",
            }}
          >
            {submitting ? "Sending…" : "Send request"}
          </button>
        </div>
      </div>
    </div>
  );
}
