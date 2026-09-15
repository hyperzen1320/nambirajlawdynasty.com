import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Image from "next/image";
import HeritageHero from "@/components/HeritageHero";
import Reveal from "@/components/Reveal";
import { getDocument } from "@/cms/content";
import type { DocumentData } from "@/cms/documents";
import { imageProps } from "@/cms/image";

// NAMBIRAJ LAW DYNASTY — Our Team. Navy masthead carrying the founder's
// portrait, then the bench as portrait cards. Members, their order and their
// photos come from the "Our Team page" CMS document. A member with a photo
// shows the headshot; without one the tile falls back to the gold monogram on
// navy, so the grid stays even while portraits are still being collected.

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getDocument("team");
  return { title: seo.title, description: seo.description };
}

const playfair = "var(--font-playfair), Georgia, serif";
const inter = "var(--font-inter), system-ui, sans-serif";

type Member = DocumentData<"team">["members"][number];

export default async function OurTeamPage() {
  const { hero, founder, members } = await getDocument("team");
  const founderPhoto = portrait(founder.photo);

  return (
    <>
      <HeritageHero
        eyebrow={hero.eyebrow}
        title={hero.title}
        lead={hero.lead}
        portrait={
          founderPhoto
            ? { src: founderPhoto, name: founder.name, role: founder.role }
            : undefined
        }
      />

      <section
        style={{
          backgroundColor:
            "color-mix(in oklch, var(--color-heritage-stone) 35%, white)",
        }}
      >
        <div className="mx-auto max-w-[1320px] px-6 py-16 md:px-10 md:py-24">
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((m, i) => (
              <Reveal key={`${m.name}-${i}`} delay={(i % 3) * 0.06} className="h-full">
                <TeamCard member={m} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

// A photo is either an upload (a Supabase Storage URL) or a file dropped into
// /public/team. A local path whose file hasn't landed yet falls back to the
// monogram rather than a broken image. Server-rendered, so this reflects the
// folder as it stands.
function portrait(photo: string) {
  if (!photo) return undefined;
  if (!photo.startsWith("/")) return photo;
  return fs.existsSync(path.join(process.cwd(), "public", photo))
    ? photo
    : undefined;
}

function initialsOf(member: Member) {
  if (member.initials.trim()) return member.initials.trim().slice(0, 3);
  const words = member.name.replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 1);
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join("");
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
            {...imageProps(photo)}
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
              {initialsOf(member)}
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
          {member.focus.map((f, i) => (
            <span
              key={`${f}-${i}`}
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
