import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { bumpChapter, bumpCounters, bumpSprint, bumpSubject } from "@/lib/counters";
import { parseDayKey } from "@/lib/dates";
import { addXp, XP_REWARDS } from "@/lib/gamification";
import type { TaskDoc } from "@/lib/schema";

export interface NewTaskInput {
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
  deadline?: Date;
  scheduledDate: string;
  sprintId?: string;
}

export async function createTask(uid: string, input: NewTaskInput): Promise<void> {
  const ref = doc(collection(db, "users", uid, "tasks"));
  const batch = writeBatch(db);
  const task: Omit<TaskDoc, "completedAt"> = {
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
    deadline: input.deadline ? Timestamp.fromDate(input.deadline) : undefined,
    scheduledDate: input.scheduledDate,
    sprintId: input.sprintId,
    status: "todo",
    actualMinutes: 0,
    questionsDone: 0,
    source: "manual",
    createdAt: serverTimestamp() as unknown as Timestamp,
    updatedAt: serverTimestamp() as unknown as Timestamp,
  };
  batch.set(ref, task);
  bumpCounters(batch, uid, parseDayKey(input.scheduledDate), { plannedTasks: 1 });
  await batch.commit();
}

/** Moves a task to a new day, keeping the plannedTasks counter accurate for both dates. */
export async function rescheduleTask(
  uid: string,
  task: TaskDoc & { id: string },
  newDate: string
): Promise<void> {
  if (newDate === task.scheduledDate) return;
  const batch = writeBatch(db);
  batch.update(doc(db, "users", uid, "tasks", task.id), {
    scheduledDate: newDate,
    status: "todo",
    updatedAt: serverTimestamp(),
  });
  bumpCounters(batch, uid, parseDayKey(task.scheduledDate), { plannedTasks: -1 });
  bumpCounters(batch, uid, parseDayKey(newDate), { plannedTasks: 1 });
  await batch.commit();
}

/** Marks a task as intentionally abandoned (distinct from deleting it — keeps history). */
export async function dropTask(uid: string, task: TaskDoc & { id: string }): Promise<void> {
  await writeBatch(db)
    .update(doc(db, "users", uid, "tasks", task.id), { status: "dropped", updatedAt: serverTimestamp() })
    .commit();
}

/** Moves a task between board columns (kanban) without touching counters. */
export async function setTaskStatus(
  uid: string,
  taskId: string,
  status: "todo" | "in_progress" | "done"
): Promise<void> {
  await updateDoc(doc(db, "users", uid, "tasks", taskId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTask(uid: string, task: TaskDoc & { id: string }): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, "users", uid, "tasks", task.id));
  // A deleted task was never "completed" from the counters' point of view
  // unless it already was, in which case those counters must unwind too —
  // otherwise the day keeps a completedTask/minute/question with no task behind it.
  if (task.status === "done") {
    const actualMinutes = task.actualMinutes;
    const questionsDone = task.questionsDone;
    bumpCounters(batch, uid, parseDayKey(task.scheduledDate), {
      completedTasks: -1,
      focusMinutes: -actualMinutes,
      questionsDone: -questionsDone,
      pyqsDone: task.category === "pyq" ? -questionsDone : 0,
      revisionsDone: task.category === "revision" ? -1 : 0,
    });
    if (task.subjectId) {
      bumpSubject(batch, uid, task.subjectId, { focusMinutes: -actualMinutes });
    }
    if (task.chapterId) {
      bumpChapter(batch, uid, task.chapterId, {
        focusMinutes: -actualMinutes,
        questionsAttempted: -questionsDone,
        pyqsDone: task.category === "pyq" ? -questionsDone : 0,
      });
    }
    if (task.sprintId) {
      bumpSprint(batch, uid, task.sprintId, {
        focusMinutes: -actualMinutes,
        questions: -questionsDone,
        pyqs: task.category === "pyq" ? -questionsDone : 0,
        mocks: task.category === "mock" ? -1 : 0,
      });
    }
  } else {
    bumpCounters(batch, uid, parseDayKey(task.scheduledDate), { plannedTasks: -1 });
  }
  await batch.commit();
}

/**
 * Marks a task done/undone and applies the single incremental write-path
 * every dashboard depends on: day/week/month counters, plus the linked
 * chapter/subject rollups. `questionsDone`/`actualMinutes` are only counted
 * on completion (not on every edit) to keep the counters exactly matching
 * "what got done".
 *
 * Runs in a transaction that reads the task's *current* status first, so a
 * stale toggle (double-check from a cached tab, or an un-check fired on an
 * already-todo task) is a no-op instead of double-counting or driving the
 * day's counters negative.
 */
export async function setTaskDone(
  uid: string,
  task: TaskDoc & { id: string },
  done: boolean,
  result?: { actualMinutes?: number; questionsDone?: number }
): Promise<void> {
  const ref = doc(db, "users", uid, "tasks", task.id);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? (snap.data() as TaskDoc) : null;
    if (current === null) throw new Error("Task not found");

    const alreadyDone = current.status === "done";
    // Stale or redundant toggle — skip without corrupting counters.
    if (alreadyDone === done) return;

    const actualMinutes = done ? (result?.actualMinutes ?? task.estimatedMinutes) : 0;
    const questionsDone = done ? (result?.questionsDone ?? task.targetQuestions ?? 0) : 0;
    const sign = done ? 1 : -1;

    tx.set(
      ref,
      {
        status: done ? "done" : "todo",
        actualMinutes,
        questionsDone,
        completedAt: done ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    const date = parseDayKey(task.scheduledDate);
    bumpCounters(tx, uid, date, {
      completedTasks: sign,
      focusMinutes: sign * actualMinutes,
      questionsDone: sign * questionsDone,
      pyqsDone: task.category === "pyq" ? sign * questionsDone : 0,
      revisionsDone: task.category === "revision" ? sign : 0,
    });

    if (task.subjectId) {
      bumpSubject(tx, uid, task.subjectId, { focusMinutes: sign * actualMinutes });
    }
    if (task.chapterId) {
      bumpChapter(tx, uid, task.chapterId, {
        focusMinutes: sign * actualMinutes,
        questionsAttempted: sign * questionsDone,
        pyqsDone: task.category === "pyq" ? sign * questionsDone : 0,
      });
    }
    if (task.sprintId) {
      bumpSprint(tx, uid, task.sprintId, {
        focusMinutes: sign * actualMinutes,
        questions: sign * questionsDone,
        pyqs: task.category === "pyq" ? sign * questionsDone : 0,
        mocks: task.category === "mock" ? sign : 0,
      });
    }

    // XP is only ever awarded, never clawed back on un-checking a task — losing
    // points for changing your mind feels punitive and is exactly the kind of
    // friction that makes students distrust a "gamified" app.
    if (done) {
      addXp(tx, uid, XP_REWARDS.taskComplete);
    }
  });
}
