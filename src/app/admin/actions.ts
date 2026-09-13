"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getAdminState, isNetworkError, UNREACHABLE_MESSAGE } from "@/cms/auth";
import { documentTag } from "@/cms/content";
import { isDocumentId } from "@/cms/documents";
import { sanitizeDocument } from "@/cms/sanitize";
import { NEWS_TAG } from "@/cms/news";
import { postToRow, sanitizeNewsPost } from "@/cms/news-fields";

/* ───────────────────────────── session ───────────────────────────── */

export type SignInState = { error: string } | null;

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createServerSupabase();
  if (!supabase) {
    return {
      error: "The CMS isn't connected to Supabase yet — set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY on the server.",
    };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (isNetworkError(error)) return { error: UNREACHABLE_MESSAGE };
    return {
      error:
        error.code === "invalid_credentials"
          ? "That email and password don't match an account."
          : error.message,
    };
  }
  redirect("/admin");
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase?.auth.signOut();
}

/* ───────────────────────────── content ───────────────────────────── */

export type SaveResult =
  | { ok: true; version: number; updatedAt: string; data: Record<string, unknown> }
  | { ok: false; error: string; conflict?: boolean };

const CONFLICT: SaveResult = {
  ok: false,
  conflict: true,
  error:
    "Someone else saved this page after you opened it. Copy anything you need, reload to see their version, then re-apply your changes.",
};

async function requireEditor() {
  const state = await getAdminState();
  if (state.status === "ok") return state;
  if (state.status === "forbidden") return { error: "Your account isn't allowed to edit the site." };
  if (state.status === "unconfigured") return { error: "Supabase isn't configured on this server." };
  if (state.status === "unreachable") return { error: `${UNREACHABLE_MESSAGE} Your changes are still here — save again.` };
  return { error: "Your session has ended. Sign in again in a new tab, then save." };
}

/**
 * Saves a document. `baseVersion` is the version the editor loaded (null when
 * the document has never been saved); the write only lands if the row is
 * still at that version, so two editors can't silently overwrite each other.
 */
export async function saveDocument(
  id: string,
  data: unknown,
  baseVersion: number | null
): Promise<SaveResult> {
  if (!isDocumentId(id)) return { ok: false, error: "Unknown document." };
  const editor = await requireEditor();
  if ("error" in editor) return { ok: false, error: editor.error };

  const clean = sanitizeDocument(id, data) as Record<string, unknown>;
  const table = editor.supabase.from("cms_documents");

  let row: { version: number; updated_at: string } | undefined;
  if (baseVersion === null) {
    const { data: inserted, error } = await table
      .insert({ id, data: clean })
      .select("version, updated_at")
      .single();
    if (error) return error.code === "23505" ? CONFLICT : { ok: false, error: error.message };
    row = inserted;
  } else {
    const { data: updated, error } = await table
      .update({ data: clean })
      .eq("id", id)
      .eq("version", baseVersion)
      .select("version, updated_at");
    if (error) return { ok: false, error: error.message };
    if (!updated?.length) return CONFLICT;
    row = updated[0];
  }

  // Expire the cached copy: the next visitor gets the new content.
  updateTag(documentTag(id));
  return { ok: true, version: row.version, updatedAt: row.updated_at, data: clean };
}

export type RestoreResult = { ok: true } | { ok: false; error: string };

/** Puts an archived revision back. The version it replaces is archived in turn. */
export async function restoreRevision(id: string, revisionId: number): Promise<RestoreResult> {
  if (!isDocumentId(id)) return { ok: false, error: "Unknown document." };
  const editor = await requireEditor();
  if ("error" in editor) return { ok: false, error: editor.error };

  const { data: revision, error: readError } = await editor.supabase
    .from("cms_document_revisions")
    .select("data")
    .eq("id", revisionId)
    .eq("document_id", id)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!revision) return { ok: false, error: "That version no longer exists." };

  const { error } = await editor.supabase
    .from("cms_documents")
    .update({ data: sanitizeDocument(id, revision.data) })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  updateTag(documentTag(id));
  return { ok: true };
}

/* ─────────────────────────────── news ─────────────────────────────── */

/** Today's date in India, YYYY-MM-DD — the default date for a new post. */
function todayInIndia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

/**
 * Creates (id null) or updates a news post. Updates only land if the post is
 * still at `baseVersion`, like documents.
 */
export async function saveNewsPost(
  id: string | null,
  data: unknown,
  baseVersion: number | null
): Promise<SaveResult & { id?: string }> {
  const editor = await requireEditor();
  if ("error" in editor) return { ok: false, error: editor.error };

  const post = sanitizeNewsPost(data, todayInIndia());
  if (!post.title) return { ok: false, error: "Give the post a headline before saving." };

  const table = editor.supabase.from("news_posts");
  let row: { id: string; version: number; updated_at: string } | undefined;

  if (id === null) {
    const { data: inserted, error } = await table
      .insert(postToRow(post))
      .select("id, version, updated_at")
      .single();
    if (error) return newsError(error);
    row = inserted;
  } else {
    let query = table.update(postToRow(post)).eq("id", id);
    if (baseVersion !== null) query = query.eq("version", baseVersion);
    const { data: updated, error } = await query.select("id, version, updated_at");
    if (error) return newsError(error);
    if (!updated?.length) return CONFLICT;
    row = updated[0];
  }

  updateTag(NEWS_TAG);
  return {
    ok: true,
    id: row.id,
    version: row.version,
    updatedAt: row.updated_at,
    data: post as unknown as Record<string, unknown>,
  };
}

function newsError(error: { code?: string; message: string }): SaveResult {
  if (error.code === "23505") {
    return { ok: false, error: "Another post already uses this web address. Change the “Web address” field and save again." };
  }
  return { ok: false, error: error.message };
}

export async function deleteNewsPost(id: string): Promise<RestoreResult> {
  const editor = await requireEditor();
  if ("error" in editor) return { ok: false, error: editor.error };

  const { error } = await editor.supabase.from("news_posts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  updateTag(NEWS_TAG);
  return { ok: true };
}
