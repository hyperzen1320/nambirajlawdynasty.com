"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { NavItem } from "@/lib/nav";

const inter = "var(--font-inter), system-ui, sans-serif";

// Desktop dropdown for a nav entry that has children ("The Firm"). Opens on
// hover for pointer users and on click/Enter for keyboard and touch, so the
// parent is never a hover-only dead end. A short close delay keeps the panel
// from vanishing while the pointer crosses the gap into it.
export default function NavDropdown({
  item,
  active,
}: {
  item: NavItem;
  active: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  useEffect(() => cancelClose, []);

  const children = item.children ?? [];

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        className="flex items-center gap-1.5 whitespace-nowrap text-[12.5px] uppercase tracking-[0.14em] transition-colors"
        style={{
          fontFamily: inter,
          fontWeight: 500,
          color: active
            ? "var(--color-heritage-gold-deep)"
            : "var(--color-heritage-navy)",
        }}
      >
        {item.name}
        <svg
          width="9"
          height="9"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden
          className="transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        >
          <path
            d="M1.5 3.5L5 7l3.5-3.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div
          className="fade-up-sm absolute left-1/2 top-full z-50 mt-4 min-w-[210px] -translate-x-1/2 border py-2 shadow-[0_28px_54px_-30px_rgba(10,16,28,0.55)]"
          style={{
            backgroundColor: "var(--color-heritage-paper)",
            borderColor: "var(--color-heritage-border)",
          }}
        >
          {/* hover bridge across the gap between trigger and panel */}
          <span aria-hidden className="absolute inset-x-0 -top-4 h-4" />
          {children.map((child) => (
            <Link
              key={child.name}
              href={child.href}
              onClick={() => setOpen(false)}
              className="block px-5 py-3 text-[12px] uppercase tracking-[0.13em] transition-colors hover:bg-[color-mix(in_oklch,var(--color-heritage-stone)_45%,white)]"
              style={{
                fontFamily: inter,
                fontWeight: 500,
                color: "var(--color-heritage-navy)",
              }}
            >
              {child.name}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
