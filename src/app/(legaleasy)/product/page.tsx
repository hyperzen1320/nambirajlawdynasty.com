import Link from "next/link";
import { connectDB } from "@/lib/db";
import { Plan } from "@/models/Plan";

// This landing page reads live pricing from the database, so it must render
// at request time — it can't be statically prerendered at build, where no
// database exists. Without this, `next build` tries to prerender "/" and
// crashes (MongooseError: uri must be a string).
export const dynamic = "force-dynamic";

type LandingPlan = {
  key: string;
  num: string;
  name: string;
  price: string;
  per: string;
  desc: string;
  features: string[];
  cta: string;
  popular: boolean;
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

async function fetchLandingPlans(): Promise<LandingPlan[]> {
  await connectDB();
  const docs = await Plan.find({ showOnLanding: true, isActive: true })
    .sort({ sortOrder: 1 })
    .lean();
  return docs.map((p, i) => ({
    key: p.key,
    num: ROMAN[i] ?? String(i + 1),
    name: p.label,
    price: p.priceLabel,
    per: p.priceSuffix,
    desc: p.description,
    features: p.features,
    cta: p.ctaLabel,
    popular: p.isPopular,
  }));
}

export default async function Home() {
  const plans = await fetchLandingPlans();
  return (
    <>
      <Hero />
      <TrustStrip />
      <Cabinet />
      <Chambers />
      <ExportFeature />
      <Pricing plans={plans} />
      <Closing />
    </>
  );
}

/* ──────────────────── Hero ──────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full opacity-[0.18]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(182,139,60,0.6), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05] paper-grain"
      />

      {/* upper masthead bar */}
      <div className="relative border-b border-rule/40">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-2 px-6 py-3 md:px-10">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
            <span className="text-brass-deep">Vol. I · No. 01</span>
            <span className="mx-2 text-rule">·</span>
            <span>Advocate Office Edition</span>
          </div>
          <div className="hidden font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft md:block">
            Founded 2026 · Made in India · Kept on paper, now on glass
          </div>
        </div>
      </div>

      <div className="relative mx-auto grid max-w-[1320px] grid-cols-1 gap-12 px-6 pb-24 pt-14 md:grid-cols-12 md:gap-10 md:px-10 md:pb-32 md:pt-20">
        {/* Left: headline */}
        <div className="md:col-span-7">
          <div
            className="rise font-mono text-[11px] uppercase tracking-[0.22em] text-brass-deep"
            style={{ animationDelay: "0.05s" }}
          >
            <span className="mr-3 inline-block h-px w-8 bg-brass align-middle" />
            For the Indian Bar
          </div>

          <h1
            className="rise mt-6 font-display text-[54px] font-medium leading-[1.02] tracking-[-0.025em] text-ink md:text-[88px]"
            style={{ animationDelay: "0.15s" }}
          >
            Your office,
            <br />
            every hearing,
            <br />
            every client,
            <br />
            <span className="italic text-ink-2">kept under one cover.</span>
          </h1>

          <p
            className="rise mt-8 max-w-xl font-body text-[18px] leading-8 text-ink-2"
            style={{ animationDelay: "0.3s" }}
          >
            Legalezi is the office, in your pocket. Cause-list at dawn,
            workflow at noon, senior-desk briefings before tea — and a year of
            records that prints, exports, and remembers, so you don&rsquo;t have
            to.
          </p>

          <div
            className="rise mt-10 flex flex-col gap-4 sm:flex-row sm:items-center"
            style={{ animationDelay: "0.45s" }}
          >
            <Link
              href="/signup"
              className="group inline-flex items-center justify-center gap-3 border border-ink bg-ink px-7 py-4 font-mono text-[12px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-ink-2"
            >
              Start 7 Days Free
              <span className="text-brass transition-transform duration-200 group-hover:translate-x-1">
                →
              </span>
            </Link>
            <Link
              href="#cabinet"
              className="group inline-flex items-center justify-center gap-2 border border-ink/30 px-7 py-4 font-mono text-[12px] uppercase tracking-[0.18em] text-ink transition-colors hover:border-ink hover:bg-paper-2"
            >
              See the Cabinet
              <span className="opacity-60 transition-opacity group-hover:opacity-100">
                ↓
              </span>
            </Link>
          </div>

          <div
            className="rise mt-12 flex flex-wrap items-center gap-x-6 gap-y-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft"
            style={{ animationDelay: "0.6s" }}
          >
            <span>
              <span className="text-brass">★★★★★</span>{" "}
              <span className="text-ink-2">4.9</span> · early access
            </span>
            <span className="text-rule">|</span>
            <span>200+ advocates · beta</span>
            <span className="text-rule">|</span>
            <span>iOS · Android · Web</span>
          </div>
        </div>

        {/* Right: case file card */}
        <aside className="rise md:col-span-5" style={{ animationDelay: "0.5s" }}>
          <CaseFileCard />
        </aside>
      </div>
    </section>
  );
}

