import { describe, expect, it } from "vitest";
import {
  addDays,
  counterBucketIds,
  dayKey,
  daysBetween,
  monthGrid,
  monthKey,
  parseDayKey,
  startOfWeek,
  weekDates,
  weekKey,
} from "@/lib/dates";

const TZ = "Asia/Kolkata";

describe("dayKey", () => {
  it("formats a calendar day in the student timezone (not UTC)", () => {
    expect(dayKey(new Date(2026, 7, 10), TZ)).toBe("2026-08-10");
    expect(dayKey(new Date(Date.UTC(2026, 7, 10, 0, 0)), "UTC")).toBe("2026-08-10");
  });

  it("zero-pads month and day", () => {
    expect(dayKey(new Date(2026, 0, 1), TZ)).toBe("2026-01-01");
    expect(dayKey(new Date(2026, 11, 31), TZ)).toBe("2026-12-31");
  });
});

describe("parseDayKey", () => {
  it("round-trips with dayKey", () => {
    const key = "2026-08-10";
    expect(dayKey(parseDayKey(key, TZ), TZ)).toBe(key);
    expect(dayKey(parseDayKey(key, "UTC"), "UTC")).toBe(key);
  });

  it("round-trips across the year boundary", () => {
    const key = "2026-01-01";
    expect(dayKey(parseDayKey(key, TZ), TZ)).toBe(key);
  });

  it("parses correctly for a timezone east of UTC", () => {
    const d = parseDayKey("2026-08-10", "Asia/Kolkata");
    expect(dayKey(d, "Asia/Kolkata")).toBe("2026-08-10");
  });
});

describe("weekKey", () => {
  it("returns ISO week format YYYY-Www", () => {
    expect(weekKey(new Date(2026, 7, 10), TZ)).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("is stable across a Mon-Sun window and changes the next week", () => {
    const monday = new Date(2026, 7, 10); // 2026-08-10 is a Monday
    const sunday = new Date(2026, 7, 16);
    const nextMonday = new Date(2026, 7, 17);
    expect(weekKey(monday, TZ)).toBe(weekKey(sunday, TZ));
    expect(weekKey(monday, TZ)).not.toBe(weekKey(nextMonday, TZ));
  });
});

describe("counterBucketIds", () => {
  it("produces day/week/month prefixes with the right formats", () => {
    const ids = counterBucketIds(new Date(2026, 7, 10), TZ);
    expect(ids.day).toBe("day_2026-08-10");
    expect(ids.week).toMatch(/^week_\d{4}-W\d{2}$/);
    expect(ids.month).toBe("month_2026-08");
  });

  it("month uses YYYY-MM", () => {
    expect(monthKey(new Date(2026, 0, 1), TZ)).toBe("2026-01");
  });
});

describe("startOfWeek / weekDates", () => {
  it("returns the Monday of the week containing a Wednesday", () => {
    const wed = new Date(2026, 7, 12); // Wednesday
    const start = startOfWeek(wed);
    expect(start.getDay()).toBe(1);
    expect(start.getDate()).toBe(10);
  });

  it("weekDates returns 7 consecutive dates starting Monday", () => {
    const dates = weekDates(new Date(2026, 7, 12));
    expect(dates).toHaveLength(7);
    expect(dates[0].getDay()).toBe(1);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i].getDate() - dates[i - 1].getDate()).toBe(1);
    }
  });
});

describe("monthGrid", () => {
  it("returns a 42-cell grid starting on a Monday", () => {
    const grid = monthGrid(new Date(2026, 7, 10));
    expect(grid).toHaveLength(42);
    expect(grid[0].getDay()).toBe(1);
  });
});

describe("addDays / daysBetween", () => {
  it("adds calendar days", () => {
    const d = addDays(new Date(2026, 7, 10), 7);
    expect(d.getDate()).toBe(17);
  });

  it("daysBetween counts inclusive span", () => {
    expect(daysBetween(new Date(2026, 7, 10), new Date(2026, 7, 16))).toBe(6);
    expect(daysBetween(new Date(2026, 7, 10), new Date(2026, 7, 10))).toBe(0);
  });
});