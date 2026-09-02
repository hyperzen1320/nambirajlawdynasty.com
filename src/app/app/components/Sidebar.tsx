"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import Logo from "@/components/Logo";
import { useChatUnread } from "@/lib/use-chat-unread";
import { fullName, initials } from "@/lib/display-name";
import {
  isFeatureEnabled,
  type FeatureKey,
  type FeatureMap,
} from "@/lib/features";

type NavItem = {
  name: string;
  href: string;
  icon: () => React.ReactElement;
  comingSoon?: boolean;
  // When set, the badge reads from this key on the polled live counters
  // so we can show an unread chat count next to Senior Desk.
  liveCountKey?: "chatUnread";
  // Office-admin-only entries. Hidden from juniors/clerks/advocates/
  // viewers in the rail; the pages and APIs enforce the same gate, so
  // hiding here is just the first (cosmetic) of the three layers.
  adminOnly?: boolean;
  // The module switch this entry belongs to. Absent = always available
  // (Dashboard and My Profile are not modules and can't be switched off).
  feature?: FeatureKey;
};

// Disposed Cases sits low in the rail (just above My Profile) because
// it's an archive — advocates dip into it occasionally to reopen or
// look up a closed matter, not as part of the daily triage flow at the
// top of the workspace section.
const NAV: NavItem[] = [
  { name: "Dashboard", href: "/app", icon: IconDashboard },
  { name: "Case Vault", href: "/app/cases", icon: IconCases, feature: "cases" },
  {
    name: "Client Crew",
    href: "/app/clients",
    icon: IconClients,
    feature: "clients",
  },
  {
    name: "Hearing Track",
    href: "/app/hearings",
    icon: IconHearings,
    feature: "hearings",
  },
  { name: "Court Hub", href: "/app/courts", icon: IconCourts, feature: "courts" },
  {
    name: "Work Flow",
    href: "/app/workflow",
    icon: IconBoards,
    feature: "workflow",
  },
  {
    name: "Senior Desk",
    href: "/app/senior-desk",
    icon: IconSeniorDesk,
    liveCountKey: "chatUnread",
    feature: "seniorDesk",
  },
  {
    name: "Activity",
    href: "/app/activity",
    icon: IconActivity,
    adminOnly: true,
    feature: "activity",
  },
  { name: "AI Assistant", href: "/app/ai", icon: IconAI, feature: "ai" },
  {
    name: "Disposed Cases",
    href: "/app/disposed-cases",
    icon: IconDisposed,
    feature: "disposed",
  },
  { name: "My Profile", href: "/app/profile", icon: IconProfile },
  {
    name: "Users / Advocates",
    href: "/app/users",
    icon: IconUsers,
    feature: "users",
  },
  {
    name: "Attendance",
    href: "/app/attendance",
    icon: IconAttendance,
    adminOnly: true,
    feature: "attendance",
  },
];

