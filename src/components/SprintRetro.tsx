import { PartyPopper, Sparkles, ThumbsUp, TrendingUp, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import type { SprintDoc } from "@/lib/schema";
import { computeSprintRetro } from "@/lib/retro";
import { useAllCounters, useFocusSessionsInRange } from "@/lib/hooks";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SprintRetroProps {
  sprint: SprintDoc;
}

function GoalBar({ title, done, target, unit, achieved }: { title: string; done: number; target: number; unit: string; achieved: boolean }) {
  const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 100;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-sm text-text-secondary">{title}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className={`h-full rounded-full ${achieved ? "bg-success" : "bg-warning"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-20 shrink-0 text-right font-numeric text-sm tabular">
        {unit ? `${done}${unit}` : done} / {target || "—"}
      </span>
      {achieved ? (
        <span className="text-xs text-success">✓</span>
      ) : target > 0 ? (
        <span className="text-xs text-warning">pending</span>
      ) : null}
    </div>
  );
}

function Chip({ children, good }: { children: ReactNode; good: boolean }) {
  return (
    <li>
      <Badge tone={good ? "success" : "danger"} size="sm">
        {children}
      </Badge>
    </li>
  );
}

export function SprintRetro({ sprint }: SprintRetroProps) {
  const counters = useAllCounters();
  const sessions = useFocusSessionsInRange(sprint.startDate, sprint.endDate);
  const retro = computeSprintRetro(sprint, counters, sessions);

  return (
    <div className="space-y-3">
      <Card className="border-success/30 p-4 text-center">
        <PartyPopper className="mx-auto text-success" size={28} />
        <p className="mt-2 font-display text-base font-bold">Sprint review</p>
        <p className="mt-1 text-sm text-text-secondary">{retro.congrats}</p>
      </Card>

      <Card className="p-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Sparkles size={15} className="text-brand-600" /> Goals this sprint
        </p>
        <div className="space-y-2">
          {retro.goals.map((g) => (
            <GoalBar key={g.title} {...g} />
          ))}
        </div>
        <p className="mt-3 text-xs text-text-muted">
          {retro.completionPct}% of the sprint overall · {retro.focusTotalMin} min focused ·{" "}
          {retro.questionsTotal} questions
        </p>
      </Card>

      {(retro.bestDay || retro.worstDay) && (
        <Card className="p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <TrendingUp size={15} className="text-brand-600" /> Day by day
          </p>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl border border-success/20 bg-success/10 p-3">
              <p className="text-xs text-success">Best focus</p>
              {retro.bestDay && (
                <p className="mt-1 font-numeric text-lg font-semibold tabular">
                  {retro.bestDay.minutes} min
                </p>
              )}
              <p className="text-xs text-text-muted">{retro.bestDay?.label}</p>
            </div>
            <div className="rounded-xl border border-warning/20 bg-warning/10 p-3">
              <p className="text-xs text-warning">Slowest day</p>
              {retro.worstDay && (
                <p className="mt-1 font-numeric text-lg font-semibold tabular">
                  {retro.worstDay.minutes} min
                </p>
              )}
              <p className="text-xs text-text-muted">{retro.worstDay?.label}</p>
            </div>
          </div>
          {retro.subjectFocus.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs uppercase tracking-wide text-text-muted">Subject mix</p>
              <div className="flex flex-wrap gap-1.5">
                {retro.subjectFocus.map((s) => (
                  <Badge key={s.name} tone="brand" size="sm">
                    {s.name} · {s.pct}%
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      <Card className="p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <ThumbsUp size={15} className="text-success" /> What went well
            </p>
            {retro.strengths.length > 0 ? (
              <ul className="space-y-1.5">
                {retro.strengths.map((s) => (
                  <Chip key={s} good>
                    {s}
                  </Chip>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">Not enough data yet — your next sprint will tell us more.</p>
            )}
          </div>
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <TriangleAlert size={15} className="text-danger" /> What to fix
            </p>
            {retro.weaknesses.length > 0 ? (
              <ul className="space-y-1.5">
                {retro.weaknesses.map((s) => (
                  <Chip key={s} good={false}>
                    {s}
                  </Chip>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">Nothing big this sprint. Nice.</p>
            )}
          </div>
        </div>
      </Card>

      <Card className="border-brand-600/25 bg-brand-600/[0.08] p-4">
        <p className="mb-2 text-sm font-semibold text-brand-600">Next sprint, try to…</p>
        <ul className="space-y-2 text-sm text-text">
          {retro.suggestions.map((s) => (
            <li key={s} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
              {s}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}