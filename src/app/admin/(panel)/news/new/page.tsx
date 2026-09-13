import type { Metadata } from "next";
import { getAdminState } from "@/cms/auth";
import { EMPTY_NEWS_POST } from "@/cms/news-fields";
import { getSupabaseConfig } from "@/lib/supabase/config";
import NewsEditor from "../NewsEditor";

export const metadata: Metadata = { title: "New post" };

export default async function NewNewsPostPage() {
  const state = await getAdminState();
  if (state.status !== "ok") return null;

  // Default the date to today in India (read after the session check, so this
  // is request-time work).
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

  return (
    <NewsEditor
      id={null}
      initialData={{ ...EMPTY_NEWS_POST, publishedOn: today }}
      version={null}
      updatedAt={null}
      updatedBy={null}
      supabase={getSupabaseConfig()}
    />
  );
}
