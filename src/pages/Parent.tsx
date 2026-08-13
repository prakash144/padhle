import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from "firebase/firestore";
import {
  Activity,
  ArrowLeft,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Lock,
  Timer,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/ProgressRing";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { computeFocusScore } from "@/lib/reports";
import { isAuthorizedFor } from "@/lib/share";
import { useAdmin } from "@/lib/hooks";
import { emptyCounter } from "@/lib/schema";
import { addDays, counterBucketIds, dayKey, parseDayKey, startOfWeek, weekKey } from "@/lib/dates";
import { friendlyFirstName } from "@/lib/utils";
import type {
  CheckinDoc,
  CounterDoc,
  ExamGoalDoc,
  FocusSessionDoc,
  MockTestDoc,
  SubjectDoc,
  TaskDoc,
  UserDoc,
} from "@/lib/schema";

type Status = "loading" | "denied" | "ready" | "missing";

type ActivityKind = "focus" | "task" | "mock" | "checkin";
type ActivityItem = {
  id: string;
  kind: ActivityKind;
  label: string;
  meta?: string;
  date: string;
  ts: number;
};

const ACTIVITY_ICON: Record<ActivityKind, { icon: LucideIcon; color: string }> = {
  focus: { icon: Timer, color: "text-brand-600" },
  task: { icon: CheckCircle2, color: "text-success" },
  mock: { icon: ClipboardCheck, color: "text-info" },
  checkin: { icon: CalendarCheck, color: "text-achievement" },
};

const EXAM_LABEL: Record<string, string> = {
  class10: "Class 10 Boards",
  class12: "Class 12 Boards",
  jeeMain: "JEE Main",
  jeeAdvanced: "JEE Advanced",
  neet: "NEET",
};

export function Parent() {
  const { uid } = useParams<{ uid: string }>();
  const { user } = useAuth();
  const isAdmin = useAdmin();
  const [status, setStatus] = useState<Status>("loading");
  const [profile, setProfile] = useState<UserDoc | null>(null);
  const [exams, setExams] = useState<(ExamGoalDoc & { id: string })[]>([]);
  const [subjects, setSubjects] = useState<(SubjectDoc & { id: string })[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [weekCounter, setWeekCounter] = useState<CounterDoc>(emptyCounter());
  const [last30, setLast30] = useState<CounterDoc>(emptyCounter());
  const [trend, setTrend] = useState<{ label: string; minutes: number }[]>([]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    const load = async () => {
      try {
        const userSnap = await getDoc(doc(db, "users", uid));
        if (cancelled) return;
        if (!userSnap.exists()) {
          setStatus("missing");
          return;
        }
        const docData = userSnap.data() as UserDoc;
        if (!isAdmin && !isAuthorizedFor(user?.email, docData.parents)) {
          setStatus("denied");
          return;
        }
        setProfile(docData);
        setStatus("ready");

        const [examSnap, counterSnap, subjectSnap, sessionSnap, tasksSnap, mocksSnap, checkinsSnap] =
          await Promise.all([
            getDocs(collection(db, "users", uid, "examGoals")),
            getDocs(collection(db, "users", uid, "counters")),
            getDocs(collection(db, "users", uid, "subjects")),
            getDocs(
              query(
                collection(db, "users", uid, "focusSessions"),
                orderBy("date", "desc"),
                limit(8)
              )
            ),
            getDocs(
              query(
                collection(db, "users", uid, "tasks"),
                orderBy("completedAt", "desc"),
                limit(10)
              )
            ),
            getDocs(
              query(collection(db, "users", uid, "mockTests"), orderBy("date", "desc"), limit(4))
            ),
            getDocs(
              query(collection(db, "users", uid, "checkins"), orderBy("date", "desc"), limit(5))
            ),
          ]);
        if (cancelled) return;

        setExams(examSnap.docs.map((d) => ({ id: d.id, ...(d.data() as ExamGoalDoc) })));
        setSubjects(subjectSnap.docs.map((d) => ({ id: d.id, ...(d.data() as SubjectDoc) })));

        const week = emptyCounter();
        const rolling = emptyCounter();
        const tz = docData.timezone ?? "Asia/Kolkata";
        const today = new Date();
        const startKey = dayKey(addDays(today, -29), tz);

        // Weekly focus buckets from day_ counters for the last 6 weeks.
        const buckets = new Map<string, number>();
        for (const dayDoc of counterSnap.docs) {
          const id = dayDoc.id;
          const c = dayDoc.data() as CounterDoc;
          if (id === counterBucketIds(today, tz).week) {
            sumInto(week, c);
          } else if (id.startsWith("day_") && id.slice(4) >= startKey) {
            sumInto(rolling, c);
          }
          if (id.startsWith("day_")) {
            const wk = weekKey(parseDayKey(id.slice(4), tz), tz);
            buckets.set(wk, (buckets.get(wk) ?? 0) + (c.focusMinutes ?? 0));
          }
        }
        setWeekCounter(week);
        setLast30(rolling);

        // Combined recent-activity feed: focus sessions, completed tasks, mock
        // tests and daily check-ins, newest first.
        const activity: ActivityItem[] = [];
        sessionSnap.docs.forEach((d) => {
          const s = d.data() as FocusSessionDoc;
          activity.push({
            id: `focus-${d.id}`,
            kind: "focus",
            label: `${s.subjectName ?? "Focus"}${s.activity ? ` · ${capitalize(s.activity)}` : ""}`,
            meta: `${Math.round(s.focusMinutes)} min${s.questionsDone ? ` · ${s.questionsDone} Q` : ""}`,
            date: s.date,
            ts: (s.endedAt ?? s.startedAt).toMillis(),
          });
        });
        tasksSnap.docs.forEach((d) => {
          const t = d.data() as TaskDoc;
          if (t.status !== "done" || !t.completedAt) return;
          activity.push({
            id: `task-${d.id}`,
            kind: "task",
            label: t.title,
            meta: `${capitalize(t.category)}${t.subjectName ? ` · ${t.subjectName}` : ""}`,
            date: dayKey(t.completedAt.toDate(), tz),
            ts: t.completedAt.toMillis(),
          });
        });
        mocksSnap.docs.forEach((d) => {
          const m = d.data() as MockTestDoc;
          activity.push({
            id: `mock-${d.id}`,
            kind: "mock",
            label: m.name,
            meta: `${Math.round(m.accuracy)}% accuracy`,
            date: m.date,
            ts: m.createdAt ? m.createdAt.toMillis() : parseDayKey(m.date, tz).getTime(),
          });
        });
        checkinsSnap.docs.forEach((d) => {
          const c = d.data() as CheckinDoc;
          activity.push({
            id: `checkin-${d.id}`,
            kind: "checkin",
            label: c.top3?.[0] ? `Planned: ${c.top3[0]}` : "Daily check-in",
            meta: c.top3?.length ? `${c.top3.length} goal${c.top3.length > 1 ? "s" : ""}` : undefined,
            date: c.date,
            ts: c.createdAt ? c.createdAt.toMillis() : parseDayKey(c.date, tz).getTime(),
          });
        });
        activity.sort((a, b) => b.ts - a.ts);
        setActivity(activity.slice(0, 12));

        const weeks: { label: string; minutes: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const anchor = startOfWeek(addDays(today, -7 * i));
          const wk = weekKey(anchor, tz);
          weeks.push({
            label: anchor.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            minutes: buckets.get(wk) ?? 0,
          });
        }
        setTrend(weeks);
      } catch {
        if (!cancelled) setStatus("denied");
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [uid, user?.email, isAdmin]);

  if (status !== "ready" || !profile) return <ParentGate status={status} />;

  const { score } = computeFocusScore(weekCounter);
  const primaryExam = exams.find((e) => e.isPrimary) ?? exams[0];
  const totalChapters = subjects.reduce((sum, s) => sum + (s.chapterCount ?? 0), 0);
  const masteredChapters = subjects.reduce((sum, s) => sum + (s.masteredCount ?? 0), 0);
  const maxTrendMinutes = Math.max(...trend.map((t) => t.minutes), 1);

  return (
    <div className="min-h-screen bg-bg px-4 py-6">
      <div className="mx-auto max-w-lg space-y-4">
        <Link
          to="/parent"
          className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-brand-600"
        >
          <ArrowLeft size={13} /> My students
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar
              src={profile.photoURL}
              name={profile.displayName}
              className="h-11 w-11 text-base"
            />
            <div>
              <p className="font-display text-lg font-bold">{friendlyFirstName(profile.displayName)}</p>
              <p className="text-xs text-text-secondary">
                Study snapshot
                {profile.lastActiveDate ? ` · active ${profile.lastActiveDate}` : ""}
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-secondary">
            <Lock size={12} /> Read-only
          </span>
        </div>

        <Card className="flex items-center gap-4 p-4 text-center">
          <ProgressRing size={96} strokeWidth={9} progress={score / 100} gradient>
            <span className="font-numeric text-2xl font-semibold tabular">{score}</span>
          </ProgressRing>
          <div className="flex-1 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Weekly focus score</p>
            <p className="text-sm text-text-secondary">
              {score >= 70 ? "Strong, consistent week." : "Room to grow this week."}
            </p>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Focus (week)" value={`${Math.round(weekCounter.focusMinutes / 60)}h`} />
          <Stat label="Questions" value={String(weekCounter.questionsDone)} />
          <Stat label="Tasks done" value={String(weekCounter.completedTasks)} />
          <Stat label="Mocks" value={String(weekCounter.mockCount)} />
        </div>

        <Card className="p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Activity size={15} /> Focus trend
          </p>
          <div className="flex items-end justify-between gap-1.5">
            {trend.map((t) => (
              <div key={t.label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-medium text-text-muted">
                  {t.minutes >= 60 ? `${Math.round(t.minutes / 60)}h` : `${Math.round(t.minutes)}m`}
                </span>
                <div
                  className="w-full rounded-t-md bg-brand-500/25"
                  style={{ height: `${Math.max(4, Math.round((t.minutes / maxTrendMinutes) * 64))}px` }}
                />
                <span className="text-[10px] text-text-muted">{t.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <CalendarDays size={15} /> Exam countdown
          </p>
          {primaryExam ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">
                {EXAM_LABEL[primaryExam.examType] ?? primaryExam.name}
              </span>
              <span className="font-numeric text-lg font-semibold tabular">
                {daysTo(primaryExam.examDate.toDate())} days
              </span>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">No exam added yet.</p>
          )}
        </Card>

        <Card className="p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <GraduationCap size={15} /> Last 30 days
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <StatRow label="Focus time" value={`${Math.round(last30.focusMinutes / 60)}h`} />
            <StatRow label="Questions" value={String(last30.questionsDone)} />
            <StatRow label="Revisions" value={String(last30.revisionsDone)} />
            <StatRow label="Study days" value={`${last30.checkinDone}`} />
          </div>
        </Card>

        <Card className="p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <BookOpen size={15} /> Syllabus progress
          </p>
          {subjects.length === 0 ? (
            <p className="text-sm text-text-secondary">No subjects set up yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div>
                  <p className="font-numeric text-xl font-semibold tabular">{subjects.length}</p>
                  <p className="text-xs text-text-muted">Subjects</p>
                </div>
                <div>
                  <p className="font-numeric text-xl font-semibold tabular">{totalChapters}</p>
                  <p className="text-xs text-text-muted">Chapters</p>
                </div>
                <div>
                  <p className="font-numeric text-xl font-semibold tabular">{masteredChapters}</p>
                  <p className="text-xs text-text-muted">Mastered</p>
                </div>
              </div>
              <div className="mt-3">
                {subjects.slice(0, 5).map((s) => (
                  <div key={s.id} className="mt-2 flex items-center justify-between text-xs">
                    <span className="truncate text-text-secondary">{s.name}</span>
                    <span className="ml-2 shrink-0 tabular text-text-muted">
                      {s.masteredCount ?? 0}/{s.chapterCount ?? 0} mastered
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card className="p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Activity size={15} /> Recent activity
          </p>
          {activity.length === 0 ? (
            <p className="text-sm text-text-secondary">No activity recorded yet.</p>
          ) : (
            <ol className="space-y-2.5">
              {activity.map((a) => {
                const { icon: Icon, color } = ACTIVITY_ICON[a.kind];
                return (
                  <li key={a.id} className="flex items-start gap-2.5 text-sm">
                    <Icon size={15} className={`mt-0.5 shrink-0 ${color}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate leading-snug">{a.label}</p>
                      {a.meta && <p className="text-xs text-text-muted">{a.meta}</p>}
                    </div>
                    <span className="shrink-0 pt-0.5 text-xs text-text-muted">
                      {parseDayKey(a.date, profile.timezone).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        <p className="text-center text-xs text-text-secondary">
          Read-only snapshot — study data stays with the student.
        </p>
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function sumInto(target: CounterDoc, c: CounterDoc) {
  for (const key of [
    "plannedTasks",
    "completedTasks",
    "focusMinutes",
    "questionsDone",
    "pyqsDone",
    "revisionsDone",
    "checkinDone",
    "mockCount",
  ] as const) {
    target[key] += c[key] ?? 0;
  }
}

function daysTo(date: Date): number {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86400000));
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3 text-center">
      <p className="font-numeric text-xl font-semibold tabular">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </Card>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-text-secondary">{label}</span>
      <span className="tabular font-medium">{value}</span>
    </div>
  );
}

function ParentGate({ status }: { status: Status }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <Card className="w-full max-w-sm py-10 text-center">
        {status === "loading" ? (
          <p className="text-sm text-text-secondary">Loading snapshot…</p>
        ) : status === "missing" ? (
          <p className="text-sm text-text-secondary">This student account doesn't exist.</p>
        ) : (
          <>
            <p className="text-sm text-text-secondary">
              This snapshot is private. Sign in with the email the student granted access to in
              order to view it.
            </p>
            <Link to="/login" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
              Sign in to view
            </Link>
          </>
        )}
      </Card>
    </div>
  );
}
