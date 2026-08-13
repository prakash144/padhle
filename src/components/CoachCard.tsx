import { useMemo } from "react";
import { motion } from "framer-motion";
import { Leaf, Sparkles } from "lucide-react";
import type { ExamGoalDoc } from "@/lib/schema";
import { DAILY_FOCUS_GOAL_MIN, buildCoachMessage } from "@/lib/coach";
import { useCheckin, useDayCounter, usePrevWeekCounter, useWeekCounter } from "@/lib/hooks";
import { dayKey } from "@/lib/dates";
import { Card } from "@/components/ui/card";

interface CoachCardProps {
  streak: number;
  exams: (ExamGoalDoc & { id: string })[];
}

export function CoachCard({ streak, exams }: CoachCardProps) {
  const todayKey = dayKey(new Date());
  const checkin = useCheckin(todayKey);
  const counter = useDayCounter(todayKey);
  const week = useWeekCounter(todayKey);
  const prevWeek = usePrevWeekCounter(todayKey);

  const msg = useMemo(() => {
    const primaryExam = exams.find((e) => e.isPrimary) ?? exams[0];
    const now = new Date();
    return buildCoachMessage({
      now,
      hour: now.getHours(),
      isMonday: now.getDay() === 1,
      hasCheckin: !!checkin && checkin.top3.length > 0,
      todayFocusMin: counter.focusMinutes,
      todayQuestions: counter.questionsDone,
      todayTasksDone: counter.completedTasks,
      weekFocusMin: week.focusMinutes,
      prevWeekFocusMin: prevWeek.focusMinutes,
      streak,
      daysLeftToExam: primaryExam
        ? Math.max(0, Math.round((primaryExam.examDate.toDate().getTime() - now.getTime()) / 864e5))
        : null,
      examName: primaryExam?.name ?? null,
    });
  }, [checkin, counter, week, prevWeek, streak, exams]);

  const pct = Math.min(100, Math.round((counter.focusMinutes / DAILY_FOCUS_GOAL_MIN) * 100));

  return (
    <Card className="relative overflow-hidden border-brand-600/20 bg-brand-500/[0.07] p-4">
      <Leaf
        size={88}
        strokeWidth={1}
        className="pointer-events-none absolute -bottom-4 -right-3 text-brand-600/10"
        aria-hidden
      />
      <div className="relative flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-lg">
          {msg.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles size={13} className="text-ai" aria-hidden />
            {msg.title}
          </p>
          <p className="mt-0.5 text-sm text-text-secondary">{msg.body}</p>
          {msg.progress !== undefined && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              <motion.div
                className="h-full rounded-full bg-brand-600 dark:bg-brand-500"
                initial={{ width: 0 }}
                animate={{ width: `${msg.progress}%` }}
                transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
              />
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-numeric text-lg font-semibold tabular">{pct}%</p>
          <p className="text-[10px] uppercase tracking-wide text-text-muted">day goal</p>
        </div>
      </div>
    </Card>
  );
}
