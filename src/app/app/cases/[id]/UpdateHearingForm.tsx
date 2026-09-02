"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buildWhatsAppLink, parseDateInputLocal } from "@/lib/whatsapp";
import WhatsAppIcon from "@/app/app/components/WhatsAppIcon";
import StatusCombobox from "../StatusCombobox";

type ClientContact = {
  name: string;
  phone: string;
  whatsapp: string;
};

type CaseContext = {
  caseNo: string;
  cnr: string;
  fileNo: string;
  oppositeParty: string;
  courtName: string;
  courtPlace: string;
  officeName: string;
};

// Copper focus ring shared by the disposal fields — same treatment the
// next-hearing date input gets inline.
function focusRing(
  e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
) {
  e.currentTarget.style.borderColor = "var(--color-app-copper)";
  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(197,133,58,0.15)";
}
function blurRing(
  e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
) {
  e.currentTarget.style.borderColor = "var(--color-app-edge)";
  e.currentTarget.style.boxShadow = "none";
}

const FIELD_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-manrope), sans-serif",
  borderColor: "var(--color-app-edge)",
  backgroundColor: "var(--color-app-paper)",
  color: "var(--color-app-ink)",
};

const DISPOSAL_LABEL_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-dm-mono), monospace",
  color: "var(--color-app-fg-muted)",
};

