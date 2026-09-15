import type { Metadata } from "next";
import Link from "next/link";
import { getAdminState } from "@/cms/auth";
import { NEWS_COLUMNS, formatNewsDate, rowToPost, type NewsRow } from "@/cms/news-fields";
import { formatWhen } from "../format";
import { card, linkButton, primaryButton } from "../styles";

export const metadata: Metadata = { title: "News posts" };

export default async function NewsListPage() {
  const state = await getAdminState();
  if (state.status !== "ok") return null;

  // Admins see drafts as well as published posts (row level security allows it).
  const { data, error } = await state.supabase
    .from("news_posts")
    .select(NEWS_COLUMNS)
    .order("published_on", { ascending: false })
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as NewsRow[];

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 lg:px-10 lg:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">News posts</h1>
          <p className="mt-1 text-[14px]" style={{ color: "var(--color-admin-fg-muted)" }}>
            Published posts appear on the public News page straight away. Drafts are only visible here.
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/news" target="_blank" rel="noopener noreferrer" className={linkButton}>
            View News page <span aria-hidden>↗</span>
          </a>
          <Link href="/admin/news/new" className={primaryButton}>
            + New post
          </Link>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-6 rounded-lg px-4 py-3 text-[13.5px]"
          style={{ backgroundColor: "var(--color-admin-warning-soft)", color: "var(--color-admin-warning)" }}
        >
          {error.code === "PGRST205" || error.code === "42P01"
            ? "The news_posts table doesn't exist yet — run the CMS migration in Supabase (see CMS.md)."
            : `Couldn't load posts: ${error.message}`}
        </p>
      ) : null}

      {rows.length ? (
        <ul className={`${card} mt-8 divide-y divide-[var(--color-admin-border-soft)]`}>
          {rows.map((row) => {
            const post = rowToPost(row);
            return (
              <li key={post.id}>
                <Link
                  href={`/admin/news/${post.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[var(--color-admin-bg)]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[14.5px] font-medium">{post.title || "Untitled post"}</div>
                    <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--color-admin-fg-soft)" }}>
                      {formatNewsDate(post.publishedOn)} · /news/{post.slug} · edited {formatWhen(row.updated_at)}
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
                    style={
                      post.published
                        ? { backgroundColor: "var(--color-admin-accent-soft)", color: "var(--color-admin-accent)" }
                        : { backgroundColor: "var(--color-admin-bg-sidebar)", color: "var(--color-admin-fg-muted)" }
                    }
                  >
                    {post.published ? "Published" : "Draft"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : !error ? (
        <div className={`${card} mt-8 px-6 py-12 text-center`}>
          <p className="text-[14.5px] font-medium">No posts yet</p>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--color-admin-fg-muted)" }}>
            Write the first one — it can stay a draft until you&rsquo;re ready.
          </p>
          <Link href="/admin/news/new" className={`${primaryButton} mt-5`}>
            + New post
          </Link>
        </div>
      ) : null}
    </main>
  );
}
