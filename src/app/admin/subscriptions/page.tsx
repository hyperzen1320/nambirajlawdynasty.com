import Link from "next/link";
import { connectDB } from "@/lib/db";
import { Plan } from "@/models/Plan";

export default async function SubscriptionsListPage() {
  await connectDB();
  const planDocs = await Plan.find({}).sort({ sortOrder: 1 }).lean();
  const plans = planDocs.map((p) => ({
    key: p.key,
    label: p.label,
    tagline: p.tagline,
    priceLabel: p.priceLabel,
    priceSuffix: p.priceSuffix,
    billingCycle: p.billingCycle,
    seatLimit: p.seatLimit,
    matterLimit: p.matterLimit,
    isPopular: p.isPopular,
    isTrial: p.isTrial,
    showOnLanding: p.showOnLanding,
    isActive: p.isActive,
    featureCount: p.features.length,
    updatedAt: p.updatedAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-[1280px]">
      {/* Header */}
      <div className="flex items-end justify-between gap-6">
        <div className="fade-up-sm">
          <div
            className="text-[11px] font-medium uppercase tracking-[0.18em] text-admin-accent"
            style={{ fontFamily: "var(--font-plex-mono), monospace" }}
          >
            Catalogue
          </div>
          <h2 className="mt-2 text-[34px] font-semibold tracking-tight text-admin-fg">
            Subscriptions
          </h2>
          <p className="mt-2 max-w-2xl text-[14px] text-admin-fg-muted">
            Pricing, features, and limits for every plan. Edits save to the
            database and update the landing page + partner-creation form
            instantly. Create your own plans — new keys are assignable to
            offices as soon as they exist.
          </p>
        </div>

        <Link
          href="/admin/subscriptions/new"
          className="shrink-0 inline-flex items-center gap-2 rounded-md bg-admin-accent px-4 py-2.5 text-[13px] font-medium text-white shadow-sm transition-all hover:bg-admin-accent-hover hover:shadow"
        >
          <span>+</span> Add plan
        </Link>
      </div>

      {/* Cards */}
      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-2">
        {plans.map((p, i) => (
          <PlanCard key={p.key} plan={p} delay={0.05 + i * 0.05} />
        ))}
      </div>

      {/* Tip */}
      <div className="mt-8 max-w-2xl rounded-lg border border-admin-accent/20 bg-admin-accent-soft px-5 py-4">
        <div
          className="text-[10px] font-medium uppercase tracking-[0.22em] text-admin-accent"
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          Tip · § 02
        </div>
        <p className="mt-1.5 text-[13px] leading-6 text-admin-fg">
          The <strong>Trial</strong> plan is internal — admin uses it when
          creating partners. The other three appear publicly on the landing
          page. Use <em>Show on landing</em> to control visibility per plan.
        </p>
      </div>
    </div>
  );
}

type PlanRow = {
  key: string;
  label: string;
  tagline: string;
  priceLabel: string;
  priceSuffix: string;
  billingCycle: string;
  seatLimit: number;
  matterLimit: number;
  isPopular: boolean;
  isTrial: boolean;
  showOnLanding: boolean;
  isActive: boolean;
  featureCount: number;
  updatedAt: string;
};

function PlanCard({ plan: p, delay }: { plan: PlanRow; delay: number }) {
  const accent = p.isTrial ? "saffron" : "emerald";
  const accentBorder =
    accent === "saffron"
      ? "border-admin-saffron/30"
      : p.isPopular
        ? "border-admin-accent"
        : "border-admin-border";
  const tagBg =
    accent === "saffron"
      ? "bg-admin-saffron-soft text-admin-saffron"
      : "bg-admin-accent-soft text-admin-accent";

  const fmtLimit = (n: number) =>
    n >= 999999 ? "∞" : n.toLocaleString("en-IN");

  return (
    <Link
      href={`/admin/subscriptions/${p.key}`}
      className={`fade-up-sm group relative flex flex-col rounded-lg border-2 bg-admin-surface p-6 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-12px_rgba(14,26,31,0.18)] ${accentBorder}`}
      style={{ animationDelay: `${delay}s` }}
    >
      {/* badges */}
      <div className="flex items-start justify-between gap-3">
        <div
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${tagBg}`}
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          <span className="font-mono">/{p.key}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 justify-end">
          {p.isPopular && (
            <span
              className="rounded-sm bg-admin-fg px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-white"
              style={{ fontFamily: "var(--font-plex-mono), monospace" }}
            >
              Most chambers
            </span>
          )}
          {p.showOnLanding ? (
            <span
              className="rounded-sm border border-admin-accent/30 bg-admin-accent-soft px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-admin-accent"
              style={{ fontFamily: "var(--font-plex-mono), monospace" }}
            >
              On landing
            </span>
          ) : (
            <span
              className="rounded-sm border border-admin-border bg-admin-bg px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-admin-fg-soft"
              style={{ fontFamily: "var(--font-plex-mono), monospace" }}
            >
              Internal
            </span>
          )}
          {!p.isActive && (
            <span
              className="rounded-sm border border-admin-danger/30 bg-admin-danger-soft px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-admin-danger"
              style={{ fontFamily: "var(--font-plex-mono), monospace" }}
            >
              Hidden
            </span>
          )}
        </div>
      </div>

      {/* name + tagline */}
      <div className="mt-5">
        <h3 className="text-[24px] font-semibold tracking-tight text-admin-fg leading-tight group-hover:text-admin-accent">
          {p.label}
        </h3>
        <p className="mt-1.5 text-[13px] text-admin-fg-muted">{p.tagline}</p>
      </div>

      {/* price */}
      <div className="mt-5 flex items-baseline gap-2">
        <span className="text-[36px] font-semibold tabular-nums tracking-tight text-admin-fg">
          {p.priceLabel}
        </span>
        {p.priceSuffix && (
          <span
            className="text-[12px] font-medium uppercase tracking-[0.14em] text-admin-fg-soft"
            style={{ fontFamily: "var(--font-plex-mono), monospace" }}
          >
            {p.priceSuffix}
          </span>
        )}
      </div>

      {/* limits */}
      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-admin-border-soft pt-4">
        <Stat label="Seats" value={fmtLimit(p.seatLimit)} />
        <Stat label="Matters" value={fmtLimit(p.matterLimit)} />
        <Stat label="Features" value={String(p.featureCount)} />
      </div>

      {/* footer */}
      <div className="mt-5 flex items-center justify-between border-t border-admin-border-soft pt-3">
        <span
          className="text-[10px] font-medium uppercase tracking-[0.14em] text-admin-fg-soft"
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          Last edited{" "}
          {new Date(p.updatedAt).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
        <span className="text-[12px] font-medium text-admin-accent">
          Edit →
        </span>
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="text-[9px] font-medium uppercase tracking-[0.18em] text-admin-fg-soft"
        style={{ fontFamily: "var(--font-plex-mono), monospace" }}
      >
        {label}
      </div>
      <div className="mt-1 text-[16px] font-semibold tabular-nums text-admin-fg">
        {value}
      </div>
    </div>
  );
}
