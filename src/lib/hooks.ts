import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getCountFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { addDays, counterBucketIds, dayKey, parseDayKey } from "@/lib/dates";
import { emptyCounter } from "@/lib/schema";
import type {
  BacklogDoc,
  ChapterDoc,
  CheckinDoc,
  CounterDoc,
  ErrorBookDoc,
  ErrorStatus,
  FocusSessionDoc,
  MockTestDoc,
  SprintDoc,
  SubjectDoc,
  TaskDoc,
} from "@/lib/schema";

export function useSubjects() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<(SubjectDoc & { id: string })[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "subjects"), orderBy("order"));
    return onSnapshot(q, (snap) => {
      setSubjects(snap.docs.map((d) => ({ id: d.id, ...(d.data() as SubjectDoc) })));
    });
  }, [user]);

  return subjects;
}

export function useChapters() {
  const { user } = useAuth();
  const [chapters, setChapters] = useState<(ChapterDoc & { id: string })[]>([]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "users", user.uid, "chapters"), (snap) => {
      setChapters(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ChapterDoc) })));
    });
  }, [user]);

  return chapters;
}

/** Tasks scheduled on a single day (YYYY-MM-DD). Carried-to-backlog tasks are hidden. */
export function useTasksForDate(date: string) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<(TaskDoc & { id: string })[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "tasks"),
      where("scheduledDate", "==", date),
      where("status", "in", ["todo", "done", "dropped"])
    );
    return onSnapshot(q, (snap) => {
      setTasks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as TaskDoc) })));
    });
  }, [user, date]);

  return tasks;
}

export function useTask(taskId: string | undefined) {
  const { user } = useAuth();
  const [task, setTask] = useState<(TaskDoc & { id: string }) | null>(null);

  useEffect(() => {
    if (!user || !taskId) {
      setTask(null);
      return;
    }
    return onSnapshot(doc(db, "users", user.uid, "tasks", taskId), (snap) => {
      setTask(snap.exists() ? ({ id: snap.id, ...(snap.data() as TaskDoc) }) : null);
    });
  }, [user, taskId]);

  return task;
}

/** Tasks scheduled within [startDate, endDate] inclusive, both YYYY-MM-DD. */
export function useTasksForRange(startDate: string, endDate: string) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<(TaskDoc & { id: string })[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "tasks"),
      where("scheduledDate", ">=", startDate),
      where("scheduledDate", "<=", endDate)
    );
    return onSnapshot(q, (snap) => {
      setTasks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as TaskDoc) })));
    });
  }, [user, startDate, endDate]);

  return tasks;
}

export function useSprints() {
  const { user } = useAuth();
  const [sprints, setSprints] = useState<(SprintDoc & { id: string })[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "sprints"));
    return onSnapshot(q, (snap) => {
      setSprints(snap.docs.map((d) => ({ id: d.id, ...(d.data() as SprintDoc) })));
    });
  }, [user]);

  return sprints;
}

/** Tasks linked to a sprint (kanban board data), live. */
export function useSprintTasks(sprintId: string | undefined) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<(TaskDoc & { id: string })[]>([]);

  useEffect(() => {
    if (!user || !sprintId) {
      setTasks([]);
      return;
    }
    const q = query(
      collection(db, "users", user.uid, "tasks"),
      where("sprintId", "==", sprintId),
      where("status", "in", ["todo", "in_progress", "done"])
    );
    return onSnapshot(q, (snap) => {
      setTasks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as TaskDoc) })));
    });
  }, [user, sprintId]);

  return tasks;
}

export function useSprint(sprintId: string | undefined) {
  const { user } = useAuth();
  const [sprint, setSprint] = useState<(SprintDoc & { id: string }) | null>(null);

  useEffect(() => {
    if (!user || !sprintId) {
      setSprint(null);
      return;
    }
    return onSnapshot(doc(db, "users", user.uid, "sprints", sprintId), (snap) => {
      setSprint(snap.exists() ? ({ id: snap.id, ...(snap.data() as SprintDoc) }) : null);
    });
  }, [user, sprintId]);

  return sprint;
}

/** undefined = still loading, null = no check-in yet for this date. */
export function useCheckin(date: string) {
  const { user } = useAuth();
  const [checkin, setCheckin] = useState<(CheckinDoc & { id: string }) | null | undefined>(
    undefined
  );

  useEffect(() => {
    if (!user) return;
    setCheckin(undefined);
    return onSnapshot(doc(db, "users", user.uid, "checkins", date), (snap) => {
      setCheckin(snap.exists() ? ({ id: snap.id, ...(snap.data() as CheckinDoc) }) : null);
    });
  }, [user, date]);

  return checkin;
}

/** Most recent mock tests, oldest-to-newest (ready to feed straight into a trend chart). */
export function useMockTests(maxCount = 20) {
  const { user } = useAuth();
  const [tests, setTests] = useState<(MockTestDoc & { id: string })[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "mockTests"),
      orderBy("date", "desc"),
      limit(maxCount)
    );
    return onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as MockTestDoc) }));
      setTests(docs.reverse());
    });
  }, [user, maxCount]);

  return tests;
}

