"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Logo from "./Logo";
import type { Brand, NavItem } from "@/lib/nav";

const playfair = "var(--font-playfair), Georgia, serif";
const inter = "var(--font-inter), system-ui, sans-serif";

// Mobile navigation for the NAMBIRAJ company site. A hamburger (lg:hidden)
// opens a full-screen sheet with the nav + Client Login. Esc closes, body
// scroll locks while open, focus moves into the sheet, and it auto-closes if
// the viewport grows to desktop.
export default function MobileMenu({ nav, brand }: { nav: NavItem[]; brand: Brand }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu-sheet"
        onClick={() => setOpen((o) => !o)}
        className="-mr-1 flex h-10 w-10 items-center justify-center"
        style={{ color: "var(--color-heritage-navy)" }}
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>

      {open
        ? createPortal(
            <div
              id="mobile-menu-sheet"
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Site menu"
              tabIndex={-1}
              className="fade-up-sm fixed inset-0 z-50 flex flex-col outline-none lg:hidden"
              style={{ backgroundColor: "var(--color-heritage-paper)" }}
            >
              <div className="mx-auto flex w-full max-w-[1320px] items-center justify-between px-6 py-5">
                <Link href="/" onClick={close} className="flex items-center gap-3 leading-none">
                  <Logo src={brand.logo} size={40} className="shrink-0" />
                  <span>
                    <span
                      className="block text-[22px] font-bold tracking-[0.06em]"
                      style={{ fontFamily: playfair, color: "var(--color-heritage-navy)" }}
                    >
                      {brand.name}
                    </span>
                    <span
                      className="mt-1 block text-[10px] tracking-[0.32em]"
                      style={{ fontFamily: inter, color: "var(--color-heritage-muted)" }}
                    >
                      {brand.tagline}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={close}
                  className="-mr-1 flex h-10 w-10 items-center justify-center"
                  style={{ color: "var(--color-heritage-navy)" }}
                >
                  <CloseIcon />
                </button>
              </div>

              <nav className="mx-auto w-full max-w-[1320px] flex-1 overflow-y-auto px-6 py-6">
                <div style={{ borderTop: "1px solid var(--color-heritage-border)" }}>
                  {nav.map((item) => (
                    <div
                      key={item.label}
                      style={{
                        borderBottom: "1px solid var(--color-heritage-border)",
                      }}
                    >
                      <Link
                        href={item.href}
                        onClick={close}
                        className="block pt-5 pb-5 text-[26px] transition-colors"
                        style={{
                          fontFamily: playfair,
                          color: "var(--color-heritage-navy)",
                          paddingBottom: item.children?.length ? "0.5rem" : undefined,
                        }}
                      >
                        {item.label}
                      </Link>
                      {/* Sub-pages sit inline rather than behind an accordion —
                          there are only two, and a tap fewer is worth more than
                          the tidiness on a sheet this short. */}
                      {item.children?.length ? (
                        <div className="pb-4 pl-4">
                          {item.children.map((child) => (
                            <Link
                              key={child.label}
                              href={child.href}
                              onClick={close}
                              className="block py-2 text-[14px] uppercase tracking-[0.14em] transition-colors"
                              style={{
                                fontFamily: inter,
                                fontWeight: 500,
                                color: "var(--color-heritage-muted)",
                              }}
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </nav>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
