import { cacheLife, cacheTag } from "next/cache";
import { createPublicSupabase } from "@/lib/supabase/public";
import { NEWS_COLUMNS, rowToPost, type NewsPost, type NewsRow } from "./news-fields";

// Public reads of published news, cached under one tag that the admin's news
// actions expire. Row level security only ever returns published posts to
// these cookie-less reads, and the query asks for them explicitly as well.

export const NEWS_TAG = "cms:news";

export async function getPublishedNews(): Promise<NewsPost[]> {
  "use cache";
  cacheTag(NEWS_TAG);

  const supabase = createPublicSupabase();
  if (!supabase) {
    cacheLife("minutes");
    return [];
  }

  const { data, error } = await supabase
    .from("news_posts")
    .select(NEWS_COLUMNS)
    .eq("published", true)
    .order("published_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("[cms] couldn't load news:", error.message);
    cacheLife("minutes");
    return [];
  }

  cacheLife("hours");
  return (data as NewsRow[]).map(rowToPost);
}

export async function getPublishedNewsPost(slug: string): Promise<NewsPost | null> {
  "use cache";
  cacheTag(NEWS_TAG);

  const supabase = createPublicSupabase();
  if (!supabase) {
    cacheLife("minutes");
    return null;
  }

  const { data, error } = await supabase
    .from("news_posts")
    .select(NEWS_COLUMNS)
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (error) {
    console.error(`[cms] couldn't load news post "${slug}":`, error.message);
    cacheLife("minutes");
    return null;
  }

  cacheLife("hours");
  return data ? rowToPost(data as NewsRow) : null;
}
