import type { Metadata } from "next";
import HeritageHero from "@/components/HeritageHero";
import Reveal from "@/components/Reveal";
import { getDocument } from "@/cms/content";

// NAMBIRAJ LAW DYNASTY — Practicing Areas. Navy masthead, then the domains as
// a seamless bordered grid; each cell fills heritage navy on hover and settles
// in as it scrolls into view. The list comes from the "Practicing Area page"
// CMS document and is numbered in the order the editor sets.

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getDocument("practice-areas");
  return { title: seo.title, description: seo.description };
}

const playfair = "var(--font-playfair), Georgia, serif";
const inter = "var(--font-inter), system-ui, sans-serif";

export default async function PracticingAreaPage() {
  const { hero, areas } = await getDocument("practice-areas");

  return (
    <>
      <HeritageHero eyebrow={hero.eyebrow} title={hero.title} lead={hero.lead} />

      <section
        style={{
          backgroundColor:
            "color-mix(in oklch, var(--color-heritage-stone) 45%, white)",
        }}
      >
        <div className="mx-auto max-w-[1320px] px-6 py-16 md:px-10 md:py-24">
          <div
            className="grid gap-px overflow-hidden md:grid-cols-2 lg:grid-cols-3"
            style={{ backgroundColor: "var(--color-heritage-border)" }}
          >
            {areas.map((a, i) => (
              <Reveal key={`${a.name}-${i}`} delay={(i % 3) * 0.06} className="h-full">
                <article className="group flex h-full flex-col bg-white p-8 transition-colors duration-300 ease-out hover:bg-[var(--color-heritage-navy)] md:p-10">
                  <div
                    className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--color-heritage-gold-deep)] transition-colors duration-300 group-hover:text-[var(--color-heritage-gold)]"
                    style={{ fontFamily: inter }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3
                    className="mt-5 text-[26px] tracking-[-0.01em] text-[var(--color-heritage-navy)] transition-colors duration-300 group-hover:text-white"
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
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
