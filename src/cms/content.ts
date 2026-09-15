import { cacheLife, cacheTag } from "next/cache";
import { createPublicSupabase } from "@/lib/supabase/public";
import { DOCUMENTS, type DocumentData, type DocumentId } from "./documents";
import { sanitizeDocument } from "./sanitize";

// Public reads of CMS content. Each document is cached under its own tag, so
// pages stay prerendered and fast; the admin's save action calls
// updateTag(documentTag(id)) and the change is live on the next request.
// Edits made outside the admin (e.g. straight in Supabase Studio) are picked
// up within the hour.

export const documentTag = (id: DocumentId) => `cms:${id}`;

export async function getDocument<K extends DocumentId>(id: K): Promise<DocumentData<K>> {
  "use cache";
  cacheTag(documentTag(id));

  const supabase = createPublicSupabase();
  if (!supabase) {
    // Not configured (e.g. a build without .env): serve the built-in copy but
    // retry soon, so a server that does have the settings takes over quickly.
    cacheLife("minutes");
    return DOCUMENTS[id].defaults;
  }

  const { data, error } = await supabase
    .from("cms_documents")
    .select("data")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(`[cms] couldn't load "${id}", serving built-in copy:`, error.message);
    cacheLife("minutes");
    return DOCUMENTS[id].defaults;
  }

  cacheLife("hours");
  return data ? sanitizeDocument(id, data.data) : DOCUMENTS[id].defaults;
}
