import Link from "next/link";
import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { Case } from "@/models/Case";
import DisposedCasesClient, {
  type DisposedCaseRow,
} from "./DisposedCasesClient";
import { guardFeature } from "@/lib/feature-guard";

// Server-rendered shell — pulls the partner's archived matters once,
// then defers search + filtering to the client component.

export const dynamic = "force-dynamic";

export default async function DisposedCasesPage() {
  await guardFeature("disposed");
  const session = await auth();
  const partnerId = session?.user?.partnerId
    ? new mongoose.Types.ObjectId(session.user.partnerId)
    : null;
  const isAdmin = session?.user?.userType === "partner_admin";

  let cases: DisposedCaseRow[] = [];

  if (partnerId) {
    await connectDB();
    const docs = await Case.find({
      partnerId,
      isDeleted: false,
      disposedAt: { $ne: null },
    })
      .sort({ disposedAt: -1 })
      .limit(500)
      .lean();
    cases = docs.map((c) => ({
      id: String(c._id),
      caseNo: c.caseNo,
      fileNo: c.fileNo,
      cnr: c.cnr,
      clientName: c.clientName,
      oppositeParty: c.oppositeParty,
      courtId: c.courtId ? String(c.courtId) : "",
      courtName: c.courtName,
      courtPlace: c.courtPlace,
      status: c.status,
      disposedAt: c.disposedAt ? c.disposedAt.toISOString() : null,
      disposalDate: c.disposalDate ? c.disposalDate.toISOString() : null,
      disposalRemarks: c.disposalRemarks || "",
      caStatus: c.caStatus || "",
      receivedByClient: Boolean(c.receivedByClient),
    }));
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.22em]"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                color: "var(--color-app-copper-deep)",
              }}
            >
              Case archive
            </div>
            <h2
              className="mt-1 text-[30px] font-semibold tracking-tight leading-[1.1] sm:text-[40px]"
              style={{
                fontFamily: "var(--font-crimson), Georgia, serif",
                color: "var(--color-app-ink)",
              }}
            >
              Disposed Cases
            </h2>
            <p
              className="mt-2 text-[13px]"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                color: "var(--color-app-fg-muted)",
              }}
            >
              {cases.length === 0 ? (
                "No matters have been disposed yet."
              ) : (
                <>
                  <span
                    style={{
                      color: "var(--color-app-ink)",
                      fontWeight: 600,
                    }}
                  >
                    {cases.length}
                  </span>{" "}
                  {cases.length === 1 ? "matter" : "matters"} on the shelf —
                  reopen any of them from the case detail.
                </>
              )}
            </p>
          </div>
          <Link
            href="/app/cases"
            className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-[12px] font-semibold transition-colors"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              backgroundColor: "var(--color-app-paper)",
              border: "1px solid var(--color-app-edge)",
              color: "var(--color-app-fg-soft)",
            }}
          >
            <span aria-hidden>←</span> Back to Case Vault
          </Link>
        </div>

        {cases.length === 0 ? (
          <EmptyArchive />
        ) : (
          <DisposedCasesClient cases={cases} isAdmin={isAdmin} />
        )}
      </div>
    </div>
  );
}

function EmptyArchive() {
  return (
    <div
      className="mt-10 rounded-xl p-16 text-center"
      style={{
        backgroundColor: "var(--color-app-paper)",
        border: "1px dashed var(--color-app-edge)",
      }}
    >
      <div
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          backgroundColor: "var(--color-app-canvas-2)",
          color: "var(--color-app-copper-deep)",
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <rect
            x="3"
            y="7"
            width="18"
            height="13"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M9 14.5l2.2 2.2L15.5 12.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h3
        className="mt-6 text-[28px] font-semibold tracking-tight"
        style={{
          fontFamily: "var(--font-crimson), Georgia, serif",
          color: "var(--color-app-ink)",
        }}
      >
        Nothing's been disposed yet.
      </h3>
      <p
        className="mx-auto mt-3 max-w-md text-[14px] leading-7"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          color: "var(--color-app-fg-muted)",
        }}
      >
        Mark a matter as <span style={{ fontWeight: 600 }}>Disposed</span>{" "}
        from the case detail page and it'll move here automatically — out of
        Case Vault, Hearing Track and the dashboard.
      </p>
    </div>
  );
}
