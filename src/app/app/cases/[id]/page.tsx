import Link from "next/link";
import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { Case } from "@/models/Case";
import { CaseDocument } from "@/models/CaseDocument";
import { Partner } from "@/models/Partner";
import UpdateHearingForm from "./UpdateHearingForm";
import ClientDocsPanel, { type ClientDoc } from "./ClientDocsPanel";
import DeleteCaseButton from "./DeleteCaseButton";
import ReopenCaseButton from "./ReopenCaseButton";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import CnrLink from "@/app/app/components/CnrLink";
import WhatsAppIcon from "@/app/app/components/WhatsAppIcon";
import { guardFeature } from "@/lib/feature-guard";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtIso(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

// Build the meta line under the Court name. Joins courtNumber + hall +
// place with " · " separators, dropping empties and deduplicating when
// the number and hall match (some chambers type "Hall 3" into both
// fields). Returns undefined when there's nothing to show so InfoCard
// renders nothing instead of an empty bar.
function courtMeta(
  num: string | undefined,
  hall: string | undefined,
  place: string | undefined
): string | undefined {
  const parts: string[] = [];
  const n = (num || "").trim();
  const h = (hall || "").trim();
  const p = (place || "").trim();
  if (n) parts.push(n);
  if (h && h.toLowerCase() !== n.toLowerCase()) parts.push(h);
  if (p) parts.push(p);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

export default async function CaseDetailPage({
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
  const caseObjId = new mongoose.Types.ObjectId(id);
  const [c, partner, docRecords] = await Promise.all([
    Case.findOne({
      _id: caseObjId,
      partnerId,
      isDeleted: false,
    }).lean(),
    Partner.findById(partnerId).lean(),
    CaseDocument.find({
      partnerId,
      caseId: caseObjId,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  if (!c) notFound();

  const officeName = partner?.branding?.officeName || partner?.name || "";
  const noticeTemplate = partner?.noticeTemplate || "";
  const isAdmin = session.user.userType === "partner_admin";
  const clientDocs: ClientDoc[] = docRecords.map((d) => ({
    id: String(d._id),
    filename: d.filename,
    contentType: d.contentType,
    size: d.size,
    uploadedByName: d.uploadedByName,
    uploadedByUserId: d.uploadedByUserId ? String(d.uploadedByUserId) : null,
    createdAt: d.createdAt.toISOString(),
  }));

  const telLink = c.clientPhone
    ? `tel:${c.clientPhone.replace(/\s+/g, "")}`
    : null;

  const waLink = buildWhatsAppLink(
    c.clientWhatsapp || c.clientPhone || "",
    noticeTemplate,
    {
      caseNo: c.caseNo || "",
      clientName: c.clientName || "",
      cnr: c.cnr || "",
      fileNo: c.fileNo || "",
      status: c.status || "",
      oppositeParty: c.oppositeParty || "",
      courtName: c.courtName || "",
      courtPlace: c.courtPlace || "",
      lastHearingDate: c.lastHearingDate || null,
      nextHearingDate: c.nextHearingDate || null,
      officeName,
    }
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue =
    c.nextHearingDate && new Date(c.nextHearingDate) < today;
  const isToday =
    c.nextHearingDate &&
    new Date(c.nextHearingDate).toDateString() === new Date().toDateString();

  // Disposed matters belong to /app/disposed-cases — when the user lands
  // here through that archive, the breadcrumb should send them back
  // there. Same for the disposal banner + Reopen action below.
  const isDisposed = Boolean(c.disposedAt);
  const role = session.user.userType === "partner_admin" ? "admin" : "junior";
  const breadcrumbHref = isDisposed ? "/app/disposed-cases" : "/app/cases";
  const breadcrumbLabel = isDisposed ? "Disposed Cases" : "Case Vault";
  const disposedDateLabel = fmtDate(c.disposalDate ?? c.disposedAt);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-[1100px]">
        {/* Breadcrumb + Edit shortcut */}
        <div className="fade-up-sm flex items-center justify-between gap-3">
          <Link
            href={breadcrumbHref}
            className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] transition-colors hover:opacity-70"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-muted)",
            }}
          >
            <span aria-hidden>&larr;</span> {breadcrumbLabel}
          </Link>
          <Link
            href={`/app/cases/${String(c._id)}/edit`}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              borderColor: "var(--color-app-edge)",
              backgroundColor: "var(--color-app-paper)",
              color: "var(--color-app-fg-soft)",
              letterSpacing: 0.4,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 20h4l10-10-4-4L4 16v4z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path
                d="M14 6l4 4"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
            Edit case
          </Link>
        </div>

        {/* Disposed banner — only when archived. Above the hero so the
            "this is closed" signal hits before the case-no shouts. */}
        {isDisposed ? (
          <section
            className="fade-up-sm mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl px-5 py-4"
            style={{
              backgroundColor: "var(--color-app-ink)",
              color: "var(--color-app-ivory)",
              animationDelay: "30ms",
            }}
          >
            <div className="min-w-0">
              <div
                className="text-[10px] font-semibold uppercase tracking-[0.22em]"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  color: "var(--color-app-copper)",
                }}
              >
                Disposed · archived
              </div>
              <div
                className="mt-1 text-[14px]"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  color: "rgba(245,235,214,0.92)",
                }}
              >
                Closed on{" "}
                <span style={{ fontWeight: 600 }}>{disposedDateLabel}</span>
                {c.disposalRemarks ? (
                  <>
                    {" "}
                    ·{" "}
                    <span
                      style={{
                        fontFamily:
                          "var(--font-crimson), Georgia, serif",
                        fontStyle: "italic",
                        color: "rgba(245,235,214,0.78)",
                      }}
                    >
                      "{c.disposalRemarks}"
                    </span>
                  </>
                ) : null}
              </div>
              {c.caStatus || c.receivedByClient ? (
                <div
                  className="mt-1 text-[12px]"
                  style={{
                    fontFamily: "var(--font-manrope), sans-serif",
                    color: "rgba(245,235,214,0.7)",
                  }}
                >
                  {c.caStatus ? (
                    <>
                      C.A.:{" "}
                      <span style={{ fontWeight: 600 }}>{c.caStatus}</span>
                    </>
                  ) : null}
                  {c.caStatus && c.receivedByClient ? " · " : null}
                  {c.receivedByClient ? "Received by client ✓" : null}
                </div>
              ) : null}
              <div
                className="mt-1.5 text-[11px]"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  color: "rgba(245,235,214,0.55)",
                }}
              >
                Hidden from Case Vault, Hearing Track and the dashboard.
              </div>
            </div>
            {role === "admin" ? (
              <ReopenCaseButton
                caseId={String(c._id)}
                caseNo={c.caseNo}
              />
            ) : null}
          </section>
        ) : null}

        {/* Hero card */}
        <section
          className="fade-up-sm relative mt-5 overflow-hidden rounded-2xl px-5 py-7 sm:px-9 sm:py-9"
          style={{
            backgroundColor: "var(--color-app-ink)",
            color: "var(--color-app-ivory)",
            backgroundImage:
              "radial-gradient(circle at 100% 0%, rgba(197,133,58,0.18), transparent 50%), radial-gradient(circle at 0% 100%, rgba(86,160,168,0.10), transparent 60%)",
            animationDelay: "60ms",
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0">
              {c.fileNo ? (
                <div
                  className="text-[11px] uppercase tracking-[0.22em]"
                  style={{
                    fontFamily: "var(--font-dm-mono), monospace",
                    color: "var(--color-app-copper)",
                  }}
                >
                  File &middot; {c.fileNo}
                </div>
              ) : null}
              <h1
                className="mt-2 text-[32px] font-semibold leading-[1.05] tracking-tight sm:text-[44px]"
                style={{
                  fontFamily: "var(--font-crimson), Georgia, serif",
                }}
              >
                {c.caseNo}
              </h1>
              {c.cnr ? (
                <div
                  className="mt-1.5 text-[12px]"
                  style={{
                    fontFamily: "var(--font-dm-mono), monospace",
                    color: "rgba(245,235,214,0.55)",
                  }}
                >
                  CNR <CnrLink cnr={c.cnr} tone="ivory" />
                </div>
              ) : null}

              {/* Parties */}
              {(c.clientName || c.oppositeParty) && (
                <div
                  className="mt-6 text-[18px] leading-[1.4]"
                  style={{
                    fontFamily: "var(--font-crimson), Georgia, serif",
                    color: "rgba(245,235,214,0.92)",
                  }}
                >
                  {c.clientName ? (
                    <span style={{ fontWeight: 600 }}>{c.clientName}</span>
                  ) : (
                    <span style={{ opacity: 0.5 }}>—</span>
                  )}
                  {c.oppositeParty ? (
                    <>
                      {" "}
                      <span
                        className="text-[12px] uppercase tracking-[0.22em]"
                        style={{
                          fontFamily: "var(--font-dm-mono), monospace",
                          color: "var(--color-app-copper)",
                          margin: "0 8px",
                        }}
                      >
                        vs
                      </span>{" "}
                      <span style={{ fontWeight: 600 }}>{c.oppositeParty}</span>
                    </>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-3">
              {c.status ? (
                <span
                  className="rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{
                    fontFamily: "var(--font-dm-mono), monospace",
                    backgroundColor: "var(--color-app-copper)",
                    color: "var(--color-app-copper-text)",
                  }}
                >
                  {c.status}
                </span>
              ) : null}

              {c.nextHearingDate ? (
                <div className="text-right">
                  <div
                    className="text-[10px] uppercase tracking-[0.22em]"
                    style={{
                      fontFamily: "var(--font-dm-mono), monospace",
                      color: "rgba(245,235,214,0.55)",
                    }}
                  >
                    Next hearing
                  </div>
                  <div
                    className="mt-1 text-[24px] font-semibold tabular-nums"
                    style={{
                      fontFamily: "var(--font-crimson), Georgia, serif",
                      color: isOverdue
                        ? "#ff8a8a"
                        : isToday
                          ? "var(--color-app-copper)"
                          : "var(--color-app-ivory)",
                    }}
                  >
                    {fmtDate(c.nextHearingDate)}
                  </div>
                </div>
              ) : (
                <div
                  className="rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{
                    fontFamily: "var(--font-dm-mono), monospace",
                    backgroundColor: "rgba(245,235,214,0.10)",
                    color: "rgba(245,235,214,0.65)",
                    border: "1px solid rgba(245,235,214,0.2)",
                  }}
                >
                  Pending date
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 2x2 info grid */}
        <section
          className="fade-up-sm mt-6 grid gap-4 md:grid-cols-2"
          style={{ animationDelay: "140ms" }}
        >
          <InfoCard
            label="Court"
            primary={c.courtName || "—"}
            secondary={courtMeta(c.courtNumber, c.courtHall, c.courtPlace)}
          />
          <InfoCard
            label="Representation"
            primary={
              c.appearingFor ? `Appearing for ${c.appearingFor}` : "—"
            }
            secondary={
              c.oppositeAdvocate
                ? `Opp. counsel: ${c.oppositeAdvocate}`
                : undefined
            }
          />
          <InfoCard
            label="Previous date"
            primary={fmtDate(c.lastHearingDate)}
            secondary={
              c.hearings && c.hearings.length > 0
                ? `${c.hearings.length} hearing${c.hearings.length === 1 ? "" : "s"} on record`
                : undefined
            }
          />
          <InfoCard
            label="I.A. Numbers"
            primary={c.iaNumbers || "—"}
            mono
          />
        </section>

        {/* Update Hearing. id="update-hearing" is the anchor target
            Hearing Track > Pending uses — clicking "Update hearing" on a
            pending row jumps the user straight here. */}
        <section
          id="update-hearing"
          className="fade-up-sm mt-6 scroll-mt-24"
          style={{ animationDelay: "220ms" }}
        >
          <UpdateHearingForm
            caseId={String(c._id)}
            initialNextDate={fmtIso(c.nextHearingDate)}
            initialStatus={c.status || "Filed"}
            initialDisposalDate={fmtIso(c.disposalDate)}
            initialCaStatus={c.caStatus || ""}
            initialDisposalRemarks={c.disposalRemarks || ""}
            initialReceivedByClient={Boolean(c.receivedByClient)}
            client={{
              name: c.clientName || "",
              phone: c.clientPhone || "",
              whatsapp: c.clientWhatsapp || "",
            }}
            caseContext={{
              caseNo: c.caseNo || "",
              cnr: c.cnr || "",
              fileNo: c.fileNo || "",
              oppositeParty: c.oppositeParty || "",
              courtName: c.courtName || "",
              courtPlace: c.courtPlace || "",
              officeName,
            }}
            template={noticeTemplate}
          />
        </section>

        {/* Client contact (left) + Client docs (right). The uncle wanted
            the contact moved aside to make room for a documents shelf on
            the matter. */}
        <section
          className="fade-up-sm mt-6 grid items-start gap-4 lg:grid-cols-[1fr_1.25fr]"
          style={{ animationDelay: "260ms" }}
        >
          <ContactCard
            clientName={c.clientName}
            clientPhone={c.clientPhone}
            clientAddress={c.clientAddress}
            telLink={telLink}
            waLink={waLink}
          />

          <ClientDocsPanel
            caseId={String(c._id)}
            initialDocs={clientDocs}
            isAdmin={isAdmin}
            viewerLabel={
              `${session.user.firstName ?? ""} ${session.user.lastName ?? ""}`.trim() +
              (session.user.email ? ` · ${session.user.email}` : "")
            }
          />
        </section>

        {/* Hearing history */}
        {c.hearings && c.hearings.length > 0 ? (
          <section
            className="fade-up-sm mt-6 rounded-xl p-6"
            style={{
              backgroundColor: "var(--color-app-paper)",
              boxShadow: "0 1px 0 var(--color-app-edge)",
              animationDelay: "300ms",
            }}
          >
            <div
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                color: "var(--color-app-copper-deep)",
              }}
            >
              Hearing history
            </div>
            <div className="mt-4 space-y-3">
              {c.hearings
                .slice()
                .reverse()
                .map((h, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[84px_1fr] gap-3 border-b pb-3 last:border-0 last:pb-0 sm:grid-cols-[140px_1fr] sm:gap-4"
                    style={{ borderColor: "var(--color-app-edge-soft)" }}
                  >
                    <div
                      className="text-[14px] font-semibold tabular-nums"
                      style={{
                        fontFamily: "var(--font-crimson), Georgia, serif",
                        color: "var(--color-app-ink)",
                      }}
                    >
                      {fmtDate(h.date)}
                    </div>
                    <div className="text-[13px]">
                      {h.status ? (
                        <span
                          className="rounded px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]"
                          style={{
                            fontFamily: "var(--font-dm-mono), monospace",
                            backgroundColor: "var(--color-app-aqua-soft)",
                            color: "var(--color-app-aqua)",
                          }}
                        >
                          {h.status}
                        </span>
                      ) : null}
                      {h.outcome ? (
                        <p
                          className="mt-2"
                          style={{
                            fontFamily: "var(--font-manrope), sans-serif",
                            color: "var(--color-app-fg-soft)",
                          }}
                        >
                          {h.outcome}
                        </p>
                      ) : null}
                      {h.nextDate ? (
                        <p
                          className="mt-1 text-[11px]"
                          style={{
                            fontFamily: "var(--font-dm-mono), monospace",
                            color: "var(--color-app-fg-muted)",
                          }}
                        >
                          Adjourned to {fmtDate(h.nextDate)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ) : null}

        {/* Delete */}
        <section
          className="fade-up-sm mt-10 flex justify-center"
          style={{ animationDelay: "380ms" }}
        >
          <DeleteCaseButton
            caseId={String(c._id)}
            caseNo={c.caseNo}
            isAdmin={role === "admin"}
          />
        </section>
      </div>
    </div>
  );
}

function InfoCard({
  label,
  primary,
  secondary,
  mono,
}: {
  label: string;
  primary: string;
  secondary?: string;
  mono?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-4 sm:p-5"
      style={{
        backgroundColor: "var(--color-app-paper)",
        boxShadow: "0 1px 0 var(--color-app-edge)",
      }}
    >
      <div
        className="text-[10px] font-semibold uppercase tracking-[0.22em]"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-fg-muted)",
        }}
      >
        {label}
      </div>
      <div
        className="mt-2 text-[18px] font-semibold leading-[1.3]"
        style={{
          fontFamily: mono
            ? "var(--font-dm-mono), monospace"
            : "var(--font-crimson), Georgia, serif",
          color: "var(--color-app-ink)",
        }}
      >
        {primary}
      </div>
      {secondary ? (
        <div
          className="mt-1 text-[12px]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-fg-muted)",
          }}
        >
          {secondary}
        </div>
      ) : null}
    </div>
  );
}

