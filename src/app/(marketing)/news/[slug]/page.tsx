import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDocument } from "@/cms/content";
import { imageProps } from "@/cms/image";
import { getPublishedNews, getPublishedNewsPost } from "@/cms/news";
import { formatNewsDate } from "@/cms/news-fields";
import { RichText } from "@/cms/rich";

// A single news article. Published posts known at build time are prerendered;
// one published later renders on its first visit and is cached from then on.

type Props = { params: Promise<{ slug: string }> };

// Cache Components needs at least one sample param to validate the route. With
// no posts yet, this placeholder can never match a real slug (slugs are
// lowercase letters, digits and dashes) and simply renders a 404.
const PLACEHOLDER = "__no-posts__";

export async function generateStaticParams() {
  const posts = await getPublishedNews();
  return posts.length ? posts.map((p) => ({ slug: p.slug })) : [{ slug: PLACEHOLDER }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = slug === PLACEHOLDER ? null : await getPublishedNewsPost(slug);
  if (!post) return { title: "News — Nambiraj Law Dynasty" };
  return {
    title: `${post.title} — Nambiraj Law Dynasty`,
    description: post.excerpt || undefined,
    openGraph: post.coverImage.startsWith("https://") ? { images: [post.coverImage] } : undefined,
  };
}

const playfair = "var(--font-playfair), Georgia, serif";
const inter = "var(--font-inter), system-ui, sans-serif";

export default async function NewsArticlePage({ params }: Props) {
  const { slug } = await params;
  const [post, page] = await Promise.all([
    slug === PLACEHOLDER ? null : getPublishedNewsPost(slug),
    getDocument("news-page"),
  ]);
  if (!post) notFound();

  return (
    <article>
      <header style={{ backgroundColor: "var(--color-heritage-navy)" }}>
        <div className="mx-auto max-w-[860px] px-6 pb-16 pt-14 md:px-10 md:pb-20 md:pt-20">
          <Link
            href="/news"
            className="text-[12px] uppercase tracking-[0.2em] transition-opacity hover:opacity-80"
            style={{ fontFamily: inter, color: "var(--color-heritage-gold)" }}
          >
            <span aria-hidden>←</span> {page.backLabel || "All news"}
          </Link>
          <h1
            className="mt-8 text-[36px] leading-[1.1] tracking-[-0.01em] text-white sm:text-[46px] md:text-[54px]"
            style={{ fontFamily: playfair, fontWeight: 500 }}
          >
            {post.title}
          </h1>
          {post.publishedOn ? (
            <time
              dateTime={post.publishedOn}
              className="mt-6 block text-[12px] font-semibold uppercase tracking-[0.18em] text-white/70"
              style={{ fontFamily: inter }}
            >
              {formatNewsDate(post.publishedOn)}
            </time>
          ) : null}
        </div>
      </header>

      <div style={{ backgroundColor: "var(--color-heritage-paper)" }}>
        <div className="mx-auto max-w-[860px] px-6 py-14 md:px-10 md:py-20">
          {post.coverImage ? (
            <div className="relative -mt-24 mb-12 aspect-[16/9] w-full overflow-hidden shadow-[0_30px_60px_-40px_rgba(10,16,28,0.6)] md:-mt-32">
              <Image
                {...imageProps(post.coverImage)}
                alt=""
                fill
                preload
                sizes="(min-width: 860px) 860px, 100vw"
                className="object-cover"
              />
            </div>
          ) : null}

          {post.excerpt ? (
            <p
              className="mb-8 text-[19px] leading-8"
              style={{ fontFamily: playfair, color: "var(--color-heritage-navy)" }}
            >
              {post.excerpt}
            </p>
          ) : null}

          <div
            className="space-y-6"
            style={{ fontFamily: inter, color: "color-mix(in oklch, var(--color-heritage-navy) 80%, white)" }}
          >
            <RichText
              text={post.body}
              className="text-[16.5px] leading-8"
              strong={{ fontWeight: 600, color: "var(--color-heritage-navy)" }}
            />
          </div>

          <div className="mt-14 border-t pt-8" style={{ borderColor: "var(--color-heritage-border)" }}>
            <Link
              href="/news"
              className="text-[12px] font-semibold uppercase tracking-[0.18em] underline-offset-4 hover:underline"
              style={{ fontFamily: inter, color: "var(--color-heritage-navy)" }}
            >
              <span aria-hidden>←</span> {page.backLabel || "All news"}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
