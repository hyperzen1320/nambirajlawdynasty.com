"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import type { FeatureMap } from "@/lib/features";

// The responsive app shell. On desktop (lg+) it's the classic two-column
// grid: a 260px sidebar rail + content. Below lg the sidebar becomes an
// off-canvas drawer opened by the topbar hamburger, over a dim overlay, so
// the whole app is usable on a phone or tablet. The drawer state lives here
// (client) while the layout stays a server component for data fetching.
export default function AppShell({
  partnerName,
  user,
  isAdmin,
  features,
  children,
}: {
  partnerName: string;
  user: { firstName: string; lastName: string; email: string };
  isAdmin: boolean;
  features: FeatureMap;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer on any navigation (tapping a nav item or a link).
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Esc closes the drawer; lock body scroll while it's open so the page
  // behind doesn't scroll under the overlay.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen]);

  // If the viewport grows to desktop while the drawer is open, close it so
  // we don't leave a stuck overlay / locked scroll.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setDrawerOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="app-shell grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
      <Sidebar
        partnerName={partnerName}
        user={user}
        isAdmin={isAdmin}
        features={features}
        drawerOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Dim overlay behind the mobile drawer */}
      {drawerOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-40 bg-black/45 lg:hidden"
        />
      ) : null}

      {/* min-w-0 + overflow-x-hidden keep wide children (tables, grids)
          from pushing the column past the viewport — they scroll inside
          their own wrappers instead of breaking the page. */}
      <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden">
        <Topbar onMenuClick={() => setDrawerOpen(true)} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
