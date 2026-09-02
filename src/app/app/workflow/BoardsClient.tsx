"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { BOARD_COLOR_STYLES, BOARD_COLORS } from "@/lib/board-defaults";
import type { BoardColor } from "@/models/Board";
import RequestDeleteDialog from "@/app/app/workflow/[id]/RequestDeleteDialog";

export type BoardRow = {
  id: string;
  title: string;
  description: string;
  color: BoardColor;
  isSeeded: boolean;
  cardCount: number;
  updatedAt: string;
  createdAt: string;
};

export default function BoardsClient({
  initialBoards,
  isAdmin,
}: {
  initialBoards: BoardRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [boards, setBoards] = useState<BoardRow[]>(initialBoards);
  const [sort, setSort] = useState<"recent" | "name" | "created">("recent");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  // When set, the create/edit form opens prefilled in edit mode for this
  // board instead of creating a new one.
  const [editingBoard, setEditingBoard] = useState<BoardRow | null>(null);

  function handleUpdated(b: BoardRow) {
    setBoards((prev) => prev.map((x) => (x.id === b.id ? { ...x, ...b } : x)));
    setEditingBoard(null);
    router.refresh();
  }

  function handleDeleted(id: string) {
    setBoards((prev) => prev.filter((x) => x.id !== id));
    router.refresh();
  }

  const sorted = useMemo(() => {
    const list = [...boards];
    if (sort === "name") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === "created") {
      list.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } else {
      list.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }
    return list;
  }, [boards, sort]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        (b.description || "").toLowerCase().includes(q)
    );
  }, [sorted, query]);

  function handleAdded(b: BoardRow) {
    setBoards((prev) => [b, ...prev]);
    setAdding(false);
  }

  return (
    <>
      {/* Header */}
      <div>
        <h2
          className="text-[30px] font-semibold tracking-tight leading-[1.1] sm:text-[40px]"
          style={{
            fontFamily: "var(--font-crimson), Georgia, serif",
            color: "var(--color-app-ink)",
          }}
        >
          Work Flow
        </h2>
        <p
          className="mt-2 text-[13px]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-fg-muted)",
          }}
        >
          Trello-style boards for office processes — new suits, notices,
          follow-ups, instructions and more.
        </p>
      </div>

      {/* Controls strip */}
      <div className="mt-7 grid gap-4 md:grid-cols-[1fr_1fr_2fr]">
        <Select
          label="Sort by"
          value={sort}
          onChange={(v) => setSort(v as typeof sort)}
          options={[
            { value: "recent", label: "Most recently active" },
            { value: "name", label: "Alphabetical" },
            { value: "created", label: "Recently created" },
          ]}
        />
        <Select
          label="Filter by"
          value=""
          onChange={() => {}}
          disabled
          options={[{ value: "", label: "Choose a collection" }]}
        />
        <SearchInput
          label="Search"
          value={query}
          onChange={setQuery}
          placeholder="Search boards"
        />
      </div>

      {/* Add / Edit form */}
      {adding || editingBoard ? (
        <div className="mt-6 fade-up-sm">
          <CreateBoardForm
            board={editingBoard}
            onCancel={() => {
              setAdding(false);
              setEditingBoard(null);
            }}
            onSaved={editingBoard ? handleUpdated : handleAdded}
          />
        </div>
      ) : null}

      {/* Grid */}
      <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {!adding && !editingBoard ? (
          <CreateTile onClick={() => setAdding(true)} />
        ) : null}
        {filtered.map((b, i) => (
          <BoardTile
            key={b.id}
            board={b}
            index={i}
            isAdmin={isAdmin}
            onEdit={() => {
              setAdding(false);
              setEditingBoard(b);
            }}
            onDeleted={handleDeleted}
          />
        ))}
        {filtered.length === 0 && query ? (
          <div
            className="md:col-span-2 lg:col-span-3 rounded-xl px-5 py-12 text-center"
            style={{
              backgroundColor: "var(--color-app-paper)",
              border: "1px dashed var(--color-app-edge)",
            }}
          >
            <p
              className="text-[14px]"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                color: "var(--color-app-fg-muted)",
              }}
            >
              No boards match{" "}
              <span style={{ color: "var(--color-app-ink)", fontWeight: 600 }}>
                &ldquo;{query}&rdquo;
              </span>
              .
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}

/* ─── Tiles ─── */

