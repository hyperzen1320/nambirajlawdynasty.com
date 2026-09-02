"use client";

import { useEffect, useRef, useState } from "react";
import { DOC_ACCEPT_ATTR, formatBytes, kindForFilename } from "@/lib/case-docs";
import type { ChatAttachment } from "@/lib/use-chat-room";

// Auto-resize textarea + Send button, now with WhatsApp-style attachments:
// a paperclip uploads files up-front to /api/app/chat/attachments and holds
// the returned refs as chips until Send fires. Enter sends, Shift+Enter
// inserts a newline. Send is enabled with text OR at least one attachment.

const MAX_BODY = 4000;
const WARN_AT = 3500;
const MAX_ATTACHMENTS = 6;

export default function Composer({
  onSend,
  disabled,
  placeholder,
  sending,
  errorMessage,
}: {
  onSend: (body: string, attachments?: ChatAttachment[]) => Promise<boolean>;
  disabled?: boolean;
  placeholder: string;
  sending: boolean;
  errorMessage: string | null;
}) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [value]);

  async function onFilesPicked(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((f) => f.size > 0);
    if (files.length === 0) return;
    const room = MAX_ATTACHMENTS - attachments.length;
    if (room <= 0) {
      setUploadError(`You can attach up to ${MAX_ATTACHMENTS} files.`);
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      files.slice(0, room).forEach((f) => fd.append("files", f));
      const res = await fetch("/api/app/chat/attachments", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadError(data?.error || "Couldn't upload that file.");
        return;
      }
      if (Array.isArray(data.attachments)) {
        setAttachments((prev) => [...prev, ...(data.attachments as ChatAttachment[])]);
      }
      if (Array.isArray(data.errors) && data.errors.length) {
        setUploadError(data.errors.join(" "));
      }
    } catch {
      setUploadError("Network error during upload.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function tryToSend() {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || sending || disabled || uploading) {
      return;
    }
    if (trimmed.length > MAX_BODY) return;
    const ok = await onSend(trimmed, attachments);
    if (ok) {
      setValue("");
      setAttachments([]);
      setUploadError(null);
      requestAnimationFrame(() => {
        if (ref.current) ref.current.style.height = "auto";
      });
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      tryToSend();
    }
  }

  const remaining = MAX_BODY - value.length;
  const showCounter = value.length >= WARN_AT;
  const overLimit = value.length > MAX_BODY;
  const canSend =
    !disabled && !sending && !uploading && !overLimit && (!!value.trim() || attachments.length > 0);

  return (
    <div
      className="border-t px-5 py-4"
      style={{
        backgroundColor: "var(--color-app-paper)",
        borderColor: "var(--color-app-edge)",
      }}
    >
      {errorMessage || uploadError ? (
        <div
          className="mb-2 rounded-md px-3 py-2 text-[12px]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            backgroundColor: "var(--color-app-danger-soft)",
            color: "var(--color-app-danger)",
          }}
        >
          {uploadError || errorMessage}
        </div>
      ) : null}

      {/* Pending attachment chips */}
      {attachments.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11.5px]"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                backgroundColor: "var(--color-app-canvas-2)",
                border: "1px solid var(--color-app-edge)",
                color: "var(--color-app-ink)",
              }}
            >
              <span aria-hidden>{kindForFilename(a.filename) === "image" ? "🖼️" : "📎"}</span>
              <span className="max-w-[160px] truncate" title={a.filename}>
                {a.filename}
              </span>
              <span style={{ color: "var(--color-app-fg-muted)" }}>{formatBytes(a.size)}</span>
              <button
                type="button"
                onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                aria-label={`Remove ${a.filename}`}
                style={{ color: "var(--color-app-fg-muted)" }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div
        className="flex items-end gap-2 rounded-xl px-2 py-2"
        style={{
          backgroundColor: "var(--color-app-canvas-2)",
          border: `1px solid ${overLimit ? "var(--color-app-danger)" : "var(--color-app-edge)"}`,
        }}
      >
        {/* Attach */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || uploading || attachments.length >= MAX_ATTACHMENTS}
          aria-label="Attach a file"
          title="Attach a file"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-[var(--color-app-edge-soft)] hover:text-[var(--color-app-ink)] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ color: "var(--color-app-fg-soft)" }}
        >
          {uploading ? (
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full"
              style={{
                borderWidth: 1.5,
                borderStyle: "solid",
                borderColor: "rgba(31,19,8,0.25)",
                borderTopColor: "var(--color-app-copper-deep)",
              }}
            />
          ) : (
            <PaperclipIcon />
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={DOC_ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) onFilesPicked(e.target.files);
          }}
        />

        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled || sending}
          className="block flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-[13.5px] outline-none disabled:opacity-60"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-ink)",
            minHeight: 36,
            maxHeight: 144,
          }}
        />
        <button
          onClick={tryToSend}
          disabled={!canSend}
          aria-label="Send"
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3.5 text-[12px] font-semibold transition-all"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            backgroundColor: "var(--color-app-copper)",
            color: "var(--color-app-copper-text)",
            opacity: canSend ? 1 : 0.45,
            cursor: canSend ? "pointer" : "not-allowed",
            boxShadow: canSend ? "0 6px 14px -8px rgba(172,123,51,0.6)" : "none",
          }}
        >
          {sending ? "Sending…" : "Send"}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 12l18-9-7 18-2-7-9-2z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div
          className="text-[10px]"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            color: "var(--color-app-fg-muted)",
            letterSpacing: 0.3,
          }}
        >
          Enter to send · Shift+Enter for a new line
        </div>
        {showCounter ? (
          <div
            className="text-[10px] tabular-nums"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: overLimit
                ? "var(--color-app-danger)"
                : remaining < 200
                  ? "var(--color-app-copper-deep)"
                  : "var(--color-app-fg-muted)",
              fontWeight: overLimit ? 700 : 500,
            }}
          >
            {remaining < 0 ? `${Math.abs(remaining)} over` : `${remaining} left`}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PaperclipIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
