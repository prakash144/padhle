import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { ArrowRight, Check, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  usePrevWeekCounter,
  useTasksForRange,
  useWeekCounter,
} from "@/lib/hooks";
import { addDays, dayKey, startOfWeek, weekKey } from "@/lib/dates";
import { carryOverTasks, saveWeeklyFocus } from "@/lib/weeklyReview";
import { useToast } from "@/lib/useToast";
import type { WeeklyFocusDoc } from "@/lib/schema";

function StatTile({
  label,
  value,
  delta,
  deltaLabel,
}: {
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="text-[11px] uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-0.5 font-display text-lg font-bold">{value}</div>
      {delta !== undefined && (
        <div className="mt-0.5 flex items-center gap-1 text-[11px]">
          {delta >= 0 ? (
            <TrendingUp size={12} className="text-mint" />
          ) : (
            <TrendingDown size={12} className="text-coral" />
          )}
          <span className={delta >= 0 ? "text-mint" : "text-coral"}>
            {delta >= 0 ? "+" : ""}
            {delta}%
          </span>
          {deltaLabel && <span className="text-text-muted">vs {deltaLabel}</span>}
        </div>
      )}
    </div>
  );
}

export function WeeklyReview() {
  const { user } = useAuth();
  const toast = useToast();
  const now = useMemo(() => new Date(), []);
  const today = dayKey(now);
  const weekStart = startOfWeek(now);
  const weekStartKey = dayKey(weekStart);
  const weekEndKey = dayKey(addDays(weekStart, 6));
  const rangeKey = weekKey(now);

  const weekCounter = useWeekCounter(today);
  const prevWeekCounter = usePrevWeekCounter(today);
  const weekTasks = useTasksForRange(weekStartKey, weekEndKey);

  const [focusAreas, setFocusAreas] = useState<string[]>(["", "", ""]);
  const [savedFocus, setSavedFocus] = useState(false);
  const [savingFocus, setSavingFocus] = useState(false);
  const [carrying, setCarrying] = useState(false);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      collection(db, "users", user.uid, "weeklyFocus"),
      (snap) => {
        const doc = snap.docs.find((d) => d.id === rangeKey);
        if (!doc) return;
        const data = doc.data() as WeeklyFocusDoc;
        setFocusAreas([...data.areas, "", "", ""].slice(0, 3));
        setSavedFocus(true);
      }
    );
  }, [user, rangeKey]);

  const undoneTasks = weekTasks.filter(
    (t) => t.status === "todo" || t.status === "in_progress"
  );

  const deltaPct = (cur: number, prev: number) =>
    prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0;

  if (!user) return null;

  const handleCarryOver = async () => {
    setCarrying(true);
    try {
      await carryOverTasks(user.uid, undoneTasks, today);
      toast.success(`Moved ${undoneTasks.length} task(s) to today`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't carry tasks over — try again.");
    } finally {
      setCarrying(false);
    }
  };

  const handleSaveFocus = async () => {
    setSavingFocus(true);
    try {
      await saveWeeklyFocus(user.uid, focusAreas);
      setSavedFocus(true);
      toast.success("Focus areas saved for next week");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save focus areas.");
    } finally {
      setSavingFocus(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="text-center">
        <h1 className="font-display text-xl font-bold">Weekly review</h1>
        <p className="text-sm text-text-muted">
          Look back at the week, clear the deck, and set the week ahead.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatTile
          label="Focus time"
          value={`${(weekCounter.focusMinutes / 60).toFixed(1)}h`}
          delta={deltaPct(weekCounter.focusMinutes, prevWeekCounter.focusMinutes)}
          deltaLabel="last week"
        />
        <StatTile
          label="Tasks done"
          value={`${weekCounter.completedTasks}/${weekCounter.plannedTasks}`}
          delta={deltaPct(weekCounter.completedTasks, prevWeekCounter.completedTasks)}
          deltaLabel="last week"
        />
        <StatTile
          label="Questions"
          value={String(weekCounter.questionsDone)}
          delta={deltaPct(weekCounter.questionsDone, prevWeekCounter.questionsDone)}
          deltaLabel="last week"
        />
        <StatTile
          label="Revisions"
          value={String(weekCounter.revisionsDone)}
          delta={deltaPct(weekCounter.revisionsDone, prevWeekCounter.revisionsDone)}
          deltaLabel="last week"
        />
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-semibold">Unfinished tasks</h2>
            <p className="text-xs text-text-muted">
              {undoneTasks.length} still open from this week.
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleCarryOver}
            disabled={undoneTasks.length === 0 || carrying}
          >
            {carrying ? "Moving…" : "Carry over to today"} <ArrowRight size={14} />
          </Button>
        </div>
        {undoneTasks.length > 0 && (
          <ul className="space-y-1 text-sm">
            {undoneTasks.slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-text-secondary">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                {t.title}
              </li>
            ))}
            {undoneTasks.length > 5 && (
              <li className="text-xs text-text-muted">
                +{undoneTasks.length - 5} more
              </li>
            )}
          </ul>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <div>
          <h2 className="font-display font-semibold">Next week's focus</h2>
          <p className="text-xs text-text-muted">
            Pick up to 3 areas to concentrate on — they'll guide your planning.
          </p>
        </div>
        {focusAreas.map((area, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 text-sm font-semibold text-brand-500">{i + 1}.</span>
            <Input
              value={area}
              placeholder={i === 0 ? "e.g. Physics — Rotational Motion" : "Optional"}
              onChange={(e) => {
                const next = [...focusAreas];
                next[i] = e.target.value;
                setFocusAreas(next);
                setSavedFocus(false);
              }}
            />
          </div>
        ))}
        <Button
          size="sm"
          onClick={handleSaveFocus}
          disabled={savingFocus || savedFocus}
          className="w-full"
        >
          {savedFocus ? (
            <>
              <Check size={14} /> Saved for this week
            </>
          ) : savingFocus ? (
            "Saving…"
          ) : (
            "Save focus areas +20 XP"
          )}
        </Button>
        <p className="text-xs text-text-muted">
          Your week: {weekStartKey} → {weekEndKey} · Focus score is in Reports.
        </p>
      </Card>
    </div>
  );
}
