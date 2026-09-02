// Shared navy masthead for the company sub-pages (The Firm, Practicing Area,
// Services, Our Team, Contact). A gold eyebrow, a large Playfair title, and a
// lead — the same opening the reference firm site uses, on the heritage navy
// band — with a scroll cue inviting the reader down into the page.

import ScrollCue from "./ScrollCue";

const playfair = "var(--font-playfair), Georgia, serif";
const inter = "var(--font-inter), system-ui, sans-serif";

export default function HeritageHero({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <section className="relative" style={{ backgroundColor: "var(--color-heritage-navy)" }}>
      <div className="mx-auto max-w-[1320px] px-6 py-24 md:px-10 md:py-32">
        <div
          className="text-[12px] uppercase tracking-[0.28em]"
          style={{ fontFamily: inter, color: "var(--color-heritage-gold)" }}
        >
          {eyebrow}
        </div>
        <h1
          className="mt-6 max-w-4xl text-[42px] leading-[1.05] tracking-[-0.01em] text-white sm:text-[58px] md:text-[72px]"
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
      <ScrollCue />
    </section>
  );
}