function BoardTile({
  board,
  index,
  isAdmin,
  onEdit,
  onDeleted,
}: {
  board: BoardRow;
  index: number;
  isAdmin: boolean;
  onEdit: () => void;
  onDeleted: (id: string) => void;
}) {
  const router = useRouter();
  const styles = BOARD_COLOR_STYLES[board.color] ?? BOARD_COLOR_STYLES.copper;

  function open() {
    router.push(`/app/workflow/${board.id}`);
  }

  return (
    <div
      className="fade-up-sm rounded-2xl overflow-hidden"
      style={{
        animationDelay: `${Math.min(index, 12) * 35}ms`,
        boxShadow: "0 1px 0 var(--color-app-edge)",
      }}
    >
      <button
        onClick={open}
        className="group block w-full text-left transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg"
        style={{
          background: `linear-gradient(135deg, ${styles.gradient[0]}, ${styles.gradient[1]})`,
          minHeight: 120,
        }}
      >
        <div className="relative h-[120px] p-5">
          {/* Subtle accent dot top-left, like Confluence whiteboards */}
          <span
            className="absolute top-4 left-4 h-2 w-2 rounded-full opacity-80"
            style={{ backgroundColor: styles.accent }}
          />
          {/* Card count chip top-right */}
          {board.cardCount > 0 ? (
            <span
              className="absolute top-3 right-3 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                backgroundColor: "rgba(255,255,255,0.18)",
                color: styles.text,
                backdropFilter: "blur(6px)",
              }}
            >
              {board.cardCount} cards
            </span>
          ) : null}
        </div>
      </button>
      <div
        className="flex items-center justify-between gap-3 px-5 py-3.5"
        style={{ backgroundColor: "var(--color-app-paper)" }}
      >
        <div className="min-w-0">
          <h3
            className="text-[16px] font-semibold tracking-tight leading-tight"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            {board.title}
          </h3>
          {board.description ? (
            <p
              className="mt-0.5 text-[11px]"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                color: "var(--color-app-fg-muted)",
              }}
              title={board.description}
            >
              {board.description.length > 60
                ? `${board.description.slice(0, 60)}…`
                : board.description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <BoardMenu
            board={board}
            isAdmin={isAdmin}
            onEdit={onEdit}
            onDeleted={onDeleted}
          />
          <button
            onClick={open}
            aria-label={`Open ${board.title}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors"
            style={{
              backgroundColor: "var(--color-app-canvas-2)",
              color: "var(--color-app-copper-deep)",
            }}
          >
            <ArrowIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

// 3-dots menu on a board tile: Edit (opens the prefilled form up top) and
// Delete. Boards are consequential, so deletion is admin-direct (with a
// confirm) while everyone else routes through the delete-request flow.
function BoardMenu({
  board,
  isAdmin,
  onEdit,
  onDeleted,
}: {
  board: BoardRow;
  isAdmin: boolean;
  onEdit: () => void;
  onDeleted: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  // The dropdown is portaled to <body> (below) so it escapes the board
  // card's `overflow-hidden` (which clipped it) and the neighbouring cards'
  // stacking context (which painted over it). We measure the trigger on open
  // and position the menu `fixed`, right-aligned to the button.
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null
  );

  function openMenu() {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const width = 220;
      const left = Math.max(
        8,
        Math.min(r.right - width, window.innerWidth - width - 8)
      );
      setCoords({ top: r.bottom + 6, left });
    }
    setOpen(true);
  }

  // Close on scroll/resize so the fixed menu never drifts from its trigger.
  useEffect(() => {
    if (!open) return;
    const onMove = () => {
      setOpen(false);
      setConfirming(false);
    };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  async function onDelete() {
    setError(null);
    setWorking(true);
    try {
      const res = await fetch(`/api/app/boards/${board.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.code === "delete_request_required") {
          setConfirming(false);
          setRequestOpen(true);
          setWorking(false);
          return;
        }
        setError(data?.error ?? "Couldn't delete this board.");
        setWorking(false);
        return;
      }
      onDeleted(board.id);
    } catch {
      setError("Network error.");
      setWorking(false);
    }
  }

  if (requestSent) {
    return (
      <span
        className="text-[11px]"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          color: "var(--color-app-aqua)",
        }}
      >
        Request sent
      </span>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        onClick={() => {
          if (open) {
            setOpen(false);
            setConfirming(false);
          } else {
            openMenu();
          }
        }}
        aria-label={`Manage ${board.title}`}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors"
        style={{
          backgroundColor: open
            ? "var(--color-app-canvas-2)"
            : "transparent",
          color: "var(--color-app-fg-muted)",
        }}
        onMouseEnter={(e) => {
          if (!open)
            e.currentTarget.style.backgroundColor = "var(--color-app-canvas-2)";
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="6" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="18" cy="12" r="1.6" />
        </svg>
      </button>

      {open && coords ? (
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[55]"
              onClick={() => {
                setOpen(false);
                setConfirming(false);
              }}
              aria-hidden
            />
            <div
              className="fixed z-[56] w-[220px] max-w-[calc(100vw-1rem)] rounded-lg p-2"
              style={{
                top: coords.top,
                left: coords.left,
                backgroundColor: "var(--color-app-paper)",
                boxShadow:
                  "0 16px 32px -10px rgba(10,17,36,0.25), 0 0 0 1px var(--color-app-edge)",
              }}
            >
          {confirming ? (
            <div className="px-2 py-1.5">
              <p
                className="text-[12px] leading-[1.5]"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  color: "var(--color-app-fg-soft)",
                }}
              >
                Delete{" "}
                <span
                  style={{ color: "var(--color-app-ink)", fontWeight: 600 }}
                >
                  {board.title}
                </span>
                ? Its lists and cards go too.
              </p>
              {error ? (
                <p
                  className="mt-2 text-[11px]"
                  style={{
                    fontFamily: "var(--font-manrope), sans-serif",
                    color: "var(--color-app-danger)",
                  }}
                >
                  {error}
                </p>
              ) : null}
              <div className="mt-3 flex justify-end gap-2">
                <button
                  onClick={() => setConfirming(false)}
                  disabled={working}
                  className="rounded-md border px-3 py-1.5 text-[12px] font-medium"
                  style={{
                    fontFamily: "var(--font-manrope), sans-serif",
                    borderColor: "var(--color-app-edge)",
                    color: "var(--color-app-fg-soft)",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={onDelete}
                  disabled={working}
                  className="rounded-md px-3 py-1.5 text-[12px] font-semibold"
                  style={{
                    fontFamily: "var(--font-manrope), sans-serif",
                    backgroundColor: "var(--color-app-danger)",
                    color: "white",
                    opacity: working ? 0.6 : 1,
                  }}
                >
                  {working ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-[13px] transition-colors"
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
                Edit board
              </button>
              <button
                onClick={() => {
                  if (isAdmin) {
                    setConfirming(true);
                  } else {
                    setOpen(false);
                    setRequestOpen(true);
                  }
                }}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-[13px] transition-colors"
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
                {isAdmin ? "Delete board" : "Request delete"}
              </button>
            </>
          )}
            </div>
          </>,
          document.body
        )
      ) : null}

      {requestOpen ? (
        <RequestDeleteDialog
          target={{
            type: "board",
            id: board.id,
            name: board.title,
            hint: "Only the office admin can delete a whole board.",
          }}
          onClose={() => setRequestOpen(false)}
          onSubmitted={() => {
            setRequestOpen(false);
            setRequestSent(true);
          }}
        />
      ) : null}
    </div>
  );
}

function CreateTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fade-up-sm group flex flex-col items-center justify-center rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
      style={{
        backgroundColor: "var(--color-app-paper)",
        border: "1.5px dashed var(--color-app-edge)",
        minHeight: 175,
      }}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full transition-colors"
        style={{
          backgroundColor: "var(--color-app-canvas-2)",
          color: "var(--color-app-copper-deep)",
        }}
      >
        <PlusIcon />
      </div>
      <span
        className="mt-3 text-[14px] font-semibold"
        style={{
          fontFamily: "var(--font-crimson), Georgia, serif",
          color: "var(--color-app-ink)",
        }}
      >
        Create new board
      </span>
      <span
        className="mt-1 text-[11px]"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          color: "var(--color-app-fg-muted)",
        }}
      >
        Pick a colour, give it a name
      </span>
    </button>
  );
}

/* ─── Create form ─── */

function CreateBoardForm({
  board,
  onCancel,
  onSaved,
}: {
  // null/undefined → create mode; a board → edit mode (PATCH + prefill).
  board?: BoardRow | null;
  onCancel: () => void;
  onSaved: (b: BoardRow) => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(board);
  const [title, setTitle] = useState(board?.title ?? "");
  const [description, setDescription] = useState(board?.description ?? "");
  const [color, setColor] = useState<BoardColor>(board?.color ?? "forest");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Board title is required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        isEdit ? `/api/app/boards/${board!.id}` : "/api/app/boards",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description, color }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save");
        setSubmitting(false);
        return;
      }
      if (isEdit) {
        // Preserve the tile's existing cardCount/createdAt — the PATCH
        // response zeroes cardCount since it doesn't recount.
        onSaved({
          ...board!,
          title: title.trim(),
          description: description.trim(),
          color,
        });
      } else {
        onSaved(data.board);
      }
      router.refresh();
    } catch {
      setError("Network error.");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="rounded-2xl p-6"
      style={{
        backgroundColor: "var(--color-app-paper)",
        boxShadow: "0 1px 0 var(--color-app-edge)",
        borderLeft: "3px solid var(--color-app-copper)",
      }}
    >
      <div
        className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-4"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-copper-deep)",
        }}
      >
        {isEdit ? "Edit board" : "New board"}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label
            className="text-[10px] font-semibold uppercase tracking-[0.22em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-muted)",
            }}
          >
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Cross-examinations"
            className="mt-2 block w-full rounded-md border px-3.5 py-2.5 text-[14px] outline-none transition-all"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              borderColor: "var(--color-app-edge)",
              backgroundColor: "var(--color-app-paper)",
              color: "var(--color-app-ink)",
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
        </div>
        <div>
          <label
            className="text-[10px] font-semibold uppercase tracking-[0.22em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-muted)",
            }}
          >
            Description
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What kind of work goes here?"
            className="mt-2 block w-full rounded-md border px-3.5 py-2.5 text-[14px] outline-none transition-all"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              borderColor: "var(--color-app-edge)",
              backgroundColor: "var(--color-app-paper)",
              color: "var(--color-app-ink)",
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
        </div>
      </div>

      <div className="mt-5">
        <label
          className="text-[10px] font-semibold uppercase tracking-[0.22em]"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            color: "var(--color-app-fg-muted)",
          }}
        >
          Colour
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {BOARD_COLORS.map((c) => {
            const styles = BOARD_COLOR_STYLES[c];
            const active = color === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={c}
                className="h-8 w-12 rounded-md transition-all"
                style={{
                  background: `linear-gradient(135deg, ${styles.gradient[0]}, ${styles.gradient[1]})`,
                  outline: active
                    ? "2px solid var(--color-app-copper)"
                    : "none",
                  outlineOffset: 2,
                  transform: active ? "scale(1.05)" : "scale(1)",
                }}
              />
            );
          })}
        </div>
      </div>

      {error ? (
        <p
          className="mt-3 text-[12px]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-danger)",
          }}
        >
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border px-5 py-2 text-[13px] font-medium transition-colors"
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
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-md px-5 py-2 text-[13px] font-semibold transition-all"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            backgroundColor: "var(--color-app-copper)",
            color: "var(--color-app-copper-text)",
            opacity: submitting ? 0.6 : 1,
            boxShadow: "0 6px 16px -10px rgba(197,133,58,0.55)",
          }}
        >
          {submitting
            ? isEdit
              ? "Saving…"
              : "Creating…"
            : isEdit
              ? "Save changes"
              : "Create Board"}
        </button>
      </div>
    </form>
  );
}

