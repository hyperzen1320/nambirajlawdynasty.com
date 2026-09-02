"use client";

import { useState, useRef, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import CardPreview, { type PreviewTask } from "./CardPreview";

// A single board list, rendered as a FIXED Trello-style column. Lists no
// longer live on a free canvas — the board lays them out left-to-right in
// sortOrder and scrolls horizontally — so this component is a plain column
// (no React Flow node wrapper, no drag handle). Cards inside it are still
// drag-sortable via @dnd-kit, exactly as before. The column caps its height
// to the board and scrolls its card area internally when a list is long.

export const COLUMN_WIDTH = 300;

export type ListColumnProps = {
  list: {
    id: string;
    title: string;
    description: string;
    listDate: string;
    sortOrder: number;
    width: number;
    color: string | null;
  };
  tasks: PreviewTask[];
  accent: string;
  canEdit: boolean;
  onTaskClick: (id: string) => void;
  onListRename: (listId: string, title: string) => void;
  onListDelete: (listId: string) => void;
  onListDescriptionChange: (listId: string, description: string) => void;
  onListDateChange: (listId: string, listDate: string) => void;
  onTaskAdd: (listId: string, title: string) => void;
};

export default function ListColumn({
  list,
  tasks,
  accent,
  canEdit,
  onTaskClick,
  onListRename,
  onListDelete,
  onListDescriptionChange,
  onListDateChange,
  onTaskAdd,
}: ListColumnProps) {
  const droppable = useDroppable({
    id: `list-drop:${list.id}`,
    data: { type: "list", listId: list.id },
  });

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [menu, setMenu] = useState(false);
  useEffect(() => setTitle(list.title), [list.title]);

  function commitTitle() {
    setEditing(false);
    if (title.trim() && title.trim() !== list.title) {
      onListRename(list.id, title.trim());
    } else {
      setTitle(list.title);
    }
  }

  function commitAddCard() {
    if (newTitle.trim()) {
      onTaskAdd(list.id, newTitle.trim());
      setNewTitle("");
    } else {
      setAdding(false);
    }
  }

  const stripeColor = list.color || accent;
  // Lists with a tmp:* id are still being saved server-side. We mark them
  // so the global pending styles (dim + blinking dot) apply.
  const isPending = list.id.startsWith("tmp:");

  return (
    <div
      className="relative flex shrink-0 flex-col"
      data-le-id={list.id}
      data-le-pending={isPending ? "true" : undefined}
      style={{
        width: COLUMN_WIDTH,
        maxHeight: "100%",
        backgroundColor: "rgba(252, 251, 249, 0.92)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderRadius: 14,
        boxShadow:
          "0 14px 34px -16px rgba(10,17,36,0.22), 0 2px 6px -3px rgba(10,17,36,0.08)",
        border: "1px solid rgba(10,17,36,0.05)",
        // overflow stays VISIBLE so the list-menu dropdown can escape the
        // wrapper; the top accent stripe self-clips via its own radii.
        overflow: "visible",
      }}
    >
      {/* Top stripe */}
      <div
        style={{
          height: 4,
          flexShrink: 0,
          background: `linear-gradient(90deg, ${stripeColor}, ${stripeColor}cc)`,
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
        }}
      />

      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 px-4 pt-3 pb-2">
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitTitle();
              }
              if (e.key === "Escape") {
                setTitle(list.title);
                setEditing(false);
              }
            }}
            className="flex-1 rounded bg-transparent px-1 text-[16px] font-semibold outline-none"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
              border: `1px solid ${stripeColor}`,
            }}
          />
        ) : (
          <button
            onClick={() => {
              if (canEdit) setEditing(true);
            }}
            className="flex-1 text-left text-[16px] font-semibold tracking-tight"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            {list.title}
          </button>
        )}
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            color: stripeColor,
            backgroundColor: `${stripeColor}1a`,
            letterSpacing: 0.5,
            minWidth: 22,
            textAlign: "center",
          }}
        >
          {tasks.length}
        </span>
        {canEdit ? (
          <ListMenu
            description={list.description}
            listDate={list.listDate}
            open={menu}
            onOpen={() => setMenu(true)}
            onClose={() => setMenu(false)}
            onRename={() => {
              setMenu(false);
              setEditing(true);
            }}
            onDescriptionChange={(d) => onListDescriptionChange(list.id, d)}
            onDateChange={(d) => onListDateChange(list.id, d)}
            onDelete={() => {
              setMenu(false);
              if (
                confirm(
                  `Delete list "${list.title}"? All ${tasks.length} card${tasks.length === 1 ? "" : "s"} in this list will be removed too.`
                )
              ) {
                onListDelete(list.id);
              }
            }}
          />
        ) : null}
      </div>

      {/* Card area — flexes to fill the column and scrolls internally when a
          list grows tall, so the board itself stays one tidy row. */}
      <div
        ref={droppable.setNodeRef}
        className="min-h-0 flex-1 overflow-y-auto"
        style={{
          padding: "4px 8px 8px",
          backgroundColor: droppable.isOver
            ? `${stripeColor}10`
            : "transparent",
          transition: "background-color 200ms",
        }}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {tasks.map((t) => (
              <SortableCard
                key={t.id}
                task={t}
                accent={stripeColor}
                onClick={() => onTaskClick(t.id)}
              />
            ))}
            {tasks.length === 0 && !adding ? (
              <div
                className="flex flex-col items-center justify-center rounded-md py-6 text-center"
                style={{ border: "1px dashed var(--color-app-edge)" }}
              >
                <span
                  className="text-[10px] uppercase tracking-[0.22em]"
                  style={{
                    fontFamily: "var(--font-dm-mono), monospace",
                    color: "var(--color-app-fg-muted)",
                  }}
                >
                  {droppable.isOver ? "Drop here" : "Empty"}
                </span>
              </div>
            ) : null}
          </div>
        </SortableContext>
      </div>

      {/* Add card composer */}
      {canEdit ? (
        <div className="shrink-0 px-2 pb-3">
          {adding ? (
            <div
              className="rounded-md p-2"
              style={{
                backgroundColor: "var(--color-app-paper)",
                boxShadow: `0 0 0 2px ${stripeColor}40`,
              }}
            >
              <textarea
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    commitAddCard();
                  }
                  if (e.key === "Escape") {
                    setAdding(false);
                    setNewTitle("");
                  }
                }}
                placeholder="Title of this card…"
                rows={2}
                className="block w-full resize-none rounded bg-transparent px-2 py-1.5 text-[13px] outline-none"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  color: "var(--color-app-ink)",
                }}
              />
              <div className="mt-1.5 flex items-center gap-2">
                <button
                  onClick={commitAddCard}
                  className="rounded-md px-3 py-1 text-[11px] font-semibold"
                  style={{
                    fontFamily: "var(--font-manrope), sans-serif",
                    backgroundColor: stripeColor,
                    color: stripeColor === "#ac7b33" ? "#2a1c08" : "#ffffff",
                  }}
                >
                  Add card
                </button>
                <button
                  onClick={() => {
                    setAdding(false);
                    setNewTitle("");
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
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex w-full items-center gap-1.5 rounded-md px-3 py-2 text-left text-[12px] transition-colors"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                color: "var(--color-app-fg-muted)",
                backgroundColor: "transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  "var(--color-app-canvas-2)";
                e.currentTarget.style.color = "var(--color-app-ink)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "var(--color-app-fg-muted)";
              }}
            >
              <span aria-hidden style={{ fontSize: 14 }}>
                +
              </span>
              Add a card
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ─── Sortable card wrapper (lives inside the list) ─── */

