import Link from "next/link";
import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { Case } from "@/models/Case";
import EditCaseForm, { type CaseInitialValues } from "./EditCaseForm";
import { guardFeature } from "@/lib/feature-guard";

// Server shell for the case edit page. Loads the case once, hands all
// fields to the client form pre-filled. Disposed matters are still
// editable here (admin might want to fix metadata before reopening), so
// we don't filter on disposedAt — the disposal banner inside the detail
// page is enough of a signal that the case is archived.

export const dynamic = "force-dynamic";

function fmtIso(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export default async function EditCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await guardFeature("cases");
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) notFound();

  const session = await auth();
  if (!session?.user?.partnerId) notFound();

  const partnerId = new mongoose.Types.ObjectId(session.user.partnerId);

  await connectDB();
  const c = await Case.findOne({
    _id: new mongoose.Types.ObjectId(id),
    partnerId,
    isDeleted: false,
  }).lean();

  if (!c) notFound();

  const initial: CaseInitialValues = {
    id: String(c._id),
    caseNo: c.caseNo || "",
    fileNo: c.fileNo || "",
    cnr: c.cnr || "",
    iaNumbers: c.iaNumbers || "",
    clientName: c.clientName || "",
    clientPhone: c.clientPhone || "",
    clientWhatsapp: c.clientWhatsapp || "",
    clientAddress: c.clientAddress || "",
    appearingFor: c.appearingFor || "Petitioner",
    oppositeParty: c.oppositeParty || "",
    oppositeAdvocate: c.oppositeAdvocate || "",
    courtId: c.courtId ? String(c.courtId) : null,
    courtName: c.courtName || "",
    courtNumber: c.courtNumber || "",
    courtHall: c.courtHall || "",
    courtPlace: c.courtPlace || "",
    status: c.status || "Filed",
    nextHearingDate: fmtIso(c.nextHearingDate),
    lastHearingDate: fmtIso(c.lastHearingDate),
    isDisposed: Boolean(c.disposedAt),
  };

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-[1100px]">
        <Link
          href={`/app/cases/${initial.id}`}
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] transition-colors hover:opacity-70"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            color: "var(--color-app-fg-muted)",
          }}
        >
          <span aria-hidden>&larr;</span> Back to case
        </Link>

        <div className="mt-4 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.22em]"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                color: "var(--color-app-copper-deep)",
              }}
            >
              Edit matter
            </div>
            <h2
              className="mt-1 text-[30px] font-semibold tracking-tight leading-[1.1] sm:text-[40px]"
              style={{
                fontFamily: "var(--font-crimson), Georgia, serif",
                color: "var(--color-app-ink)",
              }}
            >
              {initial.caseNo || "Untitled case"}
            </h2>
            <p
              className="mt-2 text-[13px]"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                color: "var(--color-app-fg-muted)",
              }}
            >
              Update any field. Saving recomputes the hearing history when
              the next date changes, and a status of{" "}
              <span style={{ fontWeight: 600, color: "var(--color-app-ink)" }}>
                Disposed
              </span>{" "}
              archives this matter to Disposed Cases.
            </p>
          </div>
        </div>

        <div className="mt-7">
          <EditCaseForm initial={initial} />
        </div>
      </div>
    </div>
  );
}
