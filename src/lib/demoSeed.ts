import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { seedSyllabusForExams } from "@/lib/syllabusSeed";
import { setTaskDone } from "@/lib/tasks";
import { logFocusSession } from "@/lib/focusSessions";
import { createMockTest } from "@/lib/mockTests";
import { createError } from "@/lib/errors";
import { saveMorningCheckin } from "@/lib/checkins";
import { createSprint } from "@/lib/sprints";
import { createNote } from "@/lib/notes";
import { scheduleSpacedRevisions } from "@/lib/revisions";
import { bumpCounters } from "@/lib/counters";
import { addDays, dayKey, parseDayKey } from "@/lib/dates";
import type { ChapterDoc, SubjectDoc, TaskDoc } from "@/lib/schema";

/**
 * Contact-address accounts that are meant for local/QA exploration. When one
 * signs in with no data yet, the app seeds a believable, consistent study
 * world (see DemoSeed in App.tsx) so a reviewer can click through every
 * screen without building data by hand.
 */
export const DEMO_EMAILS = ["prakash.rabidas.dev01@gmail.com"];

const SEED_MARKER_KEY = (uid: string) => `padhle-demo-seeded-${uid}`;

/**
 * True when this account already went through onboarding / was previously
 * seeded. Seeding is strictly one-time so it never clobbers real progress.
 */
export async function isDemoSeeded(uid: string): Promise<boolean> {
  if (localStorage.getItem(SEED_MARKER_KEY(uid))) return true;
  const goals = await getDocs(query(collection(db, "users", uid, "examGoals"), limit(1)));
  return !goals.empty;
}

/** Seeds demo data for a brand-new account. No-op if data already exists. */
export async function seedDemoDataIfNeeded(uid: string): Promise<void> {
  if (await isDemoSeeded(uid)) return;
  await seedDemoData(uid);
  localStorage.setItem(SEED_MARKER_KEY(uid), String(Date.now()));
}

// --- small helpers (keep implementation early and idempotent) --------------

