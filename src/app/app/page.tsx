import Link from "next/link";
import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { istDayStart } from "@/lib/ist-day";
import { Case } from "@/models/Case";
import { Board } from "@/models/Board";
import { Task } from "@/models/Task";
import Logo from "@/components/Logo";
import SeniorDeskTile from "./SeniorDeskTile";
import { currentFeatures } from "@/lib/feature-guard";
import { isFeatureEnabled, type FeatureMap } from "@/lib/features";
import { fullName } from "@/lib/display-name";
import { User } from "@/models/User";

export default async function PartnerDashboard() {
  const session = await auth();
  // The dashboard is the one page that can't be switched off, so it has to
  // hide the tiles and stat cards that lead into modules which HAVE been.
  const features = await currentFeatures();
  let displayName = fullName(
    session?.user?.firstName,
    session?.user?.lastName,
    "Counsel",
  );
  const partnerId = session?.user?.partnerId
    ? new mongoose.Types.ObjectId(session.user.partnerId)
    : null;

  // Day boundaries in IST, not in whatever timezone the server happens
  // to run in — the same helper the Hearing Track uses, so the tile and
  // the diary can't disagree about which matters are listed today.
  const now = new Date();
  const startOfToday = istDayStart(now, 0);
  const startOfTomorrow = istDayStart(now, 1);
  const startOfDayAfter = istDayStart(now, 2);

  let stats = {
    todayHearings: 0,
    tomorrowHearings: 0,
    pendingDates: 0,
    caseVault: 0,
  };
  let todaysBoard: Array<{
    id: string;
    caseNo: string;
    status: string;
    clientName: string;
    courtName: string;
    courtPlace: string;
    nextHearingDate: string | null;
  }> = [];
  let boardCount = 0;
  let cardCount = 0;

  if (partnerId) {
    await connectDB();
    // Read the name fresh from the DB so a change in global admin (Contact
    // Name) or My Profile shows here immediately, not only after re-login.
    if (session?.user?.email) {
      const me = await User.findOne({ email: session.user.email })
        .select("firstName lastName")
        .lean();
      if (me) displayName = fullName(me.firstName, me.lastName, "Counsel");
    }
    // Disposed cases stay out of every dashboard tile and the today's
    // board cause-list — they only appear in /app/disposed-cases.
    const activeFilter = {
      partnerId,
      isDeleted: false,
      disposedAt: null,
    } as const;
    const [today, tomorrow, pending, vault, boardDocs, boards, cards] =
      await Promise.all([
        Case.countDocuments({
          ...activeFilter,
          nextHearingDate: { $gte: startOfToday, $lt: startOfTomorrow },
        }),
        Case.countDocuments({
          ...activeFilter,
          nextHearingDate: { $gte: startOfTomorrow, $lt: startOfDayAfter },
        }),
        Case.countDocuments({
          ...activeFilter,
          $or: [
            { nextHearingDate: null },
            { nextHearingDate: { $lt: startOfToday } },
          ],
        }),
        Case.countDocuments(activeFilter),
        Case.find({
          ...activeFilter,
          nextHearingDate: {
            $gte: startOfToday,
            $lt: istDayStart(now, 14),
          },
        })
          .sort({ nextHearingDate: 1 })
          .limit(5)
          .lean(),
        Board.countDocuments({ partnerId, isDeleted: false }),
        Task.countDocuments({ partnerId, isDeleted: false }),
      ]);

    stats = {
      todayHearings: today,
      tomorrowHearings: tomorrow,
      pendingDates: pending,
      caseVault: vault,
    };
    boardCount = boards;
    cardCount = cards;
    todaysBoard = boardDocs.map((c) => ({
      id: String(c._id),
      caseNo: c.caseNo,
      status: c.status,
      clientName: c.clientName,
      courtName: c.courtName,
      courtPlace: c.courtPlace,
      nextHearingDate: c.nextHearingDate
        ? c.nextHearingDate.toISOString()
        : null,
    }));
  }

  const hour = new Date().getHours();
  const greeting =
    hour < 5
      ? "Late night"
      : hour < 12
        ? "Good morning"
        : hour < 17
          ? "Good afternoon"
          : "Good evening";

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-[1280px] space-y-8">
        <Hero
          greeting={greeting}
          name={displayName}
          stats={stats}
        />

        <StatsRow stats={stats} features={features} />

        <DeskTiles
          boardCount={boardCount}
          cardCount={cardCount}
          features={features}
        />

        {isFeatureEnabled(features, "hearings") ? (
          <TodaysBoard cases={todaysBoard} />
        ) : null}
      </div>
    </div>
  );
}

/* ──────────────── Hero ──────────────── */

