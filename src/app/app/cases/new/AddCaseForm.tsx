"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CourtCombobox from "../CourtCombobox";
import AppearingForCombobox from "../AppearingForCombobox";
import StatusCombobox from "../StatusCombobox";

// Status is now a free-form text field so chambers can use their own
// vocabulary ("Mediation", "Cross-objection filed", "On-board", etc.)
// rather than being boxed into a fixed dropdown. Default is "Filed" so
// new matters land in a sensible state if the advocate skips the field.
//
// "Appearing for" is an editable combobox — pick a standard role from
// the roster (lib/appearing-options.ts) or type a custom one.

export default function AddCaseForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<Set<string>>(new Set());

  // Row 1
  const [fileNo, setFileNo] = useState("");
  const [caseNo, setCaseNo] = useState("");

  // Row 2
  const [iaNumbers, setIaNumbers] = useState("");
  const [cnr, setCnr] = useState("");

  // Row 3
  const [clientName, setClientName] = useState("");
  const [appearingFor, setAppearingFor] = useState("Petitioner");

  // Row 4. `sameAsWhatsapp` mirrors the WhatsApp number into Contact —
  // the common case — while still letting the two differ when unchecked.
  const [clientWhatsapp, setClientWhatsapp] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [sameAsWhatsapp, setSameAsWhatsapp] = useState(false);

  // Row 5 — Court is a combobox over the Court Hub master. Selection
  // atomically fills name + number + place + the courtId link; the
  // courtNumber stays out of the visible grid (it shows up on the case
  // detail page) but rides along in the POST body.
  const [courtId, setCourtId] = useState<string | null>(null);
  const [courtName, setCourtName] = useState("");
  const [courtNumber, setCourtNumber] = useState("");
  const [status, setStatus] = useState("Filed");

  // Row 6
  const [previousDate, setPreviousDate] = useState("");
  const [nextHearingDate, setNextHearingDate] = useState("");

  // Row 7
  const [oppositeParty, setOppositeParty] = useState("");
  const [oppositeAdvocate, setOppositeAdvocate] = useState("");

  // Optional extras. courtPlace is shared with the combobox — selecting
  // a court from Court Hub overwrites whatever's here.
  const [courtPlace, setCourtPlace] = useState("");
  const [courtHall, setCourtHall] = useState("");
  const [clientAddress, setClientAddress] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

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
    setSubmitting(true);
    try {
      const res = await fetch("/api/app/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileNo,
          caseNo,
          iaNumbers,
          cnr,
          clientName,
          appearingFor,
          clientWhatsapp,
          clientPhone,
          clientAddress,
          courtId,
          courtName,
          courtNumber,
          courtPlace,
          courtHall,
          status,
          oppositeParty,
          oppositeAdvocate,
          nextHearingDate: nextHearingDate || null,
          lastHearingDate: previousDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save");
        setSubmitting(false);
        return;
      }
      router.push(`/app/cases/${data.id}`);
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
              if (missing.has("fileNo") && v.trim()) {
                const next = new Set(missing);
                next.delete("fileNo");
                setMissing(next);
              }
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
              if (missing.has("caseNo") && v.trim()) {
                const next = new Set(missing);
                next.delete("caseNo");
                setMissing(next);
              }
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
              if (missing.has("clientName") && v.trim()) {
                const next = new Set(missing);
                next.delete("clientName");
                setMissing(next);
              }
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
              // Selecting a court from the combobox overwrites Court Place
              // (per the agreed UX) — the user can still tweak the field
              // in "Add more details" if they want a custom value.
              setCourtPlace(next.courtPlace);
              if (missing.has("courtName") && next.courtName.trim()) {
                const left = new Set(missing);
                left.delete("courtName");
                setMissing(left);
              }
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

        {/* Optional extras */}
        <details className="mt-6 group">
          <summary
            className="cursor-pointer select-none text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-muted)",
            }}
          >
            <span className="inline-block transition-transform group-open:rotate-90">&rsaquo;</span>{" "}
            Add more details (optional)
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

      {error && (
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
      )}

      <div
        className="mt-6 flex items-center justify-end gap-3"
      >
        <button
          type="button"
          onClick={() => router.push("/app/cases")}
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
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-md px-6 py-2.5 text-[13px] font-semibold transition-all"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            backgroundColor: "var(--color-app-copper)",
            color: "var(--color-app-copper-text)",
            opacity: submitting ? 0.6 : 1,
            boxShadow: "0 8px 20px -10px rgba(197,133,58,0.6)",
          }}
        >
          {submitting ? "Saving…" : "Save Case"}
        </button>
      </div>
    </form>
  );
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

