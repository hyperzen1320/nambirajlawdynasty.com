"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Plan = "trial" | "solo" | "office" | "chambers";

export type PlanCardData = {
  key: string;
  label: string;
  priceLabel: string;
  priceSuffix: string;
  description: string;
  isTrial: boolean;
};

export default function AddPartnerForm({
  plans,
}: {
  plans: PlanCardData[];
}) {
  const planMap = Object.fromEntries(plans.map((p) => [p.key, p])) as Record<
    string,
    PlanCardData
  >;
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [primaryContactName, setPrimaryContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [plan, setPlan] = useState<Plan>("trial");
  const [trialDays, setTrialDays] = useState(14);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          primaryEmail,
          primaryContactName,
          phone,
          city,
          state,
          plan,
          trialDays: plan === "trial" ? trialDays : 0,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setSubmitting(false);
        return;
      }

      router.push("/admin/partners");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Section title="Organization" subtitle="Who's the chambers?">
        <Field
          id="name"
          label="Chambers Name"
          required
          value={name}
          onChange={setName}
          placeholder="K S Nagendhran & Associates"
          hint="The slug for URLs is auto-generated from this."
        />
      </Section>

      <Section
        title="Primary Contact"
        subtitle="The partner-admin who'll sign in. Email is the user ID."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            id="primaryContactName"
            label="Contact Name"
            required
            value={primaryContactName}
            onChange={setPrimaryContactName}
            placeholder="K S Nagendhran"
          />
          <Field
            id="phone"
            label="Phone"
            required
            value={phone}
            onChange={setPhone}
            placeholder="+91 98765 43210"
          />
        </div>
        <Field
          id="primaryEmail"
          label="Login Email"
          required
          type="email"
          value={primaryEmail}
          onChange={setPrimaryEmail}
          placeholder="ks@nagendhran.in"
          hint="This is the partner-admin's login. Must be unique across Legalezi."
        />
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="city" label="City" value={city} onChange={setCity} placeholder="Bengaluru" />
          <Field id="state" label="State" value={state} onChange={setState} placeholder="Karnataka" />
        </div>
      </Section>

      <Section
        title="Plan"
        subtitle="Trial blocks access automatically when the period ends. Paid plans stay active."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((p) => (
            <PlanCard
              key={p.key}
              plan={p}
              selected={plan === p.key}
              onSelect={() => setPlan(p.key as Plan)}
            />
          ))}
        </div>

        {plan === "trial" && (
          <div className="mt-5 flex items-center gap-4 rounded-md border border-admin-saffron/30 bg-admin-saffron-soft px-4 py-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-admin-saffron/20 text-admin-saffron">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex-1">
              <div
                className="text-[11px] font-medium uppercase tracking-[0.14em] text-admin-saffron"
                style={{ fontFamily: "var(--font-plex-mono), monospace" }}
              >
                Trial period
              </div>
              <div className="mt-1 flex items-center gap-3">
                <input
                  id="trialDays"
                  type="number"
                  min={1}
                  max={90}
                  value={trialDays}
                  onChange={(e) => setTrialDays(Number(e.target.value))}
                  className="w-20 rounded-md border border-admin-saffron/30 bg-white px-3 py-1.5 text-[14px] tabular-nums text-admin-fg outline-none transition-colors focus:border-admin-saffron"
                />
                <span className="text-[13px] text-admin-fg-muted">
                  days from creation. After that, no one in this chambers can log in.
                </span>
              </div>
            </div>
          </div>
        )}
      </Section>

      <Section
        title="Initial Password"
        subtitle="Set a password for the partner-admin. They can change it after they sign in."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <PasswordField
            id="password"
            label="Password"
            value={password}
            onChange={setPassword}
            show={showPassword}
            onToggleShow={() => setShowPassword((s) => !s)}
            placeholder="At least 6 characters"
          />
          <PasswordField
            id="confirmPassword"
            label="Confirm Password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showConfirm}
            onToggleShow={() => setShowConfirm((s) => !s)}
            placeholder="Match the above"
          />
        </div>
      </Section>

      {error && (
        <div className="rounded-md border border-admin-danger/30 bg-admin-danger-soft px-4 py-3">
          <div
            className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-admin-danger"
            style={{ fontFamily: "var(--font-plex-mono), monospace" }}
          >
            <span>✕</span>
            <span>Couldn&rsquo;t add chambers</span>
          </div>
          <p className="mt-1.5 text-[13px] text-admin-fg">{error}</p>
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
          {submitting ? (
            <>
              <span className="block h-1 w-1 animate-pulse rounded-full bg-white" />
              Creating…
            </>
          ) : (
            <>
              + Create Chambers
              <span>→</span>
            </>
          )}
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
  type = "text",
  required,
  value,
  onChange,
  placeholder,
  hint,
}: {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
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
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 block w-full rounded-md border border-admin-border bg-admin-surface px-3.5 py-2.5 text-[14px] text-admin-fg placeholder:text-admin-fg-soft/70 outline-none transition-colors focus:border-admin-accent focus:ring-2 focus:ring-admin-accent-soft"
      />
      {hint && <p className="mt-1.5 text-[11px] text-admin-fg-soft">{hint}</p>}
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  show,
  onToggleShow,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  show: boolean;
  onToggleShow: () => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label
          htmlFor={id}
          className="text-[11px] font-medium uppercase tracking-[0.14em] text-admin-fg-muted"
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          {label}
          <span className="ml-1 text-admin-accent">*</span>
        </label>
        <button
          type="button"
          onClick={onToggleShow}
          className="text-[10px] font-medium uppercase tracking-[0.18em] text-admin-fg-soft transition-colors hover:text-admin-fg"
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      <div className="relative mt-2">
        <input
          id={id}
          type={show ? "text" : "password"}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="block w-full rounded-md border border-admin-border bg-admin-surface px-3.5 py-2.5 pr-10 text-[14px] text-admin-fg placeholder:text-admin-fg-soft/70 outline-none transition-colors focus:border-admin-accent focus:ring-2 focus:ring-admin-accent-soft"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-admin-fg-soft">
          {show ? <EyeOpenIcon /> : <EyeClosedIcon />}
        </span>
      </div>
    </div>
  );
}

