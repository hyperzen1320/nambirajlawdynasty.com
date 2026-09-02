"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import ListColumn from "./ListNode";
import CardPreview, { type PreviewTask } from "./CardPreview";
import CardDetail from "./CardDetail";
import BellDrawer from "./BellDrawer";
import RequestDeleteDialog, { type RequestTarget } from "./RequestDeleteDialog";
import SaveToolbar from "./CanvasToolbar";
import RecentChangeOverlay from "./RecentChangeOverlay";
import PresenceDock from "./PresenceDock";
import { useBoardLiveFeed } from "@/lib/use-board-live-feed";
import { useBoardPresence } from "@/lib/use-board-presence";
import { TEMP_ID_PREFIX, isTempId } from "@/lib/use-optimistic-action";

// The id of the element the Save tool rasterises for Picture / Full-page
// exports — the column row, captured at its full scroll width so off-screen
// lists are included.
const BOARD_CAPTURE_ID = "board-capture-root";

export type CanvasList = {
  id: string;
  title: string;
  description: string;
  // ISO string. Defaults to the list's creation date; editable from the
  // ⋮ menu.
  listDate: string;
  sortOrder: number;
  // Retained for wire compatibility with the page loader; the fixed column
  // board orders by sortOrder and no longer reads x/y or width.
  position: { x: number; y: number };
  width: number;
  color: string | null;
};

export type BoardMember = { id: string; name: string; role: string };

type BoardCanvasProps = {
  currentUserId: string | null;
  boardId: string;
  board: { id: string; title: string; description: string; color: string };
  accent: string;
  accentSoft: string;
  gradient: [string, string];
  initialViewport: { x: number; y: number; zoom: number };
  initialLists: CanvasList[];
  initialTasks: PreviewTask[];
  members: BoardMember[];
  role: string;
};

export default function BoardCanvas(props: BoardCanvasProps) {
  return <Inner {...props} />;
}

