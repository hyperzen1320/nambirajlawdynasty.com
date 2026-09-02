import Link from "next/link";
import HeritageHero from "@/components/HeritageHero";
import Reveal from "@/components/Reveal";

// NAMBIRAJ LAW DYNASTY — Services. Navy masthead, then seven numbered
// service groups. Each group keeps a sticky gold-numbered label on the left
// while its cards scroll alongside, and every group settles into view as you
// reach it. Cards fill heritage navy on hover. Closes with a consult CTA.

export const metadata = {
  title: "Services — Nambiraj Law Dynasty",
  description:
    "A full spectrum of legal services — from courtroom advocacy to quiet, careful drafting — delivered with the ethical rigor that has defined our practice since 1969.",
};

const playfair = "var(--font-playfair), Georgia, serif";
const inter = "var(--font-inter), system-ui, sans-serif";

const GROUPS = [
  {
    n: "01",
    title: "Litigation & Dispute Resolution",
    desc: "Representation and advocacy across trial courts and the High Court, with thorough case preparation at every stage.",
    items: [
      {
        name: "Trial Court Representation",
        blurb:
          "Conducting civil, criminal and family matters before district and metropolitan courts with thorough preparation of pleadings and evidence.",
      },
      {
        name: "High Court Practice",
        blurb:
          "Drafting and arguing writs, appeals and revisions before the High Court with rigorous case preparation.",
      },
      {
        name: "Arbitration & Mediation",
        blurb:
          "Cost-effective resolution of commercial and civil disputes through institutional and ad-hoc arbitration, conciliation and mediation.",
      },
    ],
  },
  {
    n: "02",
    title: "Advisory & Counseling",
    desc: "Strategic legal counsel for individuals, families and enterprises facing complex or recurring legal questions.",
    items: [
      {
        name: "Strategic Legal Opinions",
        blurb:
          "Reasoned written opinions on contentious points of law, regulatory exposure and litigation risk.",
      },
      {
        name: "Retainer Advisory",
        blurb:
          "Ongoing counsel for businesses and HNIs covering day-to-day legal queries, compliance and risk reviews.",
      },
      {
        name: "Pre-Litigation Strategy",
        blurb:
          "Notice drafting, negotiation and settlement structuring to resolve matters before they reach the courtroom.",
      },
    ],
  },
  {
    n: "03",
    title: "Drafting & Documentation",
    desc: "Precision drafting of contracts, deeds and personal instruments — clear, enforceable and tailored to intent.",
    items: [
      {
        name: "Contracts & Agreements",
        blurb:
          "Commercial contracts, service agreements, NDAs, leases, MoUs and shareholder arrangements.",
      },
      {
        name: "Conveyancing & Title Deeds",
        blurb:
          "Sale deeds, gift deeds, partition deeds, mortgages and releases drafted with full title verification.",
      },
      {
        name: "Wills, Trusts & Succession",
        blurb:
          "Confidential preparation of wills, family settlements, trust deeds and succession planning instruments.",
      },
    ],
  },
  {
    n: "04",
    title: "Property & Real Estate",
    desc: "End-to-end property practice — from due diligence through registration and dispute defence.",
    items: [
      {
        name: "Title Search & Due Diligence",
        blurb:
          "Verification of ownership, encumbrances and statutory clearances before purchase or financing.",
      },
      {
        name: "Land & Property Disputes",
        blurb:
          "Recovery of possession, specific performance, partition suits and boundary disputes.",
      },
      {
        name: "Registration & Mutation",
        blurb:
          "Coordination of registration, stamp duty and revenue mutation across applicable authorities.",
      },
    ],
  },
  {
    n: "05",
    title: "Corporate, Tax & Regulatory",
    desc: "Practical counsel for businesses navigating compliance, structuring and regulatory engagement.",
    items: [
      {
        name: "Corporate Compliance",
        blurb:
          "Companies Act, FEMA, labour and sectoral compliance — periodic filings, registers and audit support.",
      },
      {
        name: "Taxation & Revenue Disputes",
        blurb:
          "Representation in income tax, GST, customs and stamp duty proceedings, including appellate forums.",
      },
      {
        name: "Regulatory Liaison",
        blurb:
          "Engagement with statutory authorities, licensing bodies and tribunals on behalf of clients.",
      },
    ],
  },
  {
    n: "06",
    title: "Registrations & Statutory Filings",
    desc: "End-to-end assistance with statutory registrations and identity instruments required to start, run and formalise a business.",
    items: [
      {
        name: "GST Registration & Filings",
        blurb:
          "New GST registration, monthly and annual return filings, amendments, cancellations and representation in GST proceedings.",
      },
      {
        name: "FSSAI Food Licence",
        blurb:
          "Basic, State and Central FSSAI registrations and renewals for food businesses, traders, manufacturers and cloud kitchens.",
      },
      {
        name: "Company & LLP Registration",
        blurb:
          "Incorporation of Private Limited Companies, LLPs, OPCs and partnership firms, including MoA/AoA drafting and post-incorporation compliance.",
      },
      {
        name: "Digital Signature Certificate (DSC)",
        blurb:
          "Issuance and renewal of Class 3 Digital Signature Certificates for individuals, directors and authorised signatories.",
      },
      {
        name: "PAN & TAN Applications",
        blurb:
          "Fresh PAN and TAN applications, corrections, reprints and linkage with statutory records for individuals and entities.",
      },
    ],
  },
  {
    n: "07",
    title: "Notarial & Allied Services",
    desc: "Practical, day-to-day legal services that support both individuals and ongoing client matters.",
    items: [
      {
        name: "Notarisation & Attestation",
        blurb:
          "Affidavits, declarations, indemnities, power of attorney and document attestations.",
      },
      {
        name: "Court & Document Filing",
        blurb:
          "Filing, certified copy applications and procedural follow-ups across courts and registries.",
      },
      {
        name: "Legal Audits & Research",
        blurb:
          "Bespoke legal research, case-law studies and internal legal audits for institutional clients.",
      },
    ],
  },
];

export default function ServicesPage() {
  return (
    <>
      <HeritageHero
        eyebrow="What We Do"
        title="Services"
        lead="A full spectrum of legal services — from courtroom advocacy to quiet, careful drafting — delivered with the ethical rigor that has defined our practice since 1969."
      />

      <div
        style={{
          backgroundColor:
            "color-mix(in oklch, var(--color-heritage-stone) 35%, white)",
        }}
      >
        {GROUPS.map((g, gi) => (
          <section
            key={g.n}
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
                      {g.n}
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
                    <p
                      className="mt-5 max-w-xs text-[15px] leading-7"
                      style={{
                        fontFamily: inter,
                        color: "var(--color-heritage-muted)",
                      }}
                    >
                      {g.desc}
                    </p>
                  </Reveal>
                </div>

                {/* Service cards */}
                <div className="md:col-span-8">
                  <div className="grid gap-5 sm:grid-cols-2">
                    {g.items.map((it, i) => (
                      <Reveal
                        key={it.name}
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
                    Not sure which service applies?
                  </h2>
                  <p
                    className="mt-3 max-w-xl text-[16px] leading-7"
                    style={{
                      fontFamily: inter,
                      color: "var(--color-heritage-muted)",
                    }}
                  >
                    Share a brief and we will route your matter to the right
                    counsel within the firm.
                  </p>
                </div>
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
                  Request a Consultation
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </div>
    </>
  );
}
