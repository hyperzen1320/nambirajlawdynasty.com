"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BillingCycle = "trial" | "monthly" | "yearly" | "bespoke";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}$/;
// Keys that collide with a static route segment under /admin/subscriptions.
const RESERVED_KEYS = ["new"];

export default function AddPlanForm({ takenKeys }: { takenKeys: string[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [priceAmount, setPriceAmount] = useState("0");
  const [priceLabel, setPriceLabel] = useState("");
  const [priceSuffix, setPriceSuffix] = useState("");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [features, setFeatures] = useState<string[]>([]);
  const [seatLimit, setSeatLimit] = useState("1");
  const [matterLimit, setMatterLimit] = useState("100");
  const [isTrial, setIsTrial] = useState(false);
  const [isPopular, setIsPopular] = useState(false);
  const [showOnLanding, setShowOnLanding] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState("0");
  const [ctaLabel, setCtaLabel] = useState("Get started");

  const normalizedKey = key.trim();
  const keyTaken = takenKeys.includes(normalizedKey);
  const keyReserved = RESERVED_KEYS.includes(normalizedKey);
  const keyValid = SLUG_RE.test(normalizedKey);
  const keyError =
    normalizedKey.length === 0
      ? null
      : !keyValid
        ? "Use 2–31 lowercase letters, numbers or hyphens, starting with a letter or number."
        : keyReserved
          ? `“${normalizedKey}” is reserved — pick another.`
          : keyTaken
            ? "That key is already taken by another plan."
            : null;

  const canSubmit =
    keyValid && !keyTaken && !keyReserved && label.trim().length > 0;

  function updateFeature(index: number, value: string) {
    setFeatures((f) => f.map((x, i) => (i === index ? value : x)));
  }
  function addFeature() {
    setFeatures((f) => [...f, ""]);
  }
  function removeFeature(index: number) {
    setFeatures((f) => f.filter((_, i) => i !== index));
  }
  function moveFeature(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= features.length) return;
    setFeatures((f) => {
      const next = [...f];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) {
      setError(keyError ?? "Fill in a key and a label to continue.");
      return;
    }
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: normalizedKey,
          label,
          tagline,
          description,
          priceAmount: Number(priceAmount) || 0,
          priceLabel,
          priceSuffix,
          billingCycle,
          features: features.map((f) => f.trim()).filter(Boolean),
          seatLimit: Number(seatLimit) || 0,
          matterLimit: Number(matterLimit) || 0,
          isTrial,
          isPopular,
          showOnLanding,
          isActive,
          sortOrder: Number(sortOrder) || 0,
          ctaLabel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't create the plan.");
        setSubmitting(false);
        return;
      }
      // Land on the new plan's edit page so limits/features can be fine-tuned.
      router.push(`/admin/subscriptions/${data.plan?.key ?? normalizedKey}`);
      router.refresh();
    } catch {
      setError("Network error.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {/* Identity */}
      <Section
        title="Identity"
        subtitle="The permanent key plus the headline label and tagline."
      >
        <Field
          id="key"
          label="Plan Key (slug)"
          required
          value={key}
          onChange={(v) => setKey(v.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          placeholder="e.g. boutique, enterprise, solo-plus"
          mono
          error={keyError}
          hint="Lowercase letters, numbers and hyphens. Used in URLs and to assign the plan to offices — it can't be changed later."
        />
        <Field
          id="label"
          label="Plan Label"
          required
          value={label}
          onChange={setLabel}
          placeholder="Boutique Chambers"
        />
        <Field
          id="tagline"
          label="Tagline"
          value={tagline}
          onChange={setTagline}
          hint="Single line shown under the plan name on the landing page card."
        />
        <Field
          id="description"
          label="Description"
          value={description}
          onChange={setDescription}
          multiline
          hint="Longer text — shown in the partner-creation form when picking this plan."
        />
      </Section>

      {/* Pricing */}
      <Section
        title="Pricing"
        subtitle="The price label is what users see on the card. priceAmount is for analytics."
      >
        <div className="grid gap-5 md:grid-cols-3">
          <Field
            id="priceAmount"
            label="Price (₹) — internal"
            value={priceAmount}
            onChange={setPriceAmount}
            type="number"
            hint="Plain number. Used for analytics/reporting."
          />
          <Field
            id="priceLabel"
            label="Display Price"
            value={priceLabel}
            onChange={setPriceLabel}
            hint='Free-form: "₹1,499", "Bespoke", "Free"'
          />
          <Field
            id="priceSuffix"
            label="Display Suffix"
            value={priceSuffix}
            onChange={setPriceSuffix}
            hint='"/ mo", "· time-limited", or empty.'
          />
        </div>
        <RadioRow
          label="Billing cycle"
          value={billingCycle}
          onChange={(v) => setBillingCycle(v as BillingCycle)}
          options={[
            { value: "trial", label: "Trial" },
            { value: "monthly", label: "Monthly" },
            { value: "yearly", label: "Yearly" },
            { value: "bespoke", label: "Bespoke" },
          ]}
        />
      </Section>

      {/* Limits */}
      <Section
        title="Limits"
        subtitle="These become the seat/matter limits for every chambers created on this plan. Use 999999 for effectively unlimited."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            id="seatLimit"
            label="Seat Limit"
            value={seatLimit}
            onChange={setSeatLimit}
            type="number"
          />
          <Field
            id="matterLimit"
            label="Matter Limit"
            value={matterLimit}
            onChange={setMatterLimit}
            type="number"
          />
        </div>
      </Section>

      {/* Features */}
      <Section
        title="Features"
        subtitle="Bullets shown on the landing page plan card. Reorder via the up/down arrows."
      >
        <div className="space-y-2">
          {features.map((f, i) => (
            <div
              key={i}
              className="group flex items-center gap-2 rounded-md border border-admin-border bg-admin-bg/40 px-2 py-1.5"
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => moveFeature(i, -1)}
                  className="text-[10px] text-admin-fg-soft hover:text-admin-fg disabled:opacity-30"
                  disabled={i === 0}
                  title="Move up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveFeature(i, 1)}
                  className="text-[10px] text-admin-fg-soft hover:text-admin-fg disabled:opacity-30"
                  disabled={i === features.length - 1}
                  title="Move down"
                >
                  ▼
                </button>
              </div>
              <span
                className="font-mono text-[10px] tabular-nums tracking-[0.14em] text-admin-fg-soft w-7 text-right"
                style={{ fontFamily: "var(--font-plex-mono), monospace" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <input
                value={f}
                onChange={(e) => updateFeature(i, e.target.value)}
                placeholder="Feature line"
                className="flex-1 bg-transparent px-2 py-1.5 text-[14px] text-admin-fg outline-none focus:bg-admin-surface focus:rounded"
              />
              <button
                type="button"
                onClick={() => removeFeature(i)}
                className="rounded px-2 py-1 text-[11px] text-admin-fg-soft transition-colors hover:bg-admin-danger-soft hover:text-admin-danger"
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addFeature}
          className="mt-1 inline-flex items-center gap-2 rounded-md border border-dashed border-admin-border-soft px-3 py-2 text-[12px] font-medium text-admin-fg-muted transition-colors hover:border-admin-accent hover:text-admin-accent"
        >
          <span>+</span> Add feature
        </button>
      </Section>

      {/* Display */}
      <Section
        title="Display"
        subtitle="Where this plan appears and how it's marketed."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Toggle
            label="Internal trial plan"
            hint="Marks this as a time-limited trial tier."
            value={isTrial}
            onChange={setIsTrial}
          />
          <Toggle
            label="Most popular"
            hint="Highlights this plan on the landing page."
            value={isPopular}
            onChange={setIsPopular}
          />
          <Toggle
            label="Show on landing"
            hint="Public marketing page visibility."
            value={showOnLanding}
            onChange={setShowOnLanding}
          />
          <Toggle
            label="Active"
            hint="Inactive plans don't appear anywhere."
            value={isActive}
            onChange={setIsActive}
          />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            id="ctaLabel"
            label="CTA button text"
            value={ctaLabel}
            onChange={setCtaLabel}
            hint='e.g. "Begin practice", "Set up office", "Speak to us"'
          />
          <Field
            id="sortOrder"
            label="Sort order"
            value={sortOrder}
            onChange={setSortOrder}
            type="number"
            hint="Lower numbers appear first."
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
            <span>Couldn&rsquo;t create plan</span>
          </div>
          <p className="mt-1.5 text-[13px] text-admin-fg">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-admin-border-soft pt-6">
        <button
          type="button"
          onClick={() => router.push("/admin/subscriptions")}
          className="rounded-md border border-admin-border bg-admin-surface px-5 py-2.5 text-[13px] font-medium text-admin-fg-muted transition-colors hover:border-admin-fg-soft hover:text-admin-fg"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className="inline-flex items-center gap-2 rounded-md bg-admin-accent px-6 py-2.5 text-[13px] font-medium text-white shadow-sm transition-all hover:bg-admin-accent-hover hover:shadow disabled:opacity-60"
        >
          {submitting ? (
            <>
              <span className="block h-1 w-1 animate-pulse rounded-full bg-white" />
              Creating…
            </>
          ) : (
            <>
              + Create plan
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
        <h3 className="text-[16px] font-semibold tracking-tight text-admin-fg">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-1 text-[13px] text-admin-fg-muted">{subtitle}</p>
        )}
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
  multiline,
  hint,
  placeholder,
  mono,
  error,
}: {
  id: string;
  label: string;
  type?: "text" | "number";
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  hint?: string;
  placeholder?: string;
  mono?: boolean;
  error?: string | null;
}) {
  const base =
    "mt-2 block w-full rounded-md border bg-admin-surface px-3.5 py-2.5 text-[14px] text-admin-fg placeholder:text-admin-fg-soft/70 outline-none transition-colors focus:ring-2";
  const stateClasses = error
    ? "border-admin-danger focus:border-admin-danger focus:ring-admin-danger-soft"
    : "border-admin-border focus:border-admin-accent focus:ring-admin-accent-soft";
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
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={placeholder}
          className={`${base} ${stateClasses}`}
        />
      ) : (
        <input
          id={id}
          type={type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${base} ${stateClasses}`}
          style={
            mono ? { fontFamily: "var(--font-plex-mono), monospace" } : undefined
          }
        />
      )}
      {error ? (
        <p className="mt-1.5 text-[11px] text-admin-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[11px] text-admin-fg-soft">{hint}</p>
      ) : null}
    </div>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`text-left rounded-md border-2 px-4 py-3 transition-all ${
        value
          ? "border-admin-accent bg-admin-accent-soft"
          : "border-admin-border bg-admin-surface hover:border-admin-fg-soft"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-admin-fg">{label}</span>
        <span
          className={`relative inline-block h-5 w-9 rounded-full transition-colors ${
            value ? "bg-admin-accent" : "bg-admin-border"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
              value ? "left-[18px]" : "left-0.5"
            }`}
          />
        </span>
      </div>
      {hint && <p className="mt-1 text-[11px] text-admin-fg-muted">{hint}</p>}
    </button>
  );
}

function RadioRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <div
        className="text-[11px] font-medium uppercase tracking-[0.14em] text-admin-fg-muted"
        style={{ fontFamily: "var(--font-plex-mono), monospace" }}
      >
        {label}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            type="button"
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`rounded-md border-2 px-4 py-2 text-[12px] font-medium transition-all ${
              value === opt.value
                ? "border-admin-accent bg-admin-accent-soft text-admin-accent"
                : "border-admin-border bg-admin-surface text-admin-fg-muted hover:border-admin-fg-soft"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
