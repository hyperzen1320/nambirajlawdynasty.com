import type { Metadata } from "next";

import { notFound } from "next/navigation";

import { getAdminState } from "@/cms/auth";
import { DOCUMENTS, isDocumentId } from "@/cms/documents";

import { sanitizeDocument } from "@/cms/sanitize";

import { getSupabaseConfig } from "@/lib/supabase/config";

import Editor from "./Editor";

type Props = {
  params: Promise<{ doc: string }>;
};

/**
 * Generate all known document routes at build time.
 *
 * This allows Next.js to resolve the [doc] parameter during
 * prerendering instead of treating generateMetadata() as
 * request-dependent.
 */
export async function generateStaticParams() {
  return Object.keys(DOCUMENTS).map((doc) => ({
    doc,
  }));
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { doc } = await params;

  return {
    title: isDocumentId(doc) ? DOCUMENTS[doc].label : "Not found",
  };
}

export default async function DocumentPage({ params }: Props) {
  const { doc } = await params;

  if (!isDocumentId(doc)) {
    notFound();
  }

  const state = await getAdminState();

  if (state.status !== "ok") {
    return null;
  }

  const { data: row, error } = await state.supabase
    .from("cms_documents")
    .select("data, version, updated_at, updated_by_email")
    .eq("id", doc)
    .maybeSingle();

  // An unsaved document opens on the built-in copy;
  // the first save creates it.
  const initialData = sanitizeDocument(
    doc,
    row ? row.data : DOCUMENTS[doc].defaults
  );

  return (
    <Editor
      // Remount on a new version (e.g. after a restore) so no stale
      // form state survives from an earlier visit.
      key={row?.version ?? 0}
      docId={doc}
      initialData={initialData as Record<string, unknown>}
      version={row?.version ?? null}
      updatedAt={row?.updated_at ?? null}
      updatedBy={row?.updated_by_email ?? null}
      supabase={getSupabaseConfig()}
      loadError={error?.message ?? null}
    />
  );
}
