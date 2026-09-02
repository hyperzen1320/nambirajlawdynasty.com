"use client";

import { useState } from "react";
import { ecourtsCnrUrl } from "@/lib/ecourts";

// Renders a CNR as a clickable token. On click it copies the CNR to the
// clipboard AND opens the eCourts CNR-search page (with a best-effort
// prefill) in a new tab — so the advocate just solves the captcha and
// pastes. Used in the Case Vault table, the case detail hero, and the
// disposed-cases archive — anywhere a CNR is shown.

export default function CnrLink({
  cnr,
  className,
  tone = "copper",
}: {
  cnr: string | null | undefined;
  className?: string;
  // "copper" for light surfaces (tables, archive), "ivory" for the dark
  // ink hero on the case detail page.
  tone?: "copper" | "ivory";
}) {
  const [copied, setCopied] = useState(false);
  const clean = (cnr || "").trim();

  if (!clean) {
    return <span style={{ color: "var(--color-app-fg-muted)" }}>—</span>;
  }

  async function openEcourts(e: React.MouseEvent) {
    // Stop the click from bubbling to any parent row/link handler.
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(clean);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* Clipboard blocked (insecure context / denied) — the eCourts tab
         still opens, the advocate just types the CNR. */
    }
    window.open(ecourtsCnrUrl(clean), "_blank", "noopener,noreferrer");
  }

  const baseColor =
    tone === "ivory"
      ? "var(--color-app-copper-bright)"
      : "var(--color-app-copper-deep)";

  return (
    <button
      type="button"
      onClick={openEcourts}
      title="Open in eCourts — the CNR is copied to your clipboard so you can paste it past the captcha"
      className={className}
      style={{
        fontFamily: "var(--font-dm-mono), monospace",
        color: copied ? "var(--color-app-aqua)" : baseColor,
        backgroundColor: "transparent",
        textDecorationLine: "underline",
        textDecorationStyle: "dotted",
        textUnderlineOffset: 3,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: 0,
      }}
    >
      <span>{clean}</span>
      {copied ? (
        <span
          className="text-[9px] uppercase tracking-[0.14em]"
          style={{ textDecoration: "none" }}
        >
          copied ✓
        </span>
      ) : (
        <ExternalIcon />
      )}
    </button>
  );
}

function ExternalIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ flexShrink: 0, opacity: 0.75 }}
    >
      <path
        d="M14 5h5v5M19 5l-8 8M11 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