/* ─── Field helpers ─── */

function Select({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
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
      </label>
      <div className="relative mt-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="block w-full appearance-none rounded-md border px-3.5 py-2.5 text-[14px] outline-none transition-all"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            borderColor: "var(--color-app-edge)",
            backgroundColor: "var(--color-app-paper)",
            color: disabled
              ? "var(--color-app-fg-muted)"
              : "var(--color-app-ink)",
            paddingRight: 36,
            opacity: disabled ? 0.7 : 1,
          }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span
          aria-hidden
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2"
          style={{ color: "var(--color-app-fg-muted)" }}
        >
          <ChevronIcon />
        </span>
      </div>
    </div>
  );
}

function SearchInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
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
      </label>
      <div
        className="mt-2 flex items-center gap-2 rounded-md border px-3.5 py-2.5 transition-all"
        style={{
          borderColor: "var(--color-app-edge)",
          backgroundColor: "var(--color-app-paper)",
        }}
      >
        <span style={{ color: "var(--color-app-fg-muted)" }}>
          <SearchIcon />
        </span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-[14px] outline-none"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-ink)",
          }}
        />
        {value.length > 0 ? (
          <button
            onClick={() => onChange("")}
            className="text-[10px] uppercase tracking-[0.14em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-muted)",
            }}
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ─── Icons ─── */

function PlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h14M13 5l7 7-7 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M16 16l5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
