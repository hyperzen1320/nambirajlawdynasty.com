"use client";

import { useEffect, useMemo, useState } from "react";
import MessageList from "./MessageList";
import Composer from "./Composer";
import NewChatPicker from "./NewChatPicker";
import { useChatRoom } from "@/lib/use-chat-room";
import type { ChatRoomDTO, SeniorDeskMember } from "./SeniorDeskClient";

// Private Chat — two-column WhatsApp-style layout. Left rail lists every
// private room the user already has, right pane renders the selected
// thread. "+ New chat" opens a member picker that calls /api/app/chat/private
// to atomically get-or-create the room and selects it.
//
// Privacy reminder lives in the empty-state (right-pane placeholder)
// because users want reassurance the moment they open the tab.

export default function PrivateChatPanel({
  me,
  members,
  rooms,
  onRoomsChange,
}: {
  me: SeniorDeskMember;
  members: SeniorDeskMember[];
  rooms: ChatRoomDTO[];
  onRoomsChange: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // On phones the rail and thread can't share the screen, so we show one at
  // a time: the rail (list) by default, the thread once a room is opened.
  // selectedId stays set across the toggle so the lg+ two-column layout is
  // unaffected and tapping Back never refetches the thread.
  const [mobileThread, setMobileThread] = useState(false);

  // Auto-select the most-recent room on first load.
  useEffect(() => {
    if (selectedId) return;
    if (rooms.length > 0) setSelectedId(rooms[0].id);
  }, [rooms, selectedId]);

  // If the selected room disappears (e.g. moderator wiped it), fall back
  // to the next-most-recent.
  useEffect(() => {
    if (!selectedId) return;
    if (!rooms.some((r) => r.id === selectedId)) {
      const next = rooms[0]?.id ?? null;
      setSelectedId(next);
      if (!next) setMobileThread(false);
    }
  }, [rooms, selectedId]);

  const selected = useMemo(
    () => rooms.find((r) => r.id === selectedId) || null,
    [rooms, selectedId]
  );

  async function startWith(userId: string) {
    setPickerOpen(false);
    try {
      const res = await fetch("/api/app/chat/private", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withUserId: userId }),
      });
      if (res.ok) {
        const data = await res.json();
        const newId = data?.room?.id as string | undefined;
        if (newId) {
          setSelectedId(newId);
          setMobileThread(true);
          onRoomsChange();
        }
      }
    } catch {
      /* swallow */
    }
  }

  return (
    <div
      className="grid h-full min-h-[420px] grid-cols-1 overflow-hidden rounded-2xl lg:grid-cols-[300px_1fr]"
      style={{
        backgroundColor: "var(--color-app-canvas-2)",
        border: "1px solid var(--color-app-edge)",
      }}
    >
      <Rail
        className={mobileThread ? "hidden lg:flex" : "flex"}
        me={me}
        rooms={rooms}
        selectedId={selectedId}
        onSelect={(id) => {
          setSelectedId(id);
          setMobileThread(true);
        }}
        onNewChat={() => setPickerOpen(true)}
      />
      <div
        className={`${
          mobileThread ? "flex" : "hidden lg:flex"
        } min-w-0 flex-col overflow-hidden`}
      >
        {selected ? (
          <Thread
            key={selected.id}
            room={selected}
            partnerId={null}
            me={me}
            onSent={onRoomsChange}
            onBack={() => setMobileThread(false)}
          />
        ) : (
          <EmptyPane onNewChat={() => setPickerOpen(true)} />
        )}
      </div>

      {pickerOpen ? (
        <NewChatPicker
          members={members}
          existingRoomMembers={
            new Set(
              rooms
                .map((r) => r.otherUser?.id)
                .filter((x): x is string => Boolean(x))
            )
          }
          onPick={startWith}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </div>
  );
}

function Rail({
  className = "",
  me,
  rooms,
  selectedId,
  onSelect,
  onNewChat,
}: {
  className?: string;
  me: SeniorDeskMember;
  rooms: ChatRoomDTO[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}) {
  return (
    <div
      className={`flex-col ${className}`}
      style={{
        backgroundColor: "var(--color-app-paper)",
        borderRight: "1px solid var(--color-app-edge)",
      }}
    >
      <div
        className="flex items-center justify-between gap-2 px-4 pb-3 pt-4"
        style={{ borderBottom: "1px solid var(--color-app-edge-soft)" }}
      >
        <div>
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-muted)",
            }}
          >
            Private
          </div>
          <div
            className="text-[14px] font-semibold"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            {me.name.split(" ")[0]}'s threads
          </div>
        </div>
        <button
          onClick={onNewChat}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            backgroundColor: "var(--color-app-copper)",
            color: "var(--color-app-copper-text)",
            boxShadow: "0 4px 10px -6px rgba(197,133,58,0.55)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {rooms.length === 0 ? (
          <div
            className="px-4 py-8 text-center text-[12.5px]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-fg-muted)",
              lineHeight: 1.6,
            }}
          >
            No private chats yet. Tap{" "}
            <span style={{ color: "var(--color-app-copper-deep)", fontWeight: 600 }}>
              New
            </span>{" "}
            and pick a teammate — only the two of you will see what's said.
          </div>
        ) : (
          <ul className="space-y-0.5 px-2">
            {rooms.map((r) => {
              const active = r.id === selectedId;
              const subtitle = r.lastMessagePreview
                ? r.lastMessagePreview
                : "No messages yet";
              return (
                <li key={r.id}>
                  <button
                    onClick={() => onSelect(r.id)}
                    className="block w-full rounded-lg px-3 py-2.5 text-left transition-colors"
                    style={{
                      backgroundColor: active
                        ? "var(--color-app-canvas-2)"
                        : "transparent",
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                        style={{
                          fontFamily: "var(--font-crimson), Georgia, serif",
                          backgroundColor: r.otherUser?.active
                            ? "var(--color-app-ink)"
                            : "var(--color-app-canvas-2)",
                          color: r.otherUser?.active
                            ? "var(--color-app-ivory)"
                            : "var(--color-app-fg-muted)",
                        }}
                      >
                        {initials(r.title)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className="truncate text-[13px] font-semibold"
                            style={{
                              fontFamily: "var(--font-manrope), sans-serif",
                              color: "var(--color-app-ink)",
                            }}
                          >
                            {r.title}
                          </span>
                          {r.lastMessageAt ? (
                            <span
                              className="shrink-0 text-[10px]"
                              style={{
                                fontFamily: "var(--font-dm-mono), monospace",
                                color: "var(--color-app-fg-muted)",
                              }}
                            >
                              {formatRelative(r.lastMessageAt)}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span
                            className="truncate text-[12px]"
                            style={{
                              fontFamily: "var(--font-manrope), sans-serif",
                              color:
                                r.unreadCount > 0
                                  ? "var(--color-app-ink)"
                                  : "var(--color-app-fg-muted)",
                              fontWeight: r.unreadCount > 0 ? 600 : 400,
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            {subtitle}
                          </span>
                          {r.unreadCount > 0 ? (
                            <span
                              className="rounded-full px-1.5 text-[10px] font-semibold tabular-nums"
                              style={{
                                fontFamily:
                                  "var(--font-dm-mono), monospace",
                                backgroundColor: "var(--color-app-danger)",
                                color: "white",
                                minWidth: 18,
                                textAlign: "center",
                              }}
                            >
                              {r.unreadCount > 99 ? "99+" : r.unreadCount}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Thread({
  room,
  partnerId,
  me,
  onSent,
  onBack,
}: {
  room: ChatRoomDTO;
  partnerId: string | null;
  me: SeniorDeskMember;
  onSent: () => void;
  onBack: () => void;
}) {
  const chat = useChatRoom(room.id, partnerId);

  useEffect(() => {
    chat.markRead();
  }, [chat, room.id, chat.messages.length]);

  return (
    <>
      <ThreadHeader room={room} onBack={onBack} />
      <MessageList
        messages={chat.messages}
        loading={chat.loading}
        hasMore={chat.hasMore}
        loadingOlder={chat.loadingOlder}
        isAdmin={false}
        emptyLabel={`This is the start of your conversation with ${room.title}. Only the two of you can read this.`}
        onLoadOlder={chat.loadOlder}
        onEdit={chat.editMessage}
        onDelete={chat.deleteMessage}
        onScrolledToBottom={chat.markRead}
      />
      <Composer
        onSend={async (body, attachments) => {
          const ok = await chat.send(body, attachments);
          if (ok) onSent();
          return ok;
        }}
        sending={chat.sending}
        placeholder={
          room.otherUser?.active === false
            ? `${room.title} is deactivated — chat is read-only.`
            : `Message ${room.title}…`
        }
        disabled={room.otherUser?.active === false}
        errorMessage={chat.error}
      />
    </>
  );
}

function ThreadHeader({
  room,
  onBack,
}: {
  room: ChatRoomDTO;
  onBack: () => void;
}) {
  const isInactive = room.otherUser?.active === false;
  return (
    <div
      className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6"
      style={{
        backgroundColor: "var(--color-app-paper)",
        borderBottom: "1px solid var(--color-app-edge)",
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to chats"
          className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md lg:hidden"
          style={{ color: "var(--color-app-fg-soft)" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 5l-7 7 7 7"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
          style={{
            fontFamily: "var(--font-crimson), Georgia, serif",
            backgroundColor: isInactive
              ? "var(--color-app-canvas-2)"
              : "var(--color-app-ink)",
            color: isInactive
              ? "var(--color-app-fg-muted)"
              : "var(--color-app-ivory)",
          }}
        >
          {initials(room.title)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="truncate text-[16px] font-semibold tracking-tight"
              style={{
                fontFamily: "var(--font-crimson), Georgia, serif",
                color: "var(--color-app-ink)",
              }}
            >
              {room.title}
            </span>
            {room.otherUser?.role ? (
              <span
                className="rounded-sm px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em]"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  backgroundColor: "var(--color-app-canvas-2)",
                  color: "var(--color-app-fg-soft)",
                }}
              >
                {room.otherUser.role}
              </span>
            ) : null}
            {isInactive ? (
              <span
                className="rounded-sm px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em]"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  backgroundColor: "var(--color-app-danger-soft)",
                  color: "var(--color-app-danger)",
                }}
              >
                Deactivated
              </span>
            ) : null}
          </div>
          <div
            className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-muted)",
            }}
          >
            <span>Private</span>
            <span>·</span>
            <span>Just the two of you</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyPane({ onNewChat }: { onNewChat: () => void }) {
  return (
    <div
      className="flex h-full flex-col items-center justify-center px-8 text-center"
      style={{ backgroundColor: "var(--color-app-canvas-2)" }}
    >
      <div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          backgroundColor: "var(--color-app-paper)",
          color: "var(--color-app-copper-deep)",
          boxShadow: "0 1px 0 var(--color-app-edge)",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 7l8-4 8 4v8c0 4-3.5 7-8 7s-8-3-8-7V7z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M9 12l2 2 4-4"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h3
        className="text-[22px] font-semibold tracking-tight"
        style={{
          fontFamily: "var(--font-crimson), Georgia, serif",
          color: "var(--color-app-ink)",
        }}
      >
        Pick someone to start a private chat.
      </h3>
      <p
        className="mt-3 max-w-md text-[13px] leading-[1.6]"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          color: "var(--color-app-fg-muted)",
        }}
      >
        Whatever you write here stays between you and the person you choose
        — admins can't read other people's private chats, and the office
        can't either.
      </p>
      <button
        onClick={onNewChat}
        className="mt-6 inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-[12.5px] font-semibold"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          backgroundColor: "var(--color-app-ink)",
          color: "var(--color-app-ivory)",
          boxShadow: "0 8px 18px -10px rgba(10,17,36,0.45)",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        Start a new private chat
      </button>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return "Yesterday";
  }
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}
