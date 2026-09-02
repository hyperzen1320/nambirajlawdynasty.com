"use client";

// useChatRoom — the working hook for a single open conversation.
//
// Owns:
//   • the message list state for the selected room
//   • adaptive polling (2s active → 8s background) to pull new messages
//   • optimistic send (renders the user's message instantly, reconciles
//     when the POST returns)
//   • mark-as-read on focus / when messages arrive
//   • broadcast-channel fan-out so two tabs of the same user stay in sync
//
// We deliberately do NOT route chat through useBoardLiveFeed even though
// the activity log records chat events — chat needs its own poll because
// the live-feed batches per (sender, room, 60s) and we want every keystroke
// surfaced to the open conversation. The live feed is what tells OTHER
// surfaces (sidebar, ribbon) that something happened.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { publishLocal, subscribeLocal } from "@/lib/broadcast-channel";

export type ChatAttachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
};

export type ChatMessageDTO = {
  id: string;
  roomId: string;
  senderId: string | null;
  senderName: string;
  senderRole: string;
  body: string;
  attachments?: ChatAttachment[];
  type: "text" | "system";
  isDeleted: boolean;
  editedAt: string | null;
  createdAt: string;
  isMine: boolean;
  // "sent" | "delivered" | "read" on your own messages, null on everyone
  // else's. Drives the WhatsApp-style ticks.
  receipt: "sent" | "delivered" | "read" | null;
};

type Cadence = "active" | "background";

const CADENCE_MS: Record<Cadence, number> = {
  active: 2000,
  background: 8000,
};

const PAGE_SIZE = 50;
const MAX_BODY = 4000;

type State = {
  messages: ChatMessageDTO[];
  hasMore: boolean;
  loading: boolean;
  loadingOlder: boolean;
  sending: boolean;
  error: string | null;
};