function Hero({
  greeting,
  name,
  stats,
}: {
  greeting: string;
  name: string;
  stats: { todayHearings: number; pendingDates: number };
}) {
  const today = new Date();
  const eyebrow = today
    .toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
    })
    .toUpperCase();

  return (
    <section
      className="fade-up-sm relative overflow-hidden rounded-2xl px-6 py-8 sm:px-10 sm:py-12"
      style={{
        background: `linear-gradient(135deg, var(--color-app-ink-2) 0%, var(--color-app-ink) 100%)`,
        boxShadow: "0 18px 48px -28px rgba(18,29,53,0.55)",
      }}
    >
      {/* Brand mark watermark, large + faint, top-right */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-4 -top-10"
        style={{ opacity: 0.12 }}
      >
        <Logo size={380} alt="" />
      </div>

      {/* Eyebrow */}
      <div
        className="text-[11px] uppercase tracking-[0.32em]"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-copper-bright)",
        }}
      >
        {eyebrow}
      </div>

      {/* Greeting */}
      <h2
        className="mt-5 text-[38px] font-semibold leading-[1.05] tracking-tight sm:text-[56px] sm:leading-[1.04]"
        style={{
          fontFamily: "var(--font-crimson), Georgia, serif",
          color: "var(--color-app-ivory)",
        }}
      >
        {greeting},{" "}
        <span style={{ fontStyle: "italic", color: "var(--color-app-copper-bright)" }}>
          {name}.
        </span>
      </h2>

      {/* Body */}
      <p
        className="mt-5 max-w-2xl text-[16px] leading-7"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          color: "var(--color-app-ivory-soft)",
        }}
      >
        {stats.todayHearings === 0 && stats.pendingDates === 0 ? (
          <>
            A clear desk today. No hearings scheduled, nothing pending. The
            perfect moment to add new matters or attend to long-term work.
          </>
        ) : (
          <>
            You have{" "}
            <CountInline n={stats.todayHearings} /> {stats.todayHearings === 1 ? "hearing" : "hearings"} scheduled today
            {stats.pendingDates > 0 ? (
              <>
                {" "}and{" "}
                <CountInline n={stats.pendingDates} /> {stats.pendingDates === 1 ? "matter" : "matters"} awaiting next date
              </>
            ) : null}
            .
          </>
        )}
      </p>
    </section>
  );
}

function CountInline({ n }: { n: number }) {
  return (
    <span
      className="font-semibold tabular-nums"
      style={{
        color: "var(--color-app-copper-bright)",
        fontFamily: "var(--font-crimson), Georgia, serif",
      }}
    >
      {n}
    </span>
  );
}

/* ──────────────── Stats row ──────────────── */

