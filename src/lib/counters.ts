/**
 * The incremental-counter write path. Every screen that shows an aggregate
 * number (Today's stats, Sprint progress, weekly/monthly Reports, Focus
 * Score) reads the counters/reports docs written here — never scan tasks,
 * sessions, or mocks to compute a displayed number.
 *
 * All deltas are applied with increment(), inside the caller's batch/
 * transaction, so offline-queued writes merge correctly instead of
 * clobbering concurrent updates.
 */
import { doc, increment } from "firebase/firestore";
import type { DocumentData, DocumentReference } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { counterBucketIds } from "@/lib/dates";
import type { CounterDoc } from "@/lib/schema";

/**
 * Firestore's Transaction and WriteBatch both expose set()/update()/delete().
 * Accepting either lets read-modify-write flows (which need atomicity) use a
 * transaction while simple multi-doc writes keep using a batch.
 */
export type CounterBatch = {
  set(
    ref: DocumentReference<DocumentData>,
    data: Record<string, unknown>,
    options?: { merge?: boolean }
  ): unknown;
};

export type CounterDelta = Partial<Record<keyof CounterDoc, number>>;

/**
 * Queues increment() writes on the day/week/month counter docs for `date`.
 * Safe to call multiple times in one batch for different deltas — Firestore
 * merges repeated increment() calls on the same batch/doc correctly only if
 * you accumulate them yourself first, so callers should pass one delta object
 * per bucket per batch.
 */
export function bumpCounters(batch: CounterBatch, uid: string, date: Date, delta: CounterDelta) {
  const buckets = counterBucketIds(date);
  const fields = Object.fromEntries(
    Object.entries(delta).map(([key, value]) => [key, increment(value ?? 0)])
  );
  for (const bucketId of [buckets.day, buckets.week, buckets.month]) {
    batch.set(doc(db, "users", uid, "counters", bucketId), fields, { merge: true });
  }
}

export function bumpSubject(
  batch: CounterBatch,
  uid: string,
  subjectId: string,
  delta: { focusMinutes?: number; accuracyNum?: number; accuracyDen?: number }
) {
  const fields = Object.fromEntries(
    Object.entries(delta).map(([key, value]) => [key, increment(value ?? 0)])
  );
  batch.set(doc(db, "users", uid, "subjects", subjectId), fields, { merge: true });
}

export function bumpChapter(
  batch: CounterBatch,
  uid: string,
  chapterId: string,
  delta: {
    focusMinutes?: number;
    questionsAttempted?: number;
    pyqsDone?: number;
    accuracyNum?: number;
    accuracyDen?: number;
  }
) {
  const fields = Object.fromEntries(
    Object.entries(delta).map(([key, value]) => [key, increment(value ?? 0)])
  );
  batch.set(doc(db, "users", uid, "chapters", chapterId), fields, { merge: true });
}

export function bumpSprint(
  batch: CounterBatch,
  uid: string,
  sprintId: string,
  delta: { questions?: number; pyqs?: number; mocks?: number; focusMinutes?: number }
) {
  const fields = Object.fromEntries(
    Object.entries(delta).map(([key, value]) => [`progress.${key}`, increment(value ?? 0)])
  );
  batch.set(doc(db, "users", uid, "sprints", sprintId), fields, { merge: true });
}