function Inner({
  currentUserId,
  boardId,
  board,
  accent,
  gradient,
  initialLists,
  initialTasks,
  members,
  role,
}: BoardCanvasProps) {
  const canEdit = role !== "viewer";

  /* ─── State ─── */
  // Declared up-front so the live-feed resync below can reference the
  // setters without a forward reference.
  const [lists, setLists] = useState<CanvasList[]>(initialLists);
  const [tasks, setTasks] = useState<PreviewTask[]>(initialTasks);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [bellOpen, setBellOpen] = useState(false);

  /* ─── Live feed + presence ─── */
  const liveFeed = useBoardLiveFeed({
    boardId,
    partnerId: null,
    lastSeenStorageKey: `legaleasy:lastseen:board:${boardId}`,
  });
  const presence = useBoardPresence(boardId);

  // Debounced resync of authoritative board state when the live feed
  // reports changes that affect lists / tasks and the actor was someone
  // other than us. Capped to once every 800ms regardless of burst size.
  const resyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResyncAtRef = useRef<number>(0);
  const scheduleResync = useCallback(() => {
    const now = Date.now();
    const since = now - lastResyncAtRef.current;
    const delay = since > 800 ? 0 : 800 - since;
    if (resyncTimerRef.current) return;
    resyncTimerRef.current = setTimeout(async () => {
      resyncTimerRef.current = null;
      lastResyncAtRef.current = Date.now();
      try {
        const res = await fetch(`/api/app/boards/${boardId}/full`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          lists: CanvasList[];
          tasks: PreviewTask[];
        };
        // Preserve any in-flight optimistic entities (temp:* ids) so we
        // don't yank a list/card the user just added but the server hasn't
        // returned for yet. Server is canonical for everything else.
        setLists((prev) => {
          const fromServer = data.lists ?? [];
          const optimistic = prev.filter((l) => isTempId(l.id));
          return [...fromServer, ...optimistic];
        });
        setTasks((prev) => {
          const fromServer = data.tasks ?? [];
          const optimistic = prev.filter((t) => isTempId(t.id));
          return [...fromServer, ...optimistic];
        });
      } catch {
        /* ignore */
      }
    }, delay);
  }, [boardId]);

  useEffect(() => {
    return () => {
      if (resyncTimerRef.current) clearTimeout(resyncTimerRef.current);
    };
  }, []);

  // Detect interesting cross-user events. Anything from a different actor
  // that targets a list/task means our state may be stale.
  const lastSeenIndexRef = useRef(0);
  useEffect(() => {
    const start = lastSeenIndexRef.current;
    if (start >= liveFeed.newRows.length) return;
    const fresh = liveFeed.newRows.slice(start);
    lastSeenIndexRef.current = liveFeed.newRows.length;

    let needsResync = false;
    for (const row of fresh) {
      if (row.actorUserId && row.actorUserId === currentUserId) continue;
      if (
        row.action.startsWith("task.") ||
        row.action.startsWith("list.") ||
        row.action.startsWith("board.") ||
        row.action === "delete_request.approved"
      ) {
        needsResync = true;
        break;
      }
    }
    if (needsResync) scheduleResync();
  }, [liveFeed.newRows, scheduleResync, currentUserId]);

  // Fixed left-to-right order: the first list created sits leftmost, each
  // new one appends to its right. sortOrder is the single source of truth.
  const orderedLists = useMemo(
    () => [...lists].sort((a, b) => a.sortOrder - b.sortOrder),
    [lists]
  );

  // Group tasks by list
  const tasksByList = useMemo(() => {
    const map = new Map<string, PreviewTask[]>();
    for (const list of lists) map.set(list.id, []);
    for (const t of tasks) {
      const arr = map.get(t.listId);
      if (arr) arr.push(t);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return map;
  }, [lists, tasks]);

  /* ─── Mutation handlers ─── */

  const onTaskClick = useCallback((id: string) => setOpenTaskId(id), []);

  // Rename / describe / date are optimistic swap-then-confirm: local state
  // changes immediately; if the server rejects we revert to the captured
  // previous value. The server emits list.updated on success so other open
  // boards resync.
  const onListRename = useCallback(async (listId: string, title: string) => {
    let previous: string | null = null;
    setLists((prev) =>
      prev.map((l) => {
        if (l.id !== listId) return l;
        previous = l.title;
        return { ...l, title };
      })
    );
    try {
      const res = await fetch(`/api/app/lists/${listId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("rename_failed");
    } catch {
      if (previous !== null) {
        const restored = previous;
        setLists((prev) =>
          prev.map((l) => (l.id === listId ? { ...l, title: restored } : l))
        );
      }
    }
  }, []);

  const onListDescriptionChange = useCallback(
    async (listId: string, description: string) => {
      let previous: string | null = null;
      setLists((prev) =>
        prev.map((l) => {
          if (l.id !== listId) return l;
          previous = l.description;
          return { ...l, description };
        })
      );
      try {
        const res = await fetch(`/api/app/lists/${listId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description }),
        });
        if (!res.ok) throw new Error("describe_failed");
      } catch {
        if (previous !== null) {
          const restored = previous;
          setLists((prev) =>
            prev.map((l) =>
              l.id === listId ? { ...l, description: restored } : l
            )
          );
        }
      }
    },
    []
  );

  const onListDateChange = useCallback(
    async (listId: string, listDate: string) => {
      let previous: string | null = null;
      setLists((prev) =>
        prev.map((l) => {
          if (l.id !== listId) return l;
          previous = l.listDate;
          return { ...l, listDate };
        })
      );
      try {
        const res = await fetch(`/api/app/lists/${listId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listDate }),
        });
        if (!res.ok) throw new Error("date_failed");
      } catch {
        if (previous !== null) {
          const restored = previous;
          setLists((prev) =>
            prev.map((l) =>
              l.id === listId ? { ...l, listDate: restored } : l
            )
          );
        }
      }
    },
    []
  );

  const [requestTarget, setRequestTarget] = useState<RequestTarget | null>(
    null
  );

  const onListDelete = useCallback(async (listId: string) => {
    const snapshot: {
      lists: CanvasList[] | null;
      tasks: PreviewTask[] | null;
    } = { lists: null, tasks: null };
    setLists((prev) => {
      snapshot.lists = prev;
      return prev.filter((l) => l.id !== listId);
    });
    setTasks((prev) => {
      snapshot.tasks = prev;
      return prev.filter((t) => t.listId !== listId);
    });

    const restore = () => {
      if (snapshot.lists) setLists(snapshot.lists);
      if (snapshot.tasks) setTasks(snapshot.tasks);
    };

    try {
      const res = await fetch(`/api/app/lists/${listId}`, { method: "DELETE" });
      if (res.ok) return;
      restore();
      if (res.status === 403) {
        const data = await res.json().catch(() => null);
        if (data && data.code === "delete_request_required") {
          setRequestTarget({
            type: "list",
            id: data.targetId,
            name: data.targetName,
            hint: data.error,
          });
        }
      }
    } catch {
      restore();
    }
  }, []);

  const onTaskAdd = useCallback(
    async (listId: string, title: string) => {
      const tempId = `${TEMP_ID_PREFIX}${Date.now().toString(36)}`;
      const trimmedTitle = title.trim();
      const tempTask: PreviewTask = {
        id: tempId,
        listId,
        title: trimmedTitle,
        description: "",
        sortOrder: Number.MAX_SAFE_INTEGER, // floats to bottom until swap
        assignee: null,
        dueDate: null,
        priority: null,
        checklistSummary: { totalChecklists: 0, totalItems: 0, doneItems: 0 },
        hasDescription: false,
        updatedAt: new Date().toISOString(),
      };
      setTasks((prev) => [...prev, tempTask]);

      try {
        const res = await fetch(`/api/app/boards/${boardId}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listId, title: trimmedTitle }),
        });
        const data = await res.json();
        if (res.ok && data.task) {
          setTasks((prev) =>
            prev.map((t) => (t.id === tempId ? (data.task as PreviewTask) : t))
          );
        } else {
          setTasks((prev) => prev.filter((t) => t.id !== tempId));
        }
      } catch {
        setTasks((prev) => prev.filter((t) => t.id !== tempId));
      }
    },
    [boardId]
  );

  /* ─── @dnd-kit for cards across lists ─── */

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const activeCardTask =
    activeCardId != null ? tasks.find((t) => t.id === activeCardId) : null;

  const onCardDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as
      | { type?: string; taskId?: string }
      | undefined;
    if (data?.type === "task" && data.taskId) setActiveCardId(data.taskId);
  }, []);

  const onCardDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveCardId(null);
      const { active, over } = event;
      if (!over) return;
      const a = active.data.current as
        | { type?: string; taskId?: string; listId?: string }
        | undefined;
      const o = over.data.current as
        | { type?: string; taskId?: string; listId?: string }
        | undefined;
      if (!a || a.type !== "task" || !a.taskId) return;

      let targetListId: string | undefined;
      let toIndex = 0;
      if (o?.type === "list" && o.listId) {
        targetListId = o.listId;
        toIndex = (tasksByList.get(targetListId) || []).filter(
          (t) => t.id !== a.taskId
        ).length;
      } else if (o?.type === "task" && o.listId) {
        targetListId = o.listId;
        const list = (tasksByList.get(targetListId) || []).filter(
          (t) => t.id !== a.taskId
        );
        const overIdx = list.findIndex((t) => t.id === o.taskId);
        toIndex = overIdx >= 0 ? overIdx : list.length;
      }
      if (!targetListId) return;

      // Optimistic local update
      setTasks((prev) => {
        const next = prev.map((t) =>
          t.id === a.taskId ? { ...t, listId: targetListId! } : t
        );
        const inDest = next
          .filter((t) => t.listId === targetListId && t.id !== a.taskId)
          .sort((x, y) => x.sortOrder - y.sortOrder);
        const moving = next.find((t) => t.id === a.taskId);
        if (moving) {
          inDest.splice(toIndex, 0, moving);
          inDest.forEach((t, i) => (t.sortOrder = i));
        }
        return [...next];
      });

      try {
        await fetch(`/api/app/tasks/${a.taskId}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toListId: targetListId, toIndex }),
        });
      } catch {
        // ignore — live feed will reconcile if our optimistic move was wrong
      }
    },
    [tasksByList]
  );

  // Move a card to another list from the card-detail panel.
  const moveCardToList = useCallback(
    async (taskId: string, toListId: string) => {
      const current = tasks.find((t) => t.id === taskId);
      if (!current || current.listId === toListId) return;
      const toIndex = (tasksByList.get(toListId) || []).length;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, listId: toListId, sortOrder: toIndex } : t
        )
      );
      try {
        await fetch(`/api/app/tasks/${taskId}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toListId, toIndex }),
        });
      } catch {
        // live feed reconciles if this optimistic move was wrong
      }
    },
    [tasks, tasksByList]
  );

  /* ─── Add list ─── */

  const onAddList = useCallback(
    async (titleInput: string) => {
      const trimmed = titleInput.trim();
      if (!trimmed) return;

      const tempId = `${TEMP_ID_PREFIX}${Date.now().toString(36)}`;
      // Append to the right: next sortOrder after the current max.
      const nextSort =
        lists.reduce((m, l) => Math.max(m, l.sortOrder), -1) + 1;
      const tempList: CanvasList = {
        id: tempId,
        title: trimmed,
        description: "",
        listDate: new Date().toISOString(),
        sortOrder: nextSort,
        position: { x: 0, y: 0 },
        width: 320,
        color: null,
      };
      setLists((prev) => [...prev, tempList]);

      try {
        const res = await fetch(`/api/app/boards/${boardId}/lists`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: trimmed }),
        });
        const data = await res.json();
        if (!res.ok || !data.list) {
          setLists((prev) => prev.filter((l) => l.id !== tempId));
          return;
        }
        // Swap temp for the real list, keeping the server's sortOrder so the
        // column lands in the right place.
        setLists((prev) =>
          prev.map((l) =>
            l.id === tempId
              ? {
                  id: data.list.id,
                  title: data.list.title,
                  description: "",
                  listDate: new Date().toISOString(),
                  sortOrder: data.list.sortOrder ?? nextSort,
                  position: { x: 0, y: 0 },
                  width: 320,
                  color: null,
                }
              : l
          )
        );
      } catch {
        setLists((prev) => prev.filter((l) => l.id !== tempId));
      }
    },
    [boardId, lists]
  );

  /* ─── Render ─── */

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-app-canvas)",
      }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onCardDragStart}
        onDragEnd={onCardDragEnd}
        onDragCancel={() => setActiveCardId(null)}
      >
        <CanvasTopBar
          board={board}
          accent={accent}
          gradient={gradient}
          canEdit={canEdit}
          onAddList={onAddList}
          totalLists={lists.length}
          totalCards={tasks.length}
          boardId={boardId}
          onBellOpen={() => setBellOpen(true)}
          presence={presence}
          unreadCount={liveFeed.unreadCount}
        />

        {/* Horizontal scroll region — columns flow left→right and the board
            scrolls sideways once they run past the screen. No panning, no
            zoom: the only movement is this honest scrollbar. */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowX: "auto",
            overflowY: "hidden",
          }}
        >
          <div
            id={BOARD_CAPTURE_ID}
            style={{
              display: "flex",
              gap: 16,
              alignItems: "flex-start",
              height: "100%",
              width: "max-content",
              padding: "4px 20px 24px",
            }}
          >
            {orderedLists.map((list) => (
              <ListColumn
                key={list.id}
                list={list}
                tasks={tasksByList.get(list.id) || []}
                accent={accent}
                canEdit={canEdit}
                onTaskClick={onTaskClick}
                onListRename={onListRename}
                onListDelete={onListDelete}
                onListDescriptionChange={onListDescriptionChange}
                onListDateChange={onListDateChange}
                onTaskAdd={onTaskAdd}
              />
            ))}
            {orderedLists.length === 0 ? (
              <div
                className="flex h-full items-center"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  color: "var(--color-app-fg-muted)",
                  fontSize: 14,
                }}
              >
                No lists yet — use{" "}
                <span
                  style={{ color: "var(--color-app-ink)", fontWeight: 600 }}
                >
                  &nbsp;Add list&nbsp;
                </span>{" "}
                above to create the first one.
              </div>
            ) : null}
          </div>
        </div>

        {/* dropAnimation={null} kills the snap-back glitch — the card vanishes
            at the drop point and re-renders in its new list (the optimistic
            update has already placed it). */}
        <DragOverlay dropAnimation={null}>
          {activeCardTask ? (
            <div style={{ width: 288 }}>
              <CardPreview
                task={activeCardTask}
                onClick={() => {}}
                isDraggingOverlay
                accent={accent}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <SaveToolbar
        boardId={boardId}
        boardTitle={board.title}
        captureTargetId={BOARD_CAPTURE_ID}
      />

      {openTaskId ? (
        <CardDetail
          taskId={openTaskId}
          members={members}
          lists={lists.map((l) => ({ id: l.id, title: l.title }))}
          canEdit={canEdit}
          onClose={() => setOpenTaskId(null)}
          onUpdated={(t) => {
            setTasks((prev) =>
              prev.map((x) => (x.id === t.id ? { ...x, ...t } : x))
            );
          }}
          onMove={moveCardToList}
          onDeleted={() => {
            setTasks((prev) => prev.filter((t) => t.id !== openTaskId));
            setOpenTaskId(null);
          }}
          onRequestDelete={(target) => setRequestTarget(target)}
        />
      ) : null}

      {bellOpen ? (
        <BellDrawer
          boardId={boardId}
          isAdmin={role === "admin"}
          totalLists={lists.length}
          totalCards={tasks.length}
          perListBreakdown={orderedLists.map((l) => ({
            id: l.id,
            title: l.title,
            count: tasksByList.get(l.id)?.length ?? 0,
          }))}
          onClose={() => setBellOpen(false)}
          liveRows={liveFeed.newRows}
          onMarkSeen={liveFeed.markSeen}
        />
      ) : null}

      {requestTarget ? (
        <RequestDeleteDialog
          target={requestTarget}
          onClose={() => setRequestTarget(null)}
          onSubmitted={() => {
            setRequestTarget(null);
            setBellOpen(true);
          }}
        />
      ) : null}

      <RecentChangeOverlay
        newRows={liveFeed.newRows}
        selfUserId={currentUserId}
      />
    </div>
  );
}

