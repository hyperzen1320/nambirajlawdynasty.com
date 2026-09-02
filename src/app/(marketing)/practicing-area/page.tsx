import HeritageHero from "@/components/HeritageHero";
import Reveal from "@/components/Reveal";

// NAMBIRAJ LAW DYNASTY — Practicing Areas. Navy masthead, then the nine
// domains as a seamless bordered grid; each cell fills heritage navy on
// hover and settles in as it scrolls into view.

export const metadata = {
  title: "Practicing Areas — Nambiraj Law Dynasty",
  description:
    "Nine domains of practice supported by a team of talented professionals and decades of institutional memory.",
};

const playfair = "var(--font-playfair), Georgia, serif";
const inter = "var(--font-inter), system-ui, sans-serif";

const AREAS = [
  {
    n: "01",
    name: "Civil Litigation",
    blurb:
      "Comprehensive representation in civil disputes — contracts, property, commercial and personal matters.",
  },
  {
    n: "02",
    name: "Criminal Defense",
    blurb:
      "Rigorous defense strategies in trial and appellate courts protecting constitutional rights.",
  },
  {
    n: "03",
    name: "Family Law",
    blurb:
      "Discreet, compassionate counsel for matrimonial, succession, custody and maintenance matters.",
  },
  {
    n: "04",
    name: "Corporate & Business Law",
    blurb:
      "Advising businesses on governance, compliance, contracts and regulatory frameworks.",
  },
  {
    n: "05",
    name: "Property & Real Estate",
    blurb: "Title verification, land disputes, conveyancing and registration.",
  },
  {
    n: "06",
    name: "Constitutional Law",
    blurb: "Writ petitions, fundamental rights and public interest litigation.",
  },
  {
    n: "07",
    name: "Governmental Affairs",
    blurb:
      "Navigating regulatory frameworks with deep institutional knowledge.",
  },
  {
    n: "08",
    name: "Arbitration & Mediation",
    blurb: "Out-of-court dispute resolution with practical commercial sense.",
  },
  {
    n: "09",
    name: "Taxation & Revenue",
    blurb: "Direct and indirect tax disputes, advisory and assessments.",
  },
];

export default function PracticingAreaPage() {
  return (
    <>
      <HeritageHero
        eyebrow="Expertise"
        title="Practicing Areas"
        lead="Nine domains of practice supported by a team of talented professionals and decades of institutional memory."
      />

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
            {AREAS.map((a, i) => (
              <Reveal key={a.name} delay={(i % 3) * 0.06} className="h-full">
                <article className="group flex h-full flex-col bg-white p-8 transition-colors duration-300 ease-out hover:bg-[var(--color-heritage-navy)] md:p-10">
                  <div
                    className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--color-heritage-gold-deep)] transition-colors duration-300 group-hover:text-[var(--color-heritage-gold)]"
                    style={{ fontFamily: inter }}
                  >
                    {a.n}
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