function CaseFileCard() {
  const hearings = [
    {
      time: "10:30",
      court: "City Civil · Court 17",
      caseNo: "O.S. 4421/2024",
      client: "Murugesan & Co.",
      status: "Arguments",
    },
    {
      time: "11:45",
      court: "High Court · Court 8",
      caseNo: "W.P. 13990/2025",
      client: "Sundaram, R.",
      status: "Reply",
    },
    {
      time: "14:00",
      court: "Family · Court 3",
      caseNo: "M.C. 88/2026",
      client: "Iyer, P.",
      status: "Mediation",
    },
    {
      time: "16:15",
      court: "City Civil · Court 22",
      caseNo: "I.A. 311/2024",
      client: "BBMP",
      status: "Adjourn",
    },
  ];

  return (
    <div className="relative">
      {/* depth shadows */}
      <div className="absolute inset-x-3 -bottom-2 top-2 rotate-1 border border-ink/10 bg-paper-3/40" />
      <div className="absolute inset-x-1 -bottom-1 top-1 -rotate-1 border border-ink/15 bg-paper-2/60" />

      <div className="drift relative border border-ink bg-paper shadow-[0_30px_60px_-20px_rgba(14,26,43,0.25)]">
        {/* top bar */}
        <div className="flex items-center justify-between border-b border-ink bg-ink px-5 py-3 text-paper">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em]">
            Cause List · Today
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-brass">
            28 · IV · 2026
          </div>
        </div>

        <div className="px-5 py-5">
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-[28px] leading-none text-ink">
              04 Hearings
            </h3>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass-deep">
              Tuesday
            </div>
          </div>

          <div className="mt-5 space-y-0">
            {hearings.map((h, i) => (
              <div
                key={i}
                className="grid grid-cols-[auto_1fr_auto] items-baseline gap-4 border-b border-rule/50 py-3.5 last:border-b-0"
              >
                <div className="font-mono text-[12px] tabular-nums text-brass-deep">
                  {h.time}
                </div>
                <div>
                  <div className="font-display text-[16px] leading-snug text-ink">
                    {h.caseNo}
                  </div>
                  <div className="mt-0.5 font-body text-[13px] italic text-ink-soft">
                    {h.client}
                  </div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                    {h.court}
                  </div>
                </div>
                <div className="border border-vermillion/40 bg-vermillion/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-vermillion">
                  {h.status}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-ink/30 pt-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
              View all · Update next dates
            </div>
            <div className="font-mono text-[14px] text-brass">→</div>
          </div>
        </div>

        {/* corner stamp */}
        <div className="absolute -right-3 -top-3 rotate-12 border-2 border-vermillion bg-paper px-2 py-1 shadow-sm">
          <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-vermillion">
            Live · Beta
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────── Trust strip ──────────────────── */

function TrustStrip() {
  return (
    <section className="border-y border-rule/40 bg-paper-2/40">
      <div className="mx-auto max-w-[1320px] px-6 py-7 md:px-10">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft">
          <span className="text-brass-deep">Built for the Bar of</span>
          <span>Madras</span>
          <span className="text-rule">·</span>
          <span>Karnataka</span>
          <span className="text-rule">·</span>
          <span>Delhi</span>
          <span className="text-rule">·</span>
          <span>Bombay</span>
          <span className="text-rule">·</span>
          <span>Telangana</span>
          <span className="hidden text-rule md:inline">·</span>
          <span className="hidden italic text-ink-2 md:inline">
            — and chambers everywhere.
          </span>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── Cabinet (modules) ──────────────────── */

function Cabinet() {
  const modules = [
    {
      num: "I",
      name: "Case Vault",
      desc: "File no., CNR, IAs, hearings, opposite party. The matter, fully kept.",
      page: "p. 04",
    },
    {
      num: "II",
      name: "Client Crew",
      desc: "One client, many matters. Address, WhatsApp, every linked case.",
      page: "p. 12",
    },
    {
      num: "III",
      name: "Hearing Track",
      desc: "Court, place, date range. The week's hearings in one report.",
      page: "p. 20",
    },
    {
      num: "IV",
      name: "Today & Tomorrow",
      desc: "The morning's cause-list. Court-wise. Update, call, message — done.",
      page: "p. 28",
    },
    {
      num: "V",
      name: "Pending Dates",
      desc: "Cases without a next hearing. Catch them before the Bench does.",
      page: "p. 36",
    },
    {
      num: "VI",
      name: "Court Hub",
      desc: "Court name, court number, place. Master data for the whole office.",
      page: "p. 44",
    },
    {
      num: "VII",
      name: "Senior Desk",
      desc: "Reminders to your juniors. Internal notes. The chambers, coordinated.",
      page: "p. 52",
    },
    {
      num: "VIII",
      name: "Work Flow",
      desc: "New Suits, Notices, IAs, CAs, Battas, Follow-ups — Kanban'd.",
      page: "p. 60",
    },
    {
      num: "IX",
      name: "AI Assistant",
      desc: "Plaints, written statements, affidavits, notices — drafted, then verified.",
      page: "p. 68",
    },
    {
      num: "X",
      name: "Document Export",
      desc: "Word and PDF. Court-ready. With templates, history, and a stamp.",
      page: "p. 76",
    },
  ];

  return (
    <section id="cabinet" className="relative">
      <div className="mx-auto max-w-[1320px] px-6 py-24 md:px-10 md:py-32">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-brass-deep">
              The Cabinet — § II
            </div>
            <h2 className="mt-6 font-display text-[44px] font-medium leading-[1.05] tracking-[-0.025em] text-ink md:text-[60px]">
              Contents of <span className="italic">the office</span>, drawer by
              drawer.
            </h2>
          </div>
          <div className="md:col-span-6 md:col-start-7">
            <p className="font-body text-[17px] leading-8 text-ink-2">
              Ten drawers, each fitted to a piece of the practice. None of them
              new. All of them now in one place — labelled, indexed, and ready
              when the matter calls for it.
            </p>
          </div>
        </div>

        <div className="mt-16 border-t-2 border-ink/80">
          {modules.map((m) => (
            <Link
              key={m.num}
              href="#"
              className="group grid grid-cols-[60px_1fr] items-baseline gap-x-6 border-b border-rule/60 py-7 transition-colors hover:bg-paper-2/40 md:grid-cols-[80px_1fr_80px]"
            >
              <div className="font-mono text-[12px] uppercase tracking-[0.22em] text-brass">
                § {m.num}
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr_2fr] md:items-baseline md:gap-12">
                <div className="font-display text-[26px] font-medium leading-tight tracking-[-0.01em] text-ink transition-transform duration-300 group-hover:translate-x-2 md:text-[30px]">
                  {m.name}
                </div>
                <p className="font-body text-[15px] leading-7 text-ink-soft">
                  {m.desc}
                </p>
              </div>
              <div className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft md:block">
                {m.page}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── A day in chambers ──────────────────── */

function Chambers() {
  const moments = [
    {
      time: "07:30",
      text: "The cause-list arrives. You glance, sip, and tap update on three matters before chai is finished.",
    },
    {
      time: "10:00",
      text: "Court 17. Reply filed. Status moves from Drafting to Arguments. Junior sees it on the Senior Desk.",
    },
    {
      time: "12:45",
      text: "A client WhatsApps — date kya hai? You don't open the diary. You open the case. One tap.",
    },
    {
      time: "16:00",
      text: "Three Pending Dates left from yesterday. You clear them on the auto, between courts.",
    },
    {
      time: "19:15",
      text: "Tomorrow's list, exported to PDF, dropped in the office group. Tea is waiting.",
    },
  ];

  return (
    <section
      id="chambers"
      className="relative border-t border-rule/40 bg-paper-2/40"
    >
      <div className="mx-auto max-w-[1320px] px-6 py-24 md:px-10 md:py-32">
        <div className="grid gap-16 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-brass-deep">
              A Column — § III
            </div>
            <h2 className="mt-6 font-display text-[44px] font-medium leading-[1.04] tracking-[-0.025em] text-ink md:text-[60px]">
              <span className="italic">A Tuesday</span>
              <br />
              in chambers.
            </h2>
            <div className="mt-8 h-px w-24 bg-brass" />
            <p className="mt-8 max-w-md font-body text-[16px] italic leading-7 text-ink-soft">
              The way the day actually moves, from cause-list to closing the
              door at night.
            </p>
            <div className="mt-12 hidden md:block">
              <DropCap letter="A" />
            </div>
          </div>

          <div className="md:col-span-6 md:col-start-7">
            <ol className="space-y-9">
              {moments.map((m, i) => (
                <li key={i} className="grid grid-cols-[80px_1fr] gap-6">
                  <div>
                    <div className="font-mono text-[12px] uppercase tracking-[0.18em] tabular-nums text-brass-deep">
                      {m.time}
                    </div>
                    <div className="mt-3 h-px w-full bg-rule" />
                    <div className="mt-2 font-mono text-[10px] tabular-nums text-ink-soft/70">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                  </div>
                  <p className="font-body text-[18px] leading-8 text-ink-2">
                    {m.text}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

function DropCap({ letter }: { letter: string }) {
  return (
    <div className="relative inline-block">
      <span className="font-display text-[200px] font-medium leading-none text-ink/10">
        {letter}
      </span>
      <span className="absolute left-3 top-3 font-display text-[180px] italic leading-none text-brass">
        {letter}
      </span>
    </div>
  );
}

/* ──────────────────── Document Export feature ──────────────────── */

function ExportFeature() {
  return (
    <section id="export" className="border-t border-rule/40">
      <div className="mx-auto max-w-[1320px] px-6 py-24 md:px-10 md:py-32">
        <div className="grid gap-16 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-brass-deep">
              The Press — § IV
            </div>
            <h2 className="mt-6 font-display text-[44px] font-medium leading-[1.04] tracking-[-0.025em] text-ink md:text-[60px]">
              From record to{" "}
              <span className="italic">record-of-court.</span>
            </h2>
            <p className="mt-8 max-w-lg font-body text-[17px] leading-8 text-ink-2">
              Pick rows. Pick columns. Word, or PDF. A4. Court-ready. Save it
              as a template, run it across a thousand records, and keep the
              audit-trail. The office prints itself.
            </p>

            <ul className="mt-10 space-y-4">
              {[
                "Eight modules, one export modal",
                "Word · PDF · A4 · court margins",
                "Saved templates and full export history",
                "Under five seconds for a hundred records",
              ].map((t, i) => (
                <li key={i} className="flex items-baseline gap-5">
                  <span className="font-mono text-[10px] tabular-nums tracking-[0.18em] text-brass">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-body text-[15px] leading-7 text-ink-2">
                    {t}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0 md:col-span-6 md:col-start-7">
            {/* On phones the editorial document preview is wider than the
                viewport (its table sets a ~400px min-width). min-w-0 lets the
                grid column shrink below that, and the wrapper scrolls the
                preview horizontally instead of overflowing the page. Desktop
                keeps the seal overhang via md:overflow-visible. */}
            <div className="overflow-x-auto overflow-y-hidden pt-6 md:overflow-visible md:pt-0">
              <DocumentPreview />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DocumentPreview() {
  return (
    <div className="relative">
      <div className="absolute left-3 top-3 h-full w-full bg-paper-3/40" />
      <div className="absolute left-1.5 top-1.5 h-full w-full bg-paper-3/60" />

      <div className="relative border border-ink/25 bg-white px-7 py-7 shadow-[0_30px_60px_-20px_rgba(14,26,43,0.25)]">
        <div className="absolute -right-5 -top-5 flex h-20 w-20 rotate-12 items-center justify-center rounded-full border-2 border-vermillion/70 bg-paper">
          <div className="text-center font-mono text-[7px] uppercase leading-tight tracking-[0.2em] text-vermillion">
            <div>Office</div>
            <div className="my-0.5 mx-auto h-px w-7 bg-vermillion/50" />
            <div>Seal</div>
            <div className="mt-0.5">2026</div>
          </div>
        </div>

        <div className="border-b-[3px] border-double border-ink/70 pb-4">
          <div className="text-center">
            <div className="font-display text-[24px] font-medium tracking-tight text-ink">
              K S Nagendhran &amp; Associates
            </div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-ink-soft">
              Advocates · High Court of Karnataka
            </div>
          </div>
        </div>

        <div className="mt-5 text-center">
          <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-brass-deep">
            Document № AOMS/2026/04/144
          </div>
          <h3 className="mt-2 font-display text-[20px] font-medium text-ink">
            Case Status Report — 28 April 2026
          </h3>
        </div>

        <div className="mt-5 overflow-hidden border border-ink/30">
          <div className="grid grid-cols-[40px_1fr_1fr_88px_72px] bg-ink text-[9px] text-paper">
            <div className="border-r border-paper/20 px-2 py-2 font-mono uppercase tracking-[0.15em]">
              №
            </div>
            <div className="border-r border-paper/20 px-2 py-2 font-mono uppercase tracking-[0.15em]">
              Case
            </div>
            <div className="border-r border-paper/20 px-2 py-2 font-mono uppercase tracking-[0.15em]">
              Client
            </div>
            <div className="border-r border-paper/20 px-2 py-2 font-mono uppercase tracking-[0.15em]">
              Court
            </div>
            <div className="px-2 py-2 font-mono uppercase tracking-[0.15em]">
              Status
            </div>
          </div>
          {[
            ["01", "O.S. 4421/2024", "Murugesan & Co.", "City C. 17", "Args"],
            ["02", "W.P. 13990/2025", "Sundaram, R.", "HC 8", "Reply"],
            ["03", "M.C. 88/2026", "Iyer, P.", "Family 3", "Med."],
            ["04", "I.A. 311/2024", "BBMP", "City C. 22", "Adj."],
            ["05", "C.R.P. 2018/2025", "Reddy, V.", "HC 14", "Listed"],
          ].map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-[40px_1fr_1fr_88px_72px] border-t border-ink/15 text-[10px]"
            >
              <div className="border-r border-ink/10 px-2 py-2 font-mono tabular-nums text-ink-soft">
                {row[0]}
              </div>
              <div className="border-r border-ink/10 px-2 py-2 font-mono text-ink">
                {row[1]}
              </div>
              <div className="border-r border-ink/10 px-2 py-2 font-body italic text-ink-2">
                {row[2]}
              </div>
              <div className="border-r border-ink/10 px-2 py-2 font-body text-ink-soft">
                {row[3]}
              </div>
              <div className="px-2 py-2 font-mono text-[9px] text-vermillion">
                {row[4]}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-baseline justify-between border-t border-ink/30 pt-3">
          <div className="font-mono text-[8px] uppercase tracking-[0.22em] text-ink-soft">
            Generated from Legalezi · AOMS
          </div>
          <div className="font-mono text-[8px] tabular-nums text-ink-soft">
            Page 1 of 4
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────── Pricing ──────────────────── */

function Pricing({ plans }: { plans: LandingPlan[] }) {
  return (
    <section
      id="pricing"
      className="border-t border-rule/40 bg-paper-2/40"
    >
      <div className="mx-auto max-w-[1320px] px-6 py-24 md:px-10 md:py-32">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-brass-deep">
              The Prospectus — § V
            </div>
            <h2 className="mt-6 font-display text-[44px] font-medium leading-[1.04] tracking-[-0.025em] text-ink md:text-[60px]">
              Three editions, <span className="italic">one practice.</span>
            </h2>
          </div>
          <div className="md:col-span-6 md:col-start-7">
            <p className="font-body text-[17px] leading-8 text-ink-2">
              Priced for chambers, not for venture rounds. Annual subscriptions,
              paid as you wish — quarterly, half-yearly, or yearly. All amounts
              in INR.
            </p>
          </div>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {plans.map((p, i) => (
            <article
              key={i}
              className={`relative flex flex-col border p-8 ${
                p.popular
                  ? "border-ink bg-paper shadow-[0_20px_60px_-20px_rgba(14,26,43,0.25)]"
                  : "border-ink/30 bg-paper/60"
              }`}
            >
              {p.popular && (
                <div className="absolute -top-3 left-7 bg-brass px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-paper">
                  Most chambers
                </div>
              )}

              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-brass">
                Edition · {p.num}
              </div>
              <h3 className="mt-2 font-display text-[32px] font-medium tracking-[-0.01em] text-ink">
                {p.name}
              </h3>

              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-[44px] font-medium tabular-nums text-ink">
                  {p.price}
                </span>
                {p.per && (
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
                    {p.per}
                  </span>
                )}
              </div>

              <p className="mt-3 font-body text-[14px] leading-7 text-ink-soft">
                {p.desc}
              </p>

              <div className="my-6 h-px w-full bg-rule" />

              <ul className="space-y-3">
                {p.features.map((f, j) => (
                  <li key={j} className="flex items-baseline gap-3">
                    <span className="font-mono text-[10px] text-brass">✦</span>
                    <span className="font-body text-[14px] leading-6 text-ink-2">
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href="#"
                className={`mt-10 inline-flex items-center justify-center gap-2 px-5 py-3.5 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors ${
                  p.popular
                    ? "bg-ink text-paper hover:bg-ink-2"
                    : "border border-ink/40 text-ink hover:border-ink hover:bg-paper-2"
                }`}
              >
                {p.cta}
                <span className={p.popular ? "text-brass" : "text-brass-deep"}>
                  →
                </span>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── Closing ──────────────────── */

function Closing() {
  return (
    <section id="access" className="border-t border-rule/40">
      <div className="mx-auto max-w-[1320px] px-6 py-24 md:px-10 md:py-32">
        <div className="text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-brass-deep">
            The Verdict — § VI
          </div>
          <h2 className="mx-auto mt-6 max-w-3xl font-display text-[48px] font-medium leading-[1.04] tracking-[-0.03em] text-ink md:text-[80px]">
            Your office is{" "}
            <span className="italic">already in here.</span>
            <br />
            Come and arrange it.
          </h2>
          <div className="mt-12 flex flex-col items-center justify-center gap-5 sm:flex-row">
            <Link
              href="/signup"
              className="group inline-flex items-center justify-center gap-3 border border-ink bg-ink px-8 py-4 font-mono text-[12px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-ink-2"
            >
              Start 7 Days Free
              <span className="text-brass transition-transform duration-200 group-hover:translate-x-1">
                →
              </span>
            </Link>
            <Link
              href="mailto:chambers@legalezi.com"
              className="font-body text-[15px] italic text-ink-2 underline-offset-4 transition-all hover:underline"
            >
              or, write to chambers@legalezi.com
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