/* ─── Top bar ─── */

function CanvasTopBar({
  board,
  accent,
  gradient,
  canEdit,
  onAddList,
  totalLists,
  totalCards,
  boardId,
  onBellOpen,
  presence,
  unreadCount,
}: {
  board: { id: string; title: string; description: string; color: string };
  accent: string;
  gradient: [string, string];
  canEdit: boolean;
  onAddList: (title: string) => void;
  totalLists: number;
  totalCards: number;
  boardId: string;
  onBellOpen: () => void;
  presence: import("@/lib/use-board-presence").ActiveUser[];
  unreadCount: number;
}) {
  // Pending delete-request count — its own short poll (counts a state, not
  // an event stream), cheaper than deriving from the live feed.
  const [pendingDeleteCount, setPendingDeleteCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const fetchCount = async () => {
      try {
        const res = await fetch(
          `/api/app/delete-requests/count?boardId=${boardId}`,
          { cache: "no-store" }
        );
        if (!res.ok || !alive) return;
        const data = await res.json();
        if (alive) setPendingDeleteCount(data.count || 0);
      } catch {
        /* ignore */
      }
    };
    fetchCount();
    const t = setInterval(fetchCount, 10000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [boardId]);

  const bellCount = unreadCount + pendingDeleteCount;
  return (
    <div
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 16,
      }}
    >
      {/* Board chip — left */}
      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-2.5"
        style={{
          backgroundColor: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(10,17,36,0.06)",
          boxShadow:
            "0 16px 40px -12px rgba(10,17,36,0.18), 0 4px 8px -4px rgba(10,17,36,0.06)",
        }}
      >
        <Link
          href="/app/workflow"
          aria-label="All boards"
          className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-app-canvas-2)]"
          style={{ color: "var(--color-app-fg-muted)" }}
        >
          <BackIcon />
        </Link>
        <div
          style={{
            width: 1,
            height: 22,
            backgroundColor: "var(--color-app-edge)",
          }}
        />
        <div
          className="flex h-8 w-8 items-center justify-center rounded-md"
          style={{
            background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
            boxShadow: `0 6px 14px -4px ${accent}55`,
          }}
        >
          <BoardIcon />
        </div>
        <div className="min-w-0">
          <div
            className="text-[10px] uppercase tracking-[0.22em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-muted)",
            }}
          >
            Workflow
          </div>
          <div
            className="text-[16px] font-semibold leading-none tracking-tight"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
              marginTop: 2,
            }}
          >
            {board.title}
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Right cluster */}
      <div
        className="flex items-center gap-2 rounded-2xl px-3 py-2"
        style={{
          backgroundColor: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(10,17,36,0.06)",
          boxShadow:
            "0 16px 40px -12px rgba(10,17,36,0.18), 0 4px 8px -4px rgba(10,17,36,0.06)",
        }}
      >
        <div className="hidden sm:contents">
          <PresenceDock active={presence} />
          <div
            style={{
              width: 1,
              height: 22,
              backgroundColor: "var(--color-app-edge)",
            }}
          />
        </div>

        {/* Stats chip — total lists · total cards */}
        <div
          className="hidden md:flex items-center gap-2 px-2 py-1 rounded-md"
          title="Lists · Cards"
          style={{ backgroundColor: "var(--color-app-canvas-2)" }}
        >
          <span
            className="text-[11px] font-semibold tabular-nums"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-soft)",
              letterSpacing: 0.4,
            }}
          >
            <span style={{ color: "var(--color-app-ink)" }}>{totalLists}</span>{" "}
            lists ·{" "}
            <span style={{ color: "var(--color-app-ink)" }}>{totalCards}</span>{" "}
            cards
          </span>
        </div>

        {/* Bell — opens drawer */}
        <button
          onClick={onBellOpen}
          aria-label="Open board pulse"
          className="relative flex h-8 w-8 items-center justify-center rounded-md transition-colors"
          style={{
            backgroundColor: "var(--color-app-canvas-2)",
            color: "var(--color-app-copper-deep)",
          }}
        >
          <BellIconStroke />
          {bellCount > 0 ? (
            <span
              className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-semibold tabular-nums"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                backgroundColor: "var(--color-app-danger)",
                color: "white",
                border: "2px solid var(--color-app-paper)",
                boxShadow: "0 2px 4px rgba(193,74,55,0.40)",
              }}
            >
              {bellCount}
            </span>
          ) : null}
        </button>

        {canEdit ? (
          <AddListComposer
            accent={accent}
            gradient={gradient}
            onSubmit={onAddList}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Inline composer for "+ Add list" — inflates into a small input + Add/Cancel
 * pill right in the top bar. Enter submits, Esc cancels.
 */
function AddListComposer({
  accent,
  gradient,
  onSubmit,
}: {
  accent: string;
  gradient: [string, string];
  onSubmit: (title: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  function commit() {
    const t = title.trim();
    if (!t) {
      setOpen(false);
      setTitle("");
      return;
    }
    onSubmit(t);
    setTitle("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-transform hover:-translate-y-0.5"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
          color: "#fff",
          boxShadow: `0 8px 20px -8px ${accent}80`,
        }}
        title="Add a new list"
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Add list
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-1 rounded-md px-1.5 py-1"
      style={{
        background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
        boxShadow: `0 8px 20px -8px ${accent}80`,
      }}
    >
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            setOpen(false);
            setTitle("");
          }
        }}
        placeholder="Name this list…"
        className="w-[44vw] min-w-[120px] max-w-[180px] rounded-sm bg-white/95 px-2 py-1 text-[12px] outline-none"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          color: "var(--color-app-ink)",
        }}
      />
      <button
        onClick={commit}
        className="rounded-sm bg-white/95 px-2.5 py-1 text-[11px] font-semibold"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          color: "var(--color-app-ink)",
        }}
      >
        Add
      </button>
      <button
        onClick={() => {
          setOpen(false);
          setTitle("");
        }}
        aria-label="Cancel"
        className="rounded-sm px-2 py-1 text-[14px] leading-none text-white/85"
        style={{ fontFamily: "var(--font-dm-mono), monospace" }}
      >
        ×
      </button>
    </div>
  );
}

function BellIconStroke() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 21a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M19 12H5M12 19l-7-7 7-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function BoardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="7" height="16" rx="1.5" stroke="white" strokeWidth="1.6" />
      <rect x="14" y="4" width="7" height="9" rx="1.5" stroke="white" strokeWidth="1.6" />
      <rect x="14" y="16" width="7" height="4" rx="1.5" stroke="white" strokeWidth="1.6" />
    </svg>
  );
}
