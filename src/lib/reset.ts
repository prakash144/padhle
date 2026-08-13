/**
 * Account reset flows. Two levels, both reachable from Profile:
 *
 *  - resetOnboarding()  — "Redo setup". Wipes the exam/syllabus choices so
 *    onboarding runs again with a clean slate (picked the wrong stream? chose
 *    JEE instead of NEET?). Study history is untouched.
 *
 *  - deleteAllUserData() — "Delete all my data". Removes every subcollection
 *    and resets gamification, then lets the student re-onboard fresh.
 *
 * Deletes are executed in 500-doc batches so a large history is wiped without
 * hitting Firestore's per-batch limit.
 */
import {
  collection,
  deleteField,
  doc,
  getDocs,
  limit,
  query,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { dayKey } from "@/lib/dates";

const USER_SUBCOLLECTIONS = [
  "tasks",
  "notes",
  "checkins",
  "errors",
  "focusSessions",
  "mockTests",
  "counters",
  "subjects",
  "chapters",
  "sprints",
  "examGoals",
  "backlog",
  "revisions",
  "reports",
  "weeklyFocus",
  "tags",
] as const;

const DELETE_BATCH_SIZE = 500;

async function deleteSubcollection(uid: string, name: string): Promise<void> {
  const ref = collection(db, "users", uid, name);
  // Loop until the collection is empty: each pass deletes up to
  // DELETE_BATCH_SIZE docs, then re-queries for whatever remains.
  for (;;) {
    const snap = await getDocs(query(ref, limit(DELETE_BATCH_SIZE)));
    if (snap.empty) break;
    const batch = writeBatch(db);
    for (const d of snap.docs) batch.delete(d.ref);
    await batch.commit();
  }
}

/** Clears exam/syllabus setup so onboarding can run again. Keeps all study data. */
export async function resetOnboarding(uid: string): Promise<void> {
  const batch = writeBatch(db);
  await deleteSubcollection(uid, "examGoals");
  await deleteSubcollection(uid, "subjects");
  await deleteSubcollection(uid, "chapters");
  batch.update(doc(db, "users", uid), {
    stream: deleteField(),
    primaryExamId: deleteField(),
    academic: deleteField(),
    onboardedAt: deleteField(),
    updatedAt: new Date(),
  });
  await batch.commit();
}

/** Deletes every user subcollection and resets gamification + onboarding fields. */
export async function deleteAllUserData(uid: string): Promise<void> {
  for (const name of USER_SUBCOLLECTIONS) {
    await deleteSubcollection(uid, name);
  }
  const batch = writeBatch(db);
  batch.update(doc(db, "users", uid), {
    stream: deleteField(),
    primaryExamId: deleteField(),
    academic: deleteField(),
    school: deleteField(),
    grade: deleteField(),
    address: deleteField(),
    onboardedAt: deleteField(),
    pomodoroPrefs: { defaultMode: "50/10", customFocus: 45, customBreak: 10 },
    throughput: {},
    xp: 0,
    streakCount: 0,
    longestStreak: 0,
    badges: [],
    lastActiveDate: dayKey(new Date()),
    updatedAt: new Date(),
  });
  await batch.commit();
}
