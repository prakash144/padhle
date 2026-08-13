import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { bumpCounters, bumpSprint, bumpSubject } from "@/lib/counters";
import { parseDayKey } from "@/lib/dates";
import { addXp, XP_REWARDS } from "@/lib/gamification";
import type { ExamType, MockTestDoc } from "@/lib/schema";

export interface NewMockTestInput {
  name: string;
  examType: ExamType;
  date: string;
  totalMarks: number;
  maxMarks: number;
  percentile?: number;
  rank?: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  timeSpentMinutes: number;
  marksLostWrong: number;
  marksLostUnattempted: number;
  sprintId?: string;
  subjectBreakdown: MockTestDoc["subjectBreakdown"];
}

export async function createMockTest(uid: string, input: NewMockTestInput): Promise<void> {
  const batch = writeBatch(db);
  const ref = doc(collection(db, "users", uid, "mockTests"));
  const accuracy = input.attempted > 0 ? Math.round((input.correct / input.attempted) * 100) : 0;

  const mockTest: Omit<MockTestDoc, "createdAt"> = {
    name: input.name,
    examType: input.examType,
    date: input.date,
    totalMarks: input.totalMarks,
    maxMarks: input.maxMarks,
    percentile: input.percentile,
    rank: input.rank,
    attempted: input.attempted,
    correct: input.correct,
    incorrect: input.incorrect,
    unattempted: input.unattempted,
    accuracy,
    timeSpentMinutes: input.timeSpentMinutes,
    marksLostWrong: input.marksLostWrong,
    marksLostUnattempted: input.marksLostUnattempted,
    sprintId: input.sprintId,
    subjectBreakdown: input.subjectBreakdown,
  };
  batch.set(ref, { ...mockTest, createdAt: serverTimestamp() });

  bumpCounters(batch, uid, parseDayKey(input.date), { mockCount: 1 });
  for (const row of input.subjectBreakdown) {
    const attempted = row.correct + row.incorrect;
    if (attempted <= 0) continue;
    bumpSubject(batch, uid, row.subjectId, {
      accuracyNum: row.correct,
      accuracyDen: attempted,
    });
  }
  if (input.sprintId) {
    bumpSprint(batch, uid, input.sprintId, { mocks: 1 });
  }
  addXp(batch, uid, XP_REWARDS.mockLogged);

  await batch.commit();
}
