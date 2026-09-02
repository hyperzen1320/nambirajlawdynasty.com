"use client";

import { useEffect } from "react";
import MessageList from "./MessageList";
import Composer from "./Composer";
import { useChatRoom } from "@/lib/use-chat-room";
import type { ChatRoomDTO, SeniorDeskMember } from "./SeniorDeskClient";

// Group Chat — single-column thread that everyone in the office reads
// and writes to. Header shows the office name + active-member count;
// the list and composer are the shared primitives.

export default function GroupChatPanel({
  room,
  me,
  memberCount,
  partnerId,
  onSent,
}: {
  room: ChatRoomDTO;
  me: SeniorDeskMember;
  memberCount: number;
  partnerId: string | null;
  onSent: () => void;
}) {
  const chat = useChatRoom(room.id, partnerId);

  // Mark as read whenever the panel mounts, when new messages arrive while
  // the user is at the bottom, and on focus.
  useEffect(() => {
    chat.markRead();
  }, [chat, room.id, chat.messages.length]);

  return (
    <div
      className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-2xl"
      style={{
        backgroundColor: "var(--color-app-canvas-2)",
        border: "1px solid var(--color-app-edge)",
        boxShadow: "0 1px 0 var(--color-app-edge)",
      }}
    >
      <Header title={room.title} memberCount={memberCount} me={me} />
      <MessageList
        messages={chat.messages}
        loading={chat.loading}
        hasMore={chat.hasMore}
        loadingOlder={chat.loadingOlder}
        isAdmin={false}
        emptyLabel="Nothing said yet — drop the first note. Everyone in the office can see it."
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
        placeholder="Talk to the whole office…"
        errorMessage={chat.error}
      />
    </div>
  );
}

function Header({
  title,
  memberCount,
  me,
}: {
  title: string;
  memberCount: number;
  me: SeniorDeskMember;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 px-6 py-4"
      style={{
        backgroundColor: "var(--color-app-paper)",
        borderBottom: "1px solid var(--color-app-edge)",
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
          style={{
            backgroundColor: "var(--color-app-ink)",
            color: "var(--color-app-copper-bright)",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 6h16v10H7l-3 3V6z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path
              d="M8 10h8M8 13h5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <div
            className="truncate text-[16px] font-semibold tracking-tight"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            {title}
          </div>
          <div
            className="mt-0.5 text-[10px] uppercase tracking-[0.18em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-muted)",
            }}
          >
            Group chat · {memberCount} {memberCount === 1 ? "person" : "people"}
          </div>
        </div>
      </div>
      <div
        className="hidden items-center gap-2 rounded-md px-3 py-1.5 sm:flex"
        style={{
          backgroundColor: "var(--color-app-canvas-2)",
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: "var(--color-app-aqua)" }}
        />
        <span
          className="text-[10px] uppercase tracking-[0.16em]"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            color: "var(--color-app-fg-soft)",
          }}
        >
          Posting as {me.name}
        </span>
      </div>
    </div>
  );
}
