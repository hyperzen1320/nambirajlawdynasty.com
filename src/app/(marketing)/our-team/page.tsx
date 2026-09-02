import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import HeritageHero from "@/components/HeritageHero";
import Reveal from "@/components/Reveal";

// NAMBIRAJ LAW DYNASTY — Our Team. Navy masthead, then the bench as portrait
// cards. Give a member a `photo` (a file in /public/team) and the tile shows the
// headshot; leave it off and it falls back to the gold monogram on navy, so the
// grid stays even while portraits are still being collected.

export const metadata = {
  title: "Our Team — Nambiraj Law Dynasty",
  description:
    "The advocates and counsel who carry the Nambiraj Law Dynasty forward — specialists across litigation, corporate, property and advisory practice.",
};

const playfair = "var(--font-playfair), Georgia, serif";
const inter = "var(--font-inter), system-ui, sans-serif";

type Member = {
  initials: string;
  name: string;
  /** Optional — omitted until the designation is confirmed. */
  role?: string;
  /** Optional — the card closes up neatly when there is no copy yet. */
  bio?: string;
  focus: string[];
  /** Path under /public, e.g. "/team/n-sureka.jpg". Omit for the monogram. */
  photo?: string;
};

const TEAM: Member[] = [
  {
    initials: "CN",
    name: "Mr. C. Nambiraj",
    role: "Founder · Senior Advocate",
    bio: "He was an intellectual legend who entered practice in 1969 and focused on the welfare of the under-privileged with absolute grace and humility.",
    focus: [],
    photo: "/team/c-nambiraj.jpg",
  },
  {
    initials: "NS",
    name: "N. Sureka",
    role: "Partner · Senior Advocate",
    bio: "Successor to the dynasty's founder. Trial and appellate advocacy across civil, commercial and family matters, with a record of hard-fought, thoroughly prepared cases.",
    focus: ["Litigation", "Family"],
    photo: "/team/n-sureka.jpg",
  },
  {
    initials: "NG",
    name: "Nagendhran. S",
    role: "Managing Partner · Administration",
    bio: "The visionary behind the Nambiraj Law Dynasty platform, committed to blending law, technology and professional excellence. Inspired by the legacy of Senior Advocate C. Nambiraj.",
    focus: ["Administration", "Technology"],
    photo: "/team/nagendhran-s.jpg",
  },
  {
    initials: "LP",
    name: "L. Pachappan",
    role: "Senior Associate · Criminal Defence",
    bio: "Disciple of C. Nambiraj. Defence strategy and bail-to-trial representation, with a steady focus on protecting constitutional rights.",
    focus: ["Criminal", "Bail"],
    photo: "/team/l-pachappan.jpg",
  },
  {
    initials: "SB",
    name: "Sanjay Balamurugaen",
    role: "Associate Advocate · Real Estate",
    bio: "Handling civil matters and real estate — end-to-end property disputes.",
    focus: ["Real Estate", "Civil"],
    photo: "/team/sanjay-balamurugaen.jpg",
  },
  {
    initials: "SA",
    name: "Syed Safeer Ahmed",
    role: "Senior Advocate Clerk",
    bio: "Handling all clerical work for the chambers.",
    focus: ["Clerical"],
    photo: "/team/syed-safeer-ahmed.jpg",
  },
  {
    initials: "GP",
    name: "G. Pradeepa",
    role: "Junior Associate · Criminal",
    bio: "Assisting on criminal matters from bail to trial.",
    focus: ["Criminal", "Trial"],
    photo: "/team/g-pradeepa.jpg",
  },
  {
    initials: "NB",
    name: "N. Balaji",
    role: "Junior Associate · Civil",
    bio: "Assisting on all civil matters.",
    focus: ["Civil"],
    photo: "/team/n-balaji.jpg",
  },
  {
    initials: "TS",
    name: "S. Tharani Shree",
    role: "Junior Advocate · Civil",
    focus: ["Civil"],
    photo: "/team/s-tharani-shree.jpg",
  },
  {
    initials: "SS",
    name: "S. Saranya",
    role: "Junior Advocate · Civil",
    focus: ["Civil"],
    photo: "/team/s-saranya.jpg",
  },
  {
    initials: "KK",
    name: "K. Kalaimathi",
    role: "Junior Advocate · Family",
    focus: ["Family"],
    photo: "/team/k-kalaimathi.jpg",
  },
  {
    initials: "AB",
    name: "S. Abinaya",
    role: "Junior Advocate · Civil & Criminal",
    focus: ["Civil", "Criminal"],
    photo: "/team/s-abinaya.jpg",
  },
  {
    initials: "AK",
    name: "A. Kannadhasan",
    focus: [],
    photo: "/team/a-kannadhasan.jpg",
  },
  {
    initials: "CA",
    name: "V. Cecilia Abigail",
    focus: [],
    photo: "/team/v-cecilia-abigail.jpg",
  },
];

