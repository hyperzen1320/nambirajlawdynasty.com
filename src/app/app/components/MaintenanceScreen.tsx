import Logo from "@/components/Logo";

// Shown in place of the whole office app when the global admin has turned on
// maintenance mode. Global admins are unaffected (they operate via /admin).
export default function MaintenanceScreen({ message }: { message: string }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{ backgroundColor: "var(--color-app-canvas)" }}
    >
      <div className="max-w-md text-center">
        <div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ backgroundColor: "var(--color-app-paper)" }}
        >
          <Logo size={40} />
        </div>
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.22em]"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            color: "var(--color-app-copper-deep)",
          }}
        >
          Down for maintenance
        </div>
        <h1
          className="mt-3 text-[28px] font-semibold tracking-tight"
          style={{
            fontFamily: "var(--font-crimson), Georgia, serif",
            color: "var(--color-app-ink)",
          }}
        >
          We&rsquo;ll be right back.
        </h1>
        <p
          className="mt-3 text-[14px] leading-relaxed"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-fg-muted)",
          }}
        >
          {message ||
            "Legalezi is undergoing scheduled maintenance. Please check back in a little while."}
        </p>
      </div>
    </div>
  );
}
