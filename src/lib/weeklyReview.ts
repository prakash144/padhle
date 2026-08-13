/**
 * Weekly review helpers. The review is a light ritual: look back at the week,
 * carry over anything undone, and set a few focus areas for the week ahead.
 * Completing the review pays a small XP reward.
 */
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { weekKey } from "@/lib/dates";
import { XP_REWARDS, addXp } from "@/lib/gamification";
import { rescheduleTask } from "@/lib/tasks";
import type { TaskDoc } from "@/lib/schema";

export function saveWeeklyFocus(uid: string, areas: string[]): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, "users", uid, "weeklyFocus", weekKey(new Date())), {
    areas: areas.filter((a) => a.trim() !== "").slice(0, 3),
    createdAt: serverTimestamp(),
  });
  addXp(batch, uid, XP_REWARDS.weeklyReview);
  return batch.commit();
}

/** Moves a list of unfinished tasks to `targetKey` (weekly carry-over). */
export async function carryOverTasks(
  uid: string,
  tasks: (TaskDoc & { id: string })[],
  targetKey: string
): Promise<void> {
  for (const task of tasks) {
    if (task.scheduledDate !== targetKey) {
      await rescheduleTask(uid, task, targetKey);
    }
  }
}