export default function OurTeamPage() {
  return (
    <>
      <HeritageHero
        eyebrow="The People"
        title="Our Team"
        lead="The advocates and counsel who carry the Nambiraj Law Dynasty forward — each a specialist, all held to the same standard of diligence and discretion."
      />

      <section
        style={{
          backgroundColor:
            "color-mix(in oklch, var(--color-heritage-stone) 35%, white)",
        }}
      >
        <div className="mx-auto max-w-[1320px] px-6 py-16 md:px-10 md:py-24">
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {TEAM.map((m, i) => (
              <Reveal key={m.name} delay={(i % 3) * 0.06} className="h-full">
                <TeamCard member={m} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section
        className="border-t"
        style={{
          borderColor: "var(--color-heritage-border)",
          backgroundColor:
            "color-mix(in oklch, var(--color-heritage-stone) 35%, white)",
        }}
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
                  Work with our bench.
                </h2>
                <p
                  className="mt-3 max-w-xl text-[16px] leading-7"
                  style={{
                    fontFamily: inter,
                    color: "var(--color-heritage-muted)",
                  }}
                >
                  Tell us about your matter and we&rsquo;ll route it to the right
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
    </>
  );
}

// Portraits are dropped into /public/team by the chambers, so a card must not
// break on a file that has not landed yet — an unresolved path falls back to
// the monogram. Server-rendered, so this reflects the folder as it stands.
function portrait(photo: string | undefined) {
  if (!photo) return undefined;
  return fs.existsSync(path.join(process.cwd(), "public", photo))
    ? photo
    : undefined;
}

function TeamCard({ member }: { member: Member }) {
  const photo = portrait(member.photo);

  return (
    <article className="group flex h-full flex-col overflow-hidden border border-[var(--color-heritage-border)] bg-white transition-shadow duration-300 hover:shadow-[0_34px_64px_-34px_rgba(10,16,28,0.5)]">
      {/* Portrait — headshot when we have one, gold monogram until then */}
      <div
        className="relative aspect-[4/5] w-full overflow-hidden"
        style={{
          background:
            "linear-gradient(160deg, var(--color-heritage-navy) 0%, #0b1422 100%)",
        }}
      >
        {photo ? (
          <Image
            src={photo}
            alt={member.name}
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
            className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : null}

        {/* navy wash so a photographed tile still reads as part of the bench */}
        {photo ? (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(10,16,28,0) 55%, rgba(10,16,28,0.18) 100%)",
            }}
          />
        ) : null}

        {/* faint gold inset frame */}
        <div
          aria-hidden
          className="absolute inset-5 border transition-[inset] duration-300 group-hover:inset-4"
          style={{ borderColor: "rgba(212,175,90,0.35)" }}
        />
        {/* soft top sheen */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 50% 0%, rgba(212,175,90,0.12), transparent 60%)",
          }}
        />
        {photo ? null : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="text-[58px] tracking-[0.06em] transition-transform duration-300 group-hover:scale-105"
              style={{ fontFamily: playfair, color: "var(--color-heritage-gold)" }}
            >
              {member.initials}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col p-6">
        <h3
          className="text-[22px] tracking-[-0.01em]"
          style={{
            fontFamily: playfair,
            color: "var(--color-heritage-navy)",
          }}
        >
          {member.name}
        </h3>
        {member.role ? (
          <div
            className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{
              fontFamily: inter,
              color: "var(--color-heritage-gold-deep)",
            }}
          >
            {member.role}
          </div>
        ) : null}
        {member.bio ? (
          <p
            className="mt-3 text-[14px] leading-7"
            style={{ fontFamily: inter, color: "var(--color-heritage-muted)" }}
          >
            {member.bio}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          {member.focus.map((f) => (
            <span
              key={f}
              className="border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em]"
              style={{
                fontFamily: inter,
                borderColor: "var(--color-heritage-border)",
                color: "var(--color-heritage-navy)",
              }}
            >
              {f}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
