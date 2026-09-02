"use client";

import { useRef, useState } from "react";
import { NOTICE_TOKENS } from "@/lib/notice-template";

// The office's pre-filled WhatsApp message. Admins edit and save it; everyone
// else sees it read-only. Typing "@" (or clicking a chip) drops in a merge
// field like {{caseNo}} / {{nextHearingDate}}, which is filled per matter when
// the advocate taps WhatsApp on a hearing.

export default function NoticeTemplateEditor({
  initialTemplate,
  isAdmin,
}: {
  initialTemplate: string;
  isAdmin: boolean;
}) {
  const [template, setTemplate] = useState(initialTemplate);
  const [saved, setSaved] = useState(initialTemplate);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // When typing an "@mention", holds the partial query + the caret position
  // so we can replace "@que" with the chosen {{token}}.
  const [mention, setMention] = useState<{ query: string; caret: number } | null>(
    null
  );
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const dirty = template !== saved;

  function syncMention(value: string, caret: number) {
    const upto = value.slice(0, caret);
    const m = upto.match(/@(\w*)$/);
    setMention(m ? { query: m[1].toLowerCase(), caret } : null);
  }

  function insertToken(token: string) {
    const el = ref.current;
    const caret = mention
      ? mention.caret
      : el?.selectionStart ?? template.length;
    // If an @mention is open, swallow the "@query" it was typed against.
    const removeFrom = mention ? caret - (mention.query.length + 1) : caret;
    const before = template.slice(0, removeFrom);
    const after = template.slice(caret);
    const piece = `{{${token}}}`;
    const next = before + piece + after;
    setTemplate(next);
    setMention(null);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = before.length + piece.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/app/office/notice-template", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Couldn't save the template.");
        return;
      }
      setSaved(template);
      setFlash(true);
      setTimeout(() => setFlash(false), 2200);
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  const filtered = mention
    ? NOTICE_TOKENS.filter(
        (t) =>
          !mention.query ||
          t.token.toLowerCase().includes(mention.query) ||
          t.label.toLowerCase().includes(mention.query)
      )
    : [];

  return (
    <div
      className="fade-up-sm mt-5 rounded-2xl p-7"
      style={{
        backgroundColor: "var(--color-app-paper)",
        boxShadow: "0 1px 0 var(--color-app-edge)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            className="text-[18px] font-semibold tracking-tight"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            Pre-filled WhatsApp message
          </h3>
          <p
            className="mt-1 max-w-xl text-[12.5px] leading-6"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-fg-muted)",
            }}
          >
            This is what fills in when you tap WhatsApp on a hearing.
            {isAdmin
              ? " Type @ (or tap a field below) to insert a detail like the case number or next date."
              : " Only the office admin can edit it."}
          </p>
        </div>
        {flash ? (
          <span
            className="text-[10px] uppercase tracking-[0.18em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-aqua)",
            }}
          >
            Saved ✓
          </span>
        ) : null}
      </div>

      {isAdmin ? (
        <div className="mt-5">
          <div className="relative">
            <textarea
              ref={ref}
              value={template}
              onChange={(e) => {
                setTemplate(e.target.value);
                syncMention(e.target.value, e.target.selectionStart);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setMention(null);
              }}
              onClick={(e) =>
                syncMention(
                  e.currentTarget.value,
                  e.currentTarget.selectionStart
                )
              }
              rows={10}
              spellCheck={false}
              className="block w-full resize-y rounded-md border px-4 py-3 text-[13.5px] leading-7 outline-none transition-all"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                borderColor: "var(--color-app-edge)",
                backgroundColor: "var(--color-app-canvas-2)",
                color: "var(--color-app-ink)",
                whiteSpace: "pre-wrap",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--color-app-copper)";
                e.currentTarget.style.boxShadow =
                  "0 0 0 3px rgba(197,133,58,0.15)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--color-app-edge)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />

            {/* @-mention popup */}
            {mention && filtered.length > 0 ? (
              <ul
                role="listbox"
                className="absolute left-4 top-2 z-20 max-h-[230px] w-[230px] overflow-auto rounded-md py-1"
                style={{
                  backgroundColor: "var(--color-app-paper)",
                  border: "1px solid var(--color-app-edge)",
                  boxShadow: "0 16px 32px -12px rgba(10,17,36,0.3)",
                }}
              >
                <li
                  className="px-3 py-1 text-[9px] uppercase tracking-[0.18em]"
                  style={{
                    fontFamily: "var(--font-dm-mono), monospace",
                    color: "var(--color-app-fg-muted)",
                  }}
                >
                  Insert field
                </li>
                {filtered.map((t) => (
                  <li key={t.token} role="option">
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        insertToken(t.token);
                      }}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] transition-colors"
                      style={{ fontFamily: "var(--font-manrope), sans-serif" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          "var(--color-app-canvas-2)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                      }
                    >
                      <span style={{ color: "var(--color-app-ink)" }}>
                        {t.label}
                      </span>
                      <span
                        className="text-[11px]"
                        style={{
                          fontFamily: "var(--font-dm-mono), monospace",
                          color: "var(--color-app-copper-deep)",
                        }}
                      >
                        {`{{${t.token}}}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* Field chips */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {NOTICE_TOKENS.map((t) => (
              <button
                key={t.token}
                type="button"
                onClick={() => insertToken(t.token)}
                className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  backgroundColor: "var(--color-app-canvas-2)",
                  border: "1px solid var(--color-app-edge)",
                  color: "var(--color-app-copper-deep)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor =
                    "var(--color-app-copper)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "var(--color-app-edge)")
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          {error ? (
            <p
              className="mt-3 text-[12.5px]"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                color: "var(--color-app-danger)",
              }}
            >
              {error}
            </p>
          ) : null}

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty}
              className="inline-flex items-center gap-2 rounded-md px-6 py-2.5 text-[13px] font-semibold transition-all"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                backgroundColor: dirty
                  ? "var(--color-app-copper)"
                  : "var(--color-app-canvas-2)",
                color: dirty
                  ? "var(--color-app-copper-text)"
                  : "var(--color-app-fg-muted)",
                opacity: saving ? 0.6 : 1,
                cursor: dirty && !saving ? "pointer" : "default",
                boxShadow: dirty
                  ? "0 8px 20px -10px rgba(197,133,58,0.6)"
                  : "none",
              }}
            >
              {saving ? "Saving…" : "Save Message"}
            </button>
          </div>
        </div>
      ) : (
        <div
          className="mt-5 whitespace-pre-wrap rounded-md px-4 py-3 text-[13.5px] leading-7"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            backgroundColor: "var(--color-app-canvas-2)",
            border: "1px solid var(--color-app-edge)",
            color: "var(--color-app-ink)",
          }}
        >
          {template}
        </div>
      )}
    </div>
  );
}
