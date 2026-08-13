import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";

function Flow({ steps }: { steps: string[] }) {
  return (
    <ol className="mt-3">
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={i} className="flex items-stretch gap-3">
            <div aria-hidden className="flex w-8 shrink-0 flex-col items-center">
              <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {i + 1}
              </span>
              {!last && (
                <>
                  <span className="mt-1 w-px flex-1 bg-border" />
                  <ChevronDown strokeWidth={2.5} size={14} className="shrink-0 text-text-muted" />
                  <span className="w-px flex-1 bg-border" />
                </>
              )}
            </div>
            <div
              className={
                "min-w-0 flex-1 pt-1.5 text-sm leading-snug" + (last ? "" : " pb-4")
              }
            >
              {step}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

type Section = {
  id: string;
  icon: string;
  title: string;
  intro: string;
  steps: string[];
  flow: string[];
  tip?: string;
};

const SECTIONS: Section[] = [
  {
    id: "setup",
    icon: "🚀",
    title: "Set up — takes ~2 minutes",
    intro: "One-time start. Everything you need for your exam is made for you automatically.",
    steps: [
      "Sign up with Google or email/password.",
      "Pick your exam — Class 10/12 Boards, JEE Main/Advanced, or NEET (you can pick more than one).",
      "Set your exam date. Padhle builds your syllabus and starts the countdown.",
    ],
    flow: ["Sign up", "Pick exam", "Set exam date", "Syllabus ready"],
    tip: "Don't worry about getting stuck — the app walks you step by step.",
  },
  {
    id: "plan",
    icon: "🗓️",
    title: "Plan your day",
    intro: "Every morning, tell Padhle your top 3 goals. That's your plan — simple as that.",
    steps: [
      "Open the Today page. A one-tap check-in asks for your top 3 goals.",
      "Notice the card at the top — it's your Coach. It changes through the day: morning plans, streak saves, Monday kick-offs, exam countdown urgency, evening wrap-up.",
      "Your goals show as 'Today's Goal'; your tasks appear in 'Do these next'.",
      "Tick tasks when done — every number in the app updates itself.",
    ],
    flow: ["Check-in (top 3 goals)", "Coach guides you", "Tasks for today", "Tick tasks done", "Stats update"],
  },
  {
    id: "focus",
    icon: "🍅",
    title: "Take a focus session",
    intro: "Pomodoro-style timer. Pick what you're studying, then focus while it runs.",
    steps: [
      "Go to Focus (the big round button).",
      "Choose subject → chapter → activity (Lecture / Practice / PYQ / Revision).",
      "Choose a length (25/5, 50/10, 90/20, or custom) and press Start.",
      "After the session: grown a tree, earned XP, and every minute is counted.",
    ],
    flow: ["Focus", "Subject & chapter", "Activity", "Timer runs", "Tree + XP"],
  },
  {
    id: "sprint",
    icon: "🏁",
    title: "Study Sprints — your smart board",
    intro: "Like a real project board, but made for studying. A sprint is a short goal: 7, 14, or 30 days.",
    steps: [
      "New sprint → name it and set targets (questions, PYQs, mocks, focus hours).",
      "Open the sprint → add tasks on the board (To Do / In Progress / Done).",
      "Drag a card between columns as you work, or use the buttons under each card.",
      "Watch the ring fill, check 'sprint health' (ahead / on track / behind), then Mark complete 🎉.",
      "After finishing (or abandoning), scroll down → a 'Sprint review' shows what went well, what to fix, and what to improve next sprint.",
    ],
    flow: ["New sprint", "Add tasks on board", "To Do → In Progress → Done", "Complete / abandon", "Review + improve"],
    tip: "Finished sprints stay safe in the Archive tab — nothing is ever thrown away. The review reads your real counters, so it never guesses.",
  },
  {
    id: "notes",
    icon: "📝",
    title: "Notes — formatted study notes",
    intro: "Write formulas, mistakes, or ideas. Style them like a real document.",
    steps: [
      "Notes → New note.",
      "Write anything, then use the toolbar: bold, italic, headings, bullets, sizes, colors, highlights.",
      "Pick a color for the note so it's easy to find, and pin your most important ones.",
      "Everything saves under your account.",
    ],
    flow: ["New note", "Write & format", "Add heading", "Pick color", "Pin favourite"],
  },
  {
    id: "tests",
    icon: "🧪",
    title: "Tests, PYQs & the Mistake Log",
    intro: "Learn from every mistake so the same one doesn't cost marks twice.",
    steps: [
      "Log mock test results (marks, attempted/correct/wrong) — accuracy is automatic.",
      "See your score trend across tests.",
      "Tap 'Review mistakes' → log each wrong answer in the Mistake Log.",
      "With mistakes saved, one tap creates an auto 'Mistakes Revision Sprint'.",
    ],
    flow: ["Log test", "See trend", "Review mistakes", "Mistakes Sprint"],
  },
  {
    id: "insights",
    icon: "📊",
    title: "Reports & Analytics",
    intro: "See weekly scores and dive deep into where your time goes.",
    steps: [
      "Reports → week/month Focus Score ring and a plain-language suggestion.",
      "Reports → 'Run your best' shows your best week of focus and best day of questions — a number to beat.",
      "Analytics → Day / Week / Month / Year / Custom with animated charts.",
      "Charts show time by subject and by activity, plus a daily trend.",
      "Export: CSV download or Print/PDF for parents or your notebook.",
    ],
    flow: ["This week", "Focus Score", "Run your best", "Analytics charts", "Export PDF"],
  },
  {
    id: "habits",
    icon: "🔥",
    title: "Stay on track — streaks & XP",
    intro: "Padhle turns consistency into something you can see, not a guilt trip.",
    steps: [
      "Study any day → your streak flame grows (it warms up at 3, 7, and 30 days).",
      "Do real work → earn XP → level up (100 XP per level).",
      "Milestones unlock achievement badges (with confetti 🎉).",
      "Your Study Forest on Profile shows every session as a tree.",
    ],
    flow: ["Study today", "Streak +1", "XP +", "Level up / badge"],
    tip: "XP is only ever earned, never taken away — changing your mind is fine.",
  },
  {
    id: "share",
    icon: "👨‍👩‍👧",
    title: "Parents & mentors",
    intro: "Let family or a mentor see your progress without sharing your account.",
    steps: [
      "Profile → Parents & mentors → add their email.",
      "Copy the share link and send it to them.",
      "They sign in with their own Google account and land on a My students hub listing everyone who shared with them.",
      "They tap a student to open a read-only snapshot: weekly focus score, focus trend, exam countdown, last-30-days totals, syllabus progress, and recent sessions.",
    ],
    flow: ["Add email", "Copy share link", "They sign in", "My students hub", "Read-only snapshot"],
  },
];

function Chip({ target }: { target: string }) {
  const section = SECTIONS.find((s) => s.id === target);
  if (!section) return null;
  return (
    <a
      href={`#/help?go=${target}`}
      onClick={(e) => {
        e.preventDefault();
        document.getElementById(`section-${target}`)?.scrollIntoView({ behavior: "smooth" });
      }}
      className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-secondary hover:border-brand-600 hover:text-text-primary"
    >
      {section.icon} {section.title}
    </a>
  );
}

export function HowToUse() {
  const asset = (name: string) => `${import.meta.env.BASE_URL}${name}`;
  const [searchParams] = useSearchParams();

  // Support direct links like `#/help?go=setup` (the same URL the section
  // chips point at) so a deep link scrolls to the right section on load.
  useEffect(() => {
    const target = searchParams.get("go");
    if (!target) return;
    const timer = window.setTimeout(() => {
      document
        .getElementById(`section-${target}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">How to use पdhle</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Made for Class 10/12 Boards, JEE, and NEET. Choose what you want to do — every path is
          just a few simple steps.
        </p>
      </div>

      <Card className="overflow-hidden p-0">
        <img
          src={asset("How-To-Use-Light.png")}
          alt="How to use Padhle — your day in 5 steps"
          loading="lazy"
          className="block w-full dark:hidden"
        />
        <img
          src={asset("How-To-Use-Dark.png")}
          alt="How to use Padhle — your day in 5 steps"
          loading="lazy"
          className="hidden w-full dark:block"
        />
      </Card>

      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <Chip key={s.id} target={s.id} />
        ))}
      </div>

      {SECTIONS.map((section) => (
        <Card id={`section-${section.id}`} key={section.id} className="scroll-mt-24 p-5">
          <p className="text-lg font-semibold">
            {section.icon} {section.title}
          </p>
          <p className="mt-1 text-sm text-text-secondary">{section.intro}</p>
          <ol className="mt-3 space-y-2">
            {section.steps.map((step, i) => (
              <li key={i} className="flex gap-2.5 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="leading-snug">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 rounded-xl bg-surface-2 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Flow at a glance
            </p>
            <Flow steps={section.flow} />
          </div>
          {section.tip && (
            <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs text-text-secondary">
              💡 {section.tip}
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}