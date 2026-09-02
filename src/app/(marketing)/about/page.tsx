import Link from "next/link";
import ScrollCue from "@/components/ScrollCue";

// NAMBIRAJ LAW DYNASTY — About, a close replica of the reference: a navy
// hero with the 55+ practice bar, then the "Firm History" and "About Us"
// editorial splits. Playfair Display + Inter on the heritage palette.

export const metadata = {
  title: "About Us — Nambiraj Law Dynasty",
  description:
    "The phenomenon of Mr. C. Nambiraj — 55+ years of legal practice, continued today as the Nambiraj Law Dynasty.",
};

const playfair = "var(--font-playfair), Georgia, serif";
const inter = "var(--font-inter), system-ui, sans-serif";
const NAVY = "var(--color-heritage-navy)";
const GOLD = "var(--color-heritage-gold)";
const GOLD_DEEP = "var(--color-heritage-gold-deep)";
const PAPER = "var(--color-heritage-paper)";
const BODY = "color-mix(in oklch, var(--color-heritage-navy) 78%, white)";

export default function AboutPage() {
  return (
    <>
      <AboutHero />
      <FirmHistory />
      <AboutFirm />
    </>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

function AboutHero() {
  return (
    <section className="relative" style={{ backgroundColor: NAVY }}>
      <div className="mx-auto max-w-[1320px] px-6 py-24 md:px-10 md:py-32">
        <div
          className="text-[12px] uppercase tracking-[0.28em]"
          style={{ fontFamily: inter, color: GOLD }}
        >
          Our Firm
        </div>
        <h1
          className="mt-6 max-w-4xl text-[42px] leading-[1.05] tracking-[-0.01em] text-white sm:text-[58px] md:text-[72px]"
          style={{ fontFamily: playfair, fontWeight: 500 }}
        >
          About Nambiraj Law Dynasty
        </h1>

        {/* 55+ practice bar */}
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
          <span
            className="text-[46px] leading-none"
            style={{ fontFamily: playfair, color: GOLD }}
          >
            55+
          </span>
          <span
            className="text-[12px] uppercase leading-5 tracking-[0.18em] text-white/85"
            style={{ fontFamily: inter }}
          >
            Years of Legal Practice · Since 1969
          </span>
        </div>
      </div>
      <ScrollCue />
    </section>
  );
}

/* ──────────────────── Firm History ──────────────────── */

function FirmHistory() {
  return (
    <section id="firm-history" className="scroll-mt-24" style={{ backgroundColor: PAPER }}>
      <div className="mx-auto grid max-w-[1320px] gap-10 px-6 py-20 md:grid-cols-12 md:gap-16 md:px-10 md:py-28">
        <div className="md:col-span-4">
          <h2
            className="text-[32px] tracking-[-0.01em] md:text-[40px]"
            style={{ fontFamily: playfair, color: GOLD_DEEP }}
          >
            Firm History
          </h2>
        </div>
        <div
          className="space-y-6 md:col-span-8 md:text-justify"
          style={{ fontFamily: inter, color: BODY }}
        >
          <p className="text-[16px] leading-8">
            A good lawyer is not the man who has an eye to every side and angle
            of contingency, but who throws himself on your part so heartily that
            it makes him win in all situations. Mr. C. Nambiraj was such a
            legend — intellectual, smart, learned, cultured, resourceful, wise,
            modest, demure and exemplary.
          </p>
          <p className="text-[16px] leading-8">
            He fought for the rights of his clients, focusing on the welfare of
            the people exceptionally and principally for the under-privileged.
            He was honest and dedicated to his profession, and maintained an
            ethical practice throughout his lifetime with cordial relationships
            with his clients.
          </p>
          <p className="text-[16px] leading-8">
            He used his talents to the fullest, for all the right purposes — by
            living for what he believed in, by working very hard, respecting the
            people he worked with, and living with absolute grace and humility.
            These are the old fashioned, timeless values that made this man a
            phenomenon. He earned name, fame and men.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── About the firm ──────────────────── */

function AboutFirm() {
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
            About Us
          </h2>
        </div>
        <div
          className="space-y-6 md:col-span-8 md:text-justify"
          style={{ fontFamily: inter, color: BODY }}
        >
          <p className="text-[16px] leading-8">
            Mr. C. Nambiraj, the founder of this dynasty, began his practice in
            1969. After his demise in 2008, the office was succeeded by his
            daughter{" "}
            <strong style={{ fontWeight: 600, color: NAVY }}>N. Sureka</strong>,
            who has developed it into a team of talented legal professionals —
            guided by the principles of C. Nambiraj as{" "}
            <em>&ldquo;Nambiraj Law Dynasty&rdquo;</em>.
          </p>
          <p className="text-[16px] leading-8">
            We offer diverse legal, business and governmental backgrounds,
            bringing vast experience and practical knowledge to each client we
            represent. The firm prides itself on its commitment to knowing the
            law and encouraging its professionals to be at the forefront of the
            latest legal developments.
          </p>
          <p className="text-[16px] leading-8">
            The firm has built a learning environment, rich with mentoring
            relationships and knowledge sharing through invaluable publications,
            holistic frameworks and access to the most exclusive resources. We
            invest in technology and infrastructure that allows our
            professionals and clients to work more efficiently, collaborate
            effectively and maintain standards.
          </p>

          <div className="pt-4">
            <Link
              href="/contact"
              className="inline-block px-7 py-4 text-[12px] uppercase tracking-[0.18em] transition-opacity hover:opacity-90"
              style={{
                fontFamily: inter,
                fontWeight: 600,
                backgroundColor: GOLD,
                color: "#ffffff",
              }}
            >
              Consult Our Dynasty
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
