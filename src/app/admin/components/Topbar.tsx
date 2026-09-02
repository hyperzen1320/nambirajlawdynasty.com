"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const PAGE_TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/partners": "Partners",
  "/admin/partners/new": "Add a chambers",
  "/admin/subscriptions": "Subscriptions",
  "/admin/activity": "Activity",
  "/admin/settings": "Settings",
};

export default function Topbar({
  user,
}: {
  user: { firstName: string; lastName: string };
}) {
  const pathname = usePathname();
  const title =
    PAGE_TITLES[pathname] ??
    (pathname.startsWith("/admin/partners/")
      ? "Partner detail"
      : "Admin");

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-admin-border bg-admin-surface px-10">
      <div className="flex items-baseline gap-4">
        <h1 className="text-[20px] font-semibold tracking-tight text-admin-fg">
          {title}
        </h1>
        <span
          className="text-[12px] text-admin-fg-soft"
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          {today}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/admin/partners/new"
          className="inline-flex items-center gap-2 rounded-md bg-admin-accent px-4 py-2 text-[13px] font-medium text-white shadow-sm transition-all hover:bg-admin-accent-hover hover:shadow"
        >
          <PlusIcon />
          Add Partner
        </Link>

        <div className="hidden items-center gap-2 rounded-md border border-admin-border bg-admin-bg px-3 py-1.5 text-[12px] text-admin-fg-muted md:flex">
          <span
            className="block h-1.5 w-1.5 rounded-full bg-admin-accent"
            aria-hidden
          />
          <span>Welcome,</span>
          <span className="font-medium text-admin-fg">{user.firstName}</span>
        </div>
      </div>
    </header>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
