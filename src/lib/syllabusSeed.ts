import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SYLLABUS_BY_EXAM } from "@/data/syllabus";
import type { ExamType } from "@/lib/schema";

/**
 * Seeds the subjects for an exam from the bundled static dataset. Chapters /
 * topics are intentionally NOT auto-created — students pick their own chapters
 * from the Syllabus page so the data matches their actual course. Idempotent:
 * a no-op if this exam's subjects already exist, so it's safe to call again
 * (e.g. a student re-running onboarding, or adding a second exam later)
 * without duplicating the syllabus.
 */
export async function seedSyllabusForExam(uid: string, examType: ExamType): Promise<void> {
  const subjectsRef = collection(db, "users", uid, "subjects");
  const existing = await getDocs(query(subjectsRef, where("examType", "==", examType), limit(1)));
  if (!existing.empty) return;

  const dataset = SYLLABUS_BY_EXAM[examType];
  const batch = writeBatch(db);

  dataset.forEach((subject, subjectOrder) => {
    const subjectRef = doc(subjectsRef);
    batch.set(subjectRef, {
      name: subject.name,
      examType,
      color: subject.color,
      order: subjectOrder,
      chapterCount: 0,
      masteredCount: 0,
      accuracyNum: 0,
      accuracyDen: 0,
      focusMinutes: 0,
    });
  });

  await batch.commit();
}

export async function seedSyllabusForExams(uid: string, examTypes: ExamType[]): Promise<void> {
  // Sequential, not parallel: keeps each seed's existence-check + batch
  // atomic per exam and avoids racing duplicate subject creation when two
  // exams share the same dataset (jeeMain + jeeAdvanced).
  for (const examType of examTypes) {
    await seedSyllabusForExam(uid, examType);
  }
}

/**
 * Deletes every subject + chapter seeded for an exam type. Used when a
 * student removes an exam goal from Profile → Academic setup, so the syllabus
 * stays in sync with the goals list (the header context is built from goals).
 */
export async function removeSyllabusForExam(uid: string, examType: ExamType): Promise<void> {
  const subjectSnap = await getDocs(
    query(collection(db, "users", uid, "subjects"), where("examType", "==", examType))
  );
  const chapterSnap = await getDocs(
    query(collection(db, "users", uid, "chapters"), where("examType", "==", examType))
  );
  const all = [...subjectSnap.docs, ...chapterSnap.docs];
  if (all.length === 0) return;

  // Firestore batches cap at 500 writes; chunk if a large syllabus ever grows past that.
  for (let i = 0; i < all.length; i += 400) {
    const chunk = all.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const d of chunk) batch.delete(d.ref);
    await batch.commit();
  }
}
