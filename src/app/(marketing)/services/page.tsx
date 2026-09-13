import type { Metadata } from "next";
import Link from "next/link";
import HeritageHero from "@/components/HeritageHero";
import Reveal from "@/components/Reveal";
import { getDocument } from "@/cms/content";

// NAMBIRAJ LAW DYNASTY — Services. Navy masthead, then numbered service
// groups. Each group keeps a sticky gold-numbered label on the left while its
// cards scroll alongside, and every group settles into view as you reach it.
// Cards fill heritage navy on hover. Closes with a consult CTA. Groups, cards
// and copy come from the "Services page" CMS document.

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getDocument("services");
  return { title: seo.title, description: seo.description };
}

const playfair = "var(--font-playfair), Georgia, serif";
const inter = "var(--font-inter), system-ui, sans-serif";

export default async function ServicesPage() {
  const { hero, groups, cta } = await getDocument("services");

  return (
    <>
      <HeritageHero eyebrow={hero.eyebrow} title={hero.title} lead={hero.lead} />

      <div
        style={{
          backgroundColor:
            "color-mix(in oklch, var(--color-heritage-stone) 35%, white)",
        }}
      >
        {groups.map((g, gi) => (
          <section
            key={`${g.title}-${gi}`}
            className={gi > 0 ? "border-t" : undefined}
            style={
              gi > 0
                ? { borderColor: "var(--color-heritage-border)" }
                : undefined
            }
          >
            <div className="mx-auto max-w-[1320px] px-6 py-14 md:px-10 md:py-20">
              <div className="grid gap-10 md:grid-cols-12 md:gap-12">
                {/* Sticky group label */}
                <div className="md:col-span-4 md:self-start md:sticky md:top-28">
                  <Reveal>
                    <div
                      className="text-[40px] leading-none md:text-[48px]"
                      style={{
                        fontFamily: playfair,
                        color: "var(--color-heritage-gold-deep)",
                      }}
                    >
                      {String(gi + 1).padStart(2, "0")}
                    </div>
                    <h2
                      className="mt-4 text-[28px] leading-[1.12] tracking-[-0.01em] md:text-[34px]"
                      style={{
                        fontFamily: playfair,
                        color: "var(--color-heritage-navy)",
                      }}
                    >
                      {g.title}
                    </h2>
                    <div
                      className="mt-5 h-px w-12"
                      style={{ backgroundColor: "var(--color-heritage-gold)" }}
                    />
                    {g.description ? (
                      <p
                        className="mt-5 max-w-xs text-[15px] leading-7"
                        style={{
                          fontFamily: inter,
                          color: "var(--color-heritage-muted)",
                        }}
                      >
                        {g.description}
                      </p>
                    ) : null}
                  </Reveal>
                </div>

                {/* Service cards */}
                <div className="md:col-span-8">
                  <div className="grid gap-5 sm:grid-cols-2">
                    {g.items.map((it, i) => (
                      <Reveal
                        key={`${it.name}-${i}`}
                        delay={(i % 2) * 0.06}
                        className="h-full"
                      >
                        <article className="group flex h-full flex-col border border-[var(--color-heritage-border)] bg-white p-7 transition-colors duration-300 ease-out hover:border-[var(--color-heritage-navy)] hover:bg-[var(--color-heritage-navy)]">
                          <h3
                            className="text-[19px] tracking-[-0.005em] text-[var(--color-heritage-navy)] transition-colors duration-300 group-hover:text-white"
                            style={{ fontFamily: playfair }}
                          >
                            {it.name}
                          </h3>
                          <p
                            className="mt-3 text-[14px] leading-7 text-[var(--color-heritage-muted)] transition-colors duration-300 group-hover:text-white/75"
                            style={{ fontFamily: inter }}
                          >
                            {it.blurb}
                          </p>
                        </article>
                      </Reveal>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ))}

        {/* Closing CTA */}
        {cta.heading ? (
          <section
            className="border-t"
            style={{ borderColor: "var(--color-heritage-border)" }}
          >
            <div className="mx-auto max-w-[1320px] px-6 py-16 md:px-10 md:py-24">
              <Reveal>
                <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2
                      className="text-[30px] tracking-[-0.01em] md:text-[40px]"
                      style={{
                        fontFamily: playfair,
                        color: "var(--color-heritage-navy)",
                      }}
                    >
                      {cta.heading}
                    </h2>
                    {cta.body ? (
                      <p
                        className="mt-3 max-w-xl text-[16px] leading-7"
                        style={{
                          fontFamily: inter,
                          color: "var(--color-heritage-muted)",
                        }}
                      >
                        {cta.body}
                      </p>
                    ) : null}
                  </div>
                  {cta.buttonLabel ? (
                    <Link
                      href="/contact"
                      className="shrink-0 px-8 py-4 text-[12px] uppercase tracking-[0.18em] transition-opacity hover:opacity-90"
                      style={{
                        fontFamily: inter,
                        fontWeight: 600,
                        backgroundColor: "var(--color-heritage-navy)",
                        color: "#ffffff",
                      }}
                    >
                      {cta.buttonLabel}
                    </Link>
                  ) : null}
                </div>
              </Reveal>
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
