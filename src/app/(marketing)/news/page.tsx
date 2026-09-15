import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import HeritageHero from "@/components/HeritageHero";
import Reveal from "@/components/Reveal";
import { getDocument } from "@/cms/content";
import { imageProps } from "@/cms/image";
import { getPublishedNews } from "@/cms/news";
import { formatNewsDate } from "@/cms/news-fields";

// NAMBIRAJ LAW DYNASTY — News. Navy masthead, then every published post as a
// card, newest first. Anyone can read it; posts are written in the admin
// (News posts) and appear here the moment they're published.

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getDocument("news-page");
  return { title: seo.title, description: seo.description };
}

const playfair = "var(--font-playfair), Georgia, serif";
const inter = "var(--font-inter), system-ui, sans-serif";

export default async function NewsPage() {
  const [page, posts] = await Promise.all([getDocument("news-page"), getPublishedNews()]);

  return (
    <>
      <HeritageHero eyebrow={page.hero.eyebrow} title={page.hero.title} lead={page.hero.lead} />

      <section
        style={{
          backgroundColor: "color-mix(in oklch, var(--color-heritage-stone) 35%, white)",
        }}
      >
        <div className="mx-auto max-w-[1320px] px-6 py-16 md:px-10 md:py-24">
          {posts.length ? (
            <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post, i) => (
                <Reveal key={post.id} delay={(i % 3) * 0.06} className="h-full">
                  <Link
                    href={`/news/${post.slug}`}
                    className="group flex h-full flex-col overflow-hidden border border-[var(--color-heritage-border)] bg-white transition-shadow duration-300 hover:shadow-[0_34px_64px_-34px_rgba(10,16,28,0.5)]"
                  >
                    <div
                      className="relative aspect-[16/10] w-full overflow-hidden"
                      style={{
                        background: "linear-gradient(160deg, var(--color-heritage-navy) 0%, #0b1422 100%)",
                      }}
                    >
                      {post.coverImage ? (
                        <Image
                          {...imageProps(post.coverImage)}
                          alt=""
                          fill
                          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span
                            className="text-[46px]"
                            style={{ fontFamily: playfair, color: "var(--color-heritage-gold)" }}
                          >
                            §
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      {post.publishedOn ? (
                        <time
                          dateTime={post.publishedOn}
                          className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                          style={{ fontFamily: inter, color: "var(--color-heritage-gold-deep)" }}
                        >
                          {formatNewsDate(post.publishedOn)}
                        </time>
                      ) : null}
                      <h2
                        className="mt-3 text-[22px] leading-[1.25] tracking-[-0.01em]"
                        style={{ fontFamily: playfair, color: "var(--color-heritage-navy)" }}
                      >
                        {post.title}
                      </h2>
                      {post.excerpt ? (
                        <p
                          className="mt-3 text-[14.5px] leading-7"
                          style={{ fontFamily: inter, color: "var(--color-heritage-muted)" }}
                        >
                          {post.excerpt}
                        </p>
                      ) : null}
                      <span
                        className="mt-auto pt-5 text-[12px] font-semibold uppercase tracking-[0.16em] underline-offset-4 group-hover:underline"
                        style={{ fontFamily: inter, color: "var(--color-heritage-navy)" }}
                      >
                        {page.readMoreLabel || "Read more"} <span aria-hidden>→</span>
                      </span>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          ) : (
            <p
              className="mx-auto max-w-xl py-10 text-center text-[17px] leading-8"
              style={{ fontFamily: inter, color: "var(--color-heritage-muted)" }}
            >
              {page.emptyMessage}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
