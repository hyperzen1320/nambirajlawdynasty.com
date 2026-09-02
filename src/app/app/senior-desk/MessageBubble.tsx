"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatAttachment, ChatMessageDTO } from "@/lib/use-chat-room";
import { formatBytes } from "@/lib/case-docs";
import ImageLightbox from "./ImageLightbox";

// Single message row. Renders sender info + body, plus a hover-revealed
// "…" menu on the user's own messages for edit / delete. The bubble
// styling differs subtly between own / others — own messages get a darker
// ink-tinted card, others get the paper card.

export default function MessageBubble({
  message,
  isAdmin,
  showSender,
  onEdit,
  onDelete,
}: {
  message: ChatMessageDTO;
  isAdmin: boolean;
  showSender: boolean;
  onEdit: (id: string, body: string) => Promise<boolean>;
  onDelete: (id: string, scope: "me" | "everyone") => Promise<boolean>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.body);
  const editRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.setSelectionRange(
        editValue.length,
        editValue.length
      );
    }
  }, [editing, editValue.length]);

  const isMine = message.isMine;
  // Optimistic (un-sent) rows carry a temp id — no server actions on them.
  const isReal = !message.id.startsWith("tmp-");
  const canEdit =
    isMine &&
    !message.isDeleted &&
    Date.now() - new Date(message.createdAt).getTime() < 5 * 60_000;
  // A message carrying a shared FILE is office property — only the admin
  // may take it out of everyone's hands. Plain text stays author-deletable.
  // ("Delete for me" is unaffected: hiding something from your own thread
  // takes nothing away from anyone else.)
  const hasAttachments = (message.attachments?.length ?? 0) > 0;
  const canDeleteEveryone =
    isReal &&
    !message.isDeleted &&
    (isAdmin || (isMine && !hasAttachments));
  // Anyone can hide any message from just their own thread (WhatsApp style).
  const canDeleteForMe = isReal;

  const time = new Date(message.createdAt).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className="group relative flex items-start gap-3"
      style={{ flexDirection: isMine ? "row-reverse" : "row" }}
    >
      {showSender && !isMine ? (
        <Avatar name={message.senderName} role={message.senderRole} />
      ) : (
        <div className="w-9 shrink-0" />
      )}

      <div
        className="max-w-[68%] min-w-0"
        style={{ alignItems: isMine ? "flex-end" : "flex-start" }}
      >
        {showSender && !isMine ? (
          <div className="mb-1 flex items-baseline gap-2">
            <span
              className="text-[12.5px] font-semibold"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                color: "var(--color-app-ink)",
              }}
            >
              {message.senderName}
            </span>
            {message.senderRole ? (
              <span
                className="rounded-sm px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em]"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  backgroundColor: roleColor(message.senderRole).bg,
                  color: roleColor(message.senderRole).fg,
                }}
              >
                {message.senderRole}
              </span>
            ) : null}
          </div>
        ) : null}

        <div
          className="relative rounded-2xl px-4 py-2.5"
          style={{
            backgroundColor: message.isDeleted
              ? "transparent"
              : isMine
                ? "var(--color-app-ink)"
                : "var(--color-app-paper)",
            color: message.isDeleted
              ? "var(--color-app-fg-muted)"
              : isMine
                ? "var(--color-app-ivory)"
                : "var(--color-app-ink)",
            border: message.isDeleted
              ? "1px dashed var(--color-app-edge)"
              : isMine
                ? "none"
                : "1px solid var(--color-app-edge-soft)",
            boxShadow: isMine && !message.isDeleted
              ? "0 8px 18px -12px rgba(10,17,36,0.4)"
              : "none",
          }}
        >
          {editing ? (
            <div className="min-w-[260px]">
              <textarea
                ref={editRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={Math.max(2, Math.min(6, editValue.split("\n").length))}
                className="block w-full resize-none rounded-md px-2 py-1.5 text-[13.5px] outline-none"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  backgroundColor: isMine
                    ? "rgba(245,235,214,0.08)"
                    : "var(--color-app-canvas-2)",
                  color: isMine
                    ? "var(--color-app-ivory)"
                    : "var(--color-app-ink)",
                  border: isMine
                    ? "1px solid rgba(245,235,214,0.2)"
                    : "1px solid var(--color-app-edge)",
                }}
              />
              <div className="mt-2 flex justify-end gap-1.5">
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditValue(message.body);
                  }}
                  className="rounded-md px-2.5 py-1 text-[11px] font-medium"
                  style={{
                    fontFamily: "var(--font-manrope), sans-serif",
                    color: isMine
                      ? "var(--color-app-ivory-soft)"
                      : "var(--color-app-fg-soft)",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const ok = await onEdit(message.id, editValue);
                    if (ok) setEditing(false);
                  }}
                  className="rounded-md px-2.5 py-1 text-[11px] font-semibold"
                  style={{
                    fontFamily: "var(--font-manrope), sans-serif",
                    backgroundColor: "var(--color-app-copper)",
                    color: "var(--color-app-copper-text)",
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          ) : message.isDeleted ? (
            <div
              className="whitespace-pre-wrap text-[13.5px] leading-[1.55]"
              style={{ fontFamily: "var(--font-manrope), sans-serif" }}
            >
              <span className="italic">Message removed</span>
            </div>
          ) : (
            <>
              {message.body ? (
                <div
                  className="whitespace-pre-wrap text-[13.5px] leading-[1.55]"
                  style={{
                    fontFamily: "var(--font-manrope), sans-serif",
                    wordBreak: "break-word",
                  }}
                >
                  {message.body}
                </div>
              ) : null}
              {message.attachments && message.attachments.length > 0 ? (
                <AttachmentList
                  attachments={message.attachments}
                  isMine={isMine}
                  hasBody={Boolean(message.body)}
                  canDownload={isAdmin}
                />
              ) : null}
            </>
          )}
        </div>

        <div
          className="mt-1 flex items-center gap-1.5"
          style={{ justifyContent: isMine ? "flex-end" : "flex-start" }}
        >
          <span
            className="text-[10px]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-muted)",
              letterSpacing: 0.3,
            }}
          >
            {time}
          </span>
          {message.editedAt ? (
            <span
              className="text-[10px]"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                color: "var(--color-app-fg-muted)",
              }}
              title={`Edited ${new Date(message.editedAt).toLocaleString()}`}
            >
              (edited)
            </span>
          ) : null}
          {isMine && !message.isDeleted && message.receipt ? (
            <ReceiptTicks receipt={message.receipt} />
          ) : null}
        </div>
      </div>

      {(canEdit || canDeleteEveryone || canDeleteForMe) && !editing ? (
        <div className="relative self-center opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Message menu"
            className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-app-canvas-2)]"
            style={{ color: "var(--color-app-fg-muted)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="6" r="1.5" fill="currentColor" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <circle cx="12" cy="18" r="1.5" fill="currentColor" />
            </svg>
          </button>
          {menuOpen ? (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setMenuOpen(false)}
              />
              <div
                className="absolute right-0 top-9 z-40 w-44 overflow-hidden rounded-md"
                style={{
                  backgroundColor: "var(--color-app-paper)",
                  border: "1px solid var(--color-app-edge)",
                  boxShadow: "0 12px 28px -12px rgba(10,17,36,0.25)",
                }}
              >
                {canEdit ? (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setEditValue(message.body);
                      setEditing(true);
                    }}
                    className="block w-full px-3 py-2 text-left text-[12px] hover:bg-[var(--color-app-canvas-2)]"
                    style={{
                      fontFamily: "var(--font-manrope), sans-serif",
                      color: "var(--color-app-ink)",
                    }}
                  >
                    Edit
                  </button>
                ) : null}
                {canDeleteEveryone ? (
                  <button
                    onClick={async () => {
                      setMenuOpen(false);
                      await onDelete(message.id, "everyone");
                    }}
                    className="block w-full px-3 py-2 text-left text-[12px] hover:bg-[var(--color-app-canvas-2)]"
                    style={{
                      fontFamily: "var(--font-manrope), sans-serif",
                      color: "var(--color-app-danger)",
                    }}
                  >
                    Delete for everyone
                  </button>
                ) : null}
                {canDeleteForMe ? (
                  <button
                    onClick={async () => {
                      setMenuOpen(false);
                      await onDelete(message.id, "me");
                    }}
                    className="block w-full px-3 py-2 text-left text-[12px] hover:bg-[var(--color-app-canvas-2)]"
                    style={{
                      fontFamily: "var(--font-manrope), sans-serif",
                      color: "var(--color-app-danger)",
                    }}
                  >
                    Delete for me
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AttachmentList({
  attachments,
  isMine,
  hasBody,
  canDownload,
}: {
  attachments: ChatAttachment[];
  isMine: boolean;
  hasBody: boolean;
  // Saving a shared file out of chambers is office-admin only; everyone
  // else opens it inline. The API enforces the same rule.
  canDownload: boolean;
}) {
  const [lightbox, setLightbox] = useState<{ src: string; filename: string } | null>(
    null
  );
  return (
    <div className={`flex flex-col gap-2 ${hasBody ? "mt-2" : ""}`}>
      {attachments.map((a) => {
        const url = `/api/app/chat/attachments/${a.id}`;
        if (isImageAtt(a)) {
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setLightbox({ src: url, filename: a.filename })}
              className="block overflow-hidden rounded-lg"
              style={{ cursor: "pointer", padding: 0, border: "none", background: "none" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={a.filename}
                className="block max-h-64 max-w-full"
                style={{ objectFit: "cover" }}
              />
            </button>
          );
        }
        return (
          <a
            key={a.id}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px] transition-opacity hover:opacity-90"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              backgroundColor: isMine ? "rgba(245,235,214,0.12)" : "var(--color-app-canvas-2)",
              color: isMine ? "var(--color-app-ivory)" : "var(--color-app-ink)",
              border: isMine
                ? "1px solid rgba(245,235,214,0.18)"
                : "1px solid var(--color-app-edge)",
            }}
          >
            <FileGlyph />
            <span className="min-w-0">
              <span className="block max-w-[200px] truncate font-semibold">{a.filename}</span>
              <span className="block text-[10.5px]" style={{ opacity: 0.7 }}>
                {formatBytes(a.size)}
              </span>
            </span>
            {canDownload ? <DownloadGlyph /> : <ViewGlyph />}
          </a>
        );
      })}
      {lightbox ? (
        <ImageLightbox
          src={lightbox.src}
          filename={lightbox.filename}
          canDownload={canDownload}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </div>
  );
}

function isImageAtt(a: ChatAttachment): boolean {
  return (
    (a.contentType || "").startsWith("image/") ||
    /\.(jpg|jpeg|png|gif|webp|bmp|heic|heif)$/i.test(a.filename)
  );
}

function FileGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <path
        d="M7 3h7l4 4v14H7z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14 3v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

// What a non-admin gets instead of the download arrow — the file opens in
// a new tab to be read, and that's the whole of it.
function ViewGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ flexShrink: 0, marginLeft: "auto", opacity: 0.7 }}
    >
      <path
        d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function DownloadGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ flexShrink: 0, marginLeft: "auto", opacity: 0.7 }}
    >
      <path
        d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Delivery ticks ─── */

