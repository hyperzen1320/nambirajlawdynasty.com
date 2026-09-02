"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { AttendanceStatus } from "@/models/Attendance";

// Attendance — month grid + per-user metrics. Admins mark; non-admins
// see only their own row, read-only.

const STATUS_OPTIONS: {
  key: AttendanceStatus;
  label: string;
  short: string;
  bg: string;
  fg: string;
}[] = [
  {
    key: "present",
    label: "Present",
    short: "P",
    bg: "var(--color-app-aqua-soft)",
    fg: "var(--color-app-aqua)",
  },
  {
    key: "absent",
    label: "Absent",
    short: "A",
    bg: "var(--color-app-danger-soft)",
    fg: "var(--color-app-danger)",
  },
  {
    key: "half_day",
    label: "Half day",
    short: "½",
    bg: "rgba(197,133,58,0.18)",
    fg: "var(--color-app-copper-deep)",
  },
  {
    key: "leave",
    label: "Leave",
    short: "L",
    bg: "rgba(86,160,168,0.18)",
    fg: "#1c6a73",
  },
  {
    key: "holiday",
    label: "Holiday",
    short: "H",
    bg: "var(--color-app-canvas-2)",
    fg: "var(--color-app-fg-muted)",
  },
];

const STATUS_BY_KEY = new Map(STATUS_OPTIONS.map((s) => [s.key, s]));

type UserDTO = {
  id: string;
  name: string;
  email: string;
  role: string;
  isYou: boolean;
};

type RecordDTO = {
  id: string;
  userId: string;
  date: string;
  status: AttendanceStatus;
  note: string;
  markedByName: string;
  markedAt: string;
};

type Summary = {
  present: number;
  absent: number;
  halfDay: number;
  leave: number;
  holiday: number;
  notMarked: number;
  totalDays: number;
  daysSoFar: number;
  attendancePct: number;
};

type ApiResponse = {
  month: string;
  totalDays: number;
  daysSoFar: number;
  users: UserDTO[];
  records: RecordDTO[];
  summary: {
    perUser: Record<string, Summary>;
    office: {
      avgAttendancePct: number;
      totalUsers: number;
      totalMarked: number;
      totalPossible: number;
    };
  };
  isAdmin: boolean;
};

