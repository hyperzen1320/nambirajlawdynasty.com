import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import ScrollCue from "@/components/ScrollCue";
import { getDocument } from "@/cms/content";
import type { DocumentData } from "@/cms/documents";
import { imageProps } from "@/cms/image";
import { inline } from "@/cms/rich";

// NAMBIRAJ LAW DYNASTY — company home, a close replica of the reference:
// hero over the library photo, the "Phenomenon" split, the practising-areas
// trio, and the modern-environment split. Playfair Display + Inter on the
// heritage navy / gold / paper palette. All copy and imagery come from the
// "Home page" CMS document.

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getDocument("home");
  return { title: seo.title, description: seo.description };
}

const playfair = "var(--font-playfair), Georgia, serif";
const inter = "var(--font-inter), system-ui, sans-serif";
const NAVY = "var(--color-heritage-navy)";
const GOLD = "var(--color-heritage-gold)";
const GOLD_DEEP = "var(--color-heritage-gold-deep)";
const PAPER = "var(--color-heritage-paper)";

type Home = DocumentData<"home">;

export default async function Home() {
  const home = await getDocument("home");
  return (
    <>
      <Hero hero={home.hero} />
      <Phenomenon founder={home.founder} />
      <PracticingAreas areas={home.areas} />
      <ModernEnvironment environment={home.environment} />
    </>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

function Hero({ hero }: { hero: Home["hero"] }) {
  return (
    <section className="relative flex min-h-[560px] items-center overflow-hidden md:min-h-[76vh]">
      {hero.image ? (
        <Image
          {...imageProps(hero.image)}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      ) : null}
      {/* darkening so the type sits cleanly */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(100deg, rgba(10,16,28,0.86) 0%, rgba(10,16,28,0.62) 45%, rgba(10,16,28,0.30) 100%)",
        }}
      />
      {/* Badge — centred at the crown of the hero, a quiet royal mark */}
      {hero.badge ? (
        <div className="absolute left-1/2 top-9 z-10 flex -translate-x-1/2 items-center gap-4 md:top-11">
          <span
            aria-hidden
            className="h-px w-10 sm:w-16"
            style={{ background: "linear-gradient(to right, transparent, var(--color-heritage-gold))" }}
          />
          <span
            className="whitespace-nowrap text-[13px] italic tracking-[0.32em] sm:text-[14px]"
            style={{ fontFamily: playfair, color: GOLD }}
          >
            {hero.badge}
          </span>
          <span
            aria-hidden
            className="h-px w-10 sm:w-16"
            style={{ background: "linear-gradient(to left, transparent, var(--color-heritage-gold))" }}
          />
        </div>
      ) : null}
      <div className="relative mx-auto w-full max-w-[1320px] px-6 py-20 md:px-10">
        <div className="max-w-2xl">
          <h1
            className="text-[42px] leading-[1.05] tracking-[-0.01em] text-white sm:text-[58px] md:text-[70px]"
            style={{ fontFamily: playfair, fontWeight: 500 }}
          >
            {hero.title}
          </h1>
          {hero.subtitle ? (
            <p
              className="mt-3 text-[26px] italic leading-[1.1] sm:text-[32px] md:text-[38px]"
              style={{ fontFamily: playfair, color: GOLD }}
            >
              {hero.subtitle}
            </p>
          ) : null}
          {hero.lead ? (
            <p
              className="mt-7 max-w-xl text-[17px] leading-8"
              style={{ fontFamily: inter, color: "rgba(255,255,255,0.78)" }}
            >
              {hero.lead}
            </p>
          ) : null}
        </div>
      </div>
      <ScrollCue />
    </section>
  );
}

/* ──────────────────── The Phenomenon ──────────────────── */

function Phenomenon({ founder }: { founder: Home["founder"] }) {
  const bodyColor = "color-mix(in oklch, var(--color-heritage-navy) 80%, white)";
  return (
    <section style={{ backgroundColor: PAPER }}>
      <div className="mx-auto grid max-w-[1320px] gap-12 px-6 py-20 md:grid-cols-12 md:gap-16 md:px-10 md:py-28">
        {/* Portrait + a quiet royal stat at its side — the years of practice
            stand proudly in the margin rather than overlaying the photograph. */}
        <div className="md:col-span-6">
          <div className="mx-auto flex w-full max-w-[440px] items-stretch gap-5 md:mx-0 md:max-w-none">
            <div
              className="relative aspect-[4/5] w-[74%] shrink-0 overflow-hidden"
              style={{ backgroundColor: "#e7ded0" }}
            >
              {founder.image ? (
                <Image
                  {...imageProps(founder.image)}
                  alt={founder.imageAlt}
                  fill
                  sizes="(min-width: 768px) 26vw, 50vw"
                  className="object-cover object-center"
                />
              ) : null}
            </div>
            <div className="flex flex-1 flex-col justify-end pb-1">
              <div
                className="text-[52px] leading-[0.85] md:text-[58px]"
                style={{ fontFamily: playfair, color: GOLD_DEEP }}
              >
                {founder.statNumber}
                {founder.statSuffix ? (
                  <span className="align-super text-[0.55em]">{founder.statSuffix}</span>
                ) : null}
              </div>
              <div className="mt-3 h-px w-10" style={{ backgroundColor: GOLD }} />
              <div
                className="mt-3 text-[10.5px] uppercase leading-5 tracking-[0.2em]"
                style={{
                  fontFamily: inter,
                  color: "color-mix(in oklch, var(--color-heritage-navy) 68%, white)",
                }}
              >
                {inline(founder.statLabel)}
              </div>
              {founder.statSince ? (
                <div
                  className="mt-4 text-[10.5px] uppercase tracking-[0.22em]"
                  style={{ fontFamily: inter, fontWeight: 600, color: GOLD_DEEP }}
                >
                  {founder.statSince}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Text — nudged down so the portrait rises above the heading,
            matching the reference composition. */}
        <div className="md:col-span-6 md:pl-4 md:pt-12">
          <h2
            className="text-[34px] leading-[1.12] tracking-[-0.01em] md:text-[44px]"
            style={{ fontFamily: playfair, color: NAVY }}
          >
            {inline(founder.heading)}
          </h2>
          {founder.intro ? (
            <p className="mt-6 text-[16px] leading-7" style={{ fontFamily: inter, color: bodyColor }}>
              {inline(founder.intro)}
            </p>
          ) : null}
          {founder.quote ? (
            <blockquote
              className="mt-6 border-l-2 pl-5 text-[16px] italic leading-7"
              style={{
                fontFamily: inter,
                borderColor: GOLD,
                color: "color-mix(in oklch, var(--color-heritage-navy) 78%, white)",
              }}
            >
              &ldquo;{founder.quote}&rdquo;
            </blockquote>
          ) : null}
          {founder.closing ? (
            <p className="mt-6 text-[16px] leading-7" style={{ fontFamily: inter, color: bodyColor }}>
              {inline(founder.closing)}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── Practicing Areas ─────────────────── */

const ICONS: Record<string, ReactNode> = {
  section: <span style={{ fontFamily: playfair, fontSize: 22 }}>§</span>,
  courthouse: <CourthouseIcon />,
  scales: <ScalesIcon />,
  gavel: <GavelIcon />,
  document: <DocumentIcon />,
  shield: <ShieldIcon />,
};

function PracticingAreas({ areas }: { areas: Home["areas"] }) {
  return (
    <section style={{ backgroundColor: "color-mix(in oklch, var(--color-heritage-stone) 45%, white)" }}>
      <div className="mx-auto max-w-[1320px] px-6 py-20 md:px-10 md:py-28">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div
              className="text-[12px] uppercase tracking-[0.24em]"
              style={{ fontFamily: inter, color: GOLD_DEEP }}
            >
              {areas.eyebrow}
            </div>
            <h2
              className="mt-3 text-[34px] tracking-[-0.01em] md:text-[44px]"
              style={{ fontFamily: playfair, color: NAVY }}
            >
              {areas.heading}
            </h2>
          </div>
          {areas.linkLabel ? (
            <Link
              href="/practicing-area"
              className="text-[12px] uppercase tracking-[0.18em] underline-offset-4 hover:underline"
              style={{ fontFamily: inter, fontWeight: 600, color: NAVY }}
            >
              {areas.linkLabel}
            </Link>
          ) : null}
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {areas.items.map((a, i) => (
            <div
              key={`${a.name}-${i}`}
              className="group border border-[var(--color-heritage-border)] bg-white p-8 transition-[background-color,border-color,box-shadow,transform] duration-300 ease-out hover:-translate-y-1 hover:border-[var(--color-heritage-navy)] hover:bg-[var(--color-heritage-navy)] hover:shadow-[0_34px_60px_-32px_rgba(10,16,28,0.55)]"
            >
              <div
                className="flex h-12 w-12 items-center justify-center bg-[color-mix(in_oklch,var(--color-heritage-gold)_20%,white)] text-[var(--color-heritage-gold-deep)] transition-colors duration-300 group-hover:bg-[var(--color-heritage-gold)] group-hover:text-[var(--color-heritage-navy)]"
              >
                {ICONS[a.icon] ?? ICONS.section}
              </div>
              <h3
                className="mt-6 text-[24px] tracking-[-0.01em] text-[var(--color-heritage-navy)] transition-colors duration-300 group-hover:text-white"
                style={{ fontFamily: playfair }}
              >
                {a.name}
              </h3>
              <p
                className="mt-3 text-[15px] leading-7 text-[var(--color-heritage-muted)] transition-colors duration-300 group-hover:text-white/75"
                style={{ fontFamily: inter }}
              >
                {a.blurb}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── A Modern Learning Environment ─────────────── */

function ModernEnvironment({ environment }: { environment: Home["environment"] }) {
  return (
    <section style={{ backgroundColor: PAPER }}>
      <div className="mx-auto grid max-w-[1320px] items-center gap-12 px-6 py-20 md:grid-cols-12 md:gap-16 md:px-10 md:py-28">
        <div className="md:col-span-5">
          <h2
            className="text-[34px] leading-[1.12] tracking-[-0.01em] md:text-[44px]"
            style={{ fontFamily: playfair, color: NAVY }}
          >
            {environment.heading}
          </h2>
          {environment.body ? (
            <p
              className="mt-6 text-[16px] leading-7"
              style={{ fontFamily: inter, color: "color-mix(in oklch, var(--color-heritage-navy) 78%, white)" }}
            >
              {inline(environment.body)}
            </p>
          ) : null}
          {environment.bullets.length ? (
            <ul className="mt-8 space-y-4">
              {environment.bullets.map((b, i) => (
                <li key={`${b}-${i}`} className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: GOLD }} />
                  <span
                    className="text-[13px] uppercase tracking-[0.16em]"
                    style={{ fontFamily: inter, fontWeight: 600, color: NAVY }}
                  >
                    {b}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="md:col-span-7">
          <div className="relative aspect-[2/1] w-full overflow-hidden">
            {environment.image ? (
              <Image
                {...imageProps(environment.image)}
                alt={environment.imageAlt}
                fill
                sizes="(min-width: 768px) 55vw, 100vw"
                className="object-cover"
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function CourthouseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 9l9-5 9 5M5 9v9M19 9v9M3 21h18M9 12v5M12 12v5M15 12v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ScalesIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 4v16M7 20h10M5 7h14M5 7l-2.5 6a3 3 0 0 0 5 0L5 7zM19 7l-2.5 6a3 3 0 0 0 5 0L19 7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function GavelIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M13.5 4.5l6 6M11 7l6 6M12.25 5.75l-4.5 4.5M16.25 9.75l-4.5 4.5M9.5 12l-6.5 6.5M4 21h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6zM9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
