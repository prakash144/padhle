import {
  collection,
  doc,
  increment,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addXp, XP_REWARDS } from "@/lib/gamification";
import { scheduleSpacedRevisions } from "@/lib/revisions";
import type { ChapterDoc, MasteryStage, SubjectDoc } from "@/lib/schema";

export const MASTERY_STAGES: MasteryStage[] = [
  "not_started",
  "learning",
  "practicing",
  "pyq",
  "revised",
  "mastered",
];

export const MASTERY_LABEL: Record<MasteryStage, string> = {
  not_started: "Not started",
  learning: "Learning",
  practicing: "Practicing",
  pyq: "PYQs",
  revised: "Revised",
  mastered: "Mastered",
};

export function nextMasteryStage(current: MasteryStage): MasteryStage {
  const i = MASTERY_STAGES.indexOf(current);
  return MASTERY_STAGES[Math.min(i + 1, MASTERY_STAGES.length - 1)];
}

/**
 * Advances (or resets) a chapter's mastery stage. Reaching "mastered"
 * increments the parent subject's masteredCount so Syllabus summary headers
 * ("62% mastered") stay O(1) reads — see subjects.masteredCount in schema.ts.
 * Spaced-revision scheduling (+1/3/7/15/30 days) hooks into this same
 * transition in Phase 5.
 */
export async function setChapterMastery(
  uid: string,
  chapter: ChapterDoc & { id: string },
  stage: MasteryStage
): Promise<void> {
  const batch = writeBatch(db);
  const wasMastered = chapter.masteryStage === "mastered";
  const isMastered = stage === "mastered";

  batch.set(
    doc(db, "users", uid, "chapters", chapter.id),
    {
      masteryStage: stage,
      stageEnteredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  if (wasMastered !== isMastered) {
    batch.set(
      doc(db, "users", uid, "subjects", chapter.subjectId),
      { masteredCount: increment(isMastered ? 1 : -1) },
      { merge: true }
    );
    if (isMastered) {
      addXp(batch, uid, XP_REWARDS.chapterMastered);
    }
  }

  await batch.commit();

  // Outside the batch since it's a separate write-set (its own doc creates);
  // only fires the moment a chapter first reaches Mastered.
  if (isMastered && !wasMastered) {
    await scheduleSpacedRevisions(uid, chapter);
  }
}

/**
 * Adds a fresh, untouched chapter (topic) under a subject. Keeps the subject's
 * chapterCount in sync in the same batch so Syllabus summary headers stay O(1).
 */
export async function addChapter(
  uid: string,
  subject: SubjectDoc & { id: string },
  name: string
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;

  const chapterRef = doc(collection(db, "users", uid, "chapters"));
  const batch = writeBatch(db);
  batch.set(chapterRef, {
    subjectId: subject.id,
    subjectName: subject.name,
    name: trimmed,
    examType: subject.examType,
    masteryStage: "not_started",
    stageEnteredAt: serverTimestamp(),
    accuracyNum: 0,
    accuracyDen: 0,
    questionsAttempted: 0,
    pyqsDone: 0,
    focusMinutes: 0,
    revisionSchedule: [],
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, "users", uid, "subjects", subject.id), {
    chapterCount: increment(1),
  });
  await batch.commit();
}

/** Renames a chapter in place — its study history, mastery and revisions stay intact. */
export async function renameChapter(uid: string, chapterId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  await updateDoc(doc(db, "users", uid, "chapters", chapterId), {
    name: trimmed,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Deletes a chapter and decrements the parent subject's counters (chapterCount,
 * and masteredCount if the chapter had been mastered). Linked study artifacts
 * (tasks, errors, notes) reference it by id but still render by name, so they
 * degrade gracefully rather than breaking.
 */
export async function deleteChapter(uid: string, chapter: ChapterDoc & { id: string }): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, "users", uid, "chapters", chapter.id));
  batch.update(doc(db, "users", uid, "subjects", chapter.subjectId), {
    chapterCount: increment(-1),
    ...(chapter.masteryStage === "mastered" ? { masteredCount: increment(-1) } : {}),
  });
  await batch.commit();
}
