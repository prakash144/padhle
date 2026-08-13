import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ExamType, SubjectDoc, UserDoc } from "@/lib/schema";

/** Calm forest-family ramp so new subjects stay visually cohesive with the seed set. */
const SUBJECT_COLORS = ["#27834A", "#3A9D5D", "#63D471", "#C99618", "#2F7D4A", "#F0A94B", "#7A8A80"];

/** Resolves the user's exam stream, falling back to class10 for safety. */
async function userExamType(uid: string): Promise<ExamType> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const data = snap.data() as Partial<UserDoc> | undefined;
    if (data?.stream) return data.stream;
  } catch {
    // unreadable profile — fall through to the default
  }
  return "class10";
}

/** Appends a fresh, empty subject to the user's syllabus (no chapters yet). */
export async function addSubject(uid: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;

  const examType = await userExamType(uid);
  const subjectsRef = collection(db, "users", uid, "subjects");
  const existing = await getDocs(query(subjectsRef));

  const subjectDoc: SubjectDoc = {
    name: trimmed,
    examType,
    color: SUBJECT_COLORS[existing.size % SUBJECT_COLORS.length],
    order: existing.size,
    chapterCount: 0,
    masteredCount: 0,
    accuracyNum: 0,
    accuracyDen: 0,
    focusMinutes: 0,
  };
  await addDoc(subjectsRef, subjectDoc);
}

/** Renames a subject in place (chapter rows reference it by subjectId, so nothing else moves). */
export async function renameSubject(uid: string, subjectId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  await updateDoc(doc(db, "users", uid, "subjects", subjectId), { name: trimmed });
}

/** Deletes a subject and every chapter that belongs to it. */
export async function deleteSubject(uid: string, subjectId: string): Promise<void> {
  const chapterSnap = await getDocs(
    query(collection(db, "users", uid, "chapters"), where("subjectId", "==", subjectId))
  );
  const batch = writeBatch(db);
  for (const c of chapterSnap.docs) batch.delete(c.ref);
  batch.delete(doc(db, "users", uid, "subjects", subjectId));
  await batch.commit();
}