export default function Sidebar({
  partnerName,
  user,
  isAdmin,
  features,
  drawerOpen = false,
  onClose,
}: {
  partnerName: string;
  user: { firstName: string; lastName: string; email: string };
  isAdmin: boolean;
  features: FeatureMap;
  // Below lg the sidebar is an off-canvas drawer driven by AppShell.
  drawerOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const chatUnread = useChatUnread();
  const [loggingOut, setLoggingOut] = useState(false);

  // Drop admin-only entries (Activity, Attendance) for everyone who
  // isn't the office admin, and anything the global admin has switched
  // off for this chambers. The page redirect + API 403 back both up.
  const nav = NAV.filter(
    (item) =>
      (!item.adminOnly || isAdmin) &&
      (!item.feature || isFeatureEnabled(features, item.feature))
  );

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-[260px] flex-col overflow-hidden border-r transition-transform duration-300 ease-in-out lg:sticky lg:inset-y-auto lg:left-auto lg:top-0 lg:z-auto lg:translate-x-0 lg:transition-none ${
        drawerOpen ? "translate-x-0" : "-translate-x-full"
      }`}
      style={{
        backgroundColor: "var(--color-app-ink)",
        borderColor: "var(--color-app-ink-3)",
      }}
    >
      {/* Mobile-only close — the desktop rail has no dismiss. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close menu"
        className="absolute right-3 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-md lg:hidden"
        style={{ color: "var(--color-app-ivory-soft)" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Brand */}
      <Link
        href="/app"
        className="flex shrink-0 items-center gap-3 px-5 pb-5 pt-7 transition-opacity hover:opacity-90"
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: "var(--color-app-paper)",
            boxShadow: "0 2px 6px -2px rgba(0,0,0,0.3)",
          }}
        >
          <Logo size={28} />
        </span>
        <div className="leading-none min-w-0">
          <div
            className="truncate text-[16px] font-semibold tracking-tight"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-ivory)",
            }}
          >
            {partnerName}
          </div>
          <div
            className="mt-1 text-[10px] uppercase tracking-[0.2em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-copper-bright)",
            }}
          >
            Advocate · Office
          </div>
        </div>
      </Link>

      <div
        className="mx-5 mb-3 h-px"
        style={{ backgroundColor: "var(--color-app-ink-3)" }}
      />

      {/* Section label */}
      <div
        className="px-5 pb-2 text-[9px] uppercase tracking-[0.22em]"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-ivory-dim)",
        }}
      >
        Workspace
      </div>

      {/* Nav — min-h-0 lets this flex child shrink below its content so it
          becomes the scroll region instead of overflowing the panel. On
          short/zoomed viewports (and the admin's longer list) the menu
          scrolls here rather than spilling the bottom items + user card
          onto the page's cream background below the panel. */}
      <nav className="app-sidebar-scroll min-h-0 flex-1 overflow-y-auto px-3">
        {nav.map((item) => {
          const isActive =
            item.href === "/app"
              ? pathname === "/app"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          const unread =
            item.liveCountKey === "chatUnread" ? chatUnread : 0;

          return (
            <Link
              key={item.name}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className="app-nav-link group relative mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors"
              style={{
                // Only the active row carries an inline background — inactive
                // rows are left unset so the `.app-nav-link:hover` wash (a
                // stylesheet rule) can take effect; an inline `transparent`
                // here would outrank it and kill the hover feedback.
                backgroundColor: isActive
                  ? "var(--color-app-ink-2)"
                  : undefined,
                color: isActive
                  ? "var(--color-app-copper-bright)"
                  : "var(--color-app-ivory-soft)",
                boxShadow: isActive
                  ? "inset 0 0 0 1px var(--color-app-ink-3)"
                  : undefined,
                fontFamily: "var(--font-manrope), sans-serif",
              }}
            >
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-sm"
                  style={{ backgroundColor: "var(--color-app-copper)" }}
                />
              )}
              <Icon />
              <span className="flex-1">{item.name}</span>
              {unread > 0 ? (
                <span className="relative inline-flex items-center">
                  <span
                    aria-hidden
                    className="absolute inset-0 animate-ping rounded-full opacity-60"
                    style={{ backgroundColor: "var(--color-app-copper)" }}
                  />
                  <span
                    className="relative rounded-full px-1.5 text-[10px] font-semibold tabular-nums"
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
                </span>
              ) : item.comingSoon ? (
                <span
                  className="rounded-sm border px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.16em]"
                  style={{
                    fontFamily: "var(--font-dm-mono), monospace",
                    borderColor: "var(--color-app-ink-3)",
                    color: "var(--color-app-ivory-dim)",
                  }}
                >
                  Soon
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* User card */}
      <div
        className="shrink-0 border-t p-4"
        style={{ borderColor: "var(--color-app-ink-3)" }}
      >
        <div className="flex items-center gap-3 rounded-md px-2 py-1.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold uppercase"
            style={{
              backgroundColor: "var(--color-app-copper)",
              color: "var(--color-app-copper-text)",
              fontFamily: "var(--font-manrope), sans-serif",
            }}
          >
            {initials(user.firstName, user.lastName, "?")}
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="truncate text-[12px] font-medium"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                color: "var(--color-app-ivory)",
              }}
            >
              {fullName(user.firstName, user.lastName)}
            </div>
            <div
              className="truncate text-[10px]"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                color: "var(--color-app-ivory-dim)",
              }}
            >
              {user.email}
            </div>
          </div>
          <button
            onClick={() => {
              if (loggingOut) return;
              setLoggingOut(true);
              // Let the flicker play before the redirect fires.
              setTimeout(() => signOut({ callbackUrl: "/login" }), 340);
            }}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors"
            style={{
              color: loggingOut ? "#ffffff" : "var(--color-app-ivory-soft)",
              backgroundColor: loggingOut
                ? "var(--color-app-danger)"
                : "transparent",
              animation: loggingOut ? "logout-flicker 0.34s linear" : undefined,
            }}
            onMouseEnter={(e) => {
              if (loggingOut) return;
              e.currentTarget.style.backgroundColor = "var(--color-app-danger)";
              e.currentTarget.style.color = "#ffffff";
            }}
            onMouseLeave={(e) => {
              if (loggingOut) return;
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--color-app-ivory-soft)";
            }}
            title="Sign out"
            aria-label="Sign out"
          >
            <style>{`
              @keyframes logout-flicker {
                0%, 100% { opacity: 1; }
                20% { opacity: 0.25; }
                40% { opacity: 1; }
                60% { opacity: 0.3; }
                80% { opacity: 1; }
              }
            `}</style>
            <IconSignOut />
          </button>
        </div>

        <div
          className="mt-3 text-center text-[9px] uppercase tracking-[0.22em]"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            color: "var(--color-app-ivory-dim)",
          }}
        >
          v1.0 · Phase 1 MVP
        </div>
      </div>
    </aside>
  );
}

function IconDashboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="7" height="9" stroke="currentColor" strokeWidth="1.6" />
      <rect x="14" y="3" width="7" height="5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3" y="16" width="7" height="5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="14" y="12" width="7" height="9" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function IconCases() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="7" width="18" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 12h18" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function IconClients() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="17.5" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M14 19c0-2 2-3.5 4-3.5s3.5 1.5 3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconHearings() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="15" r="0.8" fill="currentColor" />
    </svg>
  );
}
function IconCourts() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 9l9-5 9 5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M5 9v10M19 9v10M3 21h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 11v6M12 11v6M16 11v6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function IconBoards() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="7" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="14" y="4" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="14" y="16" width="7" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function IconActivity() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 12h4l2-7 4 14 2-7h6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconAI() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M19 14l.7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
function IconProfile() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function IconDisposed() {
  // Case file with a check overlay — "closed and shelved".
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="7"
        width="18"
        height="13"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M9 14.5l2.2 2.2L15.5 12.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconSeniorDesk() {
  // Lamp + clipboard — the senior advocate's desk corner.
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 4h6l-2 4H9l-2-4z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M10 8v6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M6 14h8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect
        x="14"
        y="11"
        width="7"
        height="9"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M16.5 11V9.5h2V11"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M16 15h3M16 17.5h3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 4l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconAttendance() {
  // Calendar with a check inside — the office register's daily tick.
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M3 10h18M8 3v4M16 3v4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M8 15l2.5 2.5L16 12"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconSignOut() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 17l5-5-5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12H9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
