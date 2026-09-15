import type { Metadata } from "next";

// The CMS lives under /admin, outside the public site's header, footer and
// disclaimer. It uses the "Plex Modern" admin tokens from globals.css.

export const metadata: Metadata = {
  title: { default: "CMS · Nambiraj Law Dynasty", template: "%s · CMS" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen antialiased"
      style={{
        backgroundColor: "var(--color-admin-bg)",
        color: "var(--color-admin-fg)",
        fontFamily: "var(--font-plex-sans), system-ui, sans-serif",
      }}
    >
      {children}
    </div>
  );
}
