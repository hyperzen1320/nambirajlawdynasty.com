import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminState } from "@/cms/auth";
import { DOCUMENTS, isDocumentId } from "@/cms/documents";
import { formatWhen } from "../../format";
import { card, linkButton } from "../../styles";
import RestoreButton from "./RestoreButton";

type Props = { params: Promise<{ doc: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { doc } = await params;
  return { title: isDocumentId(doc) ? `History — ${DOCUMENTS[doc].label}` : "Not found" };
}

type Revision = { id: number; version: number; saved_at: string; saved_by_email: string | null };

export default async function HistoryPage({ params }: Props) {
  const { doc } = await params;
  if (!isDocumentId(doc)) notFound();

  const state = await getAdminState();
  if (state.status !== "ok") return null;

  const [{ data: current }, { data: revisions, error }] = await Promise.all([
    state.supabase.from("cms_documents").select("version, updated_at, updated_by_email").eq("id", doc).maybeSingle(),
    state.supabase
      .from("cms_document_revisions")
      .select("id, version, saved_at, saved_by_email")
      .eq("document_id", doc)
      .order("id", { ascending: false })
      .limit(50),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 lg:px-10 lg:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">History</h1>
          <p className="mt-1 text-[14px]" style={{ color: "var(--color-admin-fg-muted)" }}>
            Earlier versions of <strong>{DOCUMENTS[doc].label}</strong>. Restoring one makes it live again; the version it
            replaces is kept here too, so nothing is lost.
          </p>
        </div>
        <Link href={`/admin/${doc}`} className={linkButton}>
          <span aria-hidden>←</span> Back to editor
        </Link>
      </div>

      {error ? (
        <p role="alert" className="mt-6 text-[13.5px]" style={{ color: "var(--color-admin-danger)" }}>
          Couldn&rsquo;t load history: {error.message}
        </p>
      ) : null}

      <ol className={`${card} mt-8 divide-y divide-[var(--color-admin-border-soft)]`}>
        {current ? (
          <li className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <div className="text-[14px] font-medium">
                Version {current.version}{" "}
                <span
                  className="ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ backgroundColor: "var(--color-admin-accent-soft)", color: "var(--color-admin-accent)" }}
                >
                  Live
                </span>
              </div>
              <div className="text-[12.5px]" style={{ color: "var(--color-admin-fg-soft)" }}>
                Saved {formatWhen(current.updated_at)}
                {current.updated_by_email ? ` by ${current.updated_by_email}` : ""}
              </div>
            </div>
          </li>
        ) : null}
        {((revisions ?? []) as Revision[]).map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <div className="text-[14px] font-medium">Version {r.version}</div>
              <div className="text-[12.5px]" style={{ color: "var(--color-admin-fg-soft)" }}>
                Saved {formatWhen(r.saved_at)}
                {r.saved_by_email ? ` by ${r.saved_by_email}` : ""}
              </div>
            </div>
            <RestoreButton docId={doc} revisionId={r.id} version={r.version} />
          </li>
        ))}
        {!revisions?.length && !error ? (
          <li className="px-5 py-6 text-[13.5px]" style={{ color: "var(--color-admin-fg-soft)" }}>
            No earlier versions yet — they appear here after the next save.
          </li>
        ) : null}
      </ol>
    </main>
  );
}
