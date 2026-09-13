import type { Field, InferFields } from "./fields";
import { sanitizeFields } from "./sanitize";

// A news post. Unlike the page documents, posts are a growing collection, so
// each one is its own row in public.news_posts (see the migration); these
// fields drive the post editor in the admin exactly like a document's do.
// Client-safe: no server imports.

export const NEWS_POST_FIELDS = [
  { type: "text", name: "title", label: "Headline" },
  {
    type: "text",
    name: "slug",
    label: "Web address",
    help: "The end of the link, e.g. new-office-opening → /news/new-office-opening. Leave empty to make one from the headline.",
  },
  { type: "date", name: "publishedOn", label: "Date", help: "Posts are listed newest first by this date." },
  {
    type: "boolean",
    name: "published",
    label: "Published — visible to everyone on the News page",
  },
  { type: "image", name: "coverImage", label: "Cover image", help: "Optional." },
  { type: "textarea", name: "excerpt", label: "Summary", rows: 3, help: "Shown on the News page under the headline. Optional." },
  { type: "textarea", name: "body", label: "Article", rows: 16, rich: true },
] as const satisfies readonly Field[];

export type NewsPostData = InferFields<typeof NEWS_POST_FIELDS>;
export type NewsPost = NewsPostData & { id: string };

export const EMPTY_NEWS_POST: NewsPostData = {
  title: "",
  slug: "",
  publishedOn: "",
  published: false,
  coverImage: "",
  excerpt: "",
  body: "",
};

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Coerces editor input into a storable post. `today` fills a missing date. */
export function sanitizeNewsPost(raw: unknown, today: string): NewsPostData {
  const post = sanitizeFields(NEWS_POST_FIELDS, raw, EMPTY_NEWS_POST) as NewsPostData;
  post.title = post.title.trim();
  post.slug = slugify(post.slug || post.title) || `post-${today}`;
  if (!post.publishedOn) post.publishedOn = today;
  return post;
}

/* Database row ⇄ post. Column names are snake_case in Postgres. */

export type NewsRow = {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  published_on: string;
  cover_image: string;
  excerpt: string;
  body: string;
  version: number;
  updated_at: string;
  updated_by_email: string | null;
};

export const NEWS_COLUMNS =
  "id, slug, title, published, published_on, cover_image, excerpt, body, version, updated_at, updated_by_email";

export function rowToPost(row: NewsRow): NewsPost {
  return {
    id: row.id,
    title: row.title ?? "",
    slug: row.slug ?? "",
    publishedOn: row.published_on ?? "",
    published: Boolean(row.published),
    coverImage: row.cover_image ?? "",
    excerpt: row.excerpt ?? "",
    body: row.body ?? "",
  };
}

export function postToRow(post: NewsPostData) {
  return {
    slug: post.slug,
    title: post.title,
    published: post.published,
    published_on: post.publishedOn,
    cover_image: post.coverImage,
    excerpt: post.excerpt,
    body: post.body,
  };
}

/** "13 Sept 2026" — dates are calendar days, so format them in UTC. */
export function formatNewsDate(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}
