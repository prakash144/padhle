/**
 * Custom tags — a user-managed vocabulary for organizing notes. Tags are
 * referenced from notes by tag id, so renaming a tag never rewrites notes;
 * deleting a tag strips it from every note that used it.
 */
import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { TagDoc } from "@/lib/schema";

export function useTags(): (TagDoc & { id: string })[] {
  const { user } = useAuth();
  const [tags, setTags] = useState<(TagDoc & { id: string })[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "tags"));
    return onSnapshot(q, (snap) => {
      setTags(snap.docs.map((d) => ({ id: d.id, ...(d.data() as TagDoc) })));
    });
  }, [user]);

  return tags;
}

export async function addTag(uid: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const existing = await getDocs(query(collection(db, "users", uid, "tags")));
  const taken = new Set(existing.docs.map((d) => (d.data() as TagDoc).name.toLowerCase()));
  if (taken.has(trimmed.toLowerCase())) return; // case-insensitive dedupe
  await addDoc(collection(db, "users", uid, "tags"), {
    name: trimmed,
    createdAt: serverTimestamp(),
  });
}

export async function renameTag(uid: string, tagId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  await updateDoc(doc(db, "users", uid, "tags", tagId), { name: trimmed });
}

/** Deletes the tag and removes it from every note that references it. */
export async function deleteTag(uid: string, tagId: string): Promise<void> {
  const noteSnap = await getDocs(
    query(collection(db, "users", uid, "notes"), where("tags", "array-contains", tagId))
  );
  const batch = writeBatch(db);
  for (const n of noteSnap.docs) {
    const tags = ((n.data() as { tags?: string[] }).tags ?? []).filter((t) => t !== tagId);
    batch.update(n.ref, { tags });
  }
  batch.delete(doc(db, "users", uid, "tags", tagId));
  await batch.commit();
}
