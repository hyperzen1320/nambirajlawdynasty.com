import Link from "next/link";
import Logo from "./Logo";
import { NAV } from "@/lib/nav";

const playfair = "var(--font-playfair), Georgia, serif";
const inter = "var(--font-inter), system-ui, sans-serif";

const OFFICE = [
  "Nambiraj Law Dynasty LLP.,",
  "H-14, T.N.H.B. Colony, 2nd Phase,",
  "Krishnagiri - 635 002",
  "+91 63695 04141 · 04343 225164",
  "nambirajlawdynasty@gmail.com",
];

const SOCIAL = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/nambirajlawdynasty",
    icon: <InstagramIcon />,
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/share/1KD26bRhzb/",
    icon: <FacebookIcon />,
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/in/nambiraj-law-dynasty-8251a0417",
    icon: <LinkedInIcon />,
  },
];

export default function Footer() {
  return (
    <footer style={{ backgroundColor: "var(--color-heritage-navy)" }}>
      <div className="mx-auto max-w-[1320px] px-6 py-16 md:px-10 md:py-20">
        <div className="grid gap-12 md:grid-cols-12">
          {/* Brand */}
          <div className="md:col-span-5">
            <div className="flex items-center gap-3.5">
              <Logo size={54} className="shrink-0" />
              <div
                className="text-[22px] font-bold leading-[1.1] tracking-[0.04em] md:text-[26px]"
                style={{ fontFamily: playfair, color: "#ffffff" }}
              >
                NAMBIRAJ
                <br />
                LAW DYNASTY
              </div>
            </div>
            <p
              className="mt-6 max-w-sm text-[15px] leading-7"
              style={{ fontFamily: inter, color: "rgba(255,255,255,0.62)" }}
            >
              Continuing a 55-year legacy of legal excellence. Dedicated to the
              vision of Mr. C. Nambiraj.
            </p>
          </div>

          {/* Explore */}
          <div className="md:col-span-3">
            <div
              className="text-[11px] uppercase tracking-[0.22em]"
              style={{ fontFamily: inter, color: "var(--color-heritage-gold)" }}
            >
              Explore
            </div>
            <ul className="mt-5 space-y-3">
              {NAV.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-[14px] transition-colors hover:text-white"
                    style={{ fontFamily: inter, color: "rgba(255,255,255,0.75)" }}
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Office */}
          <div className="md:col-span-4">
            <div
              className="text-[11px] uppercase tracking-[0.22em]"
              style={{ fontFamily: inter, color: "var(--color-heritage-gold)" }}
            >
              Office
            </div>
            <div className="mt-5 space-y-2">
              {OFFICE.map((line, i) => (
                <div
                  key={i}
                  className="text-[14px] leading-6"
                  style={{ fontFamily: inter, color: "rgba(255,255,255,0.75)" }}
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Social — centred, symbols only */}
        <div className="mt-14 flex items-center justify-center gap-4">
          {SOCIAL.map((s) => (
            <a
              key={s.name}
              href={s.href}
              target={s.href.startsWith("http") ? "_blank" : undefined}
              rel={s.href.startsWith("http") ? "noopener noreferrer" : undefined}
              aria-label={s.name}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors hover:bg-[var(--color-heritage-gold)] hover:text-[var(--color-heritage-navy)]"
              style={{
                borderColor: "rgba(255,255,255,0.2)",
                color: "var(--color-heritage-gold)",
              }}
            >
              {s.icon}
            </a>
          ))}
        </div>

        <div
          className="mt-10 border-t pt-6 text-center text-[11px] uppercase tracking-[0.2em]"
          style={{
            fontFamily: inter,
            borderColor: "rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          © 2026 Nambiraj Law Dynasty LLP. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

function InstagramIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.7c0-.9.26-1.5 1.55-1.5H16.7V4.3c-.29-.04-1.28-.13-2.43-.13-2.4 0-4.05 1.47-4.05 4.16v2.34H7.5V14h2.72v8z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4.98 3.5A2.5 2.5 0 1 1 5 8.5a2.5 2.5 0 0 1-.02-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21H19v-5.4c0-1.29-.02-2.95-1.8-2.95-1.8 0-2.08 1.4-2.08 2.85V21H9z" />
    </svg>
  );
}

