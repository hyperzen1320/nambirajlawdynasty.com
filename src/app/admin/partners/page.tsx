import Link from "next/link";
import { connectDB } from "@/lib/db";
import { Partner } from "@/models/Partner";

export default async function PartnersListPage() {
  await connectDB();

  const partnersDocs = await Partner.find({ isDeleted: false })
    .sort({ createdAt: -1 })
    .lean();

  const partners = partnersDocs.map((p) => ({
    id: String(p._id),
    name: p.name,
    slug: p.slug,
    primaryEmail: p.primaryEmail,
    primaryContactName: p.primaryContactName,
    phone: p.phone,
    city: p.city,
    state: p.state,
    plan: p.plan,
    status: p.subscription.status,
    startDate: p.subscription.startDate,
    endDate: p.subscription.endDate,
    signupSource: p.signupSource ?? "admin",
    emailVerified: Boolean(p.emailVerifiedAt),
    createdAt: p.createdAt,
  }));

  const selfSignups = partners.filter((p) => p.signupSource === "self").length;

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="flex items-end justify-between">
        <div className="fade-up-sm">
          <div
            className="text-[11px] font-medium uppercase tracking-[0.18em] text-admin-accent"
            style={{ fontFamily: "var(--font-plex-mono), monospace" }}
          >
            Subscribers
          </div>
          <h2 className="mt-2 text-[34px] font-semibold tracking-tight text-admin-fg">
            Partners
          </h2>
          <p className="mt-2 text-[14px] text-admin-fg-muted">
            Every chambers on the platform.
            {partners.length > 0 && (
              <>
                {" "}
                <span className="font-medium text-admin-fg">
                  {partners.length}
                </span>{" "}
                total
                {selfSignups > 0 && (
                  <>
                    {", "}
                    <span className="font-medium text-admin-fg">
                      {selfSignups}
                    </span>{" "}
                    from self sign-up
                  </>
                )}
                .
              </>
            )}
          </p>
        </div>

        {partners.length > 0 && (
          <Link
            href="/admin/partners/new"
            className="inline-flex items-center gap-2 rounded-md bg-admin-accent px-4 py-2.5 text-[13px] font-medium text-white shadow-sm transition-all hover:bg-admin-accent-hover hover:shadow"
          >
            <span>+</span> Add Partner
          </Link>
        )}
      </div>

      {partners.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {partners.map((p, i) => (
            <PartnerCard
              key={p.id}
              partner={p}
              delay={0.05 + i * 0.04}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type PartnerCardProps = {
  partner: {
    id: string;
    name: string;
    slug: string;
    primaryEmail: string;
    primaryContactName: string;
    phone: string;
    city: string;
    state: string;
    plan: string;
    status: string;
    startDate: Date | string;
    endDate: Date | string;
    signupSource: string;
    emailVerified: boolean;
    createdAt: Date | string;
  };
  delay?: number;
};

function PartnerCard({ partner: p, delay = 0 }: PartnerCardProps) {
  const isTrial = p.status === "trial";
  const isSuspended = p.status === "suspended";
  const isCancelled = p.status === "cancelled";
  const isActive = p.status === "active";

  const trialEnd = new Date(p.endDate);
  const trialStart = new Date(p.startDate);
  const now = new Date();
  const totalMs = trialEnd.getTime() - trialStart.getTime();
  const elapsedMs = Math.max(0, now.getTime() - trialStart.getTime());
  const progressPct = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
  const daysLeft = Math.max(
    0,
    Math.ceil((trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  );
  const trialOver = isTrial && daysLeft <= 0;

  return (
    <Link
      href={`/admin/partners/${p.id}`}
      className="fade-up-sm group relative flex flex-col rounded-lg border border-admin-border bg-admin-surface p-6 transition-all hover:-translate-y-0.5 hover:border-admin-fg-soft hover:shadow-[0_8px_30px_-12px_rgba(14,26,31,0.18)]"
      style={{ animationDelay: `${delay}s` }}
    >
      {/* Top: status + plan badges */}
      <div className="flex items-start justify-between">
        <StatusPill status={p.status} small />
        <PlanPill plan={p.plan} />
      </div>

      {/* Name + slug */}
      <div className="mt-4">
        <h3 className="text-[20px] font-semibold leading-tight tracking-tight text-admin-fg group-hover:text-admin-accent">
          {p.name}
        </h3>
        <div
          className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-admin-fg-soft"
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          <span>/{p.slug}</span>
          {/* How the chambers arrived. Only self sign-ups are called out —
              admin-created is the historical default and needs no label. */}
          {p.signupSource === "self" && (
            <span
              className="rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em]"
              style={{
                backgroundColor: "var(--color-admin-accent-soft)",
                color: "var(--color-admin-accent)",
              }}
              title={
                p.emailVerified
                  ? "Signed up on the site and verified their email"
                  : "Signed up on the site"
              }
            >
              {p.emailVerified ? "Self · verified" : "Self sign-up"}
            </span>
          )}
        </div>
      </div>

      {/* Contact block */}
      <dl className="mt-5 space-y-1.5 text-[12px]">
        <div className="flex items-center gap-2 text-admin-fg-muted">
          <IconMail />
          <span
            className="truncate"
            style={{ fontFamily: "var(--font-plex-mono), monospace" }}
          >
            {p.primaryEmail}
          </span>
        </div>
        <div className="flex items-center gap-2 text-admin-fg-muted">
          <IconPhone />
          <span style={{ fontFamily: "var(--font-plex-mono), monospace" }}>
            {p.phone || "—"}
          </span>
        </div>
        {(p.city || p.state) && (
          <div className="flex items-center gap-2 text-admin-fg-muted">
            <IconPin />
            <span>
              {[p.city, p.state].filter(Boolean).join(", ") || "—"}
            </span>
          </div>
        )}
      </dl>

      {/* Status footer */}
      <div className="mt-auto pt-5">
        <div className="border-t border-admin-border-soft pt-4">
          {isTrial && !trialOver && (
            <>
              <div className="flex items-baseline justify-between">
                <div className="text-[12px] text-admin-fg-muted">Trial ends in</div>
                <div className="text-[14px] font-semibold tabular-nums text-admin-saffron">
                  {daysLeft} {daysLeft === 1 ? "day" : "days"}
                </div>
              </div>
              <div className="relative mt-2 h-1 overflow-hidden rounded-full bg-admin-border-soft">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-admin-saffron transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div
                className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-admin-fg-soft"
                style={{ fontFamily: "var(--font-plex-mono), monospace" }}
              >
                {trialEnd.toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            </>
          )}

          {isTrial && trialOver && (
            <div className="rounded-md border border-admin-danger/30 bg-admin-danger-soft px-3 py-2">
              <div
                className="text-[10px] font-medium uppercase tracking-[0.14em] text-admin-danger"
                style={{ fontFamily: "var(--font-plex-mono), monospace" }}
              >
                Trial expired · login blocked
              </div>
              <div className="mt-1 text-[11px] text-admin-fg-muted">
                Ended{" "}
                {trialEnd.toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                })}
              </div>
            </div>
          )}

          {isActive && (
            <div className="flex items-center gap-2 text-[12px] text-admin-fg-muted">
              <span className="block h-1.5 w-1.5 rounded-full bg-admin-accent" />
              Active since{" "}
              {trialStart.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </div>
          )}

          {isSuspended && (
            <div className="text-[12px] text-admin-danger">
              Suspended · login blocked
            </div>
          )}

          {isCancelled && (
            <div className="text-[12px] text-admin-danger">
              Cancelled · login blocked
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[11px] text-admin-fg-soft">
            View detail
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full text-admin-accent transition-all group-hover:bg-admin-accent-soft">
            →
          </span>
        </div>
      </div>
    </Link>
  );
}

function StatusPill({
  status,
  small = false,
}: {
  status: string;
  small?: boolean;
}) {
  const map: Record<string, { bg: string; fg: string; dot: string }> = {
    active: { bg: "bg-admin-accent-soft", fg: "text-admin-accent", dot: "bg-admin-accent" },
    trial: { bg: "bg-admin-saffron-soft", fg: "text-admin-saffron", dot: "bg-admin-saffron" },
    past_due: { bg: "bg-admin-warning-soft", fg: "text-admin-warning", dot: "bg-admin-warning" },
    cancelled: { bg: "bg-admin-danger-soft", fg: "text-admin-danger", dot: "bg-admin-danger" },
    suspended: { bg: "bg-admin-danger-soft", fg: "text-admin-danger", dot: "bg-admin-danger" },
  };
  const s = map[status] ?? map.trial;
  const label = status.replace("_", " ");
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
        small ? "text-[10px]" : "text-[10px]"
      } font-medium uppercase tracking-[0.12em] ${s.bg} ${s.fg}`}
      style={{ fontFamily: "var(--font-plex-mono), monospace" }}
    >
      <span className={`block h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {label}
    </span>
  );
}

function PlanPill({ plan }: { plan: string }) {
  const isTrial = plan === "trial";
  const label = plan.charAt(0).toUpperCase() + plan.slice(1);
  return (
    <span
      className={`rounded-sm border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] ${
        isTrial
          ? "border-admin-saffron/30 bg-admin-saffron-soft/50 text-admin-saffron"
          : "border-admin-border bg-admin-bg text-admin-fg-muted"
      }`}
      style={{ fontFamily: "var(--font-plex-mono), monospace" }}
    >
      {label}
    </span>
  );
}

function IconMail() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function IconPhone() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A14 14 0 0 1 4 7a2 2 0 0 1 1-3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconPin() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 22s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EmptyState() {
  return (
    <div className="fade-up-sm mt-10 rounded-lg border border-dashed border-admin-border bg-admin-surface p-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-admin-accent-soft text-admin-accent">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="17.5" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M14 19c0-2 2-3.5 4-3.5s3.5 1.5 3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="mt-5 text-[20px] font-semibold tracking-tight text-admin-fg">
        No partners yet
      </h3>
      <p className="mx-auto mt-2 max-w-md text-[14px] text-admin-fg-muted">
        Get the platform going by adding the first chambers. Their primary
        contact will be the partner-admin login — they can add their team after
        signing in.
      </p>
      <Link
        href="/admin/partners/new"
        className="mt-7 inline-flex items-center gap-2 rounded-md bg-admin-accent px-5 py-2.5 text-[13px] font-medium text-white shadow-sm transition-all hover:bg-admin-accent-hover hover:shadow"
      >
        <span>+</span> Add the first Partner
      </Link>
    </div>
  );
}
