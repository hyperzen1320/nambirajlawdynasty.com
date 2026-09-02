// IST = UTC+5:30. Returns the UTC instant that corresponds to IST midnight,
// optionally offset by N days.
export function istDayStart(now: Date, offsetDays = 0): Date {
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
  const istDate = new Date(istMs);
  istDate.setUTCHours(0, 0, 0, 0);
  istDate.setUTCDate(istDate.getUTCDate() + offsetDays);
  return new Date(istDate.getTime() - 5.5 * 60 * 60 * 1000);
}