export default function AttendanceClient({
  isAdmin,
  me,
}: {
  isAdmin: boolean;
  me: { id: string; name: string };
}) {
  // The visible month is local-only — switching it triggers a refetch
  // but doesn't change the URL. Sharing a month link would force the
  // server to be paginated through query params, which we can layer on
  // later if a real need shows up.
  const [year, setYear] = useState<number>(() => nowYearIst());
  const [month, setMonth] = useState<number>(() => nowMonthIst());

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const fetchMonth = useCallback(async () => {
    setLoading(true);
    setError(null);
    const seq = ++requestRef.current;
    try {
      const param = `${year}-${String(month).padStart(2, "0")}`;
      const res = await fetch(`/api/app/attendance?month=${param}`, {
        cache: "no-store",
      });
      const body = await res.json().catch(() => null);
      if (seq !== requestRef.current) return;
      if (!res.ok || !body) {
        setError(body?.error || "Couldn't load attendance.");
        setData(null);
        return;
      }
      setData(body as ApiResponse);
    } catch {
      if (seq !== requestRef.current) return;
      setError("Network error. Try again.");
      setData(null);
    } finally {
      if (seq === requestRef.current) setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchMonth();
  }, [fetchMonth]);

  function goPrev() {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else setMonth((m) => m - 1);
  }
  function goNext() {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else setMonth((m) => m + 1);
  }
  function goCurrent() {
    setYear(nowYearIst());
    setMonth(nowMonthIst());
  }

  const isCurrentMonth = year === nowYearIst() && month === nowMonthIst();

  // Build the day list for the visible month. Each day carries the
  // weekday letter (S M T W T F S) which we use as a subtitle.
  const days = useMemo(() => {
    if (!data) return [];
    // Today in IST as a (year, month, day) tuple — drives the
    // future-date cutoff so future cells render as locked.
    const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const todayY = istNow.getUTCFullYear();
    const todayM = istNow.getUTCMonth() + 1;
    const todayD = istNow.getUTCDate();
    const list: {
      day: number;
      weekday: string;
      iso: string;
      isFuture: boolean;
      isToday: boolean;
    }[] = [];
    for (let d = 1; d <= data.totalDays; d++) {
      const date = new Date(Date.UTC(year, month - 1, d));
      const weekday = date.toLocaleDateString("en-IN", {
        weekday: "short",
        timeZone: "UTC",
      })[0];
      // The ISO we send to the server is the IST midnight of the day.
      const ist = new Date(date.getTime() - 5.5 * 60 * 60 * 1000);
      const isFuture =
        year > todayY ||
        (year === todayY && month > todayM) ||
        (year === todayY && month === todayM && d > todayD);
      const isToday =
        year === todayY && month === todayM && d === todayD;
      list.push({
        day: d,
        weekday,
        iso: ist.toISOString(),
        isFuture,
        isToday,
      });
    }
    return list;
  }, [data, year, month]);

  // Records indexed by (userId, day-of-month) for O(1) cell lookup.
  const recordsByKey = useMemo(() => {
    const map = new Map<string, RecordDTO>();
    if (!data) return map;
    for (const r of data.records) {
      const d = new Date(r.date);
      const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
      const dayOfMonth = ist.getUTCDate();
      map.set(`${r.userId}:${dayOfMonth}`, r);
    }
    return map;
  }, [data]);

  // Marking the attendance — optimistic so the cell update feels
  // instant. On error we roll back and surface a banner.
  const [busyCell, setBusyCell] = useState<string | null>(null);
  const mark = useCallback(
    async (
      userId: string,
      iso: string,
      status: AttendanceStatus | null
    ) => {
      const dayOfMonth = new Date(
        new Date(iso).getTime() + 5.5 * 60 * 60 * 1000
      ).getUTCDate();
      const key = `${userId}:${dayOfMonth}`;
      setBusyCell(key);
      try {
        const res = await fetch("/api/app/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            date: iso,
            status: status || "",
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(body?.error || "Couldn't save attendance.");
          return;
        }
        // Refetch — we could splice locally for speed but the office
        // summary line depends on all rows, so a full refetch keeps the
        // header honest.
        fetchMonth();
      } catch {
        setError("Network error. Try again.");
      } finally {
        setBusyCell(null);
      }
    },
    [fetchMonth]
  );

  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(
    "en-IN",
    { month: "long", year: "numeric", timeZone: "UTC" }
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div
            className="text-[10px] uppercase tracking-[0.22em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-copper-deep)",
            }}
          >
            Office attendance
          </div>
          <h2
            className="mt-1 text-[30px] font-semibold tracking-tight leading-[1.1] sm:text-[40px]"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            Attendance
          </h2>
          <p
            className="mt-2 text-[13px]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-fg-muted)",
            }}
          >
            {isAdmin
              ? "Click any cell to mark your teammates present, absent, on leave, or otherwise."
              : `Your attendance record, ${me.name.split(" ")[0]}. Only the office admin can mark.`}
          </p>
        </div>
        <MonthNav
          monthLabel={monthLabel}
          onPrev={goPrev}
          onNext={goNext}
          onCurrent={goCurrent}
          isCurrent={isCurrentMonth}
        />
      </div>

      {/* Office summary */}
      {data ? (
        <OfficeSummary
          totalUsers={data.summary.office.totalUsers}
          totalDays={data.totalDays}
          daysSoFar={data.daysSoFar}
          avgAttendancePct={data.summary.office.avgAttendancePct}
          totalMarked={data.summary.office.totalMarked}
          totalPossible={data.summary.office.totalPossible}
          isAdmin={isAdmin}
        />
      ) : null}

      {error ? (
        <div
          className="mt-5 rounded-md px-4 py-3 text-[13px]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            backgroundColor: "var(--color-app-danger-soft)",
            border: "1px solid var(--color-app-danger)",
            color: "var(--color-app-ink)",
          }}
        >
          {error}
        </div>
      ) : null}

      {/* Grid */}
      <div
        className="mt-6 overflow-hidden rounded-xl"
        style={{
          backgroundColor: "var(--color-app-paper)",
          boxShadow: "0 1px 0 var(--color-app-edge)",
        }}
      >
        {loading && !data ? (
          <LoadingShell />
        ) : !data || data.users.length === 0 ? (
          <EmptyShell />
        ) : (
          <div className="overflow-x-auto">
            <table
              className="border-collapse"
              style={{ minWidth: "100%" }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--color-app-edge)",
                    backgroundColor: "var(--color-app-canvas-2)",
                  }}
                >
                  <th
                    scope="col"
                    className="sticky left-0 z-10 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.22em]"
                    style={{
                      fontFamily: "var(--font-dm-mono), monospace",
                      color: "var(--color-app-copper-deep)",
                      backgroundColor: "var(--color-app-canvas-2)",
                      minWidth: 200,
                    }}
                  >
                    Teammate
                  </th>
                  {days.map((d) => (
                    <th
                      key={d.day}
                      scope="col"
                      className="px-1 py-3 text-center"
                      style={{
                        fontFamily: "var(--font-dm-mono), monospace",
                        color: isWeekend(d.weekday)
                          ? "var(--color-app-fg-muted)"
                          : "var(--color-app-fg-soft)",
                        minWidth: 36,
                        maxWidth: 36,
                      }}
                    >
                      <div
                        className="text-[11px] font-semibold tabular-nums"
                        style={{
                          color: "var(--color-app-ink)",
                          opacity: isWeekend(d.weekday) ? 0.55 : 1,
                        }}
                      >
                        {d.day}
                      </div>
                      <div
                        className="text-[9px] uppercase tracking-[0.12em]"
                        style={{
                          opacity: 0.55,
                        }}
                      >
                        {d.weekday}
                      </div>
                    </th>
                  ))}
                  <SummaryHeaderCell label="P" />
                  <SummaryHeaderCell label="A" />
                  <SummaryHeaderCell label="½" />
                  <SummaryHeaderCell label="L" />
                  <SummaryHeaderCell label="NM" />
                  <SummaryHeaderCell label="%" />
                </tr>
              </thead>
              <tbody>
                {data.users.map((u, i) => {
                  const summary = data.summary.perUser[u.id];
                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom:
                          i === data.users.length - 1
                            ? "none"
                            : "1px solid var(--color-app-edge-soft)",
                      }}
                    >
                      <th
                        scope="row"
                        className="sticky left-0 z-10 px-4 py-3 text-left"
                        style={{
                          backgroundColor: "var(--color-app-paper)",
                          boxShadow:
                            "1px 0 0 var(--color-app-edge-soft)",
                          fontFamily:
                            "var(--font-manrope), sans-serif",
                          fontWeight: 500,
                        }}
                      >
                        <div
                          className="text-[13px]"
                          style={{
                            color: "var(--color-app-ink)",
                            fontWeight: 600,
                          }}
                        >
                          {u.name}
                          {u.isYou ? (
                            <span
                              className="ml-2 text-[10px] uppercase tracking-[0.18em]"
                              style={{
                                fontFamily:
                                  "var(--font-dm-mono), monospace",
                                color: "var(--color-app-copper-deep)",
                                fontWeight: 600,
                              }}
                            >
                              You
                            </span>
                          ) : null}
                        </div>
                        <div
                          className="mt-0.5 text-[10px] uppercase tracking-[0.14em]"
                          style={{
                            fontFamily:
                              "var(--font-dm-mono), monospace",
                            color: "var(--color-app-fg-muted)",
                          }}
                        >
                          {roleLabel(u.role)}
                        </div>
                      </th>
                      {days.map((d) => {
                        const key = `${u.id}:${d.day}`;
                        const rec = recordsByKey.get(key);
                        return (
                          <AttendanceCell
                            key={d.day}
                            userId={u.id}
                            iso={d.iso}
                            day={d.day}
                            weekend={isWeekend(d.weekday)}
                            isFuture={d.isFuture}
                            isToday={d.isToday}
                            record={rec || null}
                            canEdit={isAdmin && !d.isFuture}
                            busy={busyCell === key}
                            onMark={mark}
                          />
                        );
                      })}
                      {summary ? (
                        <>
                          <SummaryCell value={summary.present} accent="present" />
                          <SummaryCell value={summary.absent} accent="absent" />
                          <SummaryCell value={summary.halfDay} accent="half_day" />
                          <SummaryCell value={summary.leave} accent="leave" />
                          <SummaryCell value={summary.notMarked} accent="muted" />
                          <SummaryCell
                            value={`${summary.attendancePct}%`}
                            accent={pctAccent(summary.attendancePct, summary.present + summary.absent + summary.halfDay)}
                            wide
                          />
                        </>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <Legend />
    </div>
  );
}

function MonthNav({
  monthLabel,
  onPrev,
  onNext,
  onCurrent,
  isCurrent,
}: {
  monthLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onCurrent: () => void;
  isCurrent: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <NavButton onClick={onPrev} aria-label="Previous month">
        <ChevronIcon dir="left" />
      </NavButton>
      <button
        type="button"
        onClick={onCurrent}
        disabled={isCurrent}
        className="rounded-md border px-4 py-2 text-[13px] font-semibold tabular-nums transition-colors"
        style={{
          fontFamily: "var(--font-crimson), Georgia, serif",
          borderColor: "var(--color-app-edge)",
          backgroundColor: "var(--color-app-paper)",
          color: "var(--color-app-ink)",
          minWidth: 180,
          cursor: isCurrent ? "default" : "pointer",
          opacity: isCurrent ? 1 : 0.95,
        }}
        title={isCurrent ? "" : "Jump to current month"}
      >
        {monthLabel}
      </button>
      <NavButton onClick={onNext} aria-label="Next month">
        <ChevronIcon dir="right" />
      </NavButton>
    </div>
  );
}

function NavButton({
  children,
  onClick,
  ...rest
}: {
  children: React.ReactNode;
  onClick: () => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-md border transition-colors"
      style={{
        borderColor: "var(--color-app-edge)",
        backgroundColor: "var(--color-app-paper)",
        color: "var(--color-app-ink)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--color-app-copper)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--color-app-edge)";
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

function OfficeSummary({
  totalUsers,
  totalDays,
  daysSoFar,
  avgAttendancePct,
  totalMarked,
  totalPossible,
  isAdmin,
}: {
  totalUsers: number;
  totalDays: number;
  daysSoFar: number;
  avgAttendancePct: number;
  totalMarked: number;
  totalPossible: number;
  isAdmin: boolean;
}) {
  const items = [
    {
      label: isAdmin ? "Active users" : "Days in month",
      value: isAdmin ? String(totalUsers) : String(totalDays),
    },
    {
      label: "Days so far",
      value: String(daysSoFar),
      sub: `of ${totalDays}`,
    },
    {
      label: "Avg attendance",
      value: `${avgAttendancePct}%`,
    },
    {
      label: "Marked",
      value: `${totalMarked}`,
      sub: totalPossible > 0 ? `of ${totalPossible}` : undefined,
    },
  ];
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-xl p-4"
          style={{
            backgroundColor: "var(--color-app-paper)",
            boxShadow: "0 1px 0 var(--color-app-edge)",
          }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.22em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-muted)",
            }}
          >
            {it.label}
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span
              className="text-[22px] font-semibold tabular-nums"
              style={{
                fontFamily: "var(--font-crimson), Georgia, serif",
                color: "var(--color-app-ink)",
              }}
            >
              {it.value}
            </span>
            {it.sub ? (
              <span
                className="text-[11px]"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  color: "var(--color-app-fg-muted)",
                }}
              >
                {it.sub}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function SummaryHeaderCell({ label }: { label: string }) {
  return (
    <th
      scope="col"
      className="px-2 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.22em]"
      style={{
        fontFamily: "var(--font-dm-mono), monospace",
        color: "var(--color-app-copper-deep)",
        borderLeft: "1px solid var(--color-app-edge-soft)",
        minWidth: 40,
      }}
    >
      {label}
    </th>
  );
}

function SummaryCell({
  value,
  accent,
  wide,
}: {
  value: string | number;
  accent: AttendanceStatus | "muted";
  wide?: boolean;
}) {
  const opt = accent === "muted" ? null : STATUS_BY_KEY.get(accent as AttendanceStatus) || null;
  return (
    <td
      className="px-2 py-3 text-center text-[12.5px] tabular-nums"
      style={{
        fontFamily: "var(--font-dm-mono), monospace",
        color:
          opt?.fg ||
          (accent === "muted" ? "var(--color-app-fg-muted)" : "var(--color-app-ink)"),
        fontWeight: typeof value === "string" ? 700 : 600,
        borderLeft: "1px solid var(--color-app-edge-soft)",
        minWidth: wide ? 60 : 40,
      }}
    >
      {value}
    </td>
  );
}

function pctAccent(
  pct: number,
  workingDays: number
): AttendanceStatus | "muted" {
  if (workingDays === 0) return "muted";
  if (pct >= 90) return "present";
  if (pct >= 70) return "half_day";
  return "absent";
}

// Worst-case popover dimensions (5 status options + clear-marking + day
// header). Used both for collision detection and as a CSS size cap.
const POPOVER_WIDTH = 184;
const POPOVER_HEIGHT = 268;

function AttendanceCell({
  userId,
  iso,
  day,
  weekend,
  isFuture,
  isToday,
  record,
  canEdit,
  busy,
  onMark,
}: {
  userId: string;
  iso: string;
  day: number;
  weekend: boolean;
  isFuture: boolean;
  isToday: boolean;
  record: RecordDTO | null;
  canEdit: boolean;
  busy: boolean;
  onMark: (
    userId: string,
    iso: string,
    status: AttendanceStatus | null
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  // Viewport coords for the portalled popover. Recomputed every time
  // the cell opens — fixed positioning escapes the table's
  // overflow-x-auto and overflow-hidden wrappers, which otherwise clip
  // the popover and make it look squashed under the next row.
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const rootRef = useRef<HTMLTableCellElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const placePopover = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    // Default: anchor the popover's right edge to the button's right
    // edge, sitting just below it. Clamp into the viewport so cells
    // near the right edge don't render off-screen.
    let left = rect.right - POPOVER_WIDTH;
    if (left < 8) left = 8;
    if (left + POPOVER_WIDTH > window.innerWidth - 8) {
      left = window.innerWidth - POPOVER_WIDTH - 8;
    }
    // Flip upward when there isn't enough room below — admins can mark
    // the last row of the table without the menu disappearing under
    // the page fold.
    const spaceBelow = window.innerHeight - rect.bottom;
    const flipUp =
      spaceBelow < POPOVER_HEIGHT + 12 && rect.top > POPOVER_HEIGHT + 12;
    const top = flipUp ? rect.top - POPOVER_HEIGHT - 4 : rect.bottom + 4;
    setCoords({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Close on any scroll (capture phase catches descendant scrolling
    // like the table's overflow-x-auto strip) or window resize — the
    // popover is fixed-positioned so it would otherwise drift away
    // from the cell as the table scrolls.
    const onScrollOrResize = () => setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  const opt = record ? STATUS_BY_KEY.get(record.status) || null : null;
  const tooltipBits: string[] = [];
  if (isFuture) {
    tooltipBits.push("Future date — can't mark yet");
  } else if (opt) {
    tooltipBits.push(opt.label);
    if (record?.markedByName) {
      tooltipBits.push(`by ${record.markedByName}`);
    }
    if (record?.markedAt) {
      tooltipBits.push(
        new Date(record.markedAt).toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    }
  } else {
    tooltipBits.push("Not marked");
  }

  function pick(status: AttendanceStatus | null) {
    setOpen(false);
    onMark(userId, iso, status);
  }

  function toggle() {
    if (!canEdit || isFuture) return;
    if (open) {
      setOpen(false);
      return;
    }
    placePopover();
    setOpen(true);
  }

  return (
    <td
      ref={rootRef}
      className="relative px-1 py-1.5"
      style={{
        textAlign: "center",
        verticalAlign: "middle",
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        title={tooltipBits.join(" · ")}
        onClick={toggle}
        disabled={!canEdit || busy || isFuture}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-semibold transition-all"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          // Future cells render as visibly locked: no fill, dashed
          // muted border, and the cursor goes to not-allowed so the
          // user can tell at a glance that the day hasn't happened
          // yet.
          backgroundColor: isFuture
            ? "transparent"
            : opt
              ? opt.bg
              : weekend
                ? "transparent"
                : "var(--color-app-canvas-2)",
          color: isFuture
            ? "var(--color-app-edge)"
            : opt
              ? opt.fg
              : "var(--color-app-fg-muted)",
          border: isFuture
            ? "1px dashed var(--color-app-edge)"
            : opt
              ? isToday
                ? "1px solid var(--color-app-copper)"
                : "1px solid transparent"
              : weekend
                ? "1px dashed var(--color-app-edge)"
                : isToday
                  ? "1px solid var(--color-app-copper)"
                  : "1px solid transparent",
          opacity: isFuture ? 0.5 : busy ? 0.6 : 1,
          cursor: isFuture
            ? "not-allowed"
            : canEdit
              ? "pointer"
              : "default",
        }}
      >
        {isFuture ? "" : opt ? opt.short : weekend ? "·" : ""}
      </button>

      {open && canEdit && coords && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              className="fixed overflow-hidden rounded-md"
              style={{
                top: coords.top,
                left: coords.left,
                width: POPOVER_WIDTH,
                // z-index high enough to clear the sticky table header
                // (z-10), the topbar shadow, and any future floating UI.
                zIndex: 1000,
                backgroundColor: "var(--color-app-paper)",
                border: "1px solid var(--color-app-edge)",
                boxShadow:
                  "0 16px 32px -12px rgba(10,17,36,0.25), 0 0 0 1px rgba(10,17,36,0.04)",
              }}
            >
              <div
                className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  color: "var(--color-app-fg-muted)",
                  borderBottom: "1px solid var(--color-app-edge-soft)",
                  backgroundColor: "var(--color-app-canvas-2)",
                }}
              >
                Day {day}
              </div>
              <ul className="py-1">
                {STATUS_OPTIONS.map((s) => {
                  const active = record?.status === s.key;
                  return (
                    <li key={s.key}>
                      <button
                        type="button"
                        onClick={() => pick(s.key)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left text-[12.5px] transition-colors"
                        style={{
                          fontFamily: "var(--font-manrope), sans-serif",
                          backgroundColor: active
                            ? "var(--color-app-canvas-2)"
                            : "transparent",
                          color: "var(--color-app-ink)",
                        }}
                        onMouseEnter={(e) => {
                          if (active) return;
                          e.currentTarget.style.backgroundColor =
                            "var(--color-app-canvas-2)";
                        }}
                        onMouseLeave={(e) => {
                          if (active) return;
                          e.currentTarget.style.backgroundColor =
                            "transparent";
                        }}
                      >
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold"
                          style={{
                            fontFamily:
                              "var(--font-dm-mono), monospace",
                            backgroundColor: s.bg,
                            color: s.fg,
                          }}
                        >
                          {s.short}
                        </span>
                        {s.label}
                      </button>
                    </li>
                  );
                })}
                {record ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => pick(null)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-[12.5px] transition-colors"
                      style={{
                        fontFamily: "var(--font-manrope), sans-serif",
                        color: "var(--color-app-fg-muted)",
                        borderTop: "1px solid var(--color-app-edge-soft)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "var(--color-app-canvas-2)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "transparent";
                      }}
                    >
                      <span className="text-[14px]">×</span>
                      Clear marking
                    </button>
                  </li>
                ) : null}
              </ul>
            </div>,
            document.body
          )
        : null}
    </td>
  );
}

function Legend() {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      {STATUS_OPTIONS.map((s) => (
        <div key={s.key} className="flex items-center gap-1.5">
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              backgroundColor: s.bg,
              color: s.fg,
            }}
          >
            {s.short}
          </span>
          <span
            className="text-[11px]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-muted)",
              letterSpacing: 0.4,
            }}
          >
            {s.label}
          </span>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block h-5 w-5 rounded"
          style={{
            backgroundColor: "var(--color-app-canvas-2)",
            border: "1px solid var(--color-app-edge)",
          }}
        />
        <span
          className="text-[11px]"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            color: "var(--color-app-fg-muted)",
            letterSpacing: 0.4,
          }}
        >
          Not marked
        </span>
      </div>
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="flex min-h-[260px] items-center justify-center px-6 py-12">
      <div
        className="h-8 w-8 animate-spin rounded-full"
        style={{
          borderWidth: 2.5,
          borderStyle: "solid",
          borderColor: "var(--color-app-edge)",
          borderTopColor: "var(--color-app-copper)",
        }}
      />
    </div>
  );
}

function EmptyShell() {
  return (
    <div className="flex min-h-[260px] items-center justify-center px-8 text-center">
      <p
        className="text-[14px]"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          color: "var(--color-app-fg-muted)",
        }}
      >
        No active users in your office yet. Add teammates from{" "}
        <span style={{ color: "var(--color-app-ink)", fontWeight: 600 }}>
          Users / Advocates
        </span>{" "}
        to start marking attendance.
      </p>
    </div>
  );
}

function ChevronIcon({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function nowYearIst(): number {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.getUTCFullYear();
}
function nowMonthIst(): number {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.getUTCMonth() + 1;
}

function isWeekend(weekday: string): boolean {
  // weekday is a single letter from the formatter; "S" matches Saturday
  // AND Sunday so we can't reliably distinguish them. Use the date
  // arithmetic at the cell level if a real weekend-aware behaviour is
  // ever needed — for now the muting is just a hint.
  return weekday === "S";
}

function roleLabel(role: string): string {
  if (role === "admin") return "Office Admin";
  if (role === "advocate") return "Advocate";
  if (role === "junior") return "Junior";
  if (role === "clerk") return "Clerk";
  if (role === "viewer") return "Viewer";
  return role;
}
