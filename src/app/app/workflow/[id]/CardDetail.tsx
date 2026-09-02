"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BoardMember } from "./BoardCanvas";
import type { PreviewTask as CanvasTask } from "./CardPreview";

type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
  sortOrder: number;
};
type Checklist = {
  id: string;
  title: string;
  sortOrder: number;
  items: ChecklistItem[];
};
type FullTask = CanvasTask & { checklists: Checklist[] };

type ActivityEntry = {
  id: string;
  action: string;
  actorName: string;
  message: string;
  createdAt: string;
};

export default function CardDetail({
  taskId,
  members,
  lists,
  canEdit,
  onClose,
  onUpdated,
  onMove,
  onDeleted,
  onRequestDelete,
}: {
  taskId: string;
  members: BoardMember[];
  lists: { id: string; title: string }[];
  canEdit: boolean;
  onClose: () => void;
  onUpdated: (t: Partial<CanvasTask> & { id: string }) => void;
  onMove: (taskId: string, toListId: string) => void;
  onDeleted: () => void;
  onRequestDelete?: (target: {
    type: "task";
    id: string;
    name: string;
    hint?: string;
  }) => void;
}) {
  const router = useRouter();
  const [task, setTask] = useState<FullTask | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTask = useCallback(async () => {
    try {
      const res = await fetch(`/api/app/tasks/${taskId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't load");
        return;
      }
      setTask(data.task as FullTask);
      setActivity(data.activity as ActivityEntry[]);
      setError(null);
    } catch {
      setError("Network error.");
    }
  }, [taskId]);

  useEffect(() => {
    setLoading(true);
    fetchTask().finally(() => setLoading(false));
  }, [fetchTask]);

  /* ESC closes */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function patchTask(patch: Record<string, unknown>) {
    const res = await fetch(`/api/app/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      // Re-fetch to get the activity strip + assignee details synced
      await fetchTask();
      router.refresh();
    }
  }

  async function deleteTask() {
    if (!confirm(`Delete card "${task?.title}"?`)) return;
    const res = await fetch(`/api/app/tasks/${taskId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      onDeleted();
      router.refresh();
      return;
    }
    if (res.status === 403) {
      const data = await res.json().catch(() => null);
      if (data && data.code === "delete_request_required" && onRequestDelete) {
        onRequestDelete({
          type: "task",
          id: data.targetId,
          name: data.targetName,
          hint: data.error,
        });
        // Close the detail panel so the dialog has the spotlight
        onClose();
        return;
      }
    }
  }

  // Move the card to another list. Hands the move off to the canvas
  // (which owns the optimistic task state + the /move call) and reflects
  // it locally so the picker shows the new list immediately.
  function handleMove(toListId: string) {
    if (!task || task.listId === toListId) return;
    onMove(task.id, toListId);
    setTask((prev) => (prev ? { ...prev, listId: toListId } : prev));
  }

  async function addChecklist(title: string) {
    const res = await fetch(`/api/app/tasks/${taskId}/checklists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      await fetchTask();
    }
  }

  async function renameChecklist(clId: string, title: string) {
    const res = await fetch(
      `/api/app/tasks/${taskId}/checklists/${clId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      }
    );
    if (res.ok) await fetchTask();
  }

  async function deleteChecklist(clId: string) {
    if (!confirm("Remove this checklist?")) return;
    const res = await fetch(
      `/api/app/tasks/${taskId}/checklists/${clId}`,
      { method: "DELETE" }
    );
    if (res.ok) await fetchTask();
  }

  async function addItem(clId: string, text: string) {
    const res = await fetch(
      `/api/app/tasks/${taskId}/checklists/${clId}/items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }
    );
    if (res.ok) await fetchTask();
  }

  async function patchItem(
    clId: string,
    itemId: string,
    patch: Record<string, unknown>
  ) {
    const res = await fetch(
      `/api/app/tasks/${taskId}/checklists/${clId}/items/${itemId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }
    );
    if (res.ok) await fetchTask();
  }

  async function deleteItem(clId: string, itemId: string) {
    const res = await fetch(
      `/api/app/tasks/${taskId}/checklists/${clId}/items/${itemId}`,
      { method: "DELETE" }
    );
    if (res.ok) await fetchTask();
  }

  // Sync the canvas task summary when checklist changes happen
  useEffect(() => {
    if (!task) return;
    let totalItems = 0;
    let doneItems = 0;
    for (const c of task.checklists) {
      for (const it of c.items) {
        totalItems++;
        if (it.done) doneItems++;
      }
    }
    onUpdated({
      id: task.id,
      title: task.title,
      description: task.description,
      assignee: task.assignee,
      dueDate: task.dueDate,
      priority: task.priority,
      hasDescription: Boolean(task.description?.trim()),
      checklistSummary: {
        totalChecklists: task.checklists.length,
        totalItems,
        doneItems,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(10,17,36,0.45)" }}
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="fade-up-sm max-h-[90vh] w-full max-w-[680px] overflow-y-auto rounded-2xl"
        style={{
          backgroundColor: "var(--color-app-canvas)",
          boxShadow: "0 32px 64px -24px rgba(10,17,36,0.5)",
          animationDuration: "220ms",
        }}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div
              className="h-8 w-8 animate-spin rounded-full"
              style={{
                borderWidth: 3,
                borderStyle: "solid",
                borderColor: "var(--color-app-edge)",
                borderTopColor: "var(--color-app-copper)",
              }}
            />
          </div>
        ) : !task ? (
          <div className="p-8">
            <p
              className="text-[13px]"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                color: "var(--color-app-fg-muted)",
              }}
            >
              {error ?? "Couldn't load this card."}
            </p>
          </div>
        ) : (
          <div className="px-7 py-6">
            <Header
              task={task}
              canEdit={canEdit}
              onRename={(title) => patchTask({ title })}
              onDelete={deleteTask}
              onClose={onClose}
            />

            {/* Quick row: list · assignee · due · priority */}
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ListPicker
                value={task.listId}
                lists={lists}
                disabled={!canEdit}
                onChange={handleMove}
              />
              <AssigneePicker
                value={task.assignee?.id ?? null}
                members={members}
                disabled={!canEdit}
                onChange={(uid) =>
                  patchTask({ assignedToUserId: uid })
                }
              />
              <DueDatePicker
                value={task.dueDate}
                disabled={!canEdit}
                onChange={(iso) => patchTask({ dueDate: iso })}
              />
              <PriorityPicker
                value={task.priority}
                disabled={!canEdit}
                onChange={(p) => patchTask({ priority: p })}
              />
            </div>

            {/* Description */}
            <Section title="Description">
              <DescriptionEditor
                value={task.description}
                disabled={!canEdit}
                onSave={(v) => patchTask({ description: v })}
              />
            </Section>

            {/* Checklists */}
            <Section
              title={`Checklists${
                task.checklists.length > 0
                  ? ` · ${task.checklists.length}`
                  : ""
              }`}
              right={
                canEdit ? (
                  <NewChecklistButton onAdd={addChecklist} />
                ) : null
              }
            >
              {task.checklists.length === 0 ? (
                <p
                  className="text-[12px]"
                  style={{
                    fontFamily: "var(--font-manrope), sans-serif",
                    color: "var(--color-app-fg-muted)",
                    fontStyle: "italic",
                  }}
                >
                  No checklists yet — add one to break this card into rows of
                  work.
                </p>
              ) : (
                <div className="space-y-5">
                  {task.checklists.map((cl) => (
                    <ChecklistBlock
                      key={cl.id}
                      checklist={cl}
                      canEdit={canEdit}
                      onRename={(title) => renameChecklist(cl.id, title)}
                      onDelete={() => deleteChecklist(cl.id)}
                      onAddItem={(text) => addItem(cl.id, text)}
                      onItemPatch={(itemId, patch) =>
                        patchItem(cl.id, itemId, patch)
                      }
                      onItemDelete={(itemId) => deleteItem(cl.id, itemId)}
                    />
                  ))}
                </div>
              )}
            </Section>

            {/* Activity strip */}
            <Section title="Activity">
              {activity.length === 0 ? (
                <p
                  className="text-[12px]"
                  style={{
                    fontFamily: "var(--font-manrope), sans-serif",
                    color: "var(--color-app-fg-muted)",
                  }}
                >
                  No history yet on this card.
                </p>
              ) : (
                <ul className="space-y-3">
                  {activity.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-start gap-3 text-[12px]"
                    >
                      <span
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold"
                        style={{
                          fontFamily:
                            "var(--font-crimson), Georgia, serif",
                          backgroundColor: "var(--color-app-ink)",
                          color: "var(--color-app-ivory)",
                        }}
                        title={a.actorName}
                      >
                        {initials(a.actorName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div
                          style={{
                            fontFamily: "var(--font-manrope), sans-serif",
                            color: "var(--color-app-ink)",
                          }}
                          dangerouslySetInnerHTML={{
                            __html: renderMessage(a.actorName, a.message),
                          }}
                        />
                        <div
                          className="mt-0.5 text-[10px]"
                          style={{
                            fontFamily:
                              "var(--font-dm-mono), monospace",
                            color: "var(--color-app-fg-muted)",
                            letterSpacing: 0.3,
                          }}
                        >
                          {fmtRelative(a.createdAt)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}
      </aside>
    </div>
  );
}

/* ─── Header ─── */

function Header({
  task,
  canEdit,
  onRename,
  onDelete,
  onClose,
}: {
  task: FullTask;
  canEdit: boolean;
  onRename: (title: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);

  useEffect(() => setTitle(task.title), [task.title]);

  function save() {
    setEditing(false);
    if (title.trim() && title.trim() !== task.title) {
      onRename(title.trim());
    } else {
      setTitle(task.title);
    }
  }

  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        {editing ? (
          <textarea
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                save();
              }
              if (e.key === "Escape") {
                setTitle(task.title);
                setEditing(false);
              }
            }}
            rows={1}
            className="w-full resize-none rounded bg-transparent px-2 py-1 text-[26px] font-semibold leading-[1.15] tracking-tight outline-none"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
              border: "1px solid var(--color-app-copper)",
            }}
          />
        ) : (
          <button
            onClick={() => canEdit && setEditing(true)}
            className="block w-full text-left text-[26px] font-semibold leading-[1.15] tracking-tight"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            {task.title}
          </button>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {canEdit ? (
          <button
            onClick={onDelete}
            aria-label="Delete card"
            title="Delete card"
            className="flex h-8 w-8 items-center justify-center rounded-md transition-colors"
            style={{ color: "var(--color-app-danger)" }}
          >
            <TrashIcon />
          </button>
        ) : null}
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-app-canvas-2)]"
          style={{ color: "var(--color-app-fg-muted)" }}
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

/* ─── Section ─── */

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-7">
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-[10px] uppercase tracking-[0.18em]"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            color: "var(--color-app-copper-deep)",
            fontWeight: 600,
          }}
        >
          {title}
        </h3>
        {right}
      </div>
      {children}
    </div>
  );
}

/* ─── Field pickers ─── */

// Move-to-list. The chambers wanted a second way to move a card besides
// drag-and-drop: open the card, pick a list, it moves there.
function ListPicker({
  value,
  lists,
  disabled,
  onChange,
}: {
  value: string;
  lists: { id: string; title: string }[];
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <label
        className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-copper-deep)",
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Move to list
      </label>
      <div className="relative mt-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-label="Move card to list"
          className="block w-full cursor-pointer appearance-none rounded-md border px-3 py-2 text-[13px] outline-none transition-colors"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            borderColor: "var(--color-app-copper)",
            backgroundColor: "var(--color-app-paper)",
            color: "var(--color-app-ink)",
            paddingRight: 32,
          }}
        >
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function AssigneePicker({
  value,
  members,
  disabled,
  onChange,
}: {
  value: string | null;
  members: BoardMember[];
  disabled: boolean;
  onChange: (id: string | null) => void;
}) {
  const current = members.find((m) => m.id === value) || null;
  return (
    <div>
      <label
        className="text-[10px] font-semibold uppercase tracking-[0.18em]"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-fg-muted)",
        }}
      >
        Assignee
      </label>
      <div className="relative mt-2">
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
          className="block w-full appearance-none rounded-md border px-3 py-2 text-[13px] outline-none transition-colors"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            borderColor: "var(--color-app-edge)",
            backgroundColor: "var(--color-app-paper)",
            color: current
              ? "var(--color-app-ink)"
              : "var(--color-app-fg-muted)",
            paddingRight: 32,
          }}
        >
          <option value="">— Unassigned —</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function DueDatePicker({
  value,
  disabled,
  onChange,
}: {
  value: string | null;
  disabled: boolean;
  onChange: (iso: string | null) => void;
}) {
  const dateOnly = value ? value.slice(0, 10) : "";
  return (
    <div>
      <label
        className="text-[10px] font-semibold uppercase tracking-[0.18em]"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-fg-muted)",
        }}
      >
        Due date
      </label>
      <div className="relative mt-2 flex items-center gap-2">
        <input
          type="date"
          value={dateOnly}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v ? new Date(`${v}T00:00:00`).toISOString() : null);
          }}
          disabled={disabled}
          className="block flex-1 rounded-md border px-3 py-2 text-[13px] outline-none transition-colors"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            borderColor: "var(--color-app-edge)",
            backgroundColor: "var(--color-app-paper)",
            color: "var(--color-app-ink)",
          }}
        />
        {value ? (
          <button
            onClick={() => onChange(null)}
            disabled={disabled}
            aria-label="Clear due date"
            className="text-[10px] uppercase"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-muted)",
              letterSpacing: 1.2,
            }}
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PriorityPicker({
  value,
  disabled,
  onChange,
}: {
  value: "low" | "medium" | "high" | null;
  disabled: boolean;
  onChange: (p: "low" | "medium" | "high" | null) => void;
}) {
  // A single compact dropdown with a colour dot — far less congested than
  // four squeezed-in buttons, and it sits neatly in the quick-row grid.
  const color =
    value === "high"
      ? "var(--color-app-danger)"
      : value === "medium"
        ? "var(--color-app-copper-deep)"
        : value === "low"
          ? "var(--color-app-aqua)"
          : "var(--color-app-edge)";
  return (
    <div>
      <label
        htmlFor="card-priority"
        className="text-[10px] font-semibold uppercase tracking-[0.18em]"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-fg-muted)",
        }}
      >
        Priority
      </label>
      <div className="relative mt-2">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full"
          style={{
            backgroundColor: color,
            boxShadow: value ? `0 0 0 3px ${color}22` : "none",
          }}
        />
        <select
          id="card-priority"
          value={value ?? ""}
          disabled={disabled}
          onChange={(e) =>
            onChange(
              (e.target.value || null) as "low" | "medium" | "high" | null
            )
          }
          className="block w-full cursor-pointer appearance-none rounded-md border py-2 pl-8 pr-9 text-[13px] outline-none transition-colors disabled:cursor-not-allowed"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            borderColor: "var(--color-app-edge)",
            backgroundColor: "var(--color-app-paper)",
            color: value
              ? "var(--color-app-ink)"
              : "var(--color-app-fg-muted)",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <option value="">No priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <span
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--color-app-fg-muted)" }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </div>
  );
}

/* ─── Description ─── */

function DescriptionEditor({
  value,
  disabled,
  onSave,
}: {
  value: string;
  disabled: boolean;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);

  useEffect(() => setDraft(value), [value]);

  function save() {
    setEditing(false);
    if (draft !== value) onSave(draft);
  }

  if (!editing) {
    return (
      <button
        onClick={() => !disabled && setEditing(true)}
        className="block w-full rounded-md px-4 py-3 text-left text-[13px] leading-[1.6] transition-colors"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          backgroundColor: "var(--color-app-paper)",
          boxShadow: "0 1px 0 var(--color-app-edge)",
          color: value ? "var(--color-app-fg-soft)" : "var(--color-app-fg-muted)",
          fontStyle: value ? "normal" : "italic",
          whiteSpace: "pre-wrap",
        }}
      >
        {value || "Click to add a description…"}
      </button>
    );
  }

  return (
    <div>
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={6}
        className="block w-full rounded-md border px-3.5 py-2.5 text-[13px] leading-[1.6] outline-none resize-y"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          borderColor: "var(--color-app-copper)",
          backgroundColor: "var(--color-app-paper)",
          color: "var(--color-app-ink)",
          boxShadow: "0 0 0 3px rgba(197,133,58,0.15)",
        }}
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={save}
          className="rounded-md px-4 py-1.5 text-[12px] font-semibold"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            backgroundColor: "var(--color-app-copper)",
            color: "var(--color-app-copper-text)",
          }}
        >
          Save
        </button>
        <button
          onClick={() => {
            setDraft(value);
            setEditing(false);
          }}
          className="rounded-md px-4 py-1.5 text-[12px]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-fg-muted)",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ─── Checklist block ─── */

function ChecklistBlock({
  checklist,
  canEdit,
  onRename,
  onDelete,
  onAddItem,
  onItemPatch,
  onItemDelete,
}: {
  checklist: Checklist;
  canEdit: boolean;
  onRename: (title: string) => void;
  onDelete: () => void;
  onAddItem: (text: string) => void;
  onItemPatch: (itemId: string, patch: Record<string, unknown>) => void;
  onItemDelete: (itemId: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(checklist.title);
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState("");

  const total = checklist.items.length;
  const done = checklist.items.filter((i) => i.done).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  function saveTitle() {
    setRenaming(false);
    if (title.trim() && title !== checklist.title) onRename(title.trim());
    else setTitle(checklist.title);
  }

  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: "var(--color-app-paper)",
        boxShadow: "0 1px 0 var(--color-app-edge)",
      }}
    >
      <div className="flex items-center gap-2">
        {renaming ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveTitle();
              if (e.key === "Escape") {
                setTitle(checklist.title);
                setRenaming(false);
              }
            }}
            className="flex-1 rounded bg-transparent px-1 text-[14px] font-semibold outline-none"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
              border: "1px solid var(--color-app-copper)",
            }}
          />
        ) : (
          <button
            onClick={() => canEdit && setRenaming(true)}
            className="flex-1 text-left text-[14px] font-semibold"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            {checklist.title}
          </button>
        )}
        <span
          className="text-[10px] tabular-nums"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            color: "var(--color-app-fg-muted)",
          }}
        >
          {done}/{total}
        </span>
        {canEdit ? (
          <button
            onClick={onDelete}
            aria-label="Remove checklist"
            className="text-[10px] uppercase"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-muted)",
              letterSpacing: 1.2,
            }}
          >
            Remove
          </button>
        ) : null}
      </div>

      {/* Progress bar */}
      <div
        className="mt-2 h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: "var(--color-app-canvas-2)" }}
      >
        <div
          className="h-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor:
              pct === 100
                ? "var(--color-app-aqua)"
                : "var(--color-app-copper)",
          }}
        />
      </div>

      {/* Items */}
      <ul className="mt-3 space-y-1.5">
        {checklist.items
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((it) => (
            <ChecklistItemRow
              key={it.id}
              item={it}
              canEdit={canEdit}
              onToggle={() =>
                onItemPatch(it.id, { done: !it.done })
              }
              onRename={(text) => onItemPatch(it.id, { text })}
              onDelete={() => onItemDelete(it.id)}
            />
          ))}
      </ul>

      {/* Add item */}
      {canEdit ? (
        adding ? (
          <div className="mt-2 flex items-center gap-2">
            <input
              autoFocus
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (newItem.trim()) onAddItem(newItem.trim());
                  setNewItem("");
                }
                if (e.key === "Escape") {
                  setAdding(false);
                  setNewItem("");
                }
              }}
              placeholder="Add an item, press Enter to commit"
              className="flex-1 rounded-md border px-3 py-1.5 text-[13px] outline-none"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                borderColor: "var(--color-app-copper)",
                backgroundColor: "var(--color-app-paper)",
                color: "var(--color-app-ink)",
                boxShadow: "0 0 0 3px rgba(197,133,58,0.12)",
              }}
            />
            <button
              onClick={() => {
                setAdding(false);
                setNewItem("");
              }}
              className="text-[10px] uppercase"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                color: "var(--color-app-fg-muted)",
                letterSpacing: 1.2,
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-2 inline-flex items-center gap-1.5 text-[12px]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-copper-deep)",
              fontWeight: 600,
            }}
          >
            + Add item
          </button>
        )
      ) : null}
    </div>
  );
}

function ChecklistItemRow({
  item,
  canEdit,
  onToggle,
  onRename,
  onDelete,
}: {
  item: ChecklistItem;
  canEdit: boolean;
  onToggle: () => void;
  onRename: (text: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);
  useEffect(() => setText(item.text), [item.text]);
  return (
    <li className="group flex items-center gap-2.5">
      <button
        onClick={() => canEdit && onToggle()}
        disabled={!canEdit}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors"
        style={{
          backgroundColor: item.done
            ? "var(--color-app-aqua)"
            : "transparent",
          border: item.done
            ? "1px solid var(--color-app-aqua)"
            : "1.5px solid var(--color-app-edge)",
          color: "white",
        }}
        aria-label={item.done ? "Mark incomplete" : "Mark complete"}
      >
        {item.done ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12l5 5L20 7"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </button>
      {editing ? (
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (text.trim() && text !== item.text) onRename(text.trim());
            else setText(item.text);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setEditing(false);
              if (text.trim() && text !== item.text) onRename(text.trim());
            }
            if (e.key === "Escape") {
              setEditing(false);
              setText(item.text);
            }
          }}
          className="flex-1 rounded bg-transparent px-1 py-0.5 text-[13px] outline-none"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-ink)",
            border: "1px solid var(--color-app-copper)",
          }}
        />
      ) : (
        <button
          onClick={() => canEdit && setEditing(true)}
          className="flex-1 text-left text-[13px] leading-[1.4]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: item.done
              ? "var(--color-app-fg-muted)"
              : "var(--color-app-ink)",
            textDecoration: item.done ? "line-through" : "none",
          }}
        >
          {item.text}
        </button>
      )}
      {canEdit ? (
        <button
          onClick={onDelete}
          aria-label="Delete item"
          className="opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: "var(--color-app-fg-muted)" }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 6l12 12M6 18L18 6"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </button>
      ) : null}
    </li>
  );
}

function NewChecklistButton({
  onAdd,
}: {
  onAdd: (title: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="rounded-md border px-3 py-1 text-[11px] font-semibold uppercase"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          letterSpacing: 1.2,
          borderColor: "var(--color-app-edge)",
          color: "var(--color-app-copper-deep)",
        }}
      >
        + Add checklist
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (title.trim()) onAdd(title.trim());
            setTitle("");
            setAdding(false);
          }
          if (e.key === "Escape") {
            setAdding(false);
            setTitle("");
          }
        }}
        placeholder="Checklist title"
        className="rounded border px-2 py-1 text-[12px] outline-none"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          borderColor: "var(--color-app-copper)",
          backgroundColor: "var(--color-app-paper)",
        }}
      />
      <button
        onClick={() => {
          setAdding(false);
          setTitle("");
        }}
        className="text-[10px] uppercase"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-fg-muted)",
          letterSpacing: 1.2,
        }}
      >
        Cancel
      </button>
    </div>
  );
}

/* ─── Helpers ─── */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function fmtRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) {
    const m = Math.floor(diff / 60_000);
    return `${m} min${m === 1 ? "" : "s"} ago`;
  }
  if (diff < 86_400_000) {
    const h = Math.floor(diff / 3_600_000);
    return `${h} hr${h === 1 ? "" : "s"} ago`;
  }
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Render the activity message with **bold** segments resolved to <strong>.
// Sanitised — only allows the bold span; everything else is escaped.
function renderMessage(actor: string, message: string): string {
  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const safeMsg = escape(message).replace(
    /\*\*([^*]+)\*\*/g,
    (_, inner) =>
      `<strong style="color:var(--color-app-ink);font-weight:600">${inner}</strong>`
  );
  return `<span style="color:var(--color-app-ink);font-weight:600">${escape(actor)}</span> ${safeMsg}`;
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M6 18L18 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
