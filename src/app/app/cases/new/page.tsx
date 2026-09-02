import Link from "next/link";
import AddCaseForm from "./AddCaseForm";
import { guardFeature } from "@/lib/feature-guard";

export default async function NewCasePage() {
  await guardFeature("cases");
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-[860px]">
        <Link
          href="/app/cases"
          className="inline-flex items-center gap-1.5 text-[12px]"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            color: "var(--color-app-fg-muted)",
          }}
        >
          <span>←</span> Case Vault
        </Link>

        <div className="mt-6">
          <div
            className="text-[11px] uppercase tracking-[0.18em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-copper-deep)",
            }}
          >
            New matter
          </div>
          <h2
            className="mt-2 text-[36px] font-semibold tracking-tight leading-tight"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            Add a Case
          </h2>
          <p
            className="mt-2 max-w-xl text-[14px]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-fg-muted)",
            }}
          >
            Just the essentials to get this matter on the board. You can fill
            in more detail (hearing history, client phone, court contacts) on
            the case detail page after saving.
          </p>
        </div>

        <div className="mt-8">
          <AddCaseForm />
        </div>
      </div>
    </div>
  );
}