function StatsRow({
  stats,
  features,
}: {
  stats: {
    todayHearings: number;
    tomorrowHearings: number;
    pendingDates: number;
    caseVault: number;
  };
  features: FeatureMap;
}) {
  // Three of these four cards are doorways into Hearing Track and the
  // fourth into Case Vault — a card that leads somewhere the chambers
  // can't go would just be a dead end.
  const showHearings = isFeatureEnabled(features, "hearings");
  const showCases = isFeatureEnabled(features, "cases");
  if (!showHearings && !showCases) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {showHearings ? (
        <>
      <StatCard
        label="Today Hearings"
        value={stats.todayHearings}
        variant="copper"
        href="/app/hearings"
        icon={<IconCalToday />}
        delay={0.05}
      />
      <StatCard
        label="Tomorrow Hearings"
        value={stats.tomorrowHearings}
        variant="ink"
        href="/app/hearings?tab=tomorrow"
        icon={<IconCalNext />}
        delay={0.1}
      />
      <StatCard
        label="Pending Dates"
        value={stats.pendingDates}
        variant="gold-bright"
        href="/app/hearings?tab=pending"
        icon={<IconAlert />}
        delay={0.15}
      />
        </>
      ) : null}
      {showCases ? (
        <StatCard
          label="Case Vault"
          value={stats.caseVault}
          variant="paper"
          href="/app/cases"
          icon={<IconBriefcase />}
          delay={0.2}
        />
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  variant,
  href,
  icon,
  delay,
}: {
  label: string;
  value: number;
  variant: "copper" | "gold-bright" | "ink" | "paper";
  href: string;
  icon: React.ReactNode;
  delay: number;
}) {
  const styles = {
    // Today Hearings — gold-dark.
    copper: {
      bg: "var(--color-app-copper)",
      text: "var(--color-app-copper-text)",
      label: "var(--color-app-copper-text)",
      iconBg: "rgba(0,0,0,0.12)",
      ring: "transparent",
      shadow: "0 10px 28px -14px rgba(172,123,51,0.6)",
    },
    // Pending Dates — gold-bright, the brighter amber that sets it apart
    // from Today at a glance.
    "gold-bright": {
      bg: "var(--color-app-gold-bright)",
      text: "var(--color-app-copper-text)",
      label: "var(--color-app-copper-text)",
      iconBg: "rgba(0,0,0,0.13)",
      ring: "transparent",
      shadow: "0 10px 28px -14px rgba(210,147,0,0.6)",
    },
    // Tomorrow Hearings — primary-navy.
    ink: {
      bg: "var(--color-app-ink)",
      text: "var(--color-app-ivory)",
      label: "var(--color-app-copper-bright)",
      iconBg: "rgba(255,255,255,0.08)",
      ring: "transparent",
      shadow: "0 12px 30px -14px rgba(18,29,53,0.55)",
    },
    // Case Vault — card-white, the one light tile; a hairline ring keeps
    // it defined against the cream canvas.
    paper: {
      bg: "var(--color-app-paper)",
      text: "var(--color-app-ink)",
      label: "var(--color-app-fg-muted)",
      iconBg: "var(--color-app-canvas-2)",
      ring: "var(--color-app-edge)",
      shadow: "0 10px 26px -18px rgba(18,29,53,0.28)",
    },
  }[variant];

  return (
    <Link
      href={href}
      className="fade-up-sm group relative flex flex-col rounded-2xl px-6 py-4 transition-transform hover:-translate-y-0.5"
      style={{
        backgroundColor: styles.bg,
        animationDelay: `${delay}s`,
        boxShadow: `${styles.shadow}, inset 0 0 0 1px ${styles.ring}`,
      }}
    >
      {/* Icon */}
      <div
        className="mb-3 flex h-9 w-9 items-center justify-center rounded-md"
        style={{ backgroundColor: styles.iconBg, color: styles.text }}
      >
        {icon}
      </div>

      {/* Big number */}
      <div
        className="text-[44px] font-semibold leading-none tabular-nums tracking-tight sm:text-[48px]"
        style={{
          fontFamily: "var(--font-crimson), Georgia, serif",
          color: styles.text,
        }}
      >
        {value}
      </div>

      {/* Label */}
      <div
        className="mt-2.5 text-[11px] uppercase tracking-[0.18em]"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: styles.label,
        }}
      >
        {label}
      </div>
    </Link>
  );
}

/* ──────────────── Desk tiles ──────────────── */

function DeskTiles({
  boardCount,
  cardCount,
  features,
}: {
  boardCount: number;
  cardCount: number;
  features: FeatureMap;
}) {
  const workflowSubtitle =
    boardCount === 0
      ? "Set up your first board to organise office work."
      : `${boardCount} board${boardCount === 1 ? "" : "s"} · ${cardCount} card${
          cardCount === 1 ? "" : "s"
        } in motion`;

  const showWorkflow = isFeatureEnabled(features, "workflow");
  const showDesk = isFeatureEnabled(features, "seniorDesk");
  if (!showWorkflow && !showDesk) return null;

  return (
    <div
      className={`grid gap-4 ${
        showWorkflow && showDesk ? "md:grid-cols-2" : ""
      }`}
    >
      {showWorkflow ? (
        <PhaseCard
          title="Work Flow"
          subtitle={workflowSubtitle}
          icon={<IconBoards />}
          href="/app/workflow"
        />
      ) : null}
      {showDesk ? <SeniorDeskTile /> : null}
    </div>
  );
}