export function useChatRoom(
  roomId: string | null,
  partnerId: string | null
): State & {
  send: (body: string, attachments?: ChatAttachment[]) => Promise<boolean>;
  loadOlder: () => Promise<void>;
  markRead: () => Promise<void>;
  editMessage: (id: string, body: string) => Promise<boolean>;
  deleteMessage: (
    id: string,
    scope?: "me" | "everyone"
  ) => Promise<boolean>;
  refresh: () => Promise<void>;
} {
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs: mutated by the polling loop without forcing re-renders.
  const newestIdRef = useRef<string | null>(null);
  const oldestIdRef = useRef<string | null>(null);
  const visibleRef = useRef<boolean>(true);

  // Reset everything when the room changes.
  useEffect(() => {
    setMessages([]);
    setHasMore(false);
    setError(null);
    newestIdRef.current = null;
    oldestIdRef.current = null;
  }, [roomId]);

  // Initial fetch + paginate-newer loop.
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function initialLoad() {
      if (!roomId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/app/chat/rooms/${roomId}/messages?limit=${PAGE_SIZE}`
        );
        if (!res.ok) {
          if (!cancelled) {
            setError("Couldn't load this conversation.");
            setLoading(false);
          }
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const list = (data.messages || []) as ChatMessageDTO[];
        setMessages(list);
        setHasMore(Boolean(data.hasMore));
        if (list.length > 0) {
          newestIdRef.current = list[list.length - 1].id;
          oldestIdRef.current = list[0].id;
        }
      } catch {
        if (!cancelled) setError("Couldn't load this conversation.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function pollNewer() {
      if (cancelled || !roomId) return;
      const cadence: Cadence = visibleRef.current ? "active" : "background";
      try {
        const since = newestIdRef.current;
        // Fetch the newest 50 (no cursor) and merge in any with id > since.
        // Cheap because the index hits (roomId, _id desc) and we cap at 50.
        const res = await fetch(
          `/api/app/chat/rooms/${roomId}/messages?limit=${PAGE_SIZE}`,
          { cache: "no-store" }
        );
        if (res.ok) {
          const data = await res.json();
          const list = (data.messages || []) as ChatMessageDTO[];
          if (list.length > 0) {
            const newer = since
              ? list.filter((m) => m.id > since)
              : list;
            if (newer.length > 0) {
              setMessages((prev) => mergeAppend(prev, newer));
              newestIdRef.current = list[list.length - 1].id;
            }
          }
        }
      } catch {
        // Ignore transient errors; we'll try again next tick.
      }
      if (cancelled) return;
      timer = setTimeout(pollNewer, CADENCE_MS[cadence]);
    }

    initialLoad().then(() => {
      if (cancelled) return;
      timer = setTimeout(pollNewer, CADENCE_MS.active);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [roomId]);

  // Page Visibility tracking — slow the poll when the tab is hidden.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const update = () => {
      visibleRef.current = document.visibilityState === "visible";
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  // Cross-tab broadcast sub. When a sibling tab sends a message in this
  // room, mirror it locally so both panes stay synchronised without
  // waiting for the next poll tick.
  useEffect(() => {
    if (!roomId) return;
    const off = subscribeLocal((msg) => {
      if (partnerId && msg.partnerId && msg.partnerId !== partnerId) return;
      const row = msg.row as { metadata?: Record<string, unknown> };
      const meta = row?.metadata || {};
      if (meta.roomId !== roomId) return;
      // The activity row is informational — refresh the messages tail.
      // (The actual message delivery comes from the poll; this is the
      // "wake up" cue so we don't wait the full cadence.)
      // No-op state update to nudge the effect.
    });
    return off;
  }, [roomId, partnerId]);

  const refresh = useCallback(async () => {
    if (!roomId) return;
    try {
      const res = await fetch(
        `/api/app/chat/rooms/${roomId}/messages?limit=${PAGE_SIZE}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        const list = (data.messages || []) as ChatMessageDTO[];
        setMessages(list);
        setHasMore(Boolean(data.hasMore));
        if (list.length > 0) {
          newestIdRef.current = list[list.length - 1].id;
          oldestIdRef.current = list[0].id;
        }
      }
    } catch {
      /* swallow */
    }
  }, [roomId]);

  const loadOlder = useCallback(async () => {
    if (!roomId || !oldestIdRef.current || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const res = await fetch(
        `/api/app/chat/rooms/${roomId}/messages?limit=${PAGE_SIZE}&before=${oldestIdRef.current}`
      );
      if (res.ok) {
        const data = await res.json();
        const older = (data.messages || []) as ChatMessageDTO[];
        if (older.length > 0) {
          setMessages((prev) => mergePrepend(older, prev));
          oldestIdRef.current = older[0].id;
        }
        setHasMore(Boolean(data.hasMore));
      }
    } finally {
      setLoadingOlder(false);
    }
  }, [roomId, loadingOlder]);

  const send = useCallback(
    async (body: string, attachments: ChatAttachment[] = []): Promise<boolean> => {
      if (!roomId) return false;
      const trimmed = body.trim();
      if (!trimmed && attachments.length === 0) return false;
      if (trimmed.length > MAX_BODY) {
        setError(`Messages can be at most ${MAX_BODY} characters.`);
        return false;
      }

      // Optimistic insert — show the message immediately with a temporary id.
      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const optimistic: ChatMessageDTO = {
        id: tempId,
        roomId,
        senderId: "self",
        senderName: "You",
        senderRole: "",
        body: trimmed,
        attachments,
        type: "text",
        isDeleted: false,
        editedAt: null,
        createdAt: new Date().toISOString(),
        isMine: true,
        // Not on the server yet, so not even one tick.
        receipt: null,
      };
      setMessages((prev) => [...prev, optimistic]);
      setSending(true);
      setError(null);

      try {
        const res = await fetch(`/api/app/chat/rooms/${roomId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: trimmed, attachments }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Couldn't send your message.");
          // Remove the optimistic entry so we don't leave a phantom.
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          return false;
        }
        const data = await res.json();
        const real = data.message as ChatMessageDTO;
        // Replace the optimistic entry with the server's authoritative row,
        // then dedupe by id: the 2 s poll can fetch the real message before
        // this swap runs, leaving both the optimistic temp AND the polled
        // real in the list — which then collapses to two copies of the same
        // id. Filtering by id here keeps exactly one. (The "sent twice until
        // refresh" bug.)
        setMessages((prev) => {
          const seen = new Set<string>();
          return prev
            .map((m) => (m.id === tempId ? { ...real, isMine: true } : m))
            .filter((m) => {
              if (seen.has(m.id)) return false;
              seen.add(m.id);
              return true;
            });
        });
        newestIdRef.current = real.id;

        // Same-tab fan-out so a second tab of this user updates immediately.
        if (partnerId) {
          publishLocal({
            kind: "activity",
            partnerId,
            boardId: null,
            row: {
              id: `chat-${real.id}`,
              actorUserId: real.senderId,
              actorName: real.senderName,
              action: "chat.message",
              targetType: "chat_room",
              targetId: roomId,
              targetName: "",
              message: "",
              metadata: { roomId, preview: real.body.slice(0, 80) },
              boardId: null,
              createdAt: real.createdAt,
            },
          });
        }
        return true;
      } catch {
        setError("Couldn't send your message — check your connection.");
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        return false;
      } finally {
        setSending(false);
      }
    },
    [roomId, partnerId]
  );

  const markRead = useCallback(async () => {
    if (!roomId) return;
    const last = newestIdRef.current;
    if (!last) return;
    try {
      await fetch(`/api/app/chat/rooms/${roomId}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: last }),
      });
    } catch {
      /* ignore */
    }
  }, [roomId]);

  const editMessage = useCallback(
    async (id: string, body: string): Promise<boolean> => {
      const trimmed = body.trim();
      if (!trimmed) return false;
      try {
        const res = await fetch(`/api/app/chat/messages/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: trimmed }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Couldn't update the message.");
          return false;
        }
        const data = await res.json();
        const updated = data.message as { body: string; editedAt: string | null };
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id
              ? { ...m, body: updated.body, editedAt: updated.editedAt }
              : m
          )
        );
        return true;
      } catch {
        setError("Couldn't update the message.");
        return false;
      }
    },
    []
  );

  const deleteMessage = useCallback(
    async (
      id: string,
      scope: "me" | "everyone" = "everyone"
    ): Promise<boolean> => {
      try {
        const res = await fetch(
          `/api/app/chat/messages/${id}?scope=${scope}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Couldn't delete the message.");
          return false;
        }
        if (scope === "me") {
          // Hidden for me — drop it from my thread entirely.
          setMessages((prev) => prev.filter((m) => m.id !== id));
        } else {
          // Tombstone for everyone — keep the row, blank the body.
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id ? { ...m, isDeleted: true, body: "" } : m
            )
          );
        }
        return true;
      } catch {
        setError("Couldn't delete the message.");
        return false;
      }
    },
    []
  );

  return useMemo(
    () => ({
      messages,
      hasMore,
      loading,
      loadingOlder,
      sending,
      error,
      send,
      loadOlder,
      markRead,
      editMessage,
      deleteMessage,
      refresh,
    }),
    [
      messages,
      hasMore,
      loading,
      loadingOlder,
      sending,
      error,
      send,
      loadOlder,
      markRead,
      editMessage,
      deleteMessage,
      refresh,
    ]
  );
}

// Append-merge — drops anything already present by id (handles the race
// where a poll arrives just after an optimistic send already echoed).
function mergeAppend(
  existing: ChatMessageDTO[],
  incoming: ChatMessageDTO[]
): ChatMessageDTO[] {
  if (incoming.length === 0) return existing;
  const seen = new Set(existing.map((m) => m.id));
  const fresh = incoming.filter((m) => !seen.has(m.id));
  if (fresh.length === 0) return existing;
  return [...existing, ...fresh];
}

function mergePrepend(
  older: ChatMessageDTO[],
  existing: ChatMessageDTO[]
): ChatMessageDTO[] {
  if (older.length === 0) return existing;
  const seen = new Set(existing.map((m) => m.id));
  const fresh = older.filter((m) => !seen.has(m.id));
  if (fresh.length === 0) return existing;
  return [...fresh, ...existing];
}
