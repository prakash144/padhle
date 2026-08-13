import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Parent/mentor read-only access.
 *
 * The student grants access by adding an email address; the parent's Firestore
 * security rules verify that the signed-in viewer's email is in the student's
 * `parents` array before allowing reads (see FIREBASE_SETUP.md §Remote rules).
 * The app never exposes anything publicly — the share requires the parent to
 * sign in with their own Google account.
 */
export function addParent(uid: string, email: string): Promise<void> {
  const clean = email.trim().toLowerCase();
  if (!clean.includes("@")) throw new Error("invalid-email");
  return updateDoc(doc(db, "users", uid), { parents: arrayUnion(clean) });
}

export function removeParent(uid: string, email: string): Promise<void> {
  return updateDoc(doc(db, "users", uid), { parents: arrayRemove(email.toLowerCase()) });
}

export function isAuthorizedFor(
  viewerEmail: string | null | undefined,
  parents: string[] | undefined
): boolean {
  const email = (viewerEmail ?? "").toLowerCase();
  return !!email && (parents ?? []).includes(email);
}