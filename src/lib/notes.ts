import { collection, deleteDoc, deleteField, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { noteExcerpt, sanitizeRichHtml } from "@/lib/sanitize";
import type { NoteDoc } from "@/lib/schema";

export const NOTE_COLORS = [
  "#176B4D", // forest
  "#2E8B6A", // teal-green
  "#7A8B3E", // olive
  "#B97A2B", // ochre
  "#B4563F", // clay
  "#4A6B8A", // slate
] as const;

export interface NewNoteInput {
  title?: string;
  html?: string;
  color?: string;
  pinned?: boolean;
  subjectId?: string;
  subjectName?: string;
  chapterId?: string;
  chapterName?: string;
  tags?: string[];
}

type NotePatch = Partial<Pick<NoteDoc, "title" | "html" | "color" | "pinned" | "tags" | "subjectId" | "subjectName" | "chapterId" | "chapterName">>;

export async function createNote(uid: string, input: NewNoteInput): Promise<string> {
  const ref = doc(collection(db, "users", uid, "notes"));
  const note: Record<string, unknown> = {
    title: input.title?.trim() || "Untitled note",
    html: sanitizeRichHtml(input.html ?? ""),
    color: input.color ?? NOTE_COLORS[0],
    pinned: input.pinned ?? false,
    tags: input.tags ?? [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.subjectId) note.subjectId = input.subjectId;
  if (input.subjectName) note.subjectName = input.subjectName;
  if (input.chapterId) note.chapterId = input.chapterId;
  if (input.chapterName) note.chapterName = input.chapterName;
  await setDoc(ref, note);
  return ref.id;
}

export async function updateNote(
  uid: string,
  noteId: string,
  patch: NotePatch
): Promise<void> {
  const next: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.title !== undefined) next.title = patch.title.trim() || "Untitled note";
  if (patch.html !== undefined) next.html = sanitizeRichHtml(patch.html);
  if (patch.color !== undefined) next.color = patch.color;
  if (patch.pinned !== undefined) next.pinned = patch.pinned;
  if (patch.tags !== undefined) next.tags = patch.tags;
  if (patch.subjectId !== undefined) next.subjectId = patch.subjectId || deleteField();
  if (patch.subjectName !== undefined) next.subjectName = patch.subjectName || deleteField();
  if (patch.chapterId !== undefined) next.chapterId = patch.chapterId || deleteField();
  if (patch.chapterName !== undefined) next.chapterName = patch.chapterName || deleteField();
  await updateDoc(doc(db, "users", uid, "notes", noteId), next);
}

export async function deleteNote(uid: string, noteId: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "notes", noteId));
}

export async function toggleNotePin(uid: string, noteId: string, pinned: boolean): Promise<void> {
  await updateDoc(doc(db, "users", uid, "notes", noteId), {
    pinned,
    updatedAt: serverTimestamp(),
  });
}

export { noteExcerpt, sanitizeRichHtml };

/** Formats a Firestore timestamp-ish value as a short relative label. */
export function timeAgo(ts: unknown): string {
  if (!ts || typeof ts !== "object" || !("toDate" in ts)) return "";
  const then = (ts as { toDate: () => Date }).toDate().getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return (ts as { toDate: () => Date }).toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export type { NoteDoc };
