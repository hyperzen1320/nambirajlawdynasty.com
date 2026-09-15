import Link from "next/link";
import type { ReactNode } from "react";
import Logo from "./Logo";
import type { DocumentData } from "@/cms/documents";

const playfair = "var(--font-playfair), Georgia, serif";
const inter = "var(--font-inter), system-ui, sans-serif";

const SOCIAL_ICONS: Record<string, { name: string; icon: ReactNode }> = {
  instagram: { name: "Instagram", icon: <InstagramIcon /> },
  facebook: { name: "Facebook", icon: <FacebookIcon /> },
  linkedin: { name: "LinkedIn", icon: <LinkedInIcon /> },
  youtube: { name: "YouTube", icon: <YouTubeIcon /> },
  x: { name: "X", icon: <XIcon /> },
};

export default function Footer({ site }: { site: DocumentData<"site"> }) {
  const { brand, nav, contact, social, footer } = site;

  // The office column reads top-to-bottom like a letterhead: address lines,
  // then every phone on one line, then the email.
  const office = [
    ...contact.address.split("\n").map((l) => l.trim()).filter(Boolean),
    contact.phones.map((p) => p.display).filter(Boolean).join(" · "),
    contact.email,
  ].filter(Boolean);

  return (
    <footer style={{ backgroundColor: "var(--color-heritage-navy)" }}>
      <div className="mx-auto max-w-[1320px] px-6 py-16 md:px-10 md:py-20">
        <div className="grid gap-12 md:grid-cols-12">
          {/* Brand */}
          <div className="md:col-span-5">
            <div className="flex items-center gap-3.5">
              <Logo src={brand.logo} size={54} className="shrink-0" />
              <div
                className="text-[22px] font-bold leading-[1.1] tracking-[0.04em] md:text-[26px]"
                style={{ fontFamily: playfair, color: "#ffffff" }}
              >
                {brand.name}
                {brand.tagline ? (
                  <>
                    <br />
                    {brand.tagline}
                  </>
                ) : null}
              </div>
            </div>
            {footer.about ? (
              <p
                className="mt-6 max-w-sm text-[15px] leading-7"
                style={{ fontFamily: inter, color: "rgba(255,255,255,0.62)" }}
              >
                {footer.about}
              </p>
            ) : null}
          </div>

          {/* Explore */}
          <div className="md:col-span-3">
            <div
              className="text-[11px] uppercase tracking-[0.22em]"
              style={{ fontFamily: inter, color: "var(--color-heritage-gold)" }}
            >
              {footer.exploreHeading}
            </div>
            <ul className="mt-5 space-y-3">
              {nav.map((item, i) => (
                <li key={`${item.label}-${i}`}>
                  <Link
                    href={item.href || "/"}
                    className="text-[14px] transition-colors hover:text-white"
                    style={{ fontFamily: inter, color: "rgba(255,255,255,0.75)" }}
                  >
                    {item.label}
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
              {footer.officeHeading}
            </div>
            <div className="mt-5 space-y-2">
              {office.map((line, i) => (
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
        {social.length ? (
          <div className="mt-14 flex items-center justify-center gap-4">
            {social
              .filter((s) => s.url && SOCIAL_ICONS[s.platform])
              .map((s, i) => {
                const { name, icon } = SOCIAL_ICONS[s.platform];
                const external = s.url.startsWith("http");
                return (
                  <a
                    key={`${s.platform}-${i}`}
                    href={s.url}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noopener noreferrer" : undefined}
                    aria-label={name}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors hover:bg-[var(--color-heritage-gold)] hover:text-[var(--color-heritage-navy)]"
                    style={{
                      borderColor: "rgba(255,255,255,0.2)",
                      color: "var(--color-heritage-gold)",
                    }}
                  >
                    {icon}
                  </a>
                );
              })}
          </div>
        ) : null}

        {footer.copyright ? (
          <div
            className="mt-10 border-t pt-6 text-center text-[11px] uppercase tracking-[0.2em]"
            style={{
              fontFamily: inter,
              borderColor: "rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            {footer.copyright}
          </div>
        ) : null}
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

function YouTubeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.27 5 12 5 12 5s-6.27 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.76 1.77C5.73 19 12 19 12 19s6.27 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78zm-1.08 16.2h1.7L7.4 4.73H5.58z" />
    </svg>
  );
}