/** Identical write-path to src/lib/tasks.ts:createTask, but returns the doc id. */
async function addTask(
  uid: string,
  input: {
    title: string;
    category: TaskDoc["category"];
    subjectId?: string;
    subjectName?: string;
    chapterId?: string;
    chapterName?: string;
    priority: TaskDoc["priority"];
    difficulty: TaskDoc["difficulty"];
    estimatedMinutes: number;
    targetQuestions?: number;
    scheduledDate: string;
    sprintId?: string;
  }
): Promise<string> {
  const ref = doc(collection(db, "users", uid, "tasks"));
  const batch = writeBatch(db);
  batch.set(ref, {
    title: input.title,
    category: input.category,
    subjectId: input.subjectId,
    subjectName: input.subjectName,
    chapterId: input.chapterId,
    chapterName: input.chapterName,
    priority: input.priority,
    difficulty: input.difficulty,
    estimatedMinutes: input.estimatedMinutes,
    targetQuestions: input.targetQuestions,
    scheduledDate: input.scheduledDate,
    sprintId: input.sprintId,
    status: "todo",
    actualMinutes: 0,
    questionsDone: 0,
    source: "manual",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  bumpCounters(batch, uid, parseDayKey(input.scheduledDate), { plannedTasks: 1 });
  await batch.commit();
  return ref.id;
}

async function addDoneTask(
  uid: string,
  input: Parameters<typeof addTask>[1] & { actualMinutes: number; questionsDone: number }
): Promise<void> {
  const id = await addTask(uid, input);
  await setTaskDone(uid, { id, ...input } as TaskDoc & { id: string }, true, {
    actualMinutes: input.actualMinutes,
    questionsDone: input.questionsDone,
  });
}

// --- the actual seed ---------------------------------------------------------

export async function seedDemoData(uid: string): Promise<void> {
  const todayKey = dayKey(new Date());
  const yesterdayKey = dayKey(addDays(new Date(), -1));
  const tomorrowKey = dayKey(addDays(new Date(), 1));

  // 1. Exam goals (drives countdown + accent), then syllabus.
  const jeeGoalRef = doc(collection(db, "users", uid, "examGoals"));
  const boardsGoalRef = doc(collection(db, "users", uid, "examGoals"));
  const jeeDate = new Date("2027-01-24");
  const boardsDate = new Date("2027-03-01");
  await writeBatch(db)
    .set(jeeGoalRef, {
      name: "JEE Main",
      examType: "jeeMain",
      examDate: jeeDate,
      isPrimary: true,
      createdAt: serverTimestamp(),
    })
    .set(boardsGoalRef, {
      name: "Class 12 Boards",
      examType: "class12",
      examDate: boardsDate,
      isPrimary: false,
      createdAt: serverTimestamp(),
    })
    .set(
      doc(db, "users", uid),
      {
        stream: "jeeMain",
        primaryExamId: jeeGoalRef.id,
        onboardedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    )
    .commit();
  await seedSyllabusForExams(uid, ["jeeMain", "class12"]);

  // 2. Pick subjects/chapters and mark some progress so Syllabus looks lived-in.
  const subjectDocs = await getDocs(
    query(collection(db, "users", uid, "subjects"), where("examType", "==", "jeeMain"))
  );
  const subjects = subjectDocs.docs.map((d) => ({ id: d.id, ...(d.data() as SubjectDoc) }));
  const chapterDocs = await getDocs(
    query(collection(db, "users", uid, "chapters"), where("examType", "==", "jeeMain"))
  );
  const chapters = chapterDocs.docs.map((d) => ({ id: d.id, ...(d.data() as ChapterDoc) }));

  const bySubject = (name: string) => subjects.find((s) => s.name === name);
  const byChapter = (subject: string, chapter: string) =>
    chapters.find((c) => c.subjectName === subject && c.name === chapter);

  const physics = bySubject("Physics");
  const chemistry = bySubject("Chemistry");
  const maths = bySubject("Mathematics");
  if (!physics || !chemistry || !maths) return;

  const kinetics = byChapter("Physics", "Kinematics");
  const atomic = byChapter("Chemistry", "Atomic Structure");
  const limits = byChapter("Mathematics", "Limits, Continuity & Differentiability");
  const electro = byChapter("Physics", "Current Electricity");
  const bond = byChapter("Chemistry", "Chemical Bonding");
  if (!kinetics || !atomic || !limits || !electro || !bond) return;

  // Kinematics → practicing, Atomic Structure → mastered (with revisions),
  // Limits → pyq stage. Bumps subject/chapter rollups to match task data below.
  const progressBatch = writeBatch(db);
  progressBatch.set(
    doc(db, "users", uid, "chapters", kinetics.id),
    {
      masteryStage: "practicing",
      stageEnteredAt: serverTimestamp(),
      questionsAttempted: 45,
      pyqsDone: 12,
      focusMinutes: 240,
      accuracyNum: 38,
      accuracyDen: 45,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  progressBatch.set(
    doc(db, "users", uid, "chapters", atomic.id),
    {
      masteryStage: "mastered",
      stageEnteredAt: serverTimestamp(),
      questionsAttempted: 60,
      pyqsDone: 24,
      focusMinutes: 300,
      accuracyNum: 54,
      accuracyDen: 60,
      nextRevisionDue: dayKey(addDays(new Date(), 1)),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  progressBatch.set(
    doc(db, "users", uid, "chapters", limits.id),
    {
      masteryStage: "pyq",
      stageEnteredAt: serverTimestamp(),
      questionsAttempted: 33,
      pyqsDone: 18,
      focusMinutes: 180,
      accuracyNum: 26,
      accuracyDen: 33,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  progressBatch.set(
    doc(db, "users", uid, "subjects", physics.id),
    { masteredCount: 0, accuracyNum: 38, accuracyDen: 45, focusMinutes: 240 },
    { merge: true }
  );
  progressBatch.set(
    doc(db, "users", uid, "subjects", chemistry.id),
    { masteredCount: 1, accuracyNum: 54, accuracyDen: 60, focusMinutes: 300 },
    { merge: true }
  );
  progressBatch.set(
    doc(db, "users", uid, "subjects", maths.id),
    { masteredCount: 0, accuracyNum: 26, accuracyDen: 33, focusMinutes: 180 },
    { merge: true }
  );
  await progressBatch.commit();

  // 3. Past-week completed tasks (drives Reports/Retro/streak history).
  const past = [
    { off: -6, t: "Kinematics — rectilinear motion problems", c: "pyq", s: physics, ch: kinetics, min: 50, q: 20, pri: "high", diff: "med" },
    { off: -6, t: "Atomic Structure — Bohr model notes", c: "revision", s: chemistry, ch: atomic, min: 35, q: 15, pri: "med", diff: "easy" },
    { off: -5, t: "Limits — indeterminate forms drill", c: "pyq", s: maths, ch: limits, min: 40, q: 16, pri: "high", diff: "hard" },
    { off: -5, t: "Chemical Bonding — VSEPR theory", c: "revision", s: chemistry, ch: bond, min: 25, q: 0, pri: "low", diff: "med" },
    { off: -4, t: "Current Electricity — Ohm's law practice", c: "practice", s: physics, ch: electro, min: 45, q: 18, pri: "med", diff: "med" },
    { off: -4, t: "Trigonometry formula revision", c: "revision", s: maths, min: 20, q: 0, pri: "low", diff: "easy" },
    { off: -3, t: "Kinematics — relative motion PYQs", c: "pyq", s: physics, ch: kinetics, min: 60, q: 24, pri: "high", diff: "hard" },
    { off: -3, t: "Atomic Structure — electron config drill", c: "practice", s: chemistry, ch: atomic, min: 30, q: 12, pri: "med", diff: "med" },
    { off: -2, t: "Limits — continuity examples", c: "practice", s: maths, ch: limits, min: 35, q: 14, pri: "med", diff: "med" },
    { off: -2, t: "Modern Physics — dual nature notes", c: "revision", s: physics, min: 25, q: 0, pri: "low", diff: "easy" },
    { off: -1, t: "Chemical Bonding — hybridisation PYQs", c: "pyq", s: chemistry, ch: bond, min: 45, q: 18, pri: "med", diff: "med" },
    { off: -1, t: "Electromagnetic Induction — Faraday law", c: "practice", s: physics, ch: electro, min: 40, q: 16, pri: "med", diff: "hard" },
  ];
  for (const item of past) {
    await addDoneTask(uid, {
      title: item.t,
      category: item.c as TaskDoc["category"],
      subjectId: item.s.id,
      subjectName: item.s.name,
      chapterId: item.ch?.id,
      chapterName: item.ch?.name,
      priority: item.pri as TaskDoc["priority"],
      difficulty: item.diff as TaskDoc["difficulty"],
      estimatedMinutes: item.min,
      targetQuestions: item.q,
      scheduledDate: dayKey(addDays(new Date(), item.off)),
      actualMinutes: item.min,
      questionsDone: item.q,
    });
  }

  // Yesterday left one undone → shows up in the Today rollover.
  await addTask(uid, {
    title: "Rotational Motion — torque & inertia basics",
    category: "jee",
    subjectId: physics.id,
    subjectName: physics.name,
    priority: "med",
    difficulty: "med",
    estimatedMinutes: 30,
    targetQuestions: 15,
    scheduledDate: yesterdayKey,
  });

  // 4. Active JEE sprint with a few linked tasks.
  const sprintId = await createSprint(uid, {
    name: "JEE Physics Bootcamp",
    type: "7",
    startDate: todayKey,
    goals: { targetQuestions: 40, targetPyqs: 15, targetMocks: 2, targetFocusHours: 10 },
  });
  await addTask(uid, {
    title: "Current Electricity — full chapter problems",
    category: "jee",
    subjectId: physics.id,
    subjectName: physics.name,
    chapterId: electro.id,
    chapterName: electro.name,
    priority: "high",
    difficulty: "hard",
    estimatedMinutes: 50,
    targetQuestions: 20,
    scheduledDate: todayKey,
    sprintId,
  });

  // 5. Today's To-do list (drives "Do these next") + today's check-in.
  await addTask(uid, {
    title: "Kinematics — relative motion problem set",
    category: "jee",
    subjectId: physics.id,
    subjectName: physics.name,
    chapterId: kinetics.id,
    chapterName: kinetics.name,
    priority: "high",
    difficulty: "hard",
    estimatedMinutes: 45,
    targetQuestions: 20,
    scheduledDate: todayKey,
    sprintId,
  });
  await addTask(uid, {
    title: "Atomic Structure — 30 PYQs",
    category: "pyq",
    subjectId: chemistry.id,
    subjectName: chemistry.name,
    chapterId: atomic.id,
    chapterName: atomic.name,
    priority: "med",
    difficulty: "med",
    estimatedMinutes: 40,
    targetQuestions: 30,
    scheduledDate: todayKey,
  });
  await addTask(uid, {
    title: "Limits — NCERT solved examples",
    category: "revision",
    subjectId: maths.id,
    subjectName: maths.name,
    chapterId: limits.id,
    chapterName: limits.name,
    priority: "low",
    difficulty: "easy",
    estimatedMinutes: 30,
    scheduledDate: todayKey,
  });
  await addDoneTask(uid, {
    title: "Atomic Structure — notes cleanup",
    category: "revision",
    subjectId: chemistry.id,
    subjectName: chemistry.name,
    chapterId: atomic.id,
    chapterName: atomic.name,
    priority: "low",
    difficulty: "easy",
    estimatedMinutes: 20,
    scheduledDate: todayKey,
    actualMinutes: 18,
    questionsDone: 0,
  });
  await addTask(uid, {
    title: "Vectors — dot & cross product drill",
    category: "jee",
    subjectId: physics.id,
    subjectName: physics.name,
    priority: "med",
    difficulty: "med",
    estimatedMinutes: 30,
    targetQuestions: 15,
    scheduledDate: tomorrowKey,
  });
  await addTask(uid, {
    title: "Equilibrium — ionic equilibrium basics",
    category: "jee",
    subjectId: chemistry.id,
    subjectName: chemistry.name,
    priority: "med",
    difficulty: "med",
    estimatedMinutes: 35,
    targetQuestions: 15,
    scheduledDate: tomorrowKey,
  });
  await saveMorningCheckin(uid, todayKey, [
    "Kinematics relative motion set",
    "Atomic Structure PYQs",
    "Current Electricity problems",
  ]);

  // 6. Focus sessions for the last week → Study Forest + counter history.
  const sessions = [
    { off: -6, min: 50, planned: 50, act: "practice", s: physics, ch: kinetics, q: 20, done: true, mode: "50/10" },
    { off: -5, min: 40, planned: 45, act: "pyq", s: maths, ch: limits, q: 16, done: true, mode: "50/10" },
    { off: -4, min: 45, planned: 50, act: "practice", s: physics, ch: electro, q: 18, done: true, mode: "50/10" },
    { off: -3, min: 60, planned: 60, act: "pyq", s: physics, ch: kinetics, q: 24, done: true, mode: "50/10" },
    { off: -2, min: 25, planned: 25, act: "revision", s: chemistry, ch: atomic, q: 0, done: true, mode: "25/5" },
    { off: -1, min: 30, planned: 50, act: "practice", s: chemistry, ch: bond, q: 12, done: false, mode: "50/10" },
    { off: 0, min: 25, planned: 25, act: "practice", s: physics, ch: electro, q: 10, done: true, mode: "25/5" },
  ] as const;
  for (const s of sessions) {
    const startedAt = addDays(new Date(), s.off);
    await logFocusSession(uid, {
      subjectId: s.s.id,
      subjectName: s.s.name,
      chapterId: s.ch.id,
      chapterName: s.ch.name,
      activity: s.act,
      mode: s.mode,
      plannedMinutes: s.planned,
      focusMinutes: s.min,
      questionsDone: s.q,
      completed: s.done,
      startedAt,
    });
  }

  // 7. Mock tests (with real subject breakdown) → Tests page trend.
  const breakdownBase = (subj: { id: string; name: string }, correct: number, wrong: number) => {
    const unattempted = 20 - correct - wrong;
    return {
      subjectId: subj.id,
      subjectName: subj.name,
      marks: correct * 4 - wrong,
      correct,
      incorrect: wrong,
      unattempted,
      timeMinutes: 45,
    };
  };
  await createMockTest(uid, {
    name: "JEE Main Mock #1",
    examType: "jeeMain",
    date: dayKey(addDays(new Date(), -21)),
    totalMarks: 156,
    maxMarks: 300,
    percentile: 78,
    rank: 245000,
    attempted: 46,
    correct: 30,
    incorrect: 16,
    unattempted: 14,
    timeSpentMinutes: 150,
    marksLostWrong: 16,
    marksLostUnattempted: 14,
    subjectBreakdown: [
      breakdownBase(physics, 12, 5),
      breakdownBase(chemistry, 10, 6),
      breakdownBase(maths, 8, 5),
    ],
  });
  await createMockTest(uid, {
    name: "JEE Main Mock #2",
    examType: "jeeMain",
    date: dayKey(addDays(new Date(), -12)),
    totalMarks: 198,
    maxMarks: 300,
    percentile: 88,
    rank: 120000,
    attempted: 52,
    correct: 35,
    incorrect: 17,
    unattempted: 8,
    timeSpentMinutes: 160,
    marksLostWrong: 17,
    marksLostUnattempted: 8,
    subjectBreakdown: [
      breakdownBase(physics, 14, 5),
      breakdownBase(chemistry, 11, 6),
      breakdownBase(maths, 10, 6),
    ],
  });

  // 8. Error Book entries.
  await createError(uid, {
    subjectId: physics.id,
    subjectName: physics.name,
    chapterId: kinetics.id,
    chapterName: kinetics.name,
    errorType: "concept",
    whyWrong: "Mixed up relative velocity frames — subtracted instead of adding approach speeds.",
    reviewDate: dayKey(addDays(new Date(), 2)),
  });
  await createError(uid, {
    subjectId: chemistry.id,
    subjectName: chemistry.name,
    chapterId: bond.id,
    chapterName: bond.name,
    errorType: "formula",
    whyWrong: "Used wrong hybridisation rule for expanded octets (PCl5).",
    reviewDate: dayKey(addDays(new Date(), 1)),
  });
  await createError(uid, {
    subjectId: maths.id,
    subjectName: maths.name,
    chapterId: limits.id,
    chapterName: limits.name,
    errorType: "calc",
    whyWrong: "L'Hôpital applied twice but botched the derivative of the denominator.",
    reviewDate: dayKey(addDays(new Date(), 1)),
  });
  await createError(uid, {
    subjectId: physics.id,
    subjectName: physics.name,
    chapterId: electro.id,
    chapterName: electro.name,
    errorType: "silly",
    whyWrong: "Swapped unit prefixes — wrote mA for A in the final answer.",
    reviewDate: dayKey(addDays(new Date(), 3)),
  });
  // One resolved entry so the "resolved" filter has a row too.
  const resolvedErr = collection(db, "users", uid, "errors");
  const resolvedRef = doc(resolvedErr);
  await writeBatch(db)
    .set(resolvedRef, {
      subjectId: chemistry.id,
      subjectName: chemistry.name,
      chapterId: atomic.id,
      chapterName: atomic.name,
      errorType: "guessed",
      whyWrong: "Guessed the quantum numbers question instead of applying the rules.",
      reviewDate: dayKey(addDays(new Date(), -3)),
      status: "resolved",
      createdAt: serverTimestamp(),
    })
    .commit();

  // 9. Study notes.
  await createNote(uid, {
    title: "Kinematics — formulas to remember",
    html: "<h3>Kinematics</h3><p><strong>v = u + at</strong>,<br/><strong>s = ut + ½at²</strong>,<br/><strong>v² = u² + 2as</strong>.</p><p>Relative velocity: approach speeds add when moving towards each other.</p>",
    color: "#176B4D",
    pinned: true,
  });
  await createNote(uid, {
    title: "Electrochemistry short notes",
    html: "<h3>Key points</h3><ul><li>Nernst equation</li><li>Standard electrode potentials</li><li>Kohlrausch's law</li></ul>",
    color: "#B97A2B",
    pinned: false,
  });
  await createNote(uid, {
    title: "Limits — common traps",
    html: "<p>Check direct substitution first. Factorise before L'Hôpital when possible.</p>",
    color: "#7A8B3E",
    pinned: false,
  });

  // 10. Backlog inbox (unfinished carry-over candidates).
  const backlogBatch = writeBatch(db);
  backlogBatch.set(doc(collection(db, "users", uid, "backlog")), {
    title: "Rotational Motion — torque & inertia basics",
    subjectId: physics.id,
    chapterId: byChapter("Physics", "Rotational Motion")?.id,
    category: "jee",
    estimatedMinutes: 30,
    priority: "med",
    origin: "unfinishedTask",
    status: "pending",
    createdAt: serverTimestamp(),
  });
  backlogBatch.set(doc(collection(db, "users", uid, "backlog")), {
    title: "Organic Chemistry — GOC & Isomerism PYQs",
    subjectId: chemistry.id,
    category: "pyq",
    estimatedMinutes: 45,
    priority: "high",
    origin: "manual",
    status: "pending",
    createdAt: serverTimestamp(),
  });
  backlogBatch.set(doc(collection(db, "users", uid, "backlog")), {
    title: "Probability — conditional probability drill",
    subjectId: maths.id,
    category: "jee",
    estimatedMinutes: 30,
    priority: "low",
    origin: "manual",
    status: "pending",
    createdAt: serverTimestamp(),
  });
  await backlogBatch.commit();

  // 11. Spaced revisions for the mastered chapter (injects "Revise …" tasks).
  await scheduleSpacedRevisions(uid, atomic);

  // 12. Level/streak/badges that match the seeded history so the Profile
  // achievements + level bar look earned, not arbitrary.
  await setDoc(
    doc(db, "users", uid),
    {
      xp: 540,
      streakCount: 6,
      longestStreak: 9,
      lastActiveDate: todayKey,
      timezone: "Asia/Kolkata",
      pomodoroPrefs: { defaultMode: "50/10", customFocus: 45, customBreak: 10 },
      throughput: {
        [physics.id]: 2.2,
        [chemistry.id]: 2.5,
        [maths.id]: 1.8,
      },
      badges: [
        "first-tree",
        "streak-3",
        "streak-7",
        "first-mock",
        "first-mastery",
        "level-5",
      ],
    },
    { merge: true }
  );
}