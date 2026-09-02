"use client";

import { useEffect, useRef, useState } from "react";
import type { SeniorDeskMember } from "./SeniorDeskClient";

// Modal sheet for creating a reminder. Title is required, everything else
// is optional. Default assignee is the caller (personal reminder); pick a
// teammate to delegate.

export default function NewReminderSheet({
  me,
  members,
  onCreate,
  onClose,
}: {
  me: SeniorDeskMember;
  members: SeniorDeskMember[];
  onCreate: (input: {
    title: string;
    description: string;
    dueDate: string | null;
    priority: "low" | "normal" | "high";
    assignedToUserId: string;
  }) => Promise<boolean>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [assignee, setAssignee] = useState<string>(me.id);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const activeMembers = members.filter((m) => m.active);

  async function submit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!title.trim()) {
      setError("Reminder needs a title.");
      titleRef.current?.focus();
      return;
    }
    setError(null);
    setSubmitting(true);
    const dueIso = dueDate ? new Date(dueDate).toISOString() : null;
    const ok = await onCreate({
      title: title.trim(),
      description: description.trim(),
      dueDate: dueIso,
      priority,
      assignedToUserId: assignee,
    });
    setSubmitting(false);
    if (ok) onClose();
    else setError("Couldn't save the reminder. Try again.");
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center px-4 pt-[8vh]"
      style={{ backgroundColor: "rgba(10,17,36,0.55)" }}
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-[520px] overflow-hidden rounded-2xl"
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
            New reminder
          </div>
          <h3
            className="mt-1 text-[22px] font-semibold tracking-tight"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            What's on the desk?
          </h3>
        </div>

        <div className="space-y-4 px-6 pb-5">
          <Field label="Title">
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={240}
              placeholder="Reply to opposite counsel about IA №3"
              className="block w-full rounded-md border px-3 py-2 text-[14px] outline-none"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                borderColor: "var(--color-app-edge)",
                backgroundColor: "var(--color-app-canvas-2)",
                color: "var(--color-app-ink)",
              }}
            />
          </Field>
          <Field label="Notes">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={4000}
              placeholder="Optional — context, links, what to include…"
              className="block w-full resize-none rounded-md border px-3 py-2 text-[13.5px] outline-none"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                borderColor: "var(--color-app-edge)",
                backgroundColor: "var(--color-app-canvas-2)",
                color: "var(--color-app-ink)",
              }}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due date">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="block w-full rounded-md border px-3 py-2 text-[13px] outline-none"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  borderColor: "var(--color-app-edge)",
                  backgroundColor: "var(--color-app-canvas-2)",
                  color: "var(--color-app-ink)",
                }}
              />
            </Field>
            <Field label="Priority">
              <div className="flex gap-1.5">
                {(["low", "normal", "high"] as const).map((p) => {
                  const active = p === priority;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className="flex-1 rounded-md px-2 py-2 text-[12px] font-semibold capitalize"
                      style={{
                        fontFamily: "var(--font-manrope), sans-serif",
                        backgroundColor: active
                          ? p === "high"
                            ? "var(--color-app-danger)"
                            : p === "low"
                              ? "var(--color-app-canvas-2)"
                              : "var(--color-app-ink)"
                          : "var(--color-app-canvas-2)",
                        color: active
                          ? p === "low"
                            ? "var(--color-app-fg-soft)"
                            : "white"
                          : "var(--color-app-fg-soft)",
                        border: active
                          ? "none"
                          : "1px solid var(--color-app-edge)",
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
          <Field label="Assigned to">
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="block w-full rounded-md border px-3 py-2 text-[13px] outline-none"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                borderColor: "var(--color-app-edge)",
                backgroundColor: "var(--color-app-canvas-2)",
                color: "var(--color-app-ink)",
              }}
            >
              <option value={me.id}>
                {me.name} (you)
              </option>
              {activeMembers
                .filter((m) => m.id !== me.id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.role}
                  </option>
                ))}
            </select>
          </Field>
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
              className="rounded-md px-4 py-1.5 text-[12px] font-semibold"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                backgroundColor: "var(--color-app-ink)",
                color: "var(--color-app-ivory)",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? "Saving…" : "Save reminder"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span
        className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em]"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-fg-muted)",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
