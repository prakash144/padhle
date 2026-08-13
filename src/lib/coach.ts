export const DAILY_FOCUS_GOAL_MIN = Math.round(600 / 7);

export interface CoachContext {
  now: Date;
  hour: number;
  isMonday: boolean;
  hasCheckin: boolean;
  todayFocusMin: number;
  todayQuestions: number;
  todayTasksDone: number;
  weekFocusMin: number;
  prevWeekFocusMin: number;
  streak: number;
  daysLeftToExam: number | null;
  examName: string | null;
}

export interface CoachMessage {
  emoji: string;
  title: string;
  body: string;
  tone: "morning" | "midday" | "evening" | "urgent" | "celebrate" | "encourage";
  progress?: number;
}

export function buildCoachMessage(c: CoachContext): CoachMessage {
  if (c.daysLeftToExam !== null && c.daysLeftToExam <= 14 && c.todayFocusMin === 0) {
    return {
      emoji: "🔥",
      title: `${c.daysLeftToExam} days to ${c.examName}`,
      body: "The exam is close. One focused 25-min block right now does more than a whole plan. Start it.",
      tone: "urgent",
    };
  }

  // Hitting the daily focus goal always wins (morning/evening alike) — the
  // rare celebrate beats routine nudges so it stays special.
  if (c.todayFocusMin >= DAILY_FOCUS_GOAL_MIN) {
    return {
      emoji: "🎉",
      title: "Goal already reached",
      body: `You hit ${Math.round(
        (c.todayFocusMin / DAILY_FOCUS_GOAL_MIN) * 100
      )}% of today's focus goal. Everything from here is a bonus — brilliant.`,
      tone: "celebrate",
      progress: 100,
    };
  }

  if (c.hour >= 19 && c.todayFocusMin > 0) {
    const pct = Math.min(100, Math.round((c.todayFocusMin / DAILY_FOCUS_GOAL_MIN) * 100));
    const gap = DAILY_FOCUS_GOAL_MIN - c.todayFocusMin;
    return {
      emoji: "🌇",
      title: `Day wrap-up`,
      body:
        gap > 20
          ? `You focused ${c.todayFocusMin} min today (${pct}% of goal) — ${gap} min to go. One last short session?`
          : `You focused ${c.todayFocusMin} min and did ${c.todayQuestions} question(s). That's a solid day — well done.`,
      tone: "evening",
      progress: pct,
    };
  }

  if (c.isMonday) {
    const prev = c.prevWeekFocusMin / 60;
    return {
      emoji: "📅",
      title: "Fresh week, fresh start",
      body:
        prev > 0
          ? `Last week you focused ${prev.toFixed(
              1
            )}h. ${
              c.weekFocusMin > c.prevWeekFocusMin
                ? "This week you're already beating it — keep the pace."
                : `A steady ${Math.max(1, Math.round(prev / 7))}h/day gets you past it.`
            }`
          : `A brand-new week. Aim for ~1.5h of focus most days — momentum beats bursts.`,
      tone: "encourage",
    };
  }

  if (c.hour < 12) {
    if (!c.hasCheckin) {
      return {
        emoji: "🌅",
        title: "Plan your day first",
        body: "Go through today's check-in and set your top 3 goals. Big dreams are won one morning at a time.",
        tone: "morning",
      };
    }
    return {
      emoji: "⛅",
      title: "Morning momentum",
      body: "Your goals for today are set. A single 25-minute focus block now decides whether this day ends done.",
      tone: "morning",
    };
  }

  if (c.streak >= 3 && c.todayFocusMin === 0 && c.hour >= 15) {
    return {
      emoji: "🕯️",
      title: `Keep the ${c.streak}-day streak alive`,
      body: "Ten focused minutes today keeps your streak burning. Tomorrow-you will thank you.",
      tone: "encourage",
    };
  }

  if (c.todayFocusMin > 0) {
    const pct = Math.round((c.todayFocusMin / DAILY_FOCUS_GOAL_MIN) * 100);
    return {
      emoji: "🚀",
      title: `${pct}% of the way today`,
      body: `You've focused ${c.todayFocusMin} min today. Every block up to ${DAILY_FOCUS_GOAL_MIN} min compounds. Keep going.`,
      tone: "encourage",
      progress: pct,
    };
  }

  return {
    emoji: "🤝",
    title: "Ready when you are",
    body: "Open the Focus timer and take the first small step — even 10 minutes counts in this game.",
    tone: "encourage",
  };
}