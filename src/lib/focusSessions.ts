import { collection, doc, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { bumpChapter, bumpCounters, bumpSprint, bumpSubject } from "@/lib/counters";
import { addXp, XP_REWARDS } from "@/lib/gamification";
import { dayKey } from "@/lib/dates";
import type { FocusActivity, FocusSessionDoc, PomodoroMode, TaskDoc } from "@/lib/schema";

export interface LogFocusSessionInput {
  clientSessionId?: string;
  taskId?: string;
  subjectId?: string;
  subjectName?: string;
  chapterId?: string;
  chapterName?: string;
  sprintId?: string;
  activity?: FocusActivity;
  mode: PomodoroMode;
  plannedMinutes: number;
  /** Actual elapsed focus minutes — may be less than plannedMinutes if ended early. */
  focusMinutes: number;
  questionsDone: number;
  completed: boolean;
  startedAt: Date;
}

/**
 * Writes one focusSessions doc and applies the same incremental write-path
 * every surface reads: day/week/month counters + chapter/subject/sprint
 * rollups. A clientSessionId makes the write idempotent, so a double-click or
 * recovered active timer cannot duplicate trees, XP, counters, or sprint work.
 *
 * If linked to a task, the task is marked done in the same transaction, but
 * only completedTasks is bumped for the task. Focus minutes/questions are
 * counted by the session itself to avoid double-counting planned vs actual.
 */
export async function logFocusSession(uid: string, input: LogFocusSessionInput): Promise<boolean> {
  const ref = input.clientSessionId
    ? doc(db, "users", uid, "focusSessions", input.clientSessionId)
    : doc(collection(db, "users", uid, "focusSessions"));
  const focusMinutes = Math.max(0, Math.round(input.focusMinutes));
  const isPyq = input.activity === "pyq";

  const sessionDoc: Omit<FocusSessionDoc, "endedAt"> = {
    taskId: input.taskId,
    subjectId: input.subjectId,
    subjectName: input.subjectName,
    chapterId: input.chapterId,
    chapterName: input.chapterName,
    sprintId: input.sprintId,
    activity: input.activity,
    mode: input.mode,
    plannedMinutes: input.plannedMinutes,
    focusMinutes,
    questionsDone: input.questionsDone,
    startedAt: Timestamp.fromDate(input.startedAt),
    date: dayKey(input.startedAt),
    completed: input.completed,
  };

  return runTransaction(db, async (tx) => {
    const existingSession = await tx.get(ref);
    if (existingSession.exists()) return false;

    let linkedTask: TaskDoc | null = null;
    let taskRef: ReturnType<typeof doc> | null = null;
    if (input.taskId) {
      taskRef = doc(db, "users", uid, "tasks", input.taskId);
      const taskSnap = await tx.get(taskRef);
      linkedTask = taskSnap.exists() ? (taskSnap.data() as TaskDoc) : null;
    }

    tx.set(ref, { ...sessionDoc, endedAt: serverTimestamp() });

    bumpCounters(tx, uid, input.startedAt, {
      focusMinutes,
      questionsDone: input.questionsDone,
      pyqsDone: isPyq ? input.questionsDone : 0,
      revisionsDone: input.activity === "revision" ? 1 : 0,
      completedTasks: linkedTask && linkedTask.status !== "done" ? 1 : 0,
    });

    if (input.subjectId) {
      bumpSubject(tx, uid, input.subjectId, { focusMinutes });
    }
    if (input.chapterId) {
      bumpChapter(tx, uid, input.chapterId, {
        focusMinutes,
        questionsAttempted: input.questionsDone,
        pyqsDone: isPyq ? input.questionsDone : 0,
      });
    }
    if (input.sprintId) {
      bumpSprint(tx, uid, input.sprintId, {
        focusMinutes,
        questions: input.questionsDone,
        pyqs: isPyq ? input.questionsDone : 0,
        mocks: 0,
      });
    }

    if (taskRef && linkedTask) {
      tx.set(
        taskRef,
        {
          status: "done",
          actualMinutes: focusMinutes,
          questionsDone: input.questionsDone,
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    addXp(tx, uid, focusMinutes * XP_REWARDS.focusMinute);
    return true;
  });
}
