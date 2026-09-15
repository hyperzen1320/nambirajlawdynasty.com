// Shared navy masthead for the company sub-pages (The Firm, Practicing Area,
// Services, Our Team, Contact). A gold eyebrow, a large Playfair title, and a
// lead — the same opening the reference firm site uses, on the heritage navy
// band — with a scroll cue inviting the reader down into the page.

import Image from "next/image";
import { imageProps } from "@/cms/image";
import ScrollCue from "./ScrollCue";

const playfair = "var(--font-playfair), Georgia, serif";
const inter = "var(--font-inter), system-ui, sans-serif";

export type HeroPortrait = {
  /** A path under /public or a Supabase Storage URL. */
  src: string;
  name: string;
  role?: string;
};

export default function HeritageHero({
  eyebrow,
  title,
  lead,
  portrait,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  // A framed portrait set in the right-hand side of the band, beside the
  // title and lead. Stacks under the text on narrower screens.
  portrait?: HeroPortrait;
}) {
  const eyebrowEl = (
    <div
      className="text-[12px] uppercase tracking-[0.28em]"
      style={{ fontFamily: inter, color: "var(--color-heritage-gold)" }}
    >
      {eyebrow}
    </div>
  );
  const titleClass =
    "mt-6 text-[42px] leading-[1.05] tracking-[-0.01em] text-white sm:text-[58px] md:text-[72px]";

  return (
    <section className="relative" style={{ backgroundColor: "var(--color-heritage-navy)" }}>
      {portrait ? (
        <div className="mx-auto grid max-w-[1320px] items-center gap-14 px-6 pb-28 pt-20 md:px-10 md:pb-32 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12 xl:gap-16">
          <div>
            {eyebrowEl}
            <h1 className={titleClass} style={{ fontFamily: playfair, fontWeight: 500 }}>
              {title}
            </h1>
            {lead ? (
              // Capped so the sentence wraps once on desktop; text-balance
              // then evens the two lines out.
              <p
                className="mt-7 max-w-[680px] text-balance text-[17px] leading-8 text-white/75"
                style={{ fontFamily: inter }}
              >
                {lead}
              </p>
            ) : null}
          </div>

          <figure className="mx-auto w-[240px] sm:w-[260px] lg:mx-0 lg:w-[240px] xl:w-[290px]">
            <div className="relative aspect-[3/4] overflow-hidden">
              <Image
                {...imageProps(portrait.src)}
                alt={portrait.name}
                fill
                preload
                sizes="(min-width: 1280px) 290px, 260px"
                className="object-cover object-top"
              />
              {/* faint gold inset frame, matching the team cards */}
              <div
                aria-hidden
                className="absolute inset-3 border"
                style={{ borderColor: "rgba(212,175,90,0.45)" }}
              />
            </div>
            <figcaption className="mt-7">
              <div
                className="text-[20px] leading-tight text-white"
                style={{ fontFamily: playfair }}
              >
                {portrait.name}
              </div>
              {portrait.role ? (
                <div
                  className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{ fontFamily: inter, color: "var(--color-heritage-gold)" }}
                >
                  {portrait.role}
                </div>
              ) : null}
            </figcaption>
          </figure>
        </div>
      ) : (
        <div className="mx-auto max-w-[1320px] px-6 py-24 md:px-10 md:py-32">
          {eyebrowEl}
          <h1
            className={`${titleClass} max-w-4xl`}
            style={{ fontFamily: playfair, fontWeight: 500 }}
          >
            {title}
          </h1>
          {lead ? (
            <p
              className="mt-7 max-w-2xl text-[17px] leading-8 text-white/75"
              style={{ fontFamily: inter }}
            >
              {lead}
            </p>
          ) : null}
        </div>
      )}
      <ScrollCue />
    </section>
  );
}
