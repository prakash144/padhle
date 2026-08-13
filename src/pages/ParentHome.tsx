import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { GraduationCap, Lock, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { friendlyFirstName } from "@/lib/utils";
import type { UserDoc } from "@/lib/schema";

/**
 * Landing page for parents/mentors who sign in with their own account. Lists
 * every student whose `parents` array contains the viewer's email (the same
 * check Firestore rules enforce), each opening a read-only snapshot.
 */
export function ParentHome() {
  const { user } = useAuth();
  const [students, setStudents] = useState<(UserDoc & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const email = user?.email?.toLowerCase();
    if (!email) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    getDocs(query(collection(db, "users"), where("parents", "array-contains", email)))
      .then((snap) => {
        if (cancelled) return;
        setStudents(snap.docs.map((d) => ({ id: d.id, ...(d.data() as UserDoc) })));
      })
      .catch(() => {
        // Permission denied or offline — the card below covers the empty case.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-bg px-4 py-6">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold">Parents &amp; mentors</h1>
            <p className="mt-1 text-sm text-text-secondary">Read-only snapshots of the students who've shared with you.</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-secondary">
            <Lock size={12} /> Read-only
          </span>
        </div>

        {loading ? (
          <Card className="py-10 text-center text-sm text-text-secondary">Loading…</Card>
        ) : students.length === 0 ? (
          <Card className="py-10 text-center">
            <Users size={22} className="mx-auto mb-2 text-text-muted" />
            <p className="text-sm font-medium">No students shared with you yet</p>
            <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-text-secondary">
              A student grants access by adding your email under{" "}
              <span className="font-medium">Profile → Parents &amp; mentors</span>. Once they do,
              their progress appears here automatically.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {students.map((s) => (
              <Link
                key={s.id}
                to={`/parent/${s.id}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors duration-micro hover:border-border-strong hover:bg-surface-2"
              >
                <Avatar src={s.photoURL} name={s.displayName} className="h-10 w-10 text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{friendlyFirstName(s.displayName)}</p>
                  <p className="text-xs text-text-muted">
                    {s.streakCount > 0 ? `${s.streakCount}-day streak` : "No streak yet"} · Last
                    active {s.lastActiveDate ?? "—"}
                  </p>
                </div>
                <GraduationCap size={18} className="shrink-0 text-text-muted" />
              </Link>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-text-secondary">
          Want a student to see your progress instead? Share your link from{" "}
          <Link to="/profile?section=parents" className="text-brand-600 hover:underline">
            your profile
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