// WhatsApp's vocabulary, because it's the one every user in chambers
// already knows:
//   ✓   sent      — on the server, nobody has opened the room since
//   ✓✓  delivered — somebody has had the room open since it was sent
//   ✓✓  read      — everyone else has read past it (aqua)
function ReceiptTicks({
  receipt,
}: {
  receipt: "sent" | "delivered" | "read";
}) {
  const label =
    receipt === "read"
      ? "Read by everyone"
      : receipt === "delivered"
        ? "Delivered"
        : "Sent";
  const color =
    receipt === "read"
      ? "var(--color-app-aqua)"
      : "var(--color-app-fg-muted)";

  return (
    <span
      className="inline-flex items-center"
      style={{ color }}
      title={label}
      aria-label={label}
      role="img"
    >
      <svg
        width={receipt === "sent" ? 12 : 17}
        height="12"
        viewBox={receipt === "sent" ? "0 0 12 12" : "0 0 17 12"}
        fill="none"
        aria-hidden
      >
        <path
          d="M1 6.6L4 9.6L10.4 2.6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {receipt !== "sent" ? (
          <path
            d="M6 6.6L9 9.6L15.4 2.6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </svg>
    </span>
  );
}

function Avatar({ name, role }: { name: string; role: string }) {
  const initials = (() => {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
  })();
  const c = roleColor(role);
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
      style={{
        fontFamily: "var(--font-crimson), Georgia, serif",
        backgroundColor: c.bg,
        color: c.fg,
      }}
      title={name}
    >
      {initials}
    </div>
  );
}

function roleColor(role: string): { bg: string; fg: string } {
  switch (role) {
    case "admin":
      return {
        bg: "var(--color-app-copper)",
        fg: "var(--color-app-copper-text)",
      };
    case "advocate":
      return {
        bg: "var(--color-app-ink)",
        fg: "var(--color-app-ivory)",
      };
    case "junior":
      return {
        bg: "rgba(10,17,36,0.85)",
        fg: "var(--color-app-ivory)",
      };
    case "clerk":
      return {
        bg: "rgba(197,133,58,0.18)",
        fg: "var(--color-app-copper-deep)",
      };
    case "viewer":
      return {
        bg: "var(--color-app-canvas-2)",
        fg: "var(--color-app-fg-soft)",
      };
    default:
      return {
        bg: "var(--color-app-canvas-2)",
        fg: "var(--color-app-fg-soft)",
      };
  }
}
