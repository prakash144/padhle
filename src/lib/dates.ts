/**
 * All counter/report/checkin bucket keys are derived in the student's
 * timezone (default Asia/Kolkata), never UTC — otherwise late-night study
 * sessions roll into the wrong day's counters.
 */

const DEFAULT_TZ = "Asia/Kolkata";

// The timezone all derived keys use. Set at runtime from the logged-in user's
// timezone (see AuthContext) so counters/checks/streaks bucket on the
// student's calendar, not a hardcoded IST or the server's UTC.
let currentTimezone: string = DEFAULT_TZ;

export function setDefaultTimezone(timeZone: string) {
  if (timeZone) currentTimezone = timeZone;
}

export function getDefaultTimezone(): string {
  return currentTimezone;
}

function partsInTz(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
  };
}

/** YYYY-MM-DD in the given timezone. Doubles as the doc id for day counters/checkins. */
export function dayKey(date: Date = new Date(), timeZone: string = currentTimezone): string {
  const { year, month, day } = partsInTz(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Parses a "YYYY-MM-DD" key into a Date whose wall-clock date in `timeZone`
 * IS that calendar day. (`new Date("YYYY-MM-DD")` is UTC midnight, which
 * shifts a day backward once you bucket in a timezone west of UTC.) Used
 * everywhere a stored date key becomes an increment/read target.
 */
export function parseDayKey(key: string, timeZone: string = currentTimezone): Date {
  const [year, month, day] = key.split("-").map(Number);
  let instant = new Date(Date.UTC(year, month - 1, day));
  // Correct the instant's wall-clock date in `timeZone` (two passes cover the
  // DST-transition day where the fixed offset differs from the shifted one).
  for (let pass = 0; pass < 2; pass++) {
    const p = partsInTz(instant, timeZone);
    const diff = (year - p.year) * 366 + (month - p.month) * 31 + (day - p.day);
    if (diff === 0) break;
    instant = new Date(instant.getTime() + diff * 86400000);
  }
  return instant;
}

/** ISO week number (Mon-start) for the date in the given timezone. */
export function weekKey(date: Date = new Date(), timeZone: string = currentTimezone): string {
  const { year, month, day } = partsInTz(date, timeZone);
  // Construct a UTC date from the local calendar date so week-math below is DST-safe.
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((d.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7
    );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** YYYY-MM in the given timezone. */
export function monthKey(date: Date = new Date(), timeZone: string = currentTimezone): string {
  const { year, month } = partsInTz(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function counterBucketIds(date: Date = new Date(), timeZone: string = currentTimezone) {
  return {
    day: `day_${dayKey(date, timeZone)}`,
    week: `week_${weekKey(date, timeZone)}`,
    month: `month_${monthKey(date, timeZone)}`,
  };
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function daysBetween(from: Date, to: Date): number {
  const msPerDay = 86400000;
  return Math.ceil((to.getTime() - from.getTime()) / msPerDay);
}

/** Monday of the week containing `date` (local time, Mon-start). */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const dow = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - dow);
  return d;
}

/** YYYY-MM-DD key of the Monday of the week containing `date`. */
export function startOfWeekKey(date: Date, timeZone: string = currentTimezone): string {
  return dayKey(startOfWeek(date), timeZone);
}

/** 0 (Mon) .. 6 (Sun) for a YYYY-MM-DD key. */
export function weekDayIndex(key: string, timeZone: string = currentTimezone): number {
  return (parseDayKey(key, timeZone).getDay() + 6) % 7;
}

/** The 7 local dates (Mon-Sun) of the week containing `date`. */
export function weekDates(date: Date): Date[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/**
 * A 6-row (42-cell) Mon-start calendar grid for the month containing `date`,
 * including the leading/trailing days of adjacent months needed to fill it.
 */
export function monthGrid(date: Date): Date[] {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const gridStart = startOfWeek(firstOfMonth);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}
