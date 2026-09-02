"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import Logo from "@/components/Logo";

type NavItem = {
  name: string;
  href: string;
  icon: () => React.ReactElement;
  soon?: boolean;
};

const NAV: NavItem[] = [
  { name: "Dashboard", href: "/admin", icon: IconDashboard },
  { name: "Partners", href: "/admin/partners", icon: IconPartners },
  {
    name: "Subscriptions",
    href: "/admin/subscriptions",
    icon: IconSubscriptions,
  },
  {
    name: "Activity",
    href: "/admin/activity",
    icon: IconActivity,
  },
  { name: "Support", href: "/admin/support", icon: IconSupport },
  { name: "Tutorials", href: "/admin/tutorials", icon: IconTutorials },
  { name: "Settings", href: "/admin/settings", icon: IconSettings },
];

export default function Sidebar({
  user,
}: {
  user: { firstName: string; lastName: string; email: string };
}) {
  const pathname = usePathname();

  return (
    <aside className="relative sticky top-0 flex h-screen flex-col border-r border-admin-border bg-admin-bg-sidebar">
      {/* emerald rail — brand signature */}
      <div className="absolute left-0 top-0 h-full w-[3px] bg-admin-accent" />

      {/* Back to the public site (legalezi.com) */}
      <div className="px-6 pt-5 pb-1">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-admin-fg-soft transition-colors hover:text-admin-fg"
          aria-label="Back to legalezi.com"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 5l-7 7 7 7"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to legalezi.com
        </Link>
      </div>

      {/* Brand */}
      <div className="px-6 pb-6 pt-2">
        <Link href="/admin" className="group flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white shadow-sm">
            <Logo size={26} />
          </span>
          <div className="leading-none">
            <div className="text-[18px] font-semibold tracking-tight text-admin-fg">
              Legalezi
            </div>
            <div
              className="mt-1 inline-flex items-center gap-1.5 rounded-sm bg-admin-accent-soft px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-admin-accent"
              style={{ fontFamily: "var(--font-plex-mono), monospace" }}
            >
              <span className="block h-1 w-1 rounded-full bg-admin-accent" />
              Global Admin
            </div>
          </div>
        </Link>
      </div>

      {/* Section label */}
      <div
        className="px-6 pb-2 pt-4 text-[10px] font-medium uppercase tracking-[0.18em] text-admin-fg-soft"
        style={{ fontFamily: "var(--font-plex-mono), monospace" }}
      >
        Workspace
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3">
        {NAV.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          const disabled = item.soon;

          const className = [
            "group relative mb-0.5 flex items-center gap-3 rounded-md px-3 py-2.5 text-[14px] font-medium transition-colors",
            isActive
              ? "bg-admin-accent-soft text-admin-accent"
              : "text-admin-fg-muted hover:bg-admin-border-soft hover:text-admin-fg",
            disabled ? "cursor-not-allowed opacity-55" : "",
          ].join(" ");

          const Icon = item.icon;

          if (disabled) {
            return (
              <div key={item.name} className={className}>
                <Icon />
                <span className="flex-1">{item.name}</span>
                <span
                  className="rounded-sm border border-admin-border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-admin-fg-soft"
                  style={{ fontFamily: "var(--font-plex-mono), monospace" }}
                >
                  Soon
                </span>
              </div>
            );
          }

          return (
            <Link key={item.name} href={item.href} className={className}>
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-sm bg-admin-accent" />
              )}
              <Icon />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User card */}
      <div className="mt-auto border-t border-admin-border-soft p-4">
        <div className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-admin-border-soft">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-admin-fg text-[12px] font-semibold uppercase text-admin-bg">
            {user.firstName[0]?.toUpperCase()}
            {user.lastName[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-admin-fg">
              {user.firstName} {user.lastName}
            </div>
            <div
              className="truncate text-[11px] text-admin-fg-soft"
              style={{ fontFamily: "var(--font-plex-mono), monospace" }}
            >
              {user.email}
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-admin-fg-soft transition-colors hover:bg-admin-danger-soft hover:text-admin-danger"
            title="Sign out"
            aria-label="Sign out"
          >
            <IconSignOut />
          </button>
        </div>
      </div>
    </aside>
  );
}

function IconDashboard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="7" height="9" stroke="currentColor" strokeWidth="1.6" />
      <rect x="14" y="3" width="7" height="5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3" y="16" width="7" height="5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="14" y="12" width="7" height="9" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function IconPartners() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="17.5" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M14 19c0-2 2-3.5 4-3.5s3.5 1.5 3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconSubscriptions() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="6" width="18" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 15h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function IconActivity() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 12h4l2-7 4 14 2-7h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconTutorials() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 9.5l4.5 2.5-4.5 2.5z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}
function IconSupport() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M4.9 4.9l4.3 4.3M14.8 14.8l4.3 4.3M19.1 4.9l-4.3 4.3M9.2 14.8l-4.3 4.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M19.4 14.5a1.5 1.5 0 0 0 .3 1.6l.1.1a1.8 1.8 0 0 1 0 2.5 1.8 1.8 0 0 1-2.5 0l-.1-.1a1.5 1.5 0 0 0-1.6-.3 1.5 1.5 0 0 0-.9 1.4V20a1.8 1.8 0 1 1-3.6 0v-.1a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.6.3l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.5 1.5 0 0 0 .3-1.6 1.5 1.5 0 0 0-1.4-.9H4a1.8 1.8 0 1 1 0-3.6h.1a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.6l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.5 1.5 0 0 0 1.6.3H9.5a1.5 1.5 0 0 0 .9-1.4V4a1.8 1.8 0 1 1 3.6 0v.1a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.6-.3l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.5 1.5 0 0 0-.3 1.6V9.5a1.5 1.5 0 0 0 1.4.9H20a1.8 1.8 0 1 1 0 3.6h-.1a1.5 1.5 0 0 0-1.4.9z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconSignOut() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 17l5-5-5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12H9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
