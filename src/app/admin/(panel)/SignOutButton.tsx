"use client";

import { useTransition } from "react";
import { signOut } from "../actions";

// Signs out, then does a full page load rather than a client navigation:
// Next keeps visited routes alive (Activity), and an editor's unsaved form
// state must not survive into the next person's session.
export default function SignOutButton({ variant = "link" }: { variant?: "link" | "button" }) {
  const [pending, startTransition] = useTransition();

  const onClick = () =>
    startTransition(async () => {
      await signOut();
      window.location.href = "/admin/login";
    });

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={
        variant === "button"
          ? "cursor-pointer rounded-lg border px-4 py-2 text-[13.5px] font-medium transition-colors hover:bg-[var(--color-admin-bg-sidebar)] border-[var(--color-admin-border)]"
          : "mt-1 cursor-pointer text-[13px] font-medium underline-offset-2 hover:underline"
      }
      style={variant === "link" ? { color: "var(--color-admin-accent)" } : undefined}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
