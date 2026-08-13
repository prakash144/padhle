import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { bumpCounters } from "@/lib/counters";
import { addDays, dayKey, parseDayKey } from "@/lib/dates";
import type { ChapterDoc, RevisionDoc } from "@/lib/schema";

const OFFSETS = [1, 3, 7, 15, 30] as const;

/** Called when a chapter reaches "mastered" — queues the 5 spaced-revision checkpoints. */
export async function scheduleSpacedRevisions(
  uid: string,
  chapter: ChapterDoc & { id: string }
): Promise<void> {
  const batch = writeBatch(db);
  const today = new Date();
  OFFSETS.forEach((offset) => {
    const ref = doc(collection(db, "users", uid, "revisions"));
    const revision: Omit<RevisionDoc, "createdAt"> = {
      chapterId: chapter.id,
      chapterName: chapter.name,
      subjectName: chapter.subjectName,
      offset,
      dueDate: dayKey(addDays(today, offset)),
      status: "pending",
    };
    batch.set(ref, { ...revision, createdAt: serverTimestamp() });
  });
  await batch.commit();
}

/**
 * Materializes any due-and-pending revisions into today's Planner as tasks.
 * Candidate revisions are fetched first, then each one is re-verified as still
 * "pending" *inside* the transaction that writes it — so two tabs racing to
 * inject can't both flip the same docs and create duplicate tasks (Firestore
 * retries the loser against the winner's committed status).
 */
export async function injectDueRevisions(uid: string): Promise<number> {
  const today = dayKey(new Date());
  const candidates = await getDocs(
    query(
      collection(db, "users", uid, "revisions"),
      where("status", "==", "pending"),
      where("dueDate", "<=", today)
    )
  );
  if (candidates.empty) return 0;

  return runTransaction(db, async (tx) => {
    let injected = 0;
    for (const revDoc of candidates.docs) {
      const snap = await tx.get(revDoc.ref);
      const revision = snap.data() as RevisionDoc | undefined;
      if (!revision || revision.status !== "pending") continue;

      const taskRef = doc(collection(db, "users", uid, "tasks"));
      tx.set(taskRef, {
        title: `Revise ${revision.chapterName}`,
        category: "revision",
        subjectName: revision.subjectName,
        chapterId: revision.chapterId,
        chapterName: revision.chapterName,
        priority: "med",
        difficulty: "easy",
        estimatedMinutes: 20,
        scheduledDate: today,
        revisionId: revDoc.id,
        status: "todo",
        actualMinutes: 0,
        questionsDone: 0,
        source: "revision",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      tx.update(revDoc.ref, { status: "injected", taskId: taskRef.id });
      bumpCounters(tx, uid, parseDayKey(today), { plannedTasks: 1 });
      injected++;
    }
    return injected;
  });
}
