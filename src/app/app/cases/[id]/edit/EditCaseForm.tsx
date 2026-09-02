"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CourtCombobox from "../../CourtCombobox";
import AppearingForCombobox from "../../AppearingForCombobox";
import StatusCombobox from "../../StatusCombobox";

// Full case edit form. Mirrors AddCaseForm's field set (so the user's
// mental model is identical between "Add" and "Edit") but PATCHes the
// case route with only the fields that actually changed. Every column is
// editable — the user wanted nothing to be off-limits here.

export type CaseInitialValues = {
  id: string;
  caseNo: string;
  fileNo: string;
  cnr: string;
  iaNumbers: string;
  clientName: string;
  clientPhone: string;
  clientWhatsapp: string;
  clientAddress: string;
  appearingFor: string;
  oppositeParty: string;
  oppositeAdvocate: string;
  courtId: string | null;
  courtName: string;
  courtNumber: string;
  courtHall: string;
  courtPlace: string;
  status: string;
  nextHearingDate: string;
  lastHearingDate: string;
  isDisposed: boolean;
};

export default function EditCaseForm({
  initial,
}: {
  initial: CaseInitialValues;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);

  // Row 1
  const [fileNo, setFileNo] = useState(initial.fileNo);
  const [caseNo, setCaseNo] = useState(initial.caseNo);

  // Row 2
  const [iaNumbers, setIaNumbers] = useState(initial.iaNumbers);
  const [cnr, setCnr] = useState(initial.cnr);

  // Row 3
  const [clientName, setClientName] = useState(initial.clientName);
  const [appearingFor, setAppearingFor] = useState(initial.appearingFor);

  // Row 4. `sameAsWhatsapp` mirrors the WhatsApp number into Contact —
  // default on when the loaded matter already has the two identical.
  const [clientWhatsapp, setClientWhatsapp] = useState(initial.clientWhatsapp);
  const [clientPhone, setClientPhone] = useState(initial.clientPhone);
  const [sameAsWhatsapp, setSameAsWhatsapp] = useState(
    Boolean(initial.clientPhone) &&
      initial.clientPhone === initial.clientWhatsapp
  );

  // Row 5 — Court combobox + status. The combobox owns the tuple
  // (courtId, courtName, courtNumber, courtPlace); courtPlace is also
  // mirrored into the optional details Court Place field via shared
  // state, so picking from Court Hub keeps the form consistent.
  const [courtId, setCourtId] = useState<string | null>(initial.courtId);
  const [courtName, setCourtName] = useState(initial.courtName);
  const [courtNumber, setCourtNumber] = useState(initial.courtNumber);
  const [status, setStatus] = useState(initial.status);

  // Row 6
  const [previousDate, setPreviousDate] = useState(initial.lastHearingDate);
  const [nextHearingDate, setNextHearingDate] = useState(
    initial.nextHearingDate
  );

  // Row 7
  const [oppositeParty, setOppositeParty] = useState(initial.oppositeParty);
  const [oppositeAdvocate, setOppositeAdvocate] = useState(
    initial.oppositeAdvocate
  );

  // Optional extras
  const [courtPlace, setCourtPlace] = useState(initial.courtPlace);
  const [courtHall, setCourtHall] = useState(initial.courtHall);
  const [clientAddress, setClientAddress] = useState(initial.clientAddress);

  // We compute the diff at submit time and only send fields that actually
  // moved. The PATCH handler is idempotent so this is purely a polish: the
  // activity log stays cleaner ("updated case X (clientPhone)" instead of
  // "updated case X (every field you ever touched)") and we don't pay the
  // cost of re-archiving an unchanged nextHearingDate.
  const dirty = useMemo(() => {
    return (
      fileNo !== initial.fileNo ||
      caseNo !== initial.caseNo ||
      iaNumbers !== initial.iaNumbers ||
      cnr !== initial.cnr ||
      clientName !== initial.clientName ||
      appearingFor !== initial.appearingFor ||
      clientWhatsapp !== initial.clientWhatsapp ||
      clientPhone !== initial.clientPhone ||
      courtId !== initial.courtId ||
      courtName !== initial.courtName ||
      courtNumber !== initial.courtNumber ||
      status !== initial.status ||
      previousDate !== initial.lastHearingDate ||
      nextHearingDate !== initial.nextHearingDate ||
      oppositeParty !== initial.oppositeParty ||
      oppositeAdvocate !== initial.oppositeAdvocate ||
      courtPlace !== initial.courtPlace ||
      courtHall !== initial.courtHall ||
      clientAddress !== initial.clientAddress
    );
  }, [
    fileNo,
    caseNo,
    iaNumbers,
    cnr,
    clientName,
    appearingFor,
    clientWhatsapp,
    clientPhone,
    courtId,
    courtName,
    courtNumber,
    status,
    previousDate,
    nextHearingDate,
    oppositeParty,
    oppositeAdvocate,
    courtPlace,
    courtHall,
    clientAddress,
    initial,
  ]);

  function clearMissing(key: string) {
    setMissing((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const missingNow = new Set<string>();
    if (!fileNo.trim()) missingNow.add("fileNo");
    if (!caseNo.trim()) missingNow.add("caseNo");
    if (!clientName.trim()) missingNow.add("clientName");
    if (!courtName.trim()) missingNow.add("courtName");
    if (missingNow.size > 0) {
      setMissing(missingNow);
      setError("Please fill the four required fields before saving.");
      return;
    }
    setMissing(new Set());

    if (!dirty) {
      // Nothing actually changed — short-circuit so we don't pretend to
      // hit the server. Better UX than a noop POST that returns "Saved!".
      setSaved(true);
      return;
    }

    setSubmitting(true);

    // Build a diff body — only ship fields that moved. The server is happy
    // to accept a partial payload (every PATCH branch is `if typeof ===
    // "string"` so undefined fields are simply ignored).
    const body: Record<string, string | null> = {};
    if (fileNo !== initial.fileNo) body.fileNo = fileNo;
    if (caseNo !== initial.caseNo) body.caseNo = caseNo;
    if (iaNumbers !== initial.iaNumbers) body.iaNumbers = iaNumbers;
    if (cnr !== initial.cnr) body.cnr = cnr;
    if (clientName !== initial.clientName) body.clientName = clientName;
    if (appearingFor !== initial.appearingFor)
      body.appearingFor = appearingFor;
    if (clientWhatsapp !== initial.clientWhatsapp)
      body.clientWhatsapp = clientWhatsapp;
    if (clientPhone !== initial.clientPhone) body.clientPhone = clientPhone;
    if (courtName !== initial.courtName) body.courtName = courtName;
    if (courtNumber !== initial.courtNumber)
      body.courtNumber = courtNumber;
    if (courtId !== initial.courtId) body.courtId = courtId;
    if (status !== initial.status) body.status = status;
    if (oppositeParty !== initial.oppositeParty)
      body.oppositeParty = oppositeParty;
    if (oppositeAdvocate !== initial.oppositeAdvocate)
      body.oppositeAdvocate = oppositeAdvocate;
    if (courtPlace !== initial.courtPlace) body.courtPlace = courtPlace;
    if (courtHall !== initial.courtHall) body.courtHall = courtHall;
    if (clientAddress !== initial.clientAddress)
      body.clientAddress = clientAddress;

    if (nextHearingDate !== initial.nextHearingDate) {
      body.nextHearingDate = nextHearingDate || null;
    }
    if (previousDate !== initial.lastHearingDate) {
      body.lastHearingDate = previousDate || null;
    }

    try {
      const res = await fetch(`/api/app/cases/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Couldn't save");
        setSubmitting(false);
        return;
      }

      const becameDisposed =
        !initial.isDisposed && status.trim() === "Disposed";

      router.push(
        becameDisposed
          ? "/app/disposed-cases"
          : `/app/cases/${initial.id}`
      );
      router.refresh();
    } catch {
      setError("Network error.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div
        className="rounded-2xl p-7"
        style={{
          backgroundColor: "var(--color-app-paper)",
          boxShadow: "0 1px 0 var(--color-app-edge)",
        }}
      >
        <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
          <Field
            id="fileNo"
            label="File Number"
            required
            value={fileNo}
            onChange={(v) => {
              setFileNo(v);
              if (v.trim()) clearMissing("fileNo");
            }}
            placeholder="F-2025/001"
            invalid={missing.has("fileNo")}
          />
          <Field
            id="caseNo"
            label="Case Number"
            required
            value={caseNo}
            onChange={(v) => {
              setCaseNo(v);
              if (v.trim()) clearMissing("caseNo");
            }}
            placeholder="O.S. 100/2025"
            invalid={missing.has("caseNo")}
          />

          <Field
            id="iaNumbers"
            label="I.A. Number(s)"
            value={iaNumbers}
            onChange={setIaNumbers}
            placeholder="I.A. 5/2025"
          />
          <Field
            id="cnr"
            label="CNR Number"
            value={cnr}
            onChange={setCnr}
            placeholder="TNCH010012342024"
          />

          <Field
            id="clientName"
            label="Client"
            required
            value={clientName}
            onChange={(v) => {
              setClientName(v);
              if (v.trim()) clearMissing("clientName");
            }}
            placeholder="R. Murugan"
            invalid={missing.has("clientName")}
          />
          <AppearingForCombobox
            id="appearingFor"
            label="Appearing For"
            value={appearingFor}
            onChange={setAppearingFor}
          />

          <Field
            id="whatsapp"
            label="WhatsApp"
            type="tel"
            value={clientWhatsapp}
            onChange={(v) => {
              setClientWhatsapp(v);
              if (sameAsWhatsapp) setClientPhone(v);
            }}
            placeholder="+91..."
          />
          <Field
            id="contactNumber"
            label="Contact Number"
            type="tel"
            value={clientPhone}
            onChange={setClientPhone}
            placeholder="+91..."
            disabled={sameAsWhatsapp}
          />
          <label
            className="-mt-2 inline-flex cursor-pointer items-center gap-2 text-[12px] md:col-span-2"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-fg-soft)",
            }}
          >
            <input
              type="checkbox"
              checked={sameAsWhatsapp}
              onChange={(e) => {
                const on = e.target.checked;
                setSameAsWhatsapp(on);
                if (on) setClientPhone(clientWhatsapp);
              }}
              style={{
                accentColor: "var(--color-app-copper)",
                width: 15,
                height: 15,
              }}
            />
            Contact number is the same as WhatsApp
          </label>

          <CourtCombobox
            id="courtName"
            required
            invalid={missing.has("courtName")}
            value={{
              courtId,
              courtName,
              courtNumber,
              courtPlace,
            }}
            onChange={(next) => {
              setCourtId(next.courtId);
              setCourtName(next.courtName);
              setCourtNumber(next.courtNumber);
              // Picking a court overwrites Court Place (user can still
              // tweak it in "More details" afterwards).
              setCourtPlace(next.courtPlace);
              if (next.courtName.trim()) clearMissing("courtName");
            }}
          />
          <StatusCombobox id="status" value={status} onChange={setStatus} />

          <Field
            id="previousDate"
            label="Previous Date"
            type="date"
            value={previousDate}
            onChange={setPreviousDate}
          />
          <Field
            id="nextHearingDate"
            label="Next Date"
            type="date"
            value={nextHearingDate}
            onChange={setNextHearingDate}
          />

          <Field
            id="oppositeParty"
            label="Opposite Party"
            value={oppositeParty}
            onChange={setOppositeParty}
            placeholder="State of Tamil Nadu"
          />
          <Field
            id="oppositeAdvocate"
            label="Opposite Advocate"
            value={oppositeAdvocate}
            onChange={setOppositeAdvocate}
            placeholder="Adv. S. Ramesh"
          />
        </div>

        <details className="mt-6 group" open={hasOptional(initial)}>
          <summary
            className="cursor-pointer select-none text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-muted)",
            }}
          >
            <span className="inline-block transition-transform group-open:rotate-90">
              &rsaquo;
            </span>{" "}
            More details
          </summary>
          <div className="mt-4 grid gap-x-6 gap-y-5 md:grid-cols-2">
            <Field
              id="courtPlace"
              label="Court Place"
              value={courtPlace}
              onChange={setCourtPlace}
              placeholder="Chennai"
            />
            <Field
              id="courtHall"
              label="Court Hall"
              value={courtHall}
              onChange={setCourtHall}
              placeholder="Hall 4"
            />
            <div className="md:col-span-2">
              <Field
                id="clientAddress"
                label="Client Address"
                value={clientAddress}
                onChange={setClientAddress}
                placeholder="12, North Mada St, Mylapore, Chennai"
              />
            </div>
          </div>
        </details>
      </div>

      {error ? (
        <div
          className="mt-5 rounded-md px-4 py-3"
          style={{
            backgroundColor: "var(--color-app-danger-soft)",
            border: "1px solid var(--color-app-danger)",
          }}
        >
          <p
            className="text-[13px]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-ink)",
            }}
          >
            {error}
          </p>
        </div>
      ) : null}

      {saved && !dirty ? (
        <div
          className="mt-5 rounded-md px-4 py-3"
          style={{
            backgroundColor: "var(--color-app-aqua-soft)",
            border: "1px solid var(--color-app-aqua)",
          }}
        >
          <p
            className="text-[13px]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-ink)",
            }}
          >
            Nothing to save — everything's already up to date.
          </p>
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push(`/app/cases/${initial.id}`)}
          className="rounded-md border px-5 py-2.5 text-[13px] font-medium transition-colors"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            borderColor: "var(--color-app-edge)",
            backgroundColor: "var(--color-app-paper)",
            color: "var(--color-app-fg-soft)",
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !dirty}
          className="inline-flex items-center gap-2 rounded-md px-6 py-2.5 text-[13px] font-semibold transition-all"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            backgroundColor: dirty
              ? "var(--color-app-copper)"
              : "var(--color-app-canvas-2)",
            color: dirty
              ? "var(--color-app-copper-text)"
              : "var(--color-app-fg-muted)",
            opacity: submitting ? 0.6 : 1,
            cursor: dirty && !submitting ? "pointer" : "default",
            boxShadow: dirty
              ? "0 8px 20px -10px rgba(197,133,58,0.6)"
              : "none",
          }}
        >
          {submitting ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

function hasOptional(v: CaseInitialValues): boolean {
  return Boolean(v.courtPlace || v.courtHall || v.clientAddress);
}

function Field({
  id,
  label,
  type = "text",
  required,
  value,
  onChange,
  placeholder,
  invalid,
  disabled,
}: {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-[10px] font-semibold uppercase tracking-[0.22em]"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-fg-muted)",
        }}
      >
        {label}
        {required && (
          <span style={{ color: "var(--color-app-copper)", marginLeft: 4 }}>
            *
          </span>
        )}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="mt-2 block w-full rounded-md border px-3.5 py-2.5 text-[14px] outline-none transition-all disabled:cursor-not-allowed"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          borderColor: invalid
            ? "var(--color-app-danger)"
            : "var(--color-app-edge)",
          backgroundColor: disabled
            ? "var(--color-app-canvas-2)"
            : "var(--color-app-paper)",
          color: disabled
            ? "var(--color-app-fg-muted)"
            : "var(--color-app-ink)",
        }}
        onFocus={(e) => {
          if (disabled) return;
          e.currentTarget.style.borderColor = "var(--color-app-copper)";
          e.currentTarget.style.boxShadow =
            "0 0 0 3px rgba(197,133,58,0.15)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = invalid
            ? "var(--color-app-danger)"
            : "var(--color-app-edge)";
          e.currentTarget.style.boxShadow = "none";
        }}
      />
    </div>
  );
}

