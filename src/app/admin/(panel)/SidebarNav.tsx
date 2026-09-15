"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCUMENTS, DOCUMENT_IDS } from "@/cms/documents";

export default function SidebarNav() {
  const pathname = usePathname();

  const item = (href: string, label: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      aria-current={active ? "page" : undefined}
      className="block whitespace-nowrap rounded-md px-3 py-2 text-[13.5px] transition-colors hover:bg-[var(--color-admin-border-soft)]"
      style={
        active
          ? {
              backgroundColor: "var(--color-admin-surface)",
              color: "var(--color-admin-fg)",
              fontWeight: 600,
              boxShadow: "0 1px 2px rgba(14,26,31,0.06)",
            }
          : { color: "var(--color-admin-fg-muted)" }
      }
    >
      {label}
    </Link>
  );

  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:pb-4">
      {item("/admin", "Overview", pathname === "/admin")}
      {item("/admin/news", "News posts", pathname === "/admin/news" || pathname.startsWith("/admin/news/"))}
      <div
        className="hidden px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.08em] lg:block"
        style={{ color: "var(--color-admin-fg-soft)" }}
      >
        Content
      </div>
      {DOCUMENT_IDS.map((id) =>
        item(`/admin/${id}`, DOCUMENTS[id].label, pathname === `/admin/${id}` || pathname.startsWith(`/admin/${id}/`))
      )}
    </nav>
  );
}
