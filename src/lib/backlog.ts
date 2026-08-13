import { collection, deleteDoc, doc, serverTimestamp, Timestamp, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { bumpCounters } from "@/lib/counters";
import { parseDayKey } from "@/lib/dates";
import type { BacklogDoc, TaskDoc } from "@/lib/schema";

export interface NewBacklogInput {
  title: string;
  subjectId?: string;
  subjectName?: string;
  chapterId?: string;
  chapterName?: string;
  category: BacklogDoc["category"];
  estimatedMinutes?: number;
  priority: BacklogDoc["priority"];
  deadline?: Date;
  origin?: BacklogDoc["origin"];
  sourceTaskId?: string;
}

export async function createBacklogItem(uid: string, input: NewBacklogInput): Promise<void> {
  const ref = doc(collection(db, "users", uid, "backlog"));
  await writeBatch(db)
    .set(ref, {
      title: input.title.trim(),
      subjectId: input.subjectId,
      subjectName: input.subjectName,
      chapterId: input.chapterId,
      chapterName: input.chapterName,
      category: input.category,
      estimatedMinutes: input.estimatedMinutes,
      priority: input.priority,
      deadline: input.deadline ? Timestamp.fromDate(input.deadline) : undefined,
      origin: input.origin ?? "manual",
      sourceTaskId: input.sourceTaskId,
      status: "pending",
      createdAt: serverTimestamp(),
    })
    .commit();
}

/** Carries an unfinished task into the Backlog Inbox instead of leaving it silently overdue. */
export async function moveTaskToBacklog(uid: string, task: TaskDoc & { id: string }): Promise<void> {
  const batch = writeBatch(db);
  const backlogDoc: Omit<BacklogDoc, "createdAt"> = {
    title: task.title,
    subjectId: task.subjectId,
    subjectName: task.subjectName,
    chapterId: task.chapterId,
    chapterName: task.chapterName,
    category: task.category,
    estimatedMinutes: task.estimatedMinutes,
    priority: task.priority,
    deadline: task.deadline,
    origin: "unfinishedTask",
    sourceTaskId: task.id,
    status: "pending",
  };
  batch.set(doc(collection(db, "users", uid, "backlog")), {
    ...backlogDoc,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, "users", uid, "tasks", task.id), { status: "carried" });
  // The task leaves its planned day, so that day's plannedTasks counter must
  // drop too — otherwise scheduleBacklogItem re-counts it on the new day and
  // the task is "planned" twice.
  bumpCounters(batch, uid, parseDayKey(task.scheduledDate), { plannedTasks: -1 });
  await batch.commit();
}

export async function clearBacklogItem(uid: string, backlogId: string): Promise<void> {
  await updateDoc(doc(db, "users", uid, "backlog", backlogId), { status: "cleared" });
}

export async function deleteBacklogItem(uid: string, backlogId: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "backlog", backlogId));
}

/** Turns a backlog item back into a scheduled Planner task. */
export async function scheduleBacklogItem(
  uid: string,
  item: BacklogDoc & { id: string },
  scheduledDate: string
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, "users", uid, "tasks")), {
    title: item.title,
    category: item.category,
    subjectId: item.subjectId,
    subjectName: item.subjectName,
    chapterId: item.chapterId,
    chapterName: item.chapterName,
    priority: item.priority,
    difficulty: "med",
    estimatedMinutes: item.estimatedMinutes ?? 30,
    deadline: item.deadline,
    scheduledDate,
    status: "todo",
    actualMinutes: 0,
    questionsDone: 0,
    source: "adaptive",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, "users", uid, "backlog", item.id), { status: "scheduled" });
  bumpCounters(batch, uid, parseDayKey(scheduledDate), { plannedTasks: 1 });
  await batch.commit();
}
