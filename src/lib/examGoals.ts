import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { seedSyllabusForExam, removeSyllabusForExam } from "@/lib/syllabusSeed";
import type { ExamGoalDoc, ExamType } from "@/lib/schema";

/** Switches which exam drives the countdown/accent color on Today and the TopBar chip. */
export async function setPrimaryExam(
  uid: string,
  exams: (ExamGoalDoc & { id: string })[],
  newPrimaryId: string
): Promise<void> {
  const newPrimary = exams.find((e) => e.id === newPrimaryId);
  if (!newPrimary || newPrimary.isPrimary) return;

  const batch = writeBatch(db);
  exams.forEach((exam) => {
    if (exam.isPrimary === (exam.id === newPrimaryId)) return;
    batch.update(doc(db, "users", uid, "examGoals", exam.id), {
      isPrimary: exam.id === newPrimaryId,
    });
  });
  batch.set(
    doc(db, "users", uid),
    { primaryExamId: newPrimaryId, stream: newPrimary.examType as ExamType },
    { merge: true }
  );
  await batch.commit();
}

/**
 * Adds a new exam goal from the Profile → Academic setup section. The first
 * goal also becomes the primary stream; its syllabus is seeded in the same
 * flow (idempotent — existing exams won't be re-seeded).
 */
export async function addExamGoal(
  uid: string,
  examType: ExamType,
  name: string,
  examDate: Date
): Promise<void> {
  const goalsRef = collection(db, "users", uid, "examGoals");
  const existing = await getDocs(query(goalsRef, limit(1)));
  const isFirst = existing.empty;
  const ref = await addDoc(goalsRef, {
    name,
    examType,
    examDate: Timestamp.fromDate(examDate),
    isPrimary: isFirst,
    createdAt: serverTimestamp(),
  });
  if (isFirst) {
    await setDoc(
      doc(db, "users", uid),
      { primaryExamId: ref.id, stream: examType },
      { merge: true }
    );
  }
  await seedSyllabusForExam(uid, examType);
}

/** Updates an exam's target date (Profile → Academic setup). */
export async function updateExamDate(uid: string, examId: string, examDate: Date): Promise<void> {
  await updateDoc(doc(db, "users", uid, "examGoals", examId), {
    examDate: Timestamp.fromDate(examDate),
  });
}

/**
 * Removes an exam goal and its seeded syllabus. If the removed exam was the
 * primary, another goal is promoted (or the stream fields are cleared when it
 * was the only one).
 */
export async function removeExamGoal(
  uid: string,
  exams: (ExamGoalDoc & { id: string })[],
  examId: string
): Promise<void> {
  const target = exams.find((e) => e.id === examId);
  const remaining = exams.filter((e) => e.id !== examId);

  const batch = writeBatch(db);
  batch.delete(doc(db, "users", uid, "examGoals", examId));
  if (target?.isPrimary) {
    if (remaining.length > 0) {
      const next = remaining[0];
      batch.update(doc(db, "users", uid, "examGoals", next.id), { isPrimary: true });
      batch.set(
        doc(db, "users", uid),
        { primaryExamId: next.id, stream: next.examType },
        { merge: true }
      );
    } else {
      batch.set(
        doc(db, "users", uid),
        { primaryExamId: deleteField(), stream: deleteField(), activeStudyContext: deleteField() },
        { merge: true }
      );
    }
  }
  await batch.commit();

  if (target) {
    await removeSyllabusForExam(uid, target.examType);
  }
}
