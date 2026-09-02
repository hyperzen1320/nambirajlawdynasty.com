"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import MobileMenu from "./MobileMenu";
import Logo from "./Logo";
import NavDropdown from "./NavDropdown";
import { NAV } from "@/lib/nav";

const playfair = "var(--font-playfair), Georgia, serif";
const inter = "var(--font-inter), system-ui, sans-serif";

export default function Header() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      className="sticky top-0 z-40 border-b"
      style={{
        backgroundColor: "var(--color-heritage-paper)",
        borderColor: "var(--color-heritage-border)",
      }}
    >
      <div className="relative mx-auto flex max-w-[1320px] items-center justify-between gap-6 px-6 py-5 md:px-10">
        {/* Wordmark */}
        <Link href="/" className="flex items-center gap-3 leading-none">
          <Logo size={44} priority className="shrink-0" />
          <span>
            <span
              className="block text-[22px] font-bold tracking-[0.06em]"
              style={{ fontFamily: playfair, color: "var(--color-heritage-navy)" }}
            >
              NAMBIRAJ
            </span>
            <span
              className="mt-1 block text-[10px] tracking-[0.32em]"
              style={{ fontFamily: inter, color: "var(--color-heritage-muted)" }}
            >
              LAW DYNASTY
            </span>
          </span>
        </Link>

        {/* Centre nav */}
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-6 md:flex lg:gap-8">
          {NAV.map((item) =>
            item.children?.length ? (
              <NavDropdown
                key={item.name}
                item={item}
                active={isActive(item.href)}
              />
            ) : (
              <Link
                key={item.name}
                href={item.href}
                className="text-[12.5px] uppercase tracking-[0.14em] transition-colors"
                style={{
                  fontFamily: inter,
                  fontWeight: 500,
                  color: isActive(item.href)
                    ? "var(--color-heritage-gold-deep)"
                    : "var(--color-heritage-navy)",
                }}
              >
                {item.name}
              </Link>
            )
          )}
        </nav>

        <MobileMenu nav={NAV} />
      </div>
    </header>
  );
}