/** Live count of open mistakes, for banners that must be exact despite paging. */
export function useOpenErrorCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }
    let cancelled = false;
    getCountFromServer(
      query(collection(db, "users", user.uid, "errors"), where("status", "==", "open"))
    )
      .then((snap) => {
        if (!cancelled) setCount(snap.data().count);
      })
      .catch(() => {
        if (!cancelled) setCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return count;
}

export function useErrors(status?: ErrorStatus, maxCount?: number) {
  const { user } = useAuth();
  const [errors, setErrors] = useState<(ErrorBookDoc & { id: string })[]>([]);

  useEffect(() => {
    if (!user) return;
    const base = collection(db, "users", user.uid, "errors");
    let q = status ? query(base, where("status", "==", status)) : query(base);
    if (maxCount) {
      q = query(q, orderBy("createdAt", "desc"), limit(maxCount));
    }
    return onSnapshot(q, (snap) => {
      setErrors(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ErrorBookDoc) })));
    });
  }, [user, status, maxCount]);

  return errors;
}

/** Live counters for a single day (defaults to all-zero while loading/absent). */
export function useDayCounter(date: string) {
  const { user } = useAuth();
  const [counter, setCounter] = useState<CounterDoc>(emptyCounter());

  useEffect(() => {
    if (!user) return;
    const { day } = counterBucketIds(parseDayKey(date));
    return onSnapshot(doc(db, "users", user.uid, "counters", day), (snap) => {
      setCounter({ ...emptyCounter(), ...(snap.data() as CounterDoc | undefined) });
    });
  }, [user, date]);

  return counter;
}

/** Live counters for the week/month containing `date` — same shape as useDayCounter. */
export function useWeekCounter(date: string) {
  const { user } = useAuth();
  const [counter, setCounter] = useState<CounterDoc>(emptyCounter());

  useEffect(() => {
    if (!user) return;
    const { week } = counterBucketIds(parseDayKey(date));
    return onSnapshot(doc(db, "users", user.uid, "counters", week), (snap) => {
      setCounter({ ...emptyCounter(), ...(snap.data() as CounterDoc | undefined) });
    });
  }, [user, date]);

  return counter;
}

/** Live counters for the week containing `date` minus 7 days. */
export function usePrevWeekCounter(date: string) {
  const { user } = useAuth();
  const [counter, setCounter] = useState<CounterDoc>(emptyCounter());

  useEffect(() => {
    if (!user) return;
    const { week } = counterBucketIds(addDays(parseDayKey(date), -7));
    return onSnapshot(doc(db, "users", user.uid, "counters", week), (snap) => {
      setCounter({ ...emptyCounter(), ...(snap.data() as CounterDoc | undefined) });
    });
  }, [user, date]);

  return counter;
}

/**
 * Sum of day-level counters over the trailing 30 days (today-29 .. today).
 * Reads the counters collection once and filters locally: one student's day
 * docs are a tiny dataset, so this avoids 30 separate getDoc calls.
 */
export function useLastNDaysCounter(days: number) {
  const { user } = useAuth();
  const [counter, setCounter] = useState<CounterDoc>(emptyCounter());

  useEffect(() => {
    if (!user) return;
    const today = new Date();
    const start = addDays(today, -(days - 1));
    const startKey = dayKey(start);

    return onSnapshot(collection(db, "users", user.uid, "counters"), (snap) => {
      const totals = emptyCounter();
      snap.docs.forEach((d) => {
        if (!d.id.startsWith("day_")) return;
        const bucketDate = d.id.slice(4);
        if (bucketDate < startKey) return;
        const c = d.data() as CounterDoc;
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
          totals[key] += c[key] ?? 0;
        }
      });
      setCounter(totals);
    });
  }, [user, days]);

  return counter;
}

export function useMonthCounter(date: string) {
  const { user } = useAuth();
  const [counter, setCounter] = useState<CounterDoc>(emptyCounter());

  useEffect(() => {
    if (!user) return;
    const { month } = counterBucketIds(parseDayKey(date));
    return onSnapshot(doc(db, "users", user.uid, "counters", month), (snap) => {
      setCounter({ ...emptyCounter(), ...(snap.data() as CounterDoc | undefined) });
    });
  }, [user, date]);

  return counter;
}

/** Most recent focus sessions ("trees"), oldest-to-newest, for the Study Forest. */
export function useFocusSessions(maxCount = 100) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<(FocusSessionDoc & { id: string })[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "focusSessions"),
      orderBy("startedAt", "desc"),
      limit(maxCount)
    );
    return onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as FocusSessionDoc) }));
      setSessions(docs.reverse());
    });
  }, [user, maxCount]);

  return sessions;
}

/**
 * Everything needed to compute badge eligibility (src/lib/gamification.ts).
 * Trees/mocks use cheap aggregate-count queries (`getCountFromServer`) instead
 * of downloading full `focusSessions`/`mockTests` docs just to count them —
 * exact, O(docs)*constant queries regardless of how large a power user's
 * history grows. Counts are re-fetched whenever the user doc moves (xp/streak/
 * badges change on activity), which is exactly when badge eligibility changes.
 */
