import { writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { bumpChapter, bumpSubject } from "@/lib/counters";

export interface DrillAccuracyInput {
  subjectId?: string;
  chapterId?: string;
  /** Total questions attempted during the drill. */
  questionsAttempted: number;
  /** How many of those were correct. */
  correct: number;
}

/**
 * Records a practice-drill result into the chapter/subject accuracy rolls.
 * Accuracy feeds the Syllabus "Weak" filter (accuracy < 60%) and the mastery
 * progression, so practising a chapter moves the whole loop: practice →
 * accuracy → weak detection → review.
 */
export async function recordDrillAccuracy(uid: string, input: DrillAccuracyInput): Promise<void> {
  const correct = Math.max(0, Math.min(input.correct, input.questionsAttempted));
  const batch = writeBatch(db);
  if (input.chapterId) {
    bumpChapter(batch, uid, input.chapterId, {
      accuracyNum: correct,
      accuracyDen: input.questionsAttempted,
    });
  }
  if (input.subjectId) {
    bumpSubject(batch, uid, input.subjectId, {
      accuracyNum: correct,
      accuracyDen: input.questionsAttempted,
    });
  }
  await batch.commit();
}