function SortableCard({
  task,
  accent,
  onClick,
}: {
  task: PreviewTask;
  accent: string;
  onClick: () => void;
}) {
  const sortable = useSortable({
    id: task.id,
    data: { type: "task", taskId: task.id, listId: task.listId },
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : 1,
  };
  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      {...sortable.attributes}
      {...sortable.listeners}
    >
      <CardPreview task={task} onClick={onClick} accent={accent} />
    </div>
  );
}

/* ─── List menu (the ⋮ popup) ─── */

function ListMenu({
  description,
  listDate,
  open,
  onOpen,
  onClose,
  onRename,
  onDescriptionChange,
  onDateChange,
  onDelete,
}: {
  description: string;
  listDate: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onRename: () => void;
  onDescriptionChange: (description: string) => void;
  onDateChange: (listDate: string) => void;
  onDelete: () => void;
}) {
  // Local drafts for date + description. Nothing is persisted until the
  // user hits Save — clicking outside (or the overlay) just closes and
  // discards the draft. Re-sync from props whenever the popup (re)opens or
  // a collaborator's edit arrives via the live feed.
  const [descDraft, setDescDraft] = useState(description);
  const dateValue = listDate ? listDate.slice(0, 10) : "";
  const [dateDraft, setDateDraft] = useState(dateValue);
  const btnRef = useRef<HTMLButtonElement>(null);
  // The panel is rendered fixed-position, anchored to the ⋮ button, so the
  // board's horizontal-scroll container can never clip it (it flips above
  // the button when there isn't room below).
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    setDescDraft(description);
    setDateDraft(listDate ? listDate.slice(0, 10) : "");
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const W = 252;
      const H = 360;
      let top = r.bottom + 6;
      if (top + H > window.innerHeight - 8) {
        top = Math.max(8, r.top - H - 6); // no room below — flip up
      }
      const left = Math.max(
        8,
        Math.min(r.right - W, window.innerWidth - W - 8)
      );
      setPos({ top, left });
    }
  }, [open, description, listDate]);

  function save() {
    if (dateDraft && dateDraft !== dateValue) onDateChange(dateDraft);
    if (descDraft.trim() !== (description || "").trim()) {
      onDescriptionChange(descDraft.trim());
    }
    onClose();
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => (open ? onClose() : onOpen())}
        className="flex h-7 w-7 items-center justify-center rounded transition-colors"
        style={{ color: "var(--color-app-fg-muted)" }}
        aria-label="List menu"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="6" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="18" cy="12" r="1.6" />
        </svg>
      </button>
      {open && pos ? (
        <>
          {/* Click-out scrim — any click outside the panel closes it. */}
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div
            className="fixed z-50 w-[252px] rounded-lg p-2"
            style={{
              top: pos.top,
              left: pos.left,
              maxHeight: "calc(100vh - 16px)",
              overflowY: "auto",
              backgroundColor: "var(--color-app-paper)",
              boxShadow:
                "0 16px 32px -10px rgba(10,17,36,0.25), 0 0 0 1px var(--color-app-edge)",
            }}
          >
            {/* Edit name */}
            <button
              onClick={onRename}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] rounded transition-colors"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                color: "var(--color-app-ink)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "var(--color-app-canvas-2)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
            >
              <span>Edit name</span>
              <PencilGlyph />
            </button>

            {/* Date */}
            <div className="px-3 pt-2">
              <label
                className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  color: "var(--color-app-fg-muted)",
                }}
              >
                Date
              </label>
              <input
                type="date"
                value={dateDraft}
                onChange={(e) => setDateDraft(e.target.value)}
                className="mt-1.5 block w-full rounded-md border px-2.5 py-1.5 text-[12.5px] outline-none"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  borderColor: "var(--color-app-edge)",
                  backgroundColor: "var(--color-app-paper)",
                  color: "var(--color-app-ink)",
                }}
              />
            </div>

            {/* Description */}
            <div className="px-3 pt-2.5">
              <label
                className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  color: "var(--color-app-fg-muted)",
                }}
              >
                Description
              </label>
              <textarea
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                placeholder="What goes in this list?"
                rows={3}
                className="mt-1.5 block w-full resize-none rounded-md border px-2.5 py-1.5 text-[12.5px] leading-[1.5] outline-none"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  borderColor: "var(--color-app-edge)",
                  backgroundColor: "var(--color-app-paper)",
                  color: "var(--color-app-ink)",
                }}
              />
            </div>

            {/* Save — persists the date + description and closes. */}
            <div className="px-3 pt-2.5">
              <button
                onClick={save}
                className="w-full rounded-md px-3 py-2 text-[12px] font-semibold transition-transform hover:-translate-y-0.5"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  backgroundColor: "var(--color-app-copper)",
                  color: "var(--color-app-copper-text)",
                }}
              >
                Save
              </button>
            </div>

            <div
              className="my-1.5 mx-1 border-t"
              style={{ borderColor: "var(--color-app-edge-soft)" }}
            />
            <button
              onClick={onDelete}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] rounded transition-colors"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                color: "var(--color-app-danger)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "var(--color-app-danger-soft)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
            >
              Delete list
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function PencilGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ color: "var(--color-app-fg-muted)" }}
    >
      <path
        d="M4 20h4l10-10-4-4L4 16v4z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M14 6l4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
