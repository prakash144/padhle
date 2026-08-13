import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { UserAddress } from "@/lib/schema";

/**
 * Personal details + avatar management for the Profile page.
 *
 * Avatars are stored as a small compressed JPEG data-URL on /users/{uid}.photoURL
 * (NOT Firebase Storage). A 256px square at quality 0.82 comes out at ~15-40 KB,
 * comfortably inside the 1 MiB Firestore document cap, and it means avatars work
 * in the emulators with zero extra backend setup — the right trade for an app
 * sized for 1-10 students.
 */
export interface ProfileDetails {
  displayName?: string;
  photoURL?: string;
  school?: string;
  grade?: string;
  address?: UserAddress;
}

/** Saves any of the personal fields onto /users/{uid}. Merge-write, so only the touched keys change. */
export async function saveProfileDetails(uid: string, details: ProfileDetails): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (details.displayName !== undefined) patch.displayName = details.displayName;
  if (details.photoURL !== undefined) patch.photoURL = details.photoURL;
  if (details.school !== undefined) patch.school = details.school;
  if (details.grade !== undefined) patch.grade = details.grade;
  if (details.address !== undefined) patch.address = details.address;
  await setDoc(doc(db, "users", uid), { ...patch, updatedAt: new Date() }, { merge: true });
}

export const AVATAR_MAX_DIM = 256;
export const AVATAR_QUALITY = 0.82;

/** Indian states/UTs for the profile address selector. */
export const INDIAN_STATES = [
  "Andaman & Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra & Nagar Haveli and Daman & Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu & Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

/**
 * Downscales and re-encodes an image file to a square JPEG data-URL so it can
 * live on the user doc. Throws on non-image input, decode failure, or files
 * too big to sensibly re-encode (sanity guard: anything over 10 MB).
 */
export function fileToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Not an image file"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      reject(new Error("Image is too large (max 10 MB)"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that image"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Couldn't decode that image"));
      img.onload = () => {
        const size = Math.max(1, Math.min(img.width, img.height, AVATAR_MAX_DIM));
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not available"));
          return;
        }
        // Center-crop to a square, then scale down.
        const srcSize = Math.min(img.width, img.height);
        const sx = (img.width - srcSize) / 2;
        const sy = (img.height - srcSize) / 2;
        ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", AVATAR_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
