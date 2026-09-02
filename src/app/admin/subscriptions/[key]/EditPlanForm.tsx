"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BillingCycle = "trial" | "monthly" | "yearly" | "bespoke";

type PlanProps = {
  key: string;
  label: string;
  tagline: string;
  description: string;
  priceAmount: number;
  priceLabel: string;
  priceSuffix: string;
  billingCycle: BillingCycle;
  features: string[];
  seatLimit: number;
  matterLimit: number;
  isTrial: boolean;
  isPopular: boolean;
  showOnLanding: boolean;
  isActive: boolean;
  sortOrder: number;
  ctaLabel: string;
  updatedAt: string;
};

export default function EditPlanForm({ plan }: { plan: PlanProps }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState(plan.label);
  const [tagline, setTagline] = useState(plan.tagline);
  const [description, setDescription] = useState(plan.description);
  const [priceAmount, setPriceAmount] = useState(String(plan.priceAmount));
  const [priceLabel, setPriceLabel] = useState(plan.priceLabel);
  const [priceSuffix, setPriceSuffix] = useState(plan.priceSuffix);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(plan.billingCycle);
  const [features, setFeatures] = useState<string[]>(plan.features);
  const [seatLimit, setSeatLimit] = useState(String(plan.seatLimit));
  const [matterLimit, setMatterLimit] = useState(String(plan.matterLimit));
  const [isPopular, setIsPopular] = useState(plan.isPopular);
  const [showOnLanding, setShowOnLanding] = useState(plan.showOnLanding);
  const [isActive, setIsActive] = useState(plan.isActive);
  const [sortOrder, setSortOrder] = useState(String(plan.sortOrder));
  const [ctaLabel, setCtaLabel] = useState(plan.ctaLabel);

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
    setSuccess(false);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/admin/subscriptions/${plan.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
          isPopular,
          showOnLanding,
          isActive,
          sortOrder: Number(sortOrder) || 0,
          ctaLabel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save");
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
      {/* Identity */}
      <Section title="Identity" subtitle="Headline label and short tagline.">
        <Field
          id="label"
          label="Plan Label"
          value={label}
          onChange={setLabel}
          required
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
      <Section title="Limits" subtitle="Use 999999 for effectively unlimited.">
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
        subtitle="Bullets shown on the landing page plan card. Drag-reorder via the up/down arrows."
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
        <div className="grid gap-3 md:grid-cols-3">
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
            <span>Couldn&rsquo;t save</span>
          </div>
          <p className="mt-1.5 text-[13px] text-admin-fg">{error}</p>
        </div>
      )}
      {success && (
        <div className="rounded-md border border-admin-accent/30 bg-admin-accent-soft px-4 py-3">
          <p className="text-[13px] text-admin-accent">
            ✓ Saved. The landing page and partner-creation form pick up the new
            values immediately.
          </p>
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
}: {
  id: string;
  label: string;
  type?: "text" | "number";
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
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
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="mt-2 block w-full rounded-md border border-admin-border bg-admin-surface px-3.5 py-2.5 text-[14px] text-admin-fg outline-none transition-colors focus:border-admin-accent focus:ring-2 focus:ring-admin-accent-soft"
        />
      ) : (
        <input
          id={id}
          type={type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-2 block w-full rounded-md border border-admin-border bg-admin-surface px-3.5 py-2.5 text-[14px] text-admin-fg outline-none transition-colors focus:border-admin-accent focus:ring-2 focus:ring-admin-accent-soft"
        />
      )}
      {hint && (
        <p className="mt-1.5 text-[11px] text-admin-fg-soft">{hint}</p>
      )}
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
      {hint && (
        <p className="mt-1 text-[11px] text-admin-fg-muted">{hint}</p>
      )}
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
