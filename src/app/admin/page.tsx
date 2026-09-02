import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { Partner } from "@/models/Partner";
import { User } from "@/models/User";
import Link from "next/link";

export default async function AdminDashboard() {
  const session = await auth();
  await connectDB();

  const [totalPartners, activePartners, trialPartners, totalUsers] =
    await Promise.all([
      Partner.countDocuments({ isDeleted: false }),
      Partner.countDocuments({
        "subscription.status": "active",
        isDeleted: false,
      }),
      Partner.countDocuments({
        "subscription.status": "trial",
        isDeleted: false,
      }),
      User.countDocuments({
        userType: { $ne: "global_admin" },
        isDeleted: false,
      }),
    ]);

  const recentPartnersDocs = await Partner.find({ isDeleted: false })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  const recentPartners = recentPartnersDocs.map((p) => ({
    id: String(p._id),
    name: p.name,
    slug: p.slug,
    primaryEmail: p.primaryEmail,
    plan: p.plan,
    status: p.subscription.status,
    createdAt: p.createdAt,
  }));

  const firstName = session?.user?.firstName ?? "Global";

  return (
    <div className="mx-auto max-w-[1280px]">
      {/* Greeting */}
      <div className="fade-up-sm">
        <div
          className="text-[11px] font-medium uppercase tracking-[0.18em] text-admin-accent"
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          Overview
        </div>
        <h2 className="mt-2 text-[34px] font-semibold tracking-tight text-admin-fg">
          Welcome back, {firstName}.
        </h2>
        <p className="mt-2 max-w-xl text-[15px] text-admin-fg-muted">
          Here&rsquo;s how the platform is doing today. Add a new chambers,
          review subscriptions, or click through any number to drill in.
        </p>
      </div>

      {/* Stat cards */}
      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Partners"
          value={totalPartners}
          sublabel={`${activePartners} active · ${trialPartners} trial`}
          accent="emerald"
          icon={<IconPartners />}
          delay={0.05}
        />
        <StatCard
          label="Active Subscriptions"
          value={activePartners}
          sublabel={
            totalPartners
              ? `${Math.round((activePartners / totalPartners) * 100)}% of partners`
              : "no partners yet"
          }
          accent="emerald"
          icon={<IconCheck />}
          delay={0.1}
        />
        <StatCard
          label="On Trial"
          value={trialPartners}
          sublabel="convert before expiry"
          accent="saffron"
          icon={<IconClock />}
          delay={0.15}
        />
        <StatCard
          label="Total Users"
          value={totalUsers}
          sublabel="across all partners"
          accent="neutral"
          icon={<IconUsers />}
          delay={0.2}
        />
      </div>

      {/* Lower split */}
      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {/* Recent partners (2/3) */}
        <div className="lg:col-span-2">
          <div className="fade-up-sm rounded-lg border border-admin-border bg-admin-surface" style={{ animationDelay: "0.25s" }}>
            <div className="flex items-center justify-between border-b border-admin-border-soft px-6 py-4">
              <div>
                <h3 className="text-[16px] font-semibold tracking-tight text-admin-fg">
                  Recent Partners
                </h3>
                <p className="mt-0.5 text-[12px] text-admin-fg-soft">
                  Last five chambers added
                </p>
              </div>
              <Link
                href="/admin/partners"
                className="text-[13px] font-medium text-admin-accent transition-colors hover:text-admin-accent-hover"
              >
                View all →
              </Link>
            </div>

            {recentPartners.length === 0 ? (
              <EmptyPartners />
            ) : (
              <div className="divide-y divide-admin-border-soft">
                {recentPartners.map((p) => (
                  <Link
                    key={p.id}
                    href={`/admin/partners/${p.id}`}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-6 px-6 py-4 transition-colors hover:bg-admin-bg"
                  >
                    <div>
                      <div className="text-[14px] font-medium text-admin-fg">
                        {p.name}
                      </div>
                      <div
                        className="mt-0.5 text-[11px] text-admin-fg-soft"
                        style={{
                          fontFamily: "var(--font-plex-mono), monospace",
                        }}
                      >
                        {p.primaryEmail}
                      </div>
                    </div>
                    <PlanPill plan={p.plan} />
                    <StatusPill status={p.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions (1/3) */}
        <div className="space-y-4">
          <div className="fade-up-sm rounded-lg border border-admin-border bg-admin-surface p-6" style={{ animationDelay: "0.3s" }}>
            <div
              className="text-[10px] font-medium uppercase tracking-[0.18em] text-admin-fg-soft"
              style={{ fontFamily: "var(--font-plex-mono), monospace" }}
            >
              Quick actions
            </div>
            <div className="mt-4 space-y-2.5">
              <Link
                href="/admin/partners/new"
                className="flex items-center justify-between rounded-md bg-admin-accent px-4 py-3 text-[13px] font-medium text-white transition-colors hover:bg-admin-accent-hover"
              >
                <span>+ Add a Partner</span>
                <span>→</span>
              </Link>
              <Link
                href="/admin/partners"
                className="flex items-center justify-between rounded-md border border-admin-border bg-admin-bg px-4 py-3 text-[13px] font-medium text-admin-fg transition-colors hover:border-admin-fg-soft hover:bg-admin-surface"
              >
                <span>Browse Partners</span>
                <span className="text-admin-fg-soft">→</span>
              </Link>
            </div>
          </div>

          <div
            className="fade-up-sm rounded-lg border border-admin-border bg-admin-accent-soft p-6"
            style={{ animationDelay: "0.35s" }}
          >
            <div
              className="text-[10px] font-medium uppercase tracking-[0.18em] text-admin-accent"
              style={{ fontFamily: "var(--font-plex-mono), monospace" }}
            >
              Tip · § 01
            </div>
            <p className="mt-2 text-[13px] leading-6 text-admin-fg">
              Trials default to 14 days. You can extend a partner&rsquo;s trial
              from their detail page if they need more time before going active.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  accent,
  icon,
  delay = 0,
}: {
  label: string;
  value: number | string;
  sublabel: string;
  accent: "emerald" | "saffron" | "neutral";
  icon: React.ReactNode;
  delay?: number;
}) {
  const accentBg =
    accent === "emerald"
      ? "bg-admin-accent-soft text-admin-accent"
      : accent === "saffron"
        ? "bg-admin-saffron-soft text-admin-saffron"
        : "bg-admin-border-soft text-admin-fg-muted";

  return (
    <div
      className="fade-up-sm rounded-lg border border-admin-border bg-admin-surface p-6 transition-shadow hover:shadow-[0_4px_24px_-12px_rgba(14,26,31,0.15)]"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-start justify-between">
        <div
          className="text-[10px] font-medium uppercase tracking-[0.18em] text-admin-fg-soft"
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          {label}
        </div>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-md ${accentBg}`}
        >
          {icon}
        </div>
      </div>
      <div
        className="mt-5 text-[40px] font-semibold tabular-nums leading-none tracking-tight text-admin-fg"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </div>
      <div className="mt-2 text-[12px] text-admin-fg-muted">{sublabel}</div>
    </div>
  );
}

function PlanPill({ plan }: { plan: string }) {
  const label = plan.charAt(0).toUpperCase() + plan.slice(1);
  return (
    <span
      className="rounded-sm border border-admin-border bg-admin-bg px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-admin-fg-muted"
      style={{ fontFamily: "var(--font-plex-mono), monospace" }}
    >
      {label}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
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
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] ${s.bg} ${s.fg}`}
      style={{ fontFamily: "var(--font-plex-mono), monospace" }}
    >
      <span className={`block h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {label}
    </span>
  );
}

function EmptyPartners() {
  return (
    <div className="px-6 py-14 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-admin-accent-soft text-admin-accent">
        <IconPartners />
      </div>
      <div className="mt-4 text-[15px] font-medium text-admin-fg">
        No partners yet
      </div>
      <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-admin-fg-muted">
        When you add your first chambers, it&rsquo;ll appear here. Trials
        default to 14 days.
      </p>
      <Link
        href="/admin/partners/new"
        className="mt-5 inline-flex items-center gap-2 rounded-md bg-admin-accent px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-admin-accent-hover"
      >
        <span>+</span> Add the first Partner
      </Link>
    </div>
  );
}

function IconPartners() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="17.5" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M14 19c0-2 2-3.5 4-3.5s3.5 1.5 3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