function PlanCard({
  plan: p,
  selected,
  onSelect,
}: {
  plan: PlanCardData;
  selected: boolean;
  onSelect: () => void;
}) {
  const isTrial = p.isTrial;

  const selectedClasses = isTrial
    ? "border-admin-saffron bg-admin-saffron-soft shadow-sm"
    : "border-admin-accent bg-admin-accent-soft shadow-sm";

  const idleClasses = "border-admin-border bg-admin-surface hover:border-admin-fg-soft";

  const checkClasses = isTrial
    ? "border-admin-saffron bg-admin-saffron"
    : "border-admin-accent bg-admin-accent";

  const priceDisplay = p.priceSuffix
    ? `${p.priceLabel} ${p.priceSuffix}`
    : p.priceLabel;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex flex-col rounded-lg border-2 p-4 text-left transition-all ${
        selected ? selectedClasses : idleClasses
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-[14px] font-semibold text-admin-fg">{p.label}</div>
            {isTrial && (
              <span
                className="rounded-sm bg-admin-saffron/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-admin-saffron"
                style={{ fontFamily: "var(--font-plex-mono), monospace" }}
              >
                Time-limited
              </span>
            )}
          </div>
          <div
            className="mt-0.5 text-[12px] text-admin-fg-muted"
            style={{ fontFamily: "var(--font-plex-mono), monospace" }}
          >
            {priceDisplay}
          </div>
        </div>
        <div
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
            selected ? checkClasses : "border-admin-border bg-white"
          }`}
        >
          {selected && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12l4 4 10-10"
                stroke="white"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            </svg>
          )}
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-5 text-admin-fg-muted">{p.description}</p>
    </button>
  );
}

function EyeOpenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function EyeClosedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 3l18 18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M10.5 6.2A10.6 10.6 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.6M6.5 6.5C3.7 8.4 2 12 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.9-.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M9.9 9.9a3 3 0 0 0 4.2 4.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
