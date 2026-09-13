import type { Metadata } from "next";
import Link from "next/link";
import { getAdminState } from "@/cms/auth";
import { DOCUMENTS, DOCUMENT_IDS } from "@/cms/documents";
import { formatWhen } from "./format";

export const metadata: Metadata = { title: "Overview" };

type Row = { id: string; version: number; updated_at: string; updated_by_email: string | null };

export default async function OverviewPage() {
  const state = await getAdminState();
  if (state.status !== "ok") return null; // the shell renders the reason

  const { data, error } = await state.supabase
    .from("cms_documents")
    .select("id, version, updated_at, updated_by_email");
  const rows = new Map(((data ?? []) as Row[]).map((r) => [r.id, r]));
  const tableMissing = error?.code === "PGRST205" || error?.code === "42P01";

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 lg:px-10 lg:py-10">
      <h1 className="text-[22px] font-semibold tracking-tight">Website content</h1>
      <p className="mt-1 text-[14px]" style={{ color: "var(--color-admin-fg-muted)" }}>
        Pick what to edit. Saved changes are live on the site immediately.
      </p>

      {error ? (
        <div
          role="alert"
          className="mt-6 rounded-lg px-4 py-3 text-[13.5px] leading-6"
          style={{ backgroundColor: "var(--color-admin-warning-soft)", color: "var(--color-admin-warning)" }}
        >
          {tableMissing
            ? "The CMS tables don't exist in Supabase yet. Run supabase/migrations/…_cms.sql and then supabase/seed.sql in the SQL Editor (see CMS.md)."
            : `Couldn't read content status: ${error.message}`}
        </div>
      ) : null}

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {DOCUMENT_IDS.map((id) => {
          const doc = DOCUMENTS[id];
          const row = rows.get(id);
          return (
            <Link
              key={id}
              href={`/admin/${id}`}
              className="group rounded-xl border p-5 transition-[border-color,box-shadow] hover:border-[var(--color-admin-accent)] hover:shadow-[0_4px_16px_-8px_rgba(14,124,74,0.35)]"
              style={{ backgroundColor: "var(--color-admin-surface)", borderColor: "var(--color-admin-border)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[15px] font-semibold tracking-tight">{doc.label}</h2>
                <span
                  aria-hidden
                  className="text-[15px] transition-transform group-hover:translate-x-0.5"
                  style={{ color: "var(--color-admin-accent)" }}
                >
                  →
                </span>
              </div>
              <p className="mt-1 text-[13px] leading-5" style={{ color: "var(--color-admin-fg-muted)" }}>
                {doc.description}
              </p>
              <p className="mt-3 text-[12px]" style={{ color: "var(--color-admin-fg-soft)" }}>
                {row
                  ? `Updated ${formatWhen(row.updated_at)}${row.updated_by_email ? ` by ${row.updated_by_email}` : ""}`
                  : "Not saved yet — the site shows its built-in copy"}
              </p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
