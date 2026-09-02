"use client";

import { usePathname } from "next/navigation";
import BellDropdown from "./BellDropdown";

const PAGE_TITLES: Record<string, string> = {
  "/app": "Dashboard",
  "/app/cases": "Case Vault",
  "/app/cases/new": "Add a case",
  "/app/disposed-cases": "Disposed Cases",
  "/app/clients": "Client Crew",
  "/app/hearings": "Hearing Track",
  "/app/courts": "Court Hub",
  "/app/workflow": "Work Flow",
  "/app/senior-desk": "Senior Desk",
  "/app/activity": "Activity",
  "/app/ai": "AI Assistant",
  "/app/profile": "My Profile",
  "/app/users": "Users / Advocates",
};

export default function Topbar({
  onMenuClick,
}: {
  onMenuClick?: () => void;
}) {
  const pathname = usePathname();
  const title =
    PAGE_TITLES[pathname] ??
    (pathname.startsWith("/app/cases/")
      ? "Case Vault"
      : pathname.startsWith("/app/clients/")
        ? "Client Crew"
        : "App");

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <header
      className="sticky top-0 z-30 flex h-[68px] items-center justify-between gap-3 border-b px-4 sm:px-6 lg:px-10"
      style={{
        backgroundColor: "var(--color-app-canvas)",
        borderColor: "var(--color-app-edge)",
      }}
    >
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {/* Hamburger — opens the sidebar drawer; desktop rail needs none. */}
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md lg:hidden"
          style={{ color: "var(--color-app-fg-soft)" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <div className="min-w-0">
          <div
            className="hidden text-[11px] uppercase tracking-[0.18em] sm:block"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-muted)",
            }}
          >
            {today}
          </div>
          <h1
            className="truncate text-[19px] font-semibold tracking-tight leading-none sm:mt-0.5 sm:text-[24px]"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            {title}
          </h1>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <IconButton ariaLabel="Search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6" />
            <path d="M16 16l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </IconButton>
        {/* The Topbar bell is dedicated to delete requests so admins
            can review them from any non-canvas page. Canvas keeps its
            own activity bell — they live in different surfaces. */}
        <BellDropdown />
      </div>
    </header>
  );
}

function IconButton({
  children,
  ariaLabel,
}: {
  children: React.ReactNode;
  ariaLabel: string;
}) {
  return (
    <button
      aria-label={ariaLabel}
      className="flex h-9 w-9 items-center justify-center rounded-md transition-all"
      style={{ color: "var(--color-app-fg-soft)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--color-app-paper)";
        e.currentTarget.style.color = "var(--color-app-ink)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
        e.currentTarget.style.color = "var(--color-app-fg-soft)";
      }}
    >
      {children}
    </button>
  );
}
