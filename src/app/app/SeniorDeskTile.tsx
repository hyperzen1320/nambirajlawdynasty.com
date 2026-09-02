"use client";

import Link from "next/link";
import { useChatUnread } from "@/lib/use-chat-unread";

// Dashboard tile for Senior Desk. Mirrors the Work Flow card's shell but is
// a client component so it can carry a live unread indicator — a pulsing
// dot on the icon plus a count badge by the title — sourced from the same
// poll that drives the sidebar badge.
export default function SeniorDeskTile() {
  const unread = useChatUnread();
  const has = unread > 0;

  return (
    <Link
      href="/app/senior-desk"
      className="fade-up-sm flex items-center gap-4 rounded-2xl p-5 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5"
      style={{
        backgroundColor: "var(--color-app-paper)",
        boxShadow:
          "0 10px 26px -18px rgba(18,29,53,0.28), inset 0 0 0 1px var(--color-app-edge)",
      }}
    >
      <div
        className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
        style={{
          backgroundColor: "var(--color-app-canvas-2)",
          color: "var(--color-app-copper-deep)",
        }}
      >
        <IconDesk />
        {has ? (
          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5">
            <span
              aria-hidden
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
              style={{ backgroundColor: "var(--color-app-copper)" }}
            />
            <span
              className="relative inline-flex h-3.5 w-3.5 rounded-full"
              style={{
                backgroundColor: "var(--color-app-copper)",
                boxShadow: "0 0 0 2px var(--color-app-paper)",
              }}
            />
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="text-[20px] font-semibold tracking-tight"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            Senior Desk
          </span>
          {has ? (
            <span
              className="rounded-full px-1.5 text-[10px] font-semibold tabular-nums"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                backgroundColor: "var(--color-app-copper)",
                color: "var(--color-app-copper-text)",
                minWidth: 20,
                textAlign: "center",
              }}
            >
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </div>
        <div
          className="mt-0.5 text-[13px]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: has
              ? "var(--color-app-copper-deep)"
              : "var(--color-app-fg-muted)",
          }}
        >
          {has
            ? `${unread} new message${unread === 1 ? "" : "s"} waiting for you`
            : "Coordinate with your advocates in real time."}
        </div>
      </div>

      <span className="shrink-0" style={{ color: "var(--color-app-copper-deep)" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 12h14M13 5l7 7-7 7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </Link>
  );
}

function IconDesk() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="17.5" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M14 19c0-2 2-3.5 4-3.5s3.5 1.5 3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="20" cy="5" r="2" fill="currentColor" fillOpacity="0.18" />
    </svg>
  );
}
