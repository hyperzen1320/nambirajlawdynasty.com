import Link from "next/link";
import Image from "next/image";
import { LOGO_MARK_JPG, LOGO_W, LOGO_H } from "@/lib/brand";

// Editorial footer for the Legalezi product surface. Mirrors the reference
// columns; links resolve to the product's own sections, the company pages
// (About / Contact) and the app where a real destination exists.

const COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: "Product",
    links: [
      ["Cabinet", "/product#cabinet"],
      ["Pricing", "/product#pricing"],
      ["Document Export", "/product#export"],
      ["Mobile App", "/product"],
    ],
  },
  {
    title: "Office",
    links: [
      ["Case Vault", "/product#cabinet"],
      ["Hearing Track", "/product#cabinet"],
      ["Court Hub", "/product#cabinet"],
      ["Senior Desk", "/product#cabinet"],
    ],
  },
  {
    title: "Chambers",
    links: [
      ["About", "/about"],
      ["Press", "/product#export"],
      ["Careers", "/contact"],
      ["Contact", "/contact"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Terms", "/product#access"],
      ["Privacy", "/product#access"],
      ["Compliance", "/product#access"],
      ["Status", "/product#access"],
    ],
  },
];

export default function ProductFooter() {
  return (
    <footer className="border-t border-rule/40 bg-paper-2/40">
      <div className="mx-auto max-w-[1320px] px-6 py-16 md:px-10 md:py-20">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="flex items-center gap-3.5">
              <span className="flex h-14 w-14 items-center justify-center rounded-[10px] bg-white ring-1 ring-rule/50 shadow-[0_2px_8px_rgba(14,26,43,0.10)]">
                <Image
                  src={LOGO_MARK_JPG}
                  alt="Legalezi"
                  width={LOGO_W}
                  height={LOGO_H}
                  className="object-contain"
                  style={{ height: 38, width: "auto" }}
                />
              </span>
              <div className="font-display text-[36px] font-medium leading-none tracking-tight text-ink">
                Legalezi
              </div>
            </div>
            <p className="mt-5 max-w-sm font-body text-[15px] leading-7 text-ink-2">
              An advocate office, set in order. Built in India for the way
              matters actually move — from cause-list mornings to senior-desk
              briefings, to filings at midnight.
            </p>
            <div className="mt-8 font-mono text-[10px] uppercase tracking-[0.22em] text-brass-deep">
              <span className="mr-3 inline-block h-px w-8 bg-brass align-middle" />
              Made in India
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 md:col-span-6 md:col-start-7 md:grid-cols-4">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass-deep">
                  {col.title}
                </div>
                <ul className="mt-5 space-y-3">
                  {col.links.map(([label, href]) => (
                    <li key={label}>
                      <Link
                        href={href}
                        className="font-body text-[14px] text-ink-2 transition-colors hover:text-ink"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-5 border-t border-rule/40 pt-6 md:flex-row md:items-end">
          <address className="not-italic">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass-deep">
              Nambiraj Law Dynasty LLP
            </div>
            <div className="mt-2 font-body text-[13px] leading-6 text-ink-2">
              H-14, T.N.H.B. Colony, 2nd Phase, Krishnagiri – 635 002
            </div>
            <div className="mt-0.5 font-body text-[13px] leading-6 text-ink-soft">
              +91 93537 04141 · +91 63695 04141 ·{" "}
              <a
                href="mailto:nambirajlawdynasty@gmail.com"
                className="underline-offset-2 transition-colors hover:text-ink hover:underline"
              >
                nambirajlawdynasty@gmail.com
              </a>
            </div>
          </address>
          <div className="shrink-0 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
            © 2026 Legalezi. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
