import { Award } from "lucide-react";
import { useAllCounters, useWeekCounter } from "@/lib/hooks";
import { dayKey, parseDayKey } from "@/lib/dates";
import { Card } from "@/components/ui/card";

/** "2026-W33" → "Week 33 · 2026" (compact, unambiguous for a best-week label). */
function weekKeyLabel(key: string): string {
  const m = key.match(/^(\d{4})-W(\d{2})$/);
  if (m) return `Week ${Number(m[2])} · ${m[1]}`;
  return key;
}

function dateLabel(key: string): string {
  return parseDayKey(key).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function PersonalBests() {
  const counters = useAllCounters();
  const thisWeek = useWeekCounter(dayKey(new Date()));

  let bestWeek: { key: string; min: number } | null = null;
  let bestDay: { key: string; q: number } | null = null;

  for (const c of counters) {
    if (c.id.startsWith("week_") && c.data.focusMinutes > 0) {
      if (!bestWeek || c.data.focusMinutes > bestWeek.min) {
        bestWeek = { key: c.id.slice(5), min: c.data.focusMinutes };
      }
    } else if (c.id.startsWith("day_") && c.data.questionsDone > 0) {
      if (!bestDay || c.data.questionsDone > bestDay.q) {
        bestDay = { key: c.id.slice(4), q: c.data.questionsDone };
      }
    }
  }

  if (!bestWeek && !bestDay) return null;

  const thisWeekH = thisWeek.focusMinutes / 60;
  const bestWeekH = bestWeek ? bestWeek.min / 60 : 0;
  const beatWeek = bestWeek ? thisWeekH >= bestWeekH : false;

  return (
    <Card className="border-warning/25 bg-warning/[0.08] p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Award size={16} className="text-warning" /> Run your best
      </p>
      <div className="space-y-3">
        {bestWeek && (
          <div>
            <div className="mb-1 flex items-baseline justify-between text-xs text-text-secondary">
              <span>
                Focus this week —{" "}
                <span className="tabular font-medium">
                  {thisWeekH.toFixed(1)}h vs best {bestWeekH.toFixed(1)}h
                </span>
              </span>
              <span className="shrink-0">{weekKeyLabel(bestWeek.key)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div
                className={`h-full rounded-full ${beatWeek ? "bg-success" : "bg-warning"}`}
                style={{
                  width: `${bestWeekH ? Math.min(100, Math.round((thisWeekH / bestWeekH) * 100)) : 0}%`,
                }}
              />
            </div>
            {beatWeek && <p className="mt-1 text-xs text-success">New personal record. Go get it! 🏆</p>}
          </div>
        )}
        {bestDay && (
          <p className="text-xs text-text-secondary">
            Best day of questions: <span className="font-numeric font-semibold tabular">{bestDay.q}</span> on{" "}
            {dateLabel(bestDay.key)}
          </p>
        )}
      </div>
    </Card>
  );
}