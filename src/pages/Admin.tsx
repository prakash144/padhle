import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  deleteDoc,
  doc,
  endAt,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAt,
} from "firebase/firestore";
import { Download, Eye, Search, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { useAdmin } from "@/lib/hooks";
import { useToast } from "@/lib/useToast";
import type { CounterDoc, UserDoc } from "@/lib/schema";

type UserSummary = {
  id: string;
  doc: UserDoc;
  totals: Partial<CounterDoc>;
};

type Filter = "all" | "attention" | "admins";

/**
 * Read-only admin dashboard: every registered /users doc plus each user's
 * lifetime totals (summed over their `month_*` counter docs so we don't scan
 * hundreds of per-day counters). Only reachable by someone with a doc in the
 * /admins collection (see firestore.rules). Admins can also grant/revoke admin
 * from the console-replaceable /admins collection and open any user's
 * read-only snapshot.
 */
export function Admin() {
  const { user } = useAuth();
  const isAdmin = useAdmin();
  const toast = useToast();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [admins, setAdmins] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [diag, setDiag] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const diagnoseAdmin = async () => {
    if (!user) return;
    setDiag("Checking…");
    try {
      const snap = await getDoc(doc(db, "admins", user.uid));
      if (snap.exists()) {
        setDiag(
          "An /admins doc matches your UID — admin access should be live. Reload the page and the sidebar entry will appear."
        );
      } else {
        setDiag(
          `No document found at /admins/${user.uid}. Create one whose document id is exactly this UID, then re-check.`
        );
      }
    } catch (err) {
      const e = err as { code?: string; message?: string };
      setDiag(
        `Read failed (${e.code ?? "unknown error"}). Usually means firestore.rules isn't published yet — run: firebase deploy --only firestore:rules`
      );
    }
  };

  const reloadAdmins = useCallback(async () => {
    const snap = await getDocs(collection(db, "admins"));
    setAdmins(new Map(snap.docs.map((d) => [d.id, (d.data() as { email?: string }).email ?? ""])));
  }, []);

  const loadData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setLoadError(false);
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const summaries = await Promise.all(
        usersSnap.docs.map(async (userDocSnap) => {
          const totals: Partial<CounterDoc> = {};
          const counterSnap = await getDocs(
            query(
              collection(db, "users", userDocSnap.id, "counters"),
              orderBy("__name__"),
              startAt("month_"),
              endAt("month_\uf8ff")
            )
          );
          counterSnap.docs.forEach((d) => {
            const c = d.data() as CounterDoc;
            for (const key of [
              "plannedTasks",
              "completedTasks",
              "focusMinutes",
              "questionsDone",
              "pyqsDone",
              "revisionsDone",
              "checkinDone",
              "mockCount",
            ] as const) {
              totals[key] = (totals[key] ?? 0) + (c[key] ?? 0);
            }
          });
          return { id: userDocSnap.id, doc: userDocSnap.data() as UserDoc, totals };
        })
      );
      setUsers(summaries);
      await reloadAdmins();
    } catch (err) {
      console.error("Failed to load admin dashboard", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, reloadAdmins]);

  useEffect(() => {
    void loadData();
  }, [loadData, reloadTick]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sevenDaysAgo = recentDateKey();
    const list = users.filter((u) => {
      if (filter === "admins" && !admins.has(u.id)) return false;
      if (filter === "attention") {
        const lastActive = u.doc.lastActiveDate ?? "";
        const attention =
          !u.doc.onboardedAt || (lastActive !== "" && lastActive < sevenDaysAgo) || lastActive === "";
        if (!attention) return false;
      }
      if (q) {
        const name = (u.doc.displayName ?? "").toLowerCase();
        const email = (u.doc.email ?? "").toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }
      return true;
    });
    // Most recently active first.
    return list.sort((a, b) =>
      (b.doc.lastActiveDate ?? "").localeCompare(a.doc.lastActiveDate ?? "")
    );
  }, [users, search, filter, admins]);

  const retryLoad = () => {
    setLoadError(false);
    setReloadTick((t) => t + 1);
  };

  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = [
      "Name",
      "Email",
      "Stream",
      "School",
      "Class",
      "Joined",
      "Onboarded",
      "Focus (h)",
      "Questions",
      "Tasks",
      "Mocks",
      "Streak",
      "Last active",
    ];
    const rows = filteredUsers.map((u) => [
      esc(u.doc.displayName ?? ""),
      esc(u.doc.email ?? ""),
      esc(u.doc.stream ?? ""),
      esc(u.doc.school ?? ""),
      esc(u.doc.grade ?? ""),
      esc(u.doc.createdAt ? dateKey(u.doc.createdAt.toDate()) : ""),
      u.doc.onboardedAt ? "yes" : "no",
      minsToHrs(u.totals.focusMinutes ?? 0),
      String(u.totals.questionsDone ?? 0),
      String(u.totals.completedTasks ?? 0),
      String(u.totals.mockCount ?? 0),
      String(u.doc.streakCount ?? 0),
      u.doc.lastActiveDate ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `padhle-users-${dateKey(new Date())}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="font-display text-xl font-bold">Admin</h1>
        <Card className="p-4">
          <p className="text-sm font-semibold">You don't have admin access yet</p>
          <p className="mt-2 text-xs leading-relaxed text-text-secondary">
            Signed in as <span className="font-medium text-text-primary">{user.email}</span>
            <br />
            Your UID: <code className="break-all text-text-primary">{user.uid}</code>
          </p>
          <div className="mt-3 rounded-lg bg-surface-2 p-3 text-xs leading-relaxed text-text-secondary">
            <p className="font-semibold text-text-primary">How to fix it:</p>
            <ol className="mt-1 list-decimal space-y-1 pl-4">
              <li>
                In the Firebase console open <b>Firestore → admins</b> (create the collection if
                it doesn't exist) and add a document whose <b>document id is exactly the UID
                above</b>.
              </li>
              <li>
                Publish this repo's rules: <code>firebase deploy --only firestore:rules</code> —
                the <code>/admins</code> read rule must be live.
              </li>
              <li>
                Confirm the app points at the same project as the console:{" "}
                <code>VITE_FIREBASE_PROJECT_ID</code> in <code>.env</code>.
              </li>
            </ol>
          </div>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => void diagnoseAdmin()}>
            Re-check admin access
          </Button>
          {diag && <p className="mt-2 text-xs text-text-secondary">{diag}</p>}
        </Card>
      </div>
    );
  }

  const totalUsers = users.length;
  const totalQuestions = users.reduce((sum, u) => sum + (u.totals.questionsDone ?? 0), 0);
  const onboardedUsers = users.filter((u) => !!u.doc.onboardedAt).length;
  const activeWeek = users.filter(
    (u) => u.doc.lastActiveDate && u.doc.lastActiveDate > recentDateKey()
  ).length;

  const toggleAdmin = async (u: UserSummary) => {
    if (busyUid) return;
    setBusyUid(u.id);
    try {
      if (admins.has(u.id)) {
        await deleteDoc(doc(db, "admins", u.id));
        toast.success("Admin access removed.");
      } else {
        await setDoc(doc(db, "admins", u.id), {
          email: u.doc.email ?? u.id,
          grantedAt: serverTimestamp(),
        });
        toast.success(`${u.doc.displayName} is now an admin.`);
      }
      await reloadAdmins();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't update admin access.");
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="font-display text-xl font-bold">Admin</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Registered users" value={String(totalUsers)} />
        <StatCard label="Onboarded" value={`${onboardedUsers}/${totalUsers}`} />
        <StatCard label="Active (7 days)" value={String(activeWeek)} />
        <StatCard label="Questions solved" value={String(totalQuestions)} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            aria-label="Search users"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "attention", label: "Needs attention" },
              { value: "admins", label: "Admins" },
            ]}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={exportCsv}
            disabled={filteredUsers.length === 0}
            aria-label="Download this view as CSV"
          >
            <Download size={14} /> Export CSV
          </Button>
        </div>
      </div>

      {!loading && !loadError && (
        <p className="text-xs text-text-muted">
          Showing {filteredUsers.length} of {users.length} users
        </p>
      )}

      {loading ? (
        <Card className="py-10 text-center text-sm text-text-secondary">Loading users…</Card>
      ) : loadError ? (
        <Card className="py-10 text-center">
          <p className="text-sm text-text-secondary">
            Couldn't load the user list. Check your network and the Firestore rules, then retry.
          </p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={retryLoad}>
            Retry
          </Button>
        </Card>
      ) : filteredUsers.length === 0 ? (
        <Card className="py-10 text-center text-sm text-text-secondary">
          No users match this view.
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
                <th className="px-4 py-2.5">User</th>
                <th className="px-3 py-2.5">Stream</th>
                <th className="px-3 py-2.5 text-right">Focus</th>
                <th className="px-3 py-2.5 text-right">Questions</th>
                <th className="px-3 py-2.5 text-right">Tasks</th>
                <th className="px-3 py-2.5 text-right">Mocks</th>
                <th className="px-3 py-2.5 text-right">Streak</th>
                <th className="px-3 py-2.5">Last active</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <p className="flex items-center gap-1.5 font-medium">
                      {u.doc.displayName}
                      {admins.has(u.id) && (
                        <ShieldCheck size={13} className="shrink-0 text-brand-600" aria-hidden />
                      )}
                    </p>
                    <p className="text-xs text-text-muted">{u.doc.email}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.doc.onboardedAt
                          ? "bg-surface-2 text-text-primary"
                          : "bg-border text-text-muted"
                      }`}
                    >
                      {u.doc.stream ?? "—"}
                    </span>
                    {!u.doc.onboardedAt && (
                      <span className="ml-1 text-xs text-text-muted">not onboarded</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular">
                    {minsToHrs(u.totals.focusMinutes ?? 0)}
                  </td>
                  <td className="px-3 py-3 text-right tabular">
                    {(u.totals.questionsDone ?? 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right tabular">
                    {(u.totals.completedTasks ?? 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right tabular">
                    {(u.totals.mockCount ?? 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right tabular">{u.doc.streakCount ?? 0}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-text-muted">
                    {u.doc.lastActiveDate ?? "—"}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        to={`/parent/${u.id}`}
                        title="View snapshot"
                        aria-label={`View ${u.doc.displayName}'s snapshot`}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-2 text-text-secondary transition-colors duration-micro hover:border-brand-600 hover:text-brand-600"
                      >
                        <Eye size={14} />
                      </Link>
                      <button
                        onClick={() => void toggleAdmin(u)}
                        disabled={busyUid === u.id || u.id === user.uid}
                        title={admins.has(u.id) ? "Remove admin access" : "Grant admin access"}
                        aria-label={`${admins.has(u.id) ? "Revoke" : "Grant"} admin for ${u.doc.displayName}`}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-2 text-text-secondary transition-colors duration-micro hover:border-brand-600 hover:text-brand-600 disabled:opacity-40"
                      >
                        {admins.has(u.id) ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card className="p-4">
        <p className="mb-2 text-sm font-semibold">
          Admins ({admins.size})
        </p>
        {admins.size === 0 ? (
          <p className="text-sm text-text-secondary">
            No other admins. Grant access from any row's shield button.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {[...admins.entries()].map(([id, email]) => (
              <span
                key={id}
                className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1 text-xs"
              >
                {email || id}
                {id === user.uid && <span className="text-text-muted">(you)</span>}
              </span>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-text-secondary">
          Totals are lifetime sums over each user's <code>month_*</code> counters. Granting admin
          writes to the <code>/admins</code> collection in real time; it can also be managed in the
          Firebase console.
        </p>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3 text-center">
      <p className="font-numeric text-xl font-semibold tabular">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </Card>
  );
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function recentDateKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return dateKey(d);
}

function minsToHrs(minutes: number): string {
  const h = minutes / 60;
  return h >= 10 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`;
}
