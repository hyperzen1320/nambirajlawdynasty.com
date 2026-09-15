import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminState } from "@/cms/auth";
import { NEWS_COLUMNS, rowToPost, type NewsRow } from "@/cms/news-fields";
import { getSupabaseConfig } from "@/lib/supabase/config";
import NewsEditor from "../NewsEditor";

export const metadata: Metadata = { title: "Edit post" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditNewsPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const state = await getAdminState();
  if (state.status !== "ok") return null;

  const { data, error } = await state.supabase.from("news_posts").select(NEWS_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Couldn't load the post: ${error.message}`);
  if (!data) notFound();

  const row = data as NewsRow;
  const post = rowToPost(row);

  return (
    <NewsEditor
      key={row.version}
      id={row.id}
      initialData={{ title: post.title, slug: post.slug, publishedOn: post.publishedOn, published: post.published, coverImage: post.coverImage, excerpt: post.excerpt, body: post.body }}
      version={row.version}
      updatedAt={row.updated_at}
      updatedBy={row.updated_by_email}
      supabase={getSupabaseConfig()}
    />
  );
}
