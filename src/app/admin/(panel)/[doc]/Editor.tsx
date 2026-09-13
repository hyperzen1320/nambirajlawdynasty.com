"use client";

import Link from "next/link";
import { DOCUMENTS, type DocumentId } from "@/cms/documents";
import type { SupabaseConfig } from "@/lib/supabase/config";
import { saveDocument } from "../../actions";
import FormEditor from "../FormEditor";
import { linkButton } from "../styles";
import type { Obj } from "./editor-state";

export default function Editor({
  docId,
  initialData,
  version,
  updatedAt,
  updatedBy,
  supabase,
  loadError,
}: {
  docId: DocumentId;
  initialData: Obj;
  version: number | null;
  updatedAt: string | null;
  updatedBy: string | null;
  supabase: SupabaseConfig | null;
  loadError: string | null;
}) {
  const doc = DOCUMENTS[docId];

  return (
    <FormEditor
      fields={doc.fields}
      initialData={initialData}
      version={version}
      heading={doc.label}
      description={doc.description}
      updatedAt={updatedAt}
      updatedBy={updatedBy}
      supabase={supabase}
      uploadFolder={docId}
      loadError={loadError}
      save={(data, baseVersion) => saveDocument(docId, data, baseVersion)}
      links={
        <>
          {version !== null ? (
            <Link href={`/admin/${docId}/history`} className={linkButton}>
              History
            </Link>
          ) : null}
          {doc.path ? (
            <a href={doc.path} target="_blank" rel="noopener noreferrer" className={linkButton}>
              View page <span aria-hidden>↗</span>
            </a>
          ) : null}
        </>
      }
    />
  );
}
