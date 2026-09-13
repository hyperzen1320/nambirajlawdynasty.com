// Shared admin class names. A plain module (not "use client") so server and
// client components alike receive the actual strings.

export const linkButton =
  "inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-1.5 text-[13px] font-medium transition-colors border-[var(--color-admin-border)] hover:bg-[var(--color-admin-bg-sidebar)]";

export const primaryButton =
  "inline-flex cursor-pointer items-center gap-1 rounded-lg px-4 py-2 text-[13.5px] font-medium text-white transition-colors hover:bg-[var(--color-admin-accent-hover)] bg-[var(--color-admin-accent)] disabled:cursor-not-allowed disabled:opacity-50";

export const card = "rounded-xl border border-[var(--color-admin-border)] bg-[var(--color-admin-surface)]";
