import Link from "next/link";
import { connectDB } from "@/lib/db";
import { Activity } from "@/models/Activity";
import ActivityRow, { type ActivityItem } from "./ActivityRow";

type FilterKey = "all" | "created" | "updated" | "password" | "danger" | "plan";

const FILTERS: { key: FilterKey; label: string; query: Record<string, unknown> }[] = [
  { key: "all", label: "All", query: {} },
  { key: "created", label: "Created", query: { action: "partner_created" } },
  {
    key: "updated",
    label: "Updated",
    query: {
      action: {
        $in: [
          "partner_updated",
          "partner_plan_changed",
          "partner_features_changed",
          "partner_trial_extended",
          "partner_unsuspended",
        ],
      },
    },
  },
  {
    key: "plan",
    label: "Plans",
    query: { action: "plan_updated" },
  },
  {
    key: "password",
    label: "Password",
    query: { action: "partner_password_reset" },
  },
  {
    key: "danger",
    label: "Danger",
    query: { action: { $in: ["partner_suspended", "partner_deleted"] } },
  },
];

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const sp = await searchParams;
  const activeFilter = (sp.filter as FilterKey) ?? "all";
  const filter = FILTERS.find((f) => f.key === activeFilter) ?? FILTERS[0];

  await connectDB();
  // The global-admin audit log shows global-admin actions only. Partner-
  // internal events (task.* / case.* / board.* / profile.* …, all dot-
  // namespaced) are the office's own activity and don't belong here, whereas
  // global-admin actions (partner_created, plan_updated, …) use underscores.
  // So on "All" we exclude any dotted action, which cleanly drops everything
  // performed by partner admins or partner accounts.
  const query =
    filter.key === "all" ? { action: { $not: /\./ } } : filter.query;
  const activitiesDocs = await Activity.find(query)
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const activities: ActivityItem[] = activitiesDocs.map((a) => ({
    id: String(a._id),
    actorName: a.actorName,
    actorEmail: a.actorEmail,
    actorType: a.actorType,
    action: a.action,
    targetType: a.targetType,
    targetId: a.targetId ? String(a.targetId) : null,
    targetName: a.targetName,
    message: a.message,
    metadata: (a.metadata ?? {}) as Record<string, unknown>,
    // Pass an ISO string so the client component handles dates uniformly
    createdAt: a.createdAt.toISOString(),
  }));

  const totalCount = await Activity.countDocuments({ action: { $not: /\./ } });
  const grouped = groupByDay(activities);

  return (
    <div className="mx-auto max-w-[1100px]">
      {/* Header */}
      <div className="fade-up-sm">
        <div
          className="text-[11px] font-medium uppercase tracking-[0.18em] text-admin-accent"
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          Audit log
        </div>
        <h2 className="mt-2 text-[34px] font-semibold tracking-tight text-admin-fg">
          Activity
        </h2>
        <p className="mt-2 max-w-xl text-[14px] text-admin-fg-muted">
          Every change made through the admin —{" "}
          <span className="font-medium text-admin-fg">{totalCount}</span> total
          events. Click any entry to see the full before/after diff. Showing
          the most recent {Math.min(activities.length, 100)}.
        </p>
      </div>

      {/* Filters */}
      <div
        className="fade-up-sm mt-8 flex flex-wrap items-center gap-2"
        style={{ animationDelay: "0.06s" }}
      >
        {FILTERS.map((f) => {
          const isActive = f.key === activeFilter;
          return (
            <Link
              key={f.key}
              href={
                f.key === "all"
                  ? "/admin/activity"
                  : `/admin/activity?filter=${f.key}`
              }
              className={`rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors ${
                isActive
                  ? "border-admin-fg bg-admin-fg text-white"
                  : "border-admin-border bg-admin-surface text-admin-fg-muted hover:border-admin-fg-soft hover:text-admin-fg"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="mt-10">
        {activities.length === 0 ? (
          <EmptyTimeline />
        ) : (
          <div className="relative">
            <div
              className="absolute left-[10px] top-3 bottom-3 w-px bg-admin-border"
              aria-hidden
            />
            {grouped.map((group, gi) => (
              <div key={group.label} className="mb-8 last:mb-0">
                <div
                  className="fade-up-sm relative mb-4 flex items-center gap-3 pl-7"
                  style={{ animationDelay: `${0.05 + gi * 0.05}s` }}
                >
                  <span
                    className="text-[10px] font-medium uppercase tracking-[0.22em] text-admin-fg-soft"
                    style={{ fontFamily: "var(--font-plex-mono), monospace" }}
                  >
                    {group.label}
                  </span>
                  <span className="block h-px flex-1 bg-admin-border-soft" />
                </div>

                <ol>
                  {group.items.map((a, i) => (
                    <ActivityRow
                      key={a.id}
                      activity={a}
                      delay={0.08 + gi * 0.05 + i * 0.025}
                    />
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function groupByDay<T extends { createdAt: string }>(items: T[]): {
  label: string;
  items: T[];
}[] {
  const groups: { label: string; items: T[] }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  function dayLabel(d: Date): string {
    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    if (dayStart.getTime() === today.getTime()) return "Today";
    if (dayStart.getTime() === yesterday.getTime()) return "Yesterday";
    return d.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  for (const it of items) {
    const label = dayLabel(new Date(it.createdAt));
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(it);
    } else {
      groups.push({ label, items: [it] });
    }
  }
  return groups;
}

function EmptyTimeline() {
  return (
    <div className="rounded-lg border border-dashed border-admin-border bg-admin-surface p-16 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-admin-accent-soft text-admin-accent">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M3 12h4l2-7 4 14 2-7h6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h3 className="mt-4 text-[16px] font-semibold tracking-tight text-admin-fg">
        Nothing to show yet
      </h3>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-admin-fg-muted">
        Partner creations, edits, password resets, and suspensions will land
        here with full timestamps.
      </p>
    </div>
  );
}