function PhaseCard({
  title,
  subtitle,
  icon,
  href,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <>
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
        style={{
          backgroundColor: "var(--color-app-canvas-2)",
          color: "var(--color-app-copper-deep)",
        }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="text-[20px] font-semibold tracking-tight"
          style={{
            fontFamily: "var(--font-crimson), Georgia, serif",
            color: "var(--color-app-ink)",
          }}
        >
          {title}
        </div>
        <div
          className="mt-0.5 text-[13px]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-fg-muted)",
          }}
        >
          {subtitle}
        </div>
      </div>
      {href ? (
        <span
          className="shrink-0"
          style={{ color: "var(--color-app-copper-deep)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12h14M13 5l7 7-7 7"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      ) : null}
    </>
  );

  const className =
    "fade-up-sm flex items-center gap-4 rounded-2xl p-5 transition-[transform,box-shadow] duration-200 ease-out" +
    (href ? " hover:-translate-y-0.5" : "");

  const style: React.CSSProperties = {
    backgroundColor: "var(--color-app-paper)",
    boxShadow:
      "0 10px 26px -18px rgba(18,29,53,0.28), inset 0 0 0 1px var(--color-app-edge)",
  };

  if (href) {
    return (
      <Link href={href} className={className} style={style}>
        {inner}
      </Link>
    );
  }
  return (
    <div className={className} style={style}>
      {inner}
    </div>
  );
}

/* ──────────────── Today's Board ──────────────── */

function TodaysBoard({
  cases,
}: {
  cases: Array<{
    id: string;
    caseNo: string;
    status: string;
    clientName: string;
    courtName: string;
    courtPlace: string;
    nextHearingDate: string | null;
  }>;
}) {
  return (
    <section className="fade-up-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h3
          className="text-[28px] font-semibold tracking-tight"
          style={{
            fontFamily: "var(--font-crimson), Georgia, serif",
            color: "var(--color-app-ink)",
          }}
        >
          Today&rsquo;s Board
        </h3>
        <Link
          href="/app/cases"
          className="text-[13px] font-medium transition-colors"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-copper-deep)",
          }}
        >
          View all →
        </Link>
      </div>

      {cases.length === 0 ? (
        <EmptyBoard />
      ) : (
        <div className="space-y-3">
          {cases.map((c) => (
            <BoardRow key={c.id} c={c} />
          ))}
        </div>
      )}
    </section>
  );
}

function BoardRow({
  c,
}: {
  c: {
    id: string;
    caseNo: string;
    status: string;
    clientName: string;
    courtName: string;
    courtPlace: string;
    nextHearingDate: string | null;
  };
}) {
  return (
    <Link
      href={`/app/cases/${c.id}`}
      className="group flex items-center gap-4 rounded-xl p-5 transition-all hover:-translate-y-0.5"
      style={{
        backgroundColor: "var(--color-app-paper)",
        boxShadow: "0 1px 0 var(--color-app-edge)",
        borderLeft: "3px solid var(--color-app-copper)",
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <span
            className="text-[18px] font-semibold tracking-tight"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            {c.caseNo}
          </span>
          {c.status ? (
            <span
              className="rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                backgroundColor: "var(--color-app-aqua-soft)",
                color: "var(--color-app-aqua)",
              }}
            >
              {c.status}
            </span>
          ) : null}
        </div>
        <div
          className="mt-1.5 text-[13px]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-fg-soft)",
          }}
        >
          {c.clientName ? (
            <>
              <span className="font-medium">{c.clientName}</span>
              {(c.courtName || c.courtPlace) && (
                <span style={{ color: "var(--color-app-fg-muted)" }}> · </span>
              )}
            </>
          ) : null}
          {c.courtName ? c.courtName : ""}
          {c.courtName && c.courtPlace ? ", " : ""}
          {c.courtPlace ? c.courtPlace : ""}
        </div>
      </div>
      <div
        className="text-[18px] transition-transform group-hover:translate-x-1"
        style={{ color: "var(--color-app-copper-deep)" }}
      >
        →
      </div>
    </Link>
  );
}

function EmptyBoard() {
  return (
    <div
      className="rounded-xl p-12 text-center"
      style={{
        backgroundColor: "var(--color-app-paper)",
        border: "1px dashed var(--color-app-edge)",
      }}
    >
      <div
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
        style={{
          backgroundColor: "var(--color-app-canvas-2)",
          color: "var(--color-app-copper-deep)",
        }}
      >
        <IconBriefcase />
      </div>
      <h4
        className="mt-5 text-[24px] font-semibold tracking-tight"
        style={{
          fontFamily: "var(--font-crimson), Georgia, serif",
          color: "var(--color-app-ink)",
        }}
      >
        Nothing on the board yet.
      </h4>
      <p
        className="mx-auto mt-2 max-w-md text-[14px] leading-7"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          color: "var(--color-app-fg-muted)",
        }}
      >
        Once you add cases and set their next hearing date, the
        upcoming-hearing matters will appear here in chronological order.
      </p>
      <Link
        href="/app/cases/new"
        className="mt-6 inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-[13px] font-semibold transition-all"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          backgroundColor: "var(--color-app-ink)",
          color: "var(--color-app-ivory)",
        }}
      >
        <span>+</span> Add the first case
      </Link>
    </div>
  );
}

/* ──────────────── Icons ──────────────── */

function IconCalToday() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" />
    </svg>
  );
}
function IconCalNext() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 15l3 3 4-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconAlert() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3l10 17H2L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 10v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.8" fill="currentColor" />
    </svg>
  );
}
function IconBriefcase() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="7" width="18" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 12h18" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function IconBoards() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="6" height="18" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11" y="3" width="6" height="11" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11" y="16" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="19" y="3" width="2" height="18" rx="1" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
