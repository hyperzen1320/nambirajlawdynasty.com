import type { AttendanceStatus } from "@/models/Attendance";
import { istDayStart } from "@/lib/ist-day";

// Helpers shared between the attendance API and the UI for computing
// month ranges, per-user summaries, and the attendance percentage.

export type AttendanceSummary = {
  present: number;
  absent: number;
  halfDay: number;
  leave: number;
  holiday: number;
  notMarked: number; // days in the month, up to today, with no record
  totalDays: number; // days in the month (not just the elapsed portion)
  daysSoFar: number; // days that have actually happened in IST (≤ total)
  attendancePct: number; // 0–100. See computeAttendancePct() for the formula.
};

// Returns {start, end} as the IST midnight instants bracketing a month.
// `start` is the 1st of the month at IST midnight; `end` is the 1st of
// the next month at IST midnight (exclusive upper bound, matches
// `$gte` / `$lt` query semantics).
export function monthRange(year: number, month: number): {
  start: Date;
  end: Date;
  totalDays: number;
} {
  // `month` is 1-indexed (1 = Jan). Build via UTC then shift to IST.
  const startUtc = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const start = new Date(startUtc.getTime() - 5.5 * 60 * 60 * 1000);
  const nextMonthUtc = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const end = new Date(nextMonthUtc.getTime() - 5.5 * 60 * 60 * 1000);
  // Days in the month — UTC math is enough since the day count doesn't
  // depend on timezone.
  const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start, end, totalDays };
}

// Returns the IST midnight Date for day-of-month D in the given month.
// Used to enumerate the day columns on the grid.
export function dayOfMonth(year: number, month: number, day: number): Date {
  const utc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  return new Date(utc.getTime() - 5.5 * 60 * 60 * 1000);
}

// Maps an arbitrary Date back to the IST midnight instant of the day
// it belongs to. The POST handler runs every incoming date through
// this so the unique (partner, user, date) index works regardless of
// how the client typed the date.
export function normaliseToIstMidnight(d: Date): Date {
  return istDayStart(d, 0);
}

// Parses ?month=YYYY-MM into a (year, month) tuple. Falls back to the
// current month in IST when missing or invalid.
export function parseMonthParam(raw: string | null): {
  year: number;
  month: number;
} {
  if (raw) {
    const m = /^(\d{4})-(\d{2})$/.exec(raw);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      if (y >= 1970 && mo >= 1 && mo <= 12) return { year: y, month: mo };
    }
  }
  // Current month in IST. We add IST offset to the current UTC instant
  // before reading getUTC* so "now in IST" maps cleanly.
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return { year: ist.getUTCFullYear(), month: ist.getUTCMonth() + 1 };
}

// Days that have actually elapsed in IST during the given month. If
// the month is in the past, this equals totalDays; if it's the current
// month, it equals today's date; if it's in the future, it's 0.
export function elapsedDaysInMonth(year: number, month: number): number {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const istYear = ist.getUTCFullYear();
  const istMonth = ist.getUTCMonth() + 1;
  const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (year < istYear || (year === istYear && month < istMonth)) {
    return totalDays;
  }
  if (year > istYear || (year === istYear && month > istMonth)) {
    return 0;
  }
  return ist.getUTCDate();
}

// Empty summary helper.
function blankSummary(totalDays: number, daysSoFar: number): AttendanceSummary {
  return {
    present: 0,
    absent: 0,
    halfDay: 0,
    leave: 0,
    holiday: 0,
    notMarked: daysSoFar,
    totalDays,
    daysSoFar,
    attendancePct: 0,
  };
}

// Computes the per-user attendance summary for a month given the user's
// marked records in that month. `daysSoFar` is the elapsed-days count
// (so April's summary in early May correctly attributes "not marked"
// to working days that already passed).
export function summariseUser(
  records: { status: AttendanceStatus }[],
  totalDays: number,
  daysSoFar: number
): AttendanceSummary {
  const s = blankSummary(totalDays, daysSoFar);
  for (const r of records) {
    switch (r.status) {
      case "present":
        s.present += 1;
        break;
      case "absent":
        s.absent += 1;
        break;
      case "half_day":
        s.halfDay += 1;
        break;
      case "leave":
        s.leave += 1;
        break;
      case "holiday":
        s.holiday += 1;
        break;
    }
  }
  const marked = s.present + s.absent + s.halfDay + s.leave + s.holiday;
  s.notMarked = Math.max(0, daysSoFar - marked);
  s.attendancePct = computeAttendancePct(s);
  return s;
}

// Attendance rate among "real" working days only. Holidays and leaves
// are excluded from the denominator — a chambers shouldn't dock a
// user's % for an approved leave. Half-days count as 0.5 attended.
export function computeAttendancePct(s: AttendanceSummary): number {
  const workingDays = s.present + s.absent + s.halfDay;
  if (workingDays === 0) return 0;
  const attended = s.present + s.halfDay * 0.5;
  return Math.round((attended / workingDays) * 1000) / 10; // one decimal
}