export default function UpdateHearingForm({
  caseId,
  initialNextDate,
  initialStatus,
  initialDisposalDate,
  initialCaStatus,
  initialDisposalRemarks,
  initialReceivedByClient,
  client,
  caseContext,
  template,
}: {
  caseId: string;
  initialNextDate: string;
  initialStatus: string;
  initialDisposalDate: string;
  initialCaStatus: string;
  initialDisposalRemarks: string;
  initialReceivedByClient: boolean;
  client: ClientContact;
  caseContext: CaseContext;
  template: string;
}) {
  const router = useRouter();
  const [nextDate, setNextDate] = useState(initialNextDate);
  const [status, setStatus] = useState(initialStatus);
  // Disposal record — only meaningful (and only shown) when the status is
  // "Disposed". Seeded from what's on file so an admin can edit the record
  // of an already-closed matter without re-disposing it.
  const [disposalDate, setDisposalDate] = useState(initialDisposalDate);
  const [caStatus, setCaStatus] = useState(initialCaStatus);
  const [disposalRemarks, setDisposalRemarks] = useState(
    initialDisposalRemarks
  );
  const [receivedByClient, setReceivedByClient] = useState(
    initialReceivedByClient
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // The date we actually persisted — drives the notify block's WhatsApp
  // message so it always quotes what's on record, not a half-typed edit.
  const [savedDate, setSavedDate] = useState(initialNextDate);

  const isDisposed = status.trim().toLowerCase() === "disposed";

  const dirty =
    nextDate !== initialNextDate ||
    status !== initialStatus ||
    (isDisposed &&
      (disposalDate !== initialDisposalDate ||
        caStatus !== initialCaStatus ||
        disposalRemarks !== initialDisposalRemarks ||
        receivedByClient !== initialReceivedByClient));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/app/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nextHearingDate: nextDate || null,
          status,
          // Only send the disposal record when the matter is being (or
          // staying) disposed — otherwise the server keeps whatever's on
          // file and an ordinary status change never wipes it.
          ...(isDisposed
            ? {
                disposalDate: disposalDate || null,
                caStatus,
                disposalRemarks,
                receivedByClient,
              }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't update");
        setSaving(false);
        return;
      }
      setSavedDate(nextDate);
      setSaved(true);
      setSaving(false);
      router.refresh();
    } catch {
      setError("Network error.");
      setSaving(false);
    }
  }

  // Call + WhatsApp links for the notify block. Built from the SAVED
  // date (parsed as local midnight so the day doesn't drift in IST) so
  // the message names the hearing the advocate just locked in.
  const phoneDigits = (client.phone || "").replace(/\s+/g, "");
  const telLink = phoneDigits ? `tel:${phoneDigits}` : null;
  const waLink = buildWhatsAppLink(
    client.whatsapp || client.phone || "",
    template,
    {
      caseNo: caseContext.caseNo,
      clientName: client.name,
      cnr: caseContext.cnr,
      fileNo: caseContext.fileNo,
      status,
      oppositeParty: caseContext.oppositeParty,
      courtName: caseContext.courtName,
      courtPlace: caseContext.courtPlace,
      // The hearing being notified about just happened on the date we
      // updated *from*; the new posting is the date we just saved.
      lastHearingDate: parseDateInputLocal(initialNextDate),
      nextHearingDate: parseDateInputLocal(savedDate),
      officeName: caseContext.officeName,
    }
  );
  // Show the notify block once a save has landed and nothing new is
  // pending — i.e. exactly "after Save Update", which is when uncle
  // wants the Call / WhatsApp to surface right here in the form.
  const showNotify = saved && !dirty;
  const hasContact = Boolean(telLink || waLink);

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl p-6"
      style={{
        backgroundColor: "var(--color-app-paper)",
        boxShadow: "0 1px 0 var(--color-app-edge)",
        borderLeft: "3px solid var(--color-app-copper)",
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            color: "var(--color-app-copper-deep)",
          }}
        >
          Update hearing
        </div>
        {saved && !dirty ? (
          <span
            className="text-[10px] uppercase tracking-[0.18em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-aqua)",
            }}
          >
            Saved
          </span>
        ) : null}
      </div>

      <div className="mt-5">
        <label
          htmlFor="nextDate"
          className="text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            color: "var(--color-app-fg-muted)",
          }}
        >
          Next hearing date
        </label>
        <input
          id="nextDate"
          type="date"
          value={nextDate}
          onChange={(e) => setNextDate(e.target.value)}
          className="mt-2 block w-full rounded-md border px-3.5 py-2.5 text-[14px] outline-none transition-colors"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            borderColor: "var(--color-app-edge)",
            backgroundColor: "var(--color-app-paper)",
            color: "var(--color-app-ink)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--color-app-copper)";
            e.currentTarget.style.boxShadow =
              "0 0 0 3px rgba(197,133,58,0.15)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--color-app-edge)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
        <p
          className="mt-1.5 text-[11px]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-fg-muted)",
          }}
        >
          Leave blank to mark as pending. The previous date is archived to the
          hearing history when changed.
        </p>
      </div>

      <div className="mt-5">
        <StatusCombobox
          id="caseStatus"
          label="Status / Stage"
          value={status}
          onChange={setStatus}
          placeholder="Filed, Evidence, Arguments…"
        />
        <p
          className="mt-1.5 text-[11px]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-fg-muted)",
          }}
        >
          Type anything — your chambers&rsquo; own vocabulary. Type{" "}
          <span style={{ fontWeight: 600, color: "var(--color-app-ink)" }}>
            Disposed
          </span>{" "}
          to archive this matter to Disposed Cases.
        </p>
      </div>

      {/* Disposal record — revealed the moment the stage is "Disposed",
          so the admin captures the order date, C.A. status, a note and
          whether the client has the copy in the same save. */}
      {isDisposed ? (
        <div
          className="mt-6 rounded-lg p-5"
          style={{
            backgroundColor: "var(--color-app-canvas-2)",
            border: "1px solid var(--color-app-edge)",
          }}
        >
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-copper-deep)",
            }}
          >
            Disposal details
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="disposalDate"
                className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={DISPOSAL_LABEL_STYLE}
              >
                Disposed date
              </label>
              <input
                id="disposalDate"
                type="date"
                value={disposalDate}
                onChange={(e) => setDisposalDate(e.target.value)}
                className="mt-2 block w-full rounded-md border px-3.5 py-2.5 text-[14px] outline-none transition-colors"
                style={FIELD_STYLE}
                onFocus={focusRing}
                onBlur={blurRing}
              />
            </div>
            <div>
              <label
                htmlFor="caStatus"
                className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={DISPOSAL_LABEL_STYLE}
              >
                C.A. status
              </label>
              <input
                id="caStatus"
                list="caStatusOptions"
                value={caStatus}
                onChange={(e) => setCaStatus(e.target.value)}
                placeholder="Applied / Ready / Delivered"
                autoComplete="off"
                className="mt-2 block w-full rounded-md border px-3.5 py-2.5 text-[14px] outline-none transition-colors"
                style={FIELD_STYLE}
                onFocus={focusRing}
                onBlur={blurRing}
              />
              <datalist id="caStatusOptions">
                <option value="Applied" />
                <option value="Ready" />
                <option value="Delivered" />
              </datalist>
            </div>
          </div>

          <div className="mt-4">
            <label
              htmlFor="disposalRemarks"
              className="text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={DISPOSAL_LABEL_STYLE}
            >
              Disposal note
            </label>
            <textarea
              id="disposalRemarks"
              value={disposalRemarks}
              onChange={(e) => setDisposalRemarks(e.target.value)}
              rows={3}
              placeholder="Decree passed / Compromised / Withdrawn / Dismissed…"
              className="mt-2 block w-full resize-y rounded-md border px-3.5 py-2.5 text-[14px] outline-none transition-colors"
              style={FIELD_STYLE}
              onFocus={focusRing}
              onBlur={blurRing}
            />
          </div>

          <label className="mt-4 flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={receivedByClient}
              onChange={(e) => setReceivedByClient(e.target.checked)}
              style={{
                width: 16,
                height: 16,
                accentColor: "var(--color-app-copper)",
              }}
            />
            <span
              className="text-[13px]"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                color: "var(--color-app-ink)",
              }}
            >
              Received by client
            </span>
          </label>
        </div>
      ) : null}

      {error && (
        <div
          className="mt-4 rounded-md px-4 py-3 text-[13px]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            backgroundColor: "var(--color-app-danger-soft)",
            border: "1px solid var(--color-app-danger)",
            color: "var(--color-app-ink)",
          }}
        >
          {error}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={saving || !dirty}
          className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-[13px] font-semibold transition-all"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            backgroundColor: dirty
              ? "var(--color-app-copper)"
              : "var(--color-app-canvas-2)",
            color: dirty
              ? "var(--color-app-copper-text)"
              : "var(--color-app-fg-muted)",
            opacity: saving ? 0.6 : 1,
            cursor: dirty && !saving ? "pointer" : "default",
            boxShadow: dirty
              ? "0 8px 20px -10px rgba(197,133,58,0.6)"
              : "none",
          }}
        >
          {saving ? "Saving…" : "Save Update"}
        </button>
      </div>

      {/* Notify-client block — appears right here after a successful save,
          so the advocate can ring or WhatsApp the client about the new
          date the instant it's locked in, without hunting for the
          contact card. The WhatsApp notice already quotes the saved
          date, venue and matter. */}
      {showNotify ? (
        <div
          className="mt-6 rounded-lg p-4"
          style={{
            backgroundColor: "var(--color-app-canvas-2)",
            border: "1px solid var(--color-app-edge)",
          }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-copper-deep)",
            }}
          >
            Hearing saved — notify {client.name || "the client"}
          </div>
          {hasContact ? (
            <div className="mt-3 flex flex-wrap gap-3">
              {telLink ? (
                <a
                  href={telLink}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-[13px] font-semibold transition-all hover:-translate-y-0.5"
                  style={{
                    fontFamily: "var(--font-manrope), sans-serif",
                    backgroundColor: "var(--color-app-ink)",
                    color: "var(--color-app-ivory)",
                    boxShadow: "0 8px 20px -10px rgba(10,17,36,0.4)",
                    minWidth: 130,
                  }}
                >
                  <PhoneIcon />
                  Call
                </a>
              ) : null}
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
                    minWidth: 130,
                  }}
                >
                  <WhatsAppIcon />
                  WhatsApp
                </a>
              ) : null}
            </div>
          ) : (
            <p
              className="mt-2 text-[12px]"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                color: "var(--color-app-fg-muted)",
              }}
            >
              No phone or WhatsApp on file for this client. Add a number from
              Edit case to message them the new date here.
            </p>
          )}
        </div>
      ) : null}
    </form>
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