function ContactCard({
  clientName,
  clientPhone,
  clientAddress,
  telLink,
  waLink,
}: {
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  telLink: string | null;
  waLink: string | null;
}) {
  const hasContact = clientName || clientPhone || clientAddress;

  return (
    <div
      className="flex flex-col rounded-xl p-6"
      style={{
        backgroundColor: "var(--color-app-paper)",
        boxShadow: "0 1px 0 var(--color-app-edge)",
        borderLeft: "3px solid var(--color-app-aqua)",
      }}
    >
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-copper-deep)",
        }}
      >
        Client contact
      </div>

      {hasContact ? (
        <>
          <div className="mt-4">
            <div
              className="text-[20px] font-semibold leading-tight"
              style={{
                fontFamily: "var(--font-crimson), Georgia, serif",
                color: "var(--color-app-ink)",
              }}
            >
              {clientName || "—"}
            </div>
            {clientPhone ? (
              <div
                className="mt-1 text-[13px] tabular-nums"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  color: "var(--color-app-fg-soft)",
                }}
              >
                {clientPhone}
              </div>
            ) : null}
            {clientAddress ? (
              <p
                className="mt-3 text-[13px] leading-[1.55]"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  color: "var(--color-app-fg-soft)",
                }}
              >
                {clientAddress}
              </p>
            ) : null}
          </div>

          <div className="mt-auto flex gap-3 pt-5">
            {telLink ? (
              <a
                href={telLink}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-[13px] font-semibold transition-all hover:-translate-y-0.5"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  backgroundColor: "var(--color-app-ink)",
                  color: "var(--color-app-ivory)",
                  boxShadow: "0 8px 20px -10px rgba(10,17,36,0.4)",
                }}
              >
                <PhoneIcon />
                Call
              </a>
            ) : (
              <button
                disabled
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-[13px] font-semibold opacity-50"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  backgroundColor: "var(--color-app-canvas-2)",
                  color: "var(--color-app-fg-muted)",
                }}
              >
                <PhoneIcon />
                No phone
              </button>
            )}
            {waLink ? (
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-[13px] font-semibold transition-all hover:-translate-y-0.5"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  backgroundColor: "#1faa4f",
                  color: "#ffffff",
                  boxShadow: "0 8px 20px -10px rgba(31,170,79,0.5)",
                }}
              >
                <WhatsAppIcon />
                WhatsApp
              </a>
            ) : null}
          </div>
        </>
      ) : (
        <p
          className="mt-4 text-[13px]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-fg-muted)",
          }}
        >
          No client contact saved. Edit the matter to add a phone number and
          address — that will activate the Call and WhatsApp buttons.
        </p>
      )}
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// WhatsAppIcon now imported from the shared components module.