export function useBadgeContext() {
  const { user, userDoc } = useAuth();
  const subjects = useSubjects();
  const sprints = useSprints();
  const [counts, setCounts] = useState({ treesGrown: 0, mockTestsLogged: 0 });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [trees, mocks] = await Promise.all([
          getCountFromServer(query(collection(db, "users", user.uid, "focusSessions"))),
          getCountFromServer(query(collection(db, "users", user.uid, "mockTests"))),
        ]);
        if (!cancelled) {
          setCounts({ treesGrown: trees.data().count, mockTestsLogged: mocks.data().count });
        }
      } catch (err) {
        console.error("Failed to load badge counts", err);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // Refetch on user-doc movements — activity (tasks/focus/mocks) bumps xp,
    // and streak/badge changes re-check here too. Not a live listener, which
    // is fine: unlocks surface via the sync effect on the next movement.
  }, [user, userDoc?.xp, userDoc?.streakCount, userDoc?.longestStreak, userDoc?.badges?.length]);

  // Stable object identity: AppShell's badge-sync effect keys on this value,
  // so returning a fresh object every render would re-run (and re-fetch the
  // count queries) on every keystroke/navigation. Only xp/streak/badge changes
  // produce a new identity, which is exactly when eligibility re-checks.
  return useMemo(
    () => ({
      xp: userDoc?.xp ?? 0,
      streakCount: userDoc?.streakCount ?? 0,
      longestStreak: userDoc?.longestStreak ?? 0,
      treesGrown: counts.treesGrown,
      chaptersMastered: subjects.reduce((sum, s) => sum + s.masteredCount, 0),
      mockTestsLogged: counts.mockTestsLogged,
      sprintsCompleted: sprints.filter((s) => s.status === "completed").length,
    }),
    [
      userDoc?.xp,
      userDoc?.streakCount,
      userDoc?.longestStreak,
      counts.treesGrown,
      counts.mockTestsLogged,
      subjects,
      sprints,
    ]
  );
}

/** Still-"todo" tasks scheduled before today — candidates for the daily rollover prompt. */
export function useOverdueTasks(todayKey: string) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<(TaskDoc & { id: string })[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "tasks"),
      where("scheduledDate", "<", todayKey),
      where("status", "==", "todo")
    );
    return onSnapshot(q, (snap) => {
      setTasks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as TaskDoc) })));
    });
  }, [user, todayKey]);

  return tasks;
}

export function useBacklog(maxCount?: number) {
  const { user } = useAuth();
  const [items, setItems] = useState<(BacklogDoc & { id: string })[]>([]);

  useEffect(() => {
    if (!user) return;
    let q = query(
      collection(db, "users", user.uid, "backlog"),
      where("status", "==", "pending")
    );
    if (maxCount) {
      q = query(q, orderBy("createdAt", "desc"), limit(maxCount));
    }
    return onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as BacklogDoc) })));
    });
  }, [user, maxCount]);

  return items;
}

/** All counter docs (day_/week_/month_), for scans/bests/retros. Small dataset. */
export function useAllCounters() {
  const { user } = useAuth();
  const [counters, setCounters] = useState<{ id: string; data: CounterDoc }[]>([]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "users", user.uid, "counters"), (snap) => {
      setCounters(snap.docs.map((d) => ({ id: d.id, data: d.data() as CounterDoc })));
    });
  }, [user]);

  return counters;
}

/**
 * Focus sessions whose `date` key falls in [start, end] (inclusive), newest
 * first, capped at maxCount. Bounded by a date window so pages like Analytics
 * never pull an entire session history into memory.
 */
export function useFocusSessionsInRange(start: string, end: string, maxCount = 2000) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<FocusSessionDoc[]>([]);

  useEffect(() => {
    if (!user) {
      setSessions([]);
      return;
    }
    const q = query(
      collection(db, "users", user.uid, "focusSessions"),
      where("date", ">=", start),
      where("date", "<=", end),
      orderBy("date", "desc"),
      limit(maxCount)
    );
    return onSnapshot(q, (snap) => {
      setSessions(snap.docs.map((d) => d.data() as FocusSessionDoc));
    });
  }, [user, start, end, maxCount]);

  return sessions;
}

/**
 * true once the signed-in user has a doc in the top-level /admins collection
 * (granted manually via the Firebase console — see firestore.rules). Drives
 * the admin dashboard's route guard and nav visibility.
 */
export function useAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    return onSnapshot(
      doc(db, "admins", user.uid),
      (snap) => {
        setIsAdmin(snap.exists());
        if (snap.exists()) {
          console.debug(`[admin] ${user.uid} has an /admins doc — admin granted`);
        }
      },
      (err) => {
        // A denied read here is silent by default and looks exactly like
        // "the Admin dashboard disappeared". Surface it so misconfiguration
        // (unpublished rules, wrong project, wrong UID) is obvious instead
        // of invisible.
        console.error(
          `[admin] Could not read /admins/${user.uid} — are firestore.rules published and is this the right project?`,
          err.code ?? err.message
        );
        setIsAdmin(false);
      }
    );
  }, [user]);

  return isAdmin;
}
