import Link from "next/link";
import Image from "next/image";
import { LOGO_MARK_JPG, LOGO_W, LOGO_H } from "@/lib/brand";

// Editorial masthead for the Legalezi product surface (/product, /login).
// Distinct from the NAMBIRAJ company Header — this is the product's own
// brand. Nav items deep-link into the product page's sections so they work
// from the login page too. "Sign in" is the route into the app.

const NAV = [
  { num: "01", name: "Cabinet", href: "/product#cabinet" },
  { num: "02", name: "A Day", href: "/product#chambers" },
  { num: "03", name: "Press", href: "/product#export" },
  { num: "04", name: "Prospectus", href: "/product#pricing" },
];

export default function ProductHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-rule/40 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-6 px-6 py-4 md:px-10">
        {/* Back to the public site + wordmark */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/"
            aria-label="Back to legalezi.com"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-rule/50 text-ink transition-colors hover:border-ink hover:bg-ink hover:text-paper"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M15 5l-7 7 7 7"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <Link href="/product" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[7px] bg-white ring-1 ring-rule/60 shadow-[0_1px_3px_rgba(14,26,43,0.10)]">
            <Image
              src={LOGO_MARK_JPG}
              alt="Legalezi"
              width={LOGO_W}
              height={LOGO_H}
              priority
              className="object-contain"
              style={{ height: 28, width: "auto" }}
            />
          </span>
          <span className="leading-none">
            <span className="block font-display text-[20px] font-medium tracking-tight text-ink">
              Legalezi
            </span>
            <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.28em] text-ink-soft">
              Advocate · Edition
            </span>
          </span>
          </Link>
        </div>

        {/* Section nav */}
        <nav className="hidden items-center gap-8 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="inline-flex items-baseline gap-1.5 font-body text-[15px] text-ink transition-colors hover:text-brass-deep"
            >
              <span className="font-mono text-[10px] tracking-[0.18em] text-brass">
                {item.num}
              </span>
              {item.name}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-4 sm:gap-5">
          <Link
            href="/login"
            className="font-body text-[15px] text-ink transition-colors hover:text-brass-deep"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="group inline-flex items-center gap-2 border border-ink bg-ink px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-ink-2"
          >
            Sign Up
            <span className="text-brass transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
