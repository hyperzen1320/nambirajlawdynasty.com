"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Plan = "trial" | "solo" | "office" | "chambers";

type Partner = {
  id: string;
  name: string;
  slug: string;
  primaryEmail: string;
  primaryContactName: string;
  phone: string;
  city: string;
  state: string;
  plan: Plan;
  subscription: {
    status: string;
    startDate: string;
    endDate: string;
  };
};

const PLAN_DETAILS: Record<
  Plan,
  { label: string; price: string; accent: "saffron" | "emerald" }
> = {
  trial: { label: "Trial", price: "Free · time-limited", accent: "saffron" },
  solo: { label: "Solo", price: "₹1,499 / mo", accent: "emerald" },
  office: { label: "Office", price: "₹4,999 / mo", accent: "emerald" },
  chambers: { label: "Chambers", price: "Bespoke", accent: "emerald" },
};

export default function EditPartnerForm({ partner }: { partner: Partner }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(partner.name);
  const [primaryContactName, setPrimaryContactName] = useState(
    partner.primaryContactName
  );
  const [phone, setPhone] = useState(partner.phone);
  const [city, setCity] = useState(partner.city);
  const [state, setState] = useState(partner.state);
  const [plan, setPlan] = useState<Plan>(partner.plan);
  const [extendDays, setExtendDays] = useState(7);

  const isTrial = partner.subscription.status === "trial";
  const trialEnd = new Date(partner.subscription.endDate);
  const daysLeft = Math.ceil(
    (trialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/admin/partners/${partner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          primaryContactName,
          phone,
          city,
          state,
          plan,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save changes.");
        setSubmitting(false);
        return;
      }
      setSuccess(true);
      setSubmitting(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  async function onExtendTrial() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/partners/${partner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extendTrialDays: extendDays }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not extend trial.");
        setSubmitting(false);
        return;
      }
      setSuccess(true);
      setSubmitting(false);
      router.refresh();
    } catch {
      setError("Network error.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Section title="Partner Information" subtitle="Editable details about the chambers.">
        <Field
          id="name"
          label="Chambers Name"
          required
          value={name}
          onChange={setName}
        />
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            id="primaryContactName"
            label="Contact Name"
            required
            value={primaryContactName}
            onChange={setPrimaryContactName}
          />
          <Field
            id="phone"
            label="Phone"
            required
            value={phone}
            onChange={setPhone}
          />
        </div>
        <Field
          id="primaryEmail"
          label="Login Email (read-only)"
          value={partner.primaryEmail}
          onChange={() => {}}
          readOnly
          hint="Use the password reset section below if the partner-admin needs new credentials."
        />
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="city" label="City" value={city} onChange={setCity} />
          <Field id="state" label="State" value={state} onChange={setState} />
        </div>
      </Section>

      <Section title="Plan & Subscription" subtitle="Change plan, extend trial, or move to active.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(Object.keys(PLAN_DETAILS) as Plan[]).map((p) => (
            <PlanCardSmall
              key={p}
              plan={p}
              selected={plan === p}
              onSelect={() => setPlan(p)}
            />
          ))}
        </div>

        {isTrial && (
          <div className="rounded-md border border-admin-saffron/30 bg-admin-saffron-soft p-4">
            <div className="flex items-center justify-between">
              <div>
                <div
                  className="text-[11px] font-medium uppercase tracking-[0.14em] text-admin-saffron"
                  style={{ fontFamily: "var(--font-plex-mono), monospace" }}
                >
                  Currently on trial
                </div>
                <div className="mt-1 text-[14px] text-admin-fg">
                  {daysLeft > 0
                    ? `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left — ends ${trialEnd.toLocaleDateString(
                        "en-IN",
                        { day: "2-digit", month: "long", year: "numeric" }
                      )}`
                    : `Trial expired ${trialEnd.toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })} · login is blocked`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={extendDays}
                  onChange={(e) => setExtendDays(Number(e.target.value))}
                  className="w-16 rounded-md border border-admin-saffron/30 bg-white px-2.5 py-1.5 text-[13px] tabular-nums text-admin-fg outline-none focus:border-admin-saffron"
                />
                <span className="text-[12px] text-admin-fg-muted">days</span>
                <button
                  type="button"
                  onClick={onExtendTrial}
                  disabled={submitting}
                  className="ml-2 rounded-md border border-admin-saffron bg-white px-4 py-1.5 text-[12px] font-medium text-admin-saffron transition-colors hover:bg-admin-saffron hover:text-white disabled:opacity-60"
                >
                  Extend
                </button>
              </div>
            </div>
          </div>
        )}
      </Section>

      {error && (
        <div className="rounded-md border border-admin-danger/30 bg-admin-danger-soft px-4 py-3">
          <p className="text-[13px] text-admin-fg">{error}</p>
        </div>
      )}
      {success && (
        <div className="rounded-md border border-admin-accent/30 bg-admin-accent-soft px-4 py-3">
          <p className="text-[13px] text-admin-accent">✓ Changes saved.</p>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-admin-border-soft pt-6">
        <button
          type="button"
          onClick={() => router.push("/admin/partners")}
          className="rounded-md border border-admin-border bg-admin-surface px-5 py-2.5 text-[13px] font-medium text-admin-fg-muted transition-colors hover:border-admin-fg-soft hover:text-admin-fg"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-md bg-admin-accent px-6 py-2.5 text-[13px] font-medium text-white shadow-sm transition-all hover:bg-admin-accent-hover hover:shadow disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-admin-border bg-admin-surface p-7">
      <div className="border-b border-admin-border-soft pb-5">
        <h3 className="text-[16px] font-semibold tracking-tight text-admin-fg">{title}</h3>
        {subtitle && <p className="mt-1 text-[13px] text-admin-fg-muted">{subtitle}</p>}
      </div>
      <div className="mt-5 space-y-5">{children}</div>
    </div>
  );
}

function Field({
  id,
  label,
  required,
  value,
  onChange,
  readOnly,
  hint,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-[11px] font-medium uppercase tracking-[0.14em] text-admin-fg-muted"
        style={{ fontFamily: "var(--font-plex-mono), monospace" }}
      >
        {label}
        {required && <span className="ml-1 text-admin-accent">*</span>}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        className={`mt-2 block w-full rounded-md border border-admin-border px-3.5 py-2.5 text-[14px] outline-none transition-colors ${
          readOnly
            ? "bg-admin-bg text-admin-fg-muted"
            : "bg-admin-surface text-admin-fg focus:border-admin-accent focus:ring-2 focus:ring-admin-accent-soft"
        }`}
        style={
          readOnly ? { fontFamily: "var(--font-plex-mono), monospace" } : undefined
        }
      />
      {hint && <p className="mt-1.5 text-[11px] text-admin-fg-soft">{hint}</p>}
    </div>
  );
}

function PlanCardSmall({
  plan,
  selected,
  onSelect,
}: {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
}) {
  const d = PLAN_DETAILS[plan];
  const isTrial = plan === "trial";
  const sel = isTrial
    ? "border-admin-saffron bg-admin-saffron-soft"
    : "border-admin-accent bg-admin-accent-soft";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-md border-2 p-3 text-left transition-all ${
        selected ? sel : "border-admin-border bg-admin-surface hover:border-admin-fg-soft"
      }`}
    >
      <div className="text-[13px] font-semibold text-admin-fg">{d.label}</div>
      <div
        className="mt-0.5 text-[11px] text-admin-fg-muted"
        style={{ fontFamily: "var(--font-plex-mono), monospace" }}
      >
        {d.price}
      </div>
    </button>
  );
}
