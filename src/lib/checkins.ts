import { doc, runTransaction, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { bumpCounters } from "@/lib/counters";
import { parseDayKey } from "@/lib/dates";
import type { CheckinDoc } from "@/lib/schema";

/**
 * Saves the morning "top 3 goals" check-in for `date`. The existing-doc read
 * and the counter bump happen in one transaction, so re-saving the same day's
 * check-in (e.g. editing goals) or a double-submit can never double-count
 * `checkinDone` in that day's counter doc.
 */
export async function saveMorningCheckin(uid: string, date: string, top3: string[]): Promise<void> {
  return saveMorningCheckinWithOptions(uid, date, { top3 });
}

export async function saveMorningCheckinWithOptions(
  uid: string,
  date: string,
  input: { top3: string[]; dailyTargetMinutes?: number }
): Promise<void> {
  const ref = doc(db, "users", uid, "checkins", date);

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(ref);
    const alreadyCheckedIn =
      existing.exists() && Array.isArray((existing.data() as CheckinDoc).top3) &&
      (existing.data() as CheckinDoc).top3!.length > 0;

    tx.set(
      ref,
      {
        date,
        top3: input.top3,
        dailyTargetMinutes: input.dailyTargetMinutes,
        completedGoals: 0,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
    if (!alreadyCheckedIn) {
      bumpCounters(tx, uid, parseDayKey(date), { checkinDone: 1 });
    }
  });
}

export async function saveReflection(
  uid: string,
  date: string,
  reflection: string,
  mood?: number
): Promise<void> {
  await writeBatch(db)
    .set(
      doc(db, "users", uid, "checkins", date),
      { reflection, mood, reflectedAt: serverTimestamp() },
      { merge: true }
    )
    .commit();
}
