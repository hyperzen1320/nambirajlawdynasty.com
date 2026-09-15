import type { Metadata } from "next";
import ScrollCue from "@/components/ScrollCue";
import { getDocument } from "@/cms/content";
import type { DocumentData } from "@/cms/documents";
import { RichText } from "@/cms/rich";

// NAMBIRAJ LAW DYNASTY — About, a close replica of the reference: a navy
// hero with the 55+ practice bar, then the "Firm History" and "About Us"
// editorial splits. Playfair Display + Inter on the heritage palette. Copy
// comes from the "About page" CMS document; the section ids stay fixed because
// the menu's dropdown links point at them.

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getDocument("about");
  return { title: seo.title, description: seo.description };
}

const playfair = "var(--font-playfair), Georgia, serif";
const inter = "var(--font-inter), system-ui, sans-serif";
const NAVY = "var(--color-heritage-navy)";
const GOLD = "var(--color-heritage-gold)";
const GOLD_DEEP = "var(--color-heritage-gold-deep)";
const PAPER = "var(--color-heritage-paper)";
const BODY = "color-mix(in oklch, var(--color-heritage-navy) 78%, white)";

type About = DocumentData<"about">;

export default async function AboutPage() {
  const about = await getDocument("about");
  return (
    <>
      <AboutHero hero={about.hero} />
      <FirmHistory history={about.history} />
      <AboutFirm aboutUs={about.aboutUs} />
    </>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

function AboutHero({ hero }: { hero: About["hero"] }) {
  return (
    <section className="relative" style={{ backgroundColor: NAVY }}>
      <div className="mx-auto max-w-[1320px] px-6 py-24 md:px-10 md:py-32">
        <div
          className="text-[12px] uppercase tracking-[0.28em]"
          style={{ fontFamily: inter, color: GOLD }}
        >
          {hero.eyebrow}
        </div>
        <h1
          className="mt-6 max-w-4xl text-[42px] leading-[1.05] tracking-[-0.01em] text-white sm:text-[58px] md:text-[72px]"
          style={{ fontFamily: playfair, fontWeight: 500 }}
        >
          {hero.title}
        </h1>

        {/* practice bar */}
        {hero.statNumber || hero.statLabel ? (
          <div
            className="mt-12 flex max-w-xl items-center gap-6 px-7 py-6"
            style={{
              backgroundColor: "rgba(255,255,255,0.02)",
              borderTop: "1px solid rgba(255,255,255,0.12)",
              borderRight: "1px solid rgba(255,255,255,0.12)",
              borderBottom: "1px solid rgba(255,255,255,0.12)",
              borderLeft: `3px solid ${GOLD}`,
            }}
          >
            {hero.statNumber ? (
              <span
                className="text-[46px] leading-none"
                style={{ fontFamily: playfair, color: GOLD }}
              >
                {hero.statNumber}
              </span>
            ) : null}
            <span
              className="text-[12px] uppercase leading-5 tracking-[0.18em] text-white/85"
              style={{ fontFamily: inter }}
            >
              {hero.statLabel}
            </span>
          </div>
        ) : null}
      </div>
      <ScrollCue />
    </section>
  );
}

/* ──────────────────── Firm History ──────────────────── */

function FirmHistory({ history }: { history: About["history"] }) {
  return (
    <section id="firm-history" className="scroll-mt-24" style={{ backgroundColor: PAPER }}>
      <div className="mx-auto grid max-w-[1320px] gap-10 px-6 py-20 md:grid-cols-12 md:gap-16 md:px-10 md:py-28">
        <div className="md:col-span-4">
          <h2
            className="text-[32px] tracking-[-0.01em] md:text-[40px]"
            style={{ fontFamily: playfair, color: GOLD_DEEP }}
          >
            {history.heading}
          </h2>
        </div>
        <div
          className="space-y-6 md:col-span-8 md:text-justify"
          style={{ fontFamily: inter, color: BODY }}
        >
          <RichText
            text={history.body}
            className="text-[16px] leading-8"
            strong={{ fontWeight: 600, color: NAVY }}
          />
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── About the firm ──────────────────── */

function AboutFirm({ aboutUs }: { aboutUs: About["aboutUs"] }) {
  return (
    <section id="about-us" className="scroll-mt-24" style={{ backgroundColor: PAPER }}>
      <div
        className="mx-auto grid max-w-[1320px] gap-10 px-6 py-20 md:grid-cols-12 md:gap-16 md:px-10 md:py-28"
        style={{ borderTop: "1px solid var(--color-heritage-border)" }}
      >
        <div className="md:col-span-4">
          <h2
            className="text-[32px] tracking-[-0.01em] md:text-[40px]"
            style={{ fontFamily: playfair, color: GOLD_DEEP }}
          >
            {aboutUs.heading}
          </h2>
        </div>
        <div
          className="space-y-6 md:col-span-8 md:text-justify"
          style={{ fontFamily: inter, color: BODY }}
        >
          <RichText
            text={aboutUs.body}
            className="text-[16px] leading-8"
            strong={{ fontWeight: 600, color: NAVY }}
          />
        </div>
      </div>
    </section>
  );
}
