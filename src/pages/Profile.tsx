import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, Bell, Camera, Copy, GraduationCap, Loader2, LogOut, MapPin, Palette, Plus, RotateCcw, Save, School, SlidersHorizontal, Trash2, Trees, Trophy, UserPlus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";
import { Avatar } from "@/components/Avatar";
import { LevelBadge } from "@/components/LevelBadge";
import { StreakFlame } from "@/components/StreakFlame";
import { AchievementsGrid } from "@/components/AchievementsGrid";
import { ForestStrip } from "@/components/ForestStrip";
import { useAuth } from "@/contexts/AuthContext";
import { useFocusSessions, useLastNDaysCounter } from "@/lib/hooks";
import { db, signOutUser } from "@/lib/firebase";
import { daysBetween } from "@/lib/dates";
import { useAppearance, PALETTES, type Appearance } from "@/lib/appearance";
import { DEFAULT_FEATURES, FEATURE_META, saveAppearancePref, saveFeaturePrefs } from "@/lib/preferences";
import { useFeatures } from "@/lib/useFeatures";
import { useToast } from "@/lib/useToast";
import { useReminder } from "@/lib/useReminder";
import { addParent, removeParent } from "@/lib/share";
import { addExamGoal, removeExamGoal, updateExamDate } from "@/lib/examGoals";
import { INDIAN_STATES, fileToAvatarDataUrl, saveProfileDetails } from "@/lib/profile";
import { ACADEMIC_CONTEXTS } from "@/lib/academicContext";
import { deleteAllUserData, resetOnboarding } from "@/lib/reset";
import { cn, friendlyFirstName } from "@/lib/utils";
import type { ExamGoalDoc, ExamType, FeatureKey } from "@/lib/schema";

const EXAM_LABEL: Record<string, string> = {
  class10: "Class 10 Boards",
  class12: "Class 12 Boards",
  jeeMain: "JEE Main",
  jeeAdvanced: "JEE Advanced",
  neet: "NEET",
};

export function Profile() {
  const { user, userDoc } = useAuth();
  const navigate = useNavigate();
  const sessions = useFocusSessions(100);
  const last30 = useLastNDaysCounter(30);
  const [exams, setExams] = useState<(ExamGoalDoc & { id: string })[]>([]);
  const { mode, palette, isDark, setMode, setPalette } = useAppearance();
  const [profileName, setProfileName] = useState(userDoc?.displayName ?? "");
  const [school, setSchool] = useState(userDoc?.school ?? "");
  const [grade, setGrade] = useState(userDoc?.grade ?? "");
  const [addressLine, setAddressLine] = useState(userDoc?.address?.line ?? "");
  const [addressCity, setAddressCity] = useState(userDoc?.address?.city ?? "");
  const [addressState, setAddressState] = useState(userDoc?.address?.state ?? "");
  const [photoURL, setPhotoURL] = useState(userDoc?.photoURL ?? user?.photoURL ?? "");
  const [savingDetails, setSavingDetails] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const seededRef = useRef<string | null>(null);
  const resolvedFeatures = useFeatures();
  const [features, setFeatures] = useState<Record<FeatureKey, boolean>>(DEFAULT_FEATURES);
  const [savingPref, setSavingPref] = useState(false);
  const toast = useToast();
  const reminder = useReminder();
  const [parentEmail, setParentEmail] = useState("");
  const [savingParent, setSavingParent] = useState(false);
  const [resetAction, setResetAction] = useState<"redo" | "delete" | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const [resetting, setResetting] = useState(false);
  const [addingExam, setAddingExam] = useState(false);
  const [newExamType, setNewExamType] = useState("");
  const [newExamDate, setNewExamDate] = useState("");
  const [savingExam, setSavingExam] = useState(false);
  const [busyExamId, setBusyExamId] = useState<string | null>(null);
  const [deletingExam, setDeletingExam] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  // Deep-link from the header avatar menu: Profile / Academic setup /
  // Preferences / Parents & mentors / Settings each scroll to their card.
  useEffect(() => {
    const section = searchParams.get("section");
    if (!section) return;
    const el = document.getElementById(`profile-${section}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.setAttribute("data-flash", "true");
    const timer = window.setTimeout(() => el.removeAttribute("data-flash"), 1600);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  // Seed the personal-details form once per signed-in account (the doc usually
  // arrives after first paint, and re-seeding on every userDoc change would
  // clobber in-progress edits — e.g. after gamification writes touch the doc).
  useEffect(() => {
    if (!user || !userDoc) return;
    if (seededRef.current === user.uid) return;
    seededRef.current = user.uid;
    setProfileName(userDoc.displayName ?? "");
    setSchool(userDoc.school ?? "");
    setGrade(userDoc.grade ?? "");
    setAddressLine(userDoc.address?.line ?? "");
    setAddressCity(userDoc.address?.city ?? "");
    setAddressState(userDoc.address?.state ?? "");
    setPhotoURL(userDoc.photoURL ?? user.photoURL ?? "");
  }, [user, userDoc]);

  useEffect(() => {
    setFeatures(resolvedFeatures);
  }, [resolvedFeatures]);

  const changeAppearance = async (patch: Partial<Appearance>) => {
    if (!user) return;
    const next: Appearance = { mode, palette, ...patch };
    if (patch.mode) setMode(patch.mode);
    if (patch.palette) setPalette(patch.palette);
    setSavingPref(true);
    try {
      await saveAppearancePref(user.uid, { mode: next.mode, palette: next.palette });
    } catch {
      toast.error("Couldn't save appearance. Check your connection.");
    } finally {
      setSavingPref(false);
    }
  };

  const toggleFeature = async (key: FeatureKey, on: boolean) => {
    if (!user) return;
    const next = { ...features, [key]: on };
    setFeatures(next);
    try {
      await saveFeaturePrefs(user.uid, next);
    } catch {
      toast.error("Couldn't save your preference. Try again.");
    }
  };

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "users", user.uid, "examGoals"), (snap) => {
      setExams(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ExamGoalDoc) })));
    });
  }, [user]);

  if (!user || !userDoc) return null;

  const parents = userDoc.parents ?? [];

  const addableExamOptions = ACADEMIC_CONTEXTS.filter(
    (c) => !exams.some((e) => e.examType === c.value)
  ).map((c) => ({ value: c.value, label: c.label }));

  const handleAddExam = async () => {
    if (!user || !newExamType || !newExamDate) return;
    setSavingExam(true);
    try {
      await addExamGoal(user.uid, newExamType as ExamType, newExamType, new Date(`${newExamDate}T00:00:00`));
      setAddingExam(false);
      setNewExamType("");
      setNewExamDate("");
      toast.success("Exam added — syllabus ready.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't add that exam.");
    } finally {
      setSavingExam(false);
    }
  };

  const handleDateChange = async (examId: string, date: string) => {
    if (!user) return;
    setBusyExamId(examId);
    try {
      await updateExamDate(user.uid, examId, new Date(`${date}T00:00:00`));
    } catch (err) {
      console.error(err);
      toast.error("Couldn't update the exam date.");
    } finally {
      setBusyExamId(null);
    }
  };

  const handleRemoveExam = async () => {
    if (!user || !deletingExam) return;
    setSavingExam(true);
    try {
      await removeExamGoal(user.uid, exams, deletingExam);
      setDeletingExam(null);
      toast.success("Exam removed.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't remove that exam.");
    } finally {
      setSavingExam(false);
    }
  };

  const handleAddParent = async () => {
    if (!parentEmail.trim()) return;
    setSavingParent(true);
    try {
      await addParent(user.uid, parentEmail);
      setParentEmail("");
      toast.success("Granted read-only access.");
    } catch {
      toast.error("Couldn't add that email. Check it and try again.");
    } finally {
      setSavingParent(false);
    }
  };

  const copyShareLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}#/parent/${user.uid}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setAvatarBusy(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      await saveProfileDetails(user.uid, { photoURL: dataUrl });
      // Keep the auth profile in sync so the header avatar (which prefers
      // user.photoURL) picks it up immediately.
      try {
        await updateProfile(user, { photoURL: dataUrl });
      } catch {
        // Non-fatal: the doc copy is enough for most surfaces.
      }
      setPhotoURL(dataUrl);
      toast.success("Profile photo updated.");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Couldn't update the photo.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!user || !userDoc) return;
    setSavingDetails(true);
    try {
      const displayName = profileName.trim();
      await saveProfileDetails(user.uid, {
        displayName,
        school: school.trim(),
        grade: grade.trim(),
        address: {
          line: addressLine.trim(),
          city: addressCity.trim(),
          state: addressState.trim(),
        },
      });
      if (displayName && displayName !== user.displayName) {
        try {
          await updateProfile(user, { displayName });
        } catch {
          // Non-fatal: the doc copy is the source of truth in-app.
        }
      }
      toast.success("Profile saved.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save your profile. Try again.");
    } finally {
      setSavingDetails(false);
    }
  };

  const handleReset = async () => {
    if (!user || !resetAction) return;
    if (resetAction === "delete" && deleteText.trim().toUpperCase() !== "DELETE") return;
    setResetting(true);
    try {
      if (resetAction === "redo") await resetOnboarding(user.uid);
      else await deleteAllUserData(user.uid);
      setResetAction(null);
      setDeleteText("");
      navigate("/onboarding", { replace: true });
    } catch (err) {
      console.error(err);
      toast.error("Reset failed. Check your connection and try again.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Avatar
          src={photoURL || user?.photoURL || undefined}
          name={userDoc.displayName}
          className="h-14 w-14 text-lg"
        />
        <div>
          <p className="font-display text-lg font-bold">{friendlyFirstName(userDoc.displayName)}</p>
        </div>
      </div>

      <Card id="profile-details" className="scroll-mt-20 p-4">
        <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
          <GraduationCap size={15} className="text-brand-600" /> Personal details
        </p>

        <div className="mb-4 flex items-center gap-4">
          <Avatar src={photoURL} name={profileName} className="h-16 w-16 text-xl" />
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleAvatarFile(e)}
              aria-label="Choose a profile photo"
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={avatarBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              {avatarBusy ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Processing…
                </>
              ) : (
                <>
                  <Camera size={14} /> Change photo
                </>
              )}
            </Button>
            <p className="mt-1 text-[11px] text-text-muted">
              Square image, cropped &amp; compressed before saving.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-text-muted" htmlFor="profile-name">
              Full name
            </label>
            <Input
              id="profile-name"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted" htmlFor="profile-school">
              <School size={11} className="mr-1 inline" aria-hidden /> School / college
            </label>
            <Input
              id="profile-school"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="e.g. Kendriya Vidyalaya, Delhi"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted" htmlFor="profile-grade">
              Class / grade
            </label>
            <Input
              id="profile-grade"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="e.g. 12 or Dropper"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted" htmlFor="profile-state">
              <MapPin size={11} className="mr-1 inline" aria-hidden /> State
            </label>
            <Select
              id="profile-state"
              value={addressState}
              onChange={setAddressState}
              options={INDIAN_STATES.map((s) => ({ value: s, label: s }))}
              placeholder="Select state…"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-text-muted" htmlFor="profile-address">
              <MapPin size={11} className="mr-1 inline" aria-hidden /> Address
            </label>
            <Input
              id="profile-address"
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              placeholder="Street / area"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted" htmlFor="profile-city">
              City
            </label>
            <Input
              id="profile-city"
              value={addressCity}
              onChange={(e) => setAddressCity(e.target.value)}
              placeholder="e.g. Pune"
            />
          </div>
          <div className="flex items-end">
            <Button
              className="w-full"
              disabled={savingDetails || !profileName.trim()}
              onClick={() => void handleSaveDetails()}
            >
              {savingDetails ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Save size={14} /> Save details
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Level" value={`${Math.floor(userDoc.xp / 100) + 1}`} />
        <StatCard label="Total XP" value={`${userDoc.xp}`} />
        <StatCard label="Streak" value={`${userDoc.streakCount} days`} />
        <StatCard label="Best streak" value={`${userDoc.longestStreak} days`} />
      </div>

      <Card className="p-4">
        <p className="mb-3 text-sm font-semibold">Last 30 days</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Focus" value={`${Math.round(last30.focusMinutes / 60)}h`} />
          <StatCard label="Tasks done" value={`${last30.completedTasks}`} />
          <StatCard label="Questions" value={`${last30.questionsDone}`} />
          <StatCard label="Mocks" value={`${last30.mockCount}`} />
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">Progress</p>
          <StreakFlame streak={userDoc.streakCount} />
        </div>
        <LevelBadge xp={userDoc.xp} />
        <p className="mt-2 text-xs text-text-muted">Longest streak: {userDoc.longestStreak} days</p>
      </Card>

      <Card id="profile-academic" className="p-4 scroll-mt-20">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">Academic setup</p>
          {!addingExam && (
            <button
              onClick={() => setAddingExam(true)}
              className="flex items-center gap-1 rounded-md border border-dashed border-border-strong px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-micro hover:border-brand-600 hover:text-brand-600 dark:hover:text-brand-500"
            >
              <Plus size={13} /> Add exam
            </button>
          )}
        </div>
        <p className="mb-3 text-xs text-text-secondary">
          Your class and exam goals drive the syllabus, planner, countdown and recommendations.
        </p>
        {exams.length === 0 ? (
          <p className="text-sm text-text-secondary">No exams added yet.</p>
        ) : (
          <div className="space-y-2">
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {EXAM_LABEL[exam.examType] ?? exam.name}
                    {exam.isPrimary && (
                      <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-500">
                        Primary
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {Math.max(0, daysBetween(new Date(), exam.examDate.toDate()))} days to go
                  </p>
                </div>
                {busyExamId === exam.id ? (
                  <span className="text-xs text-text-muted">Saving…</span>
                ) : (
                  <Input
                    type="date"
                    aria-label={`${EXAM_LABEL[exam.examType] ?? exam.name} exam date`}
                    value={exam.examDate.toDate().toISOString().slice(0, 10)}
                    onChange={(e) => {
                      if (e.target.value) void handleDateChange(exam.id, e.target.value);
                    }}
                    className="h-9 w-40"
                  />
                )}
                <button
                  onClick={() => setDeletingExam(exam.id)}
                  aria-label={`Remove ${EXAM_LABEL[exam.examType] ?? exam.name}`}
                  title="Remove exam"
                  className="rounded-full p-1.5 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        {addingExam && (
          <div className="mt-3 space-y-2 rounded-lg border border-border bg-surface-2 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-text-muted" htmlFor="new-exam-type">
                  Exam
                </label>
                <Select
                  id="new-exam-type"
                  value={newExamType}
                  onChange={setNewExamType}
                  options={addableExamOptions}
                  placeholder="Choose an exam…"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-muted" htmlFor="new-exam-date">
                  Date
                </label>
                <Input
                  id="new-exam-date"
                  type="date"
                  value={newExamDate}
                  onChange={(e) => setNewExamDate(e.target.value)}
                  className="h-11 w-40"
                />
              </div>
              <Button size="sm" className="h-11" disabled={savingExam} onClick={() => void handleAddExam()}>
                {savingExam ? "Adding…" : "Add"}
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-text-muted">
                Adds the exam and its syllabus. The first exam is your primary stream.
              </p>
              <button
                onClick={() => setAddingExam(false)}
                className="rounded-full p-1 text-text-muted transition-colors hover:text-text-primary"
                aria-label="Cancel add exam"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {deletingExam && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-danger/30 bg-surface-2 p-3 text-sm">
            <span className="flex-1 text-danger">
              Remove this exam? Its subjects and chapters will be deleted too.
            </span>
            <button
              onClick={() => void handleRemoveExam()}
              disabled={savingExam}
              aria-label="Confirm remove exam"
              className="rounded-md bg-danger px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {savingExam ? "…" : "Remove"}
            </button>
            <button
              onClick={() => setDeletingExam(null)}
              aria-label="Cancel remove exam"
              className="rounded-full p-1 text-text-muted transition-colors hover:text-text-primary"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Bell size={15} /> Daily study reminder
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              {reminder.supported
                ? reminder.permission === "denied"
                  ? "Notifications are blocked in your browser settings."
                  : "A gentle nudge at your chosen time, every day."
                : "This browser doesn't support notifications."}
            </p>
          </div>
          <Switch
            checked={reminder.prefs.enabled}
            onCheckedChange={(v) => reminder.save({ ...reminder.prefs, enabled: v })}
            aria-label="Toggle daily reminder"
          />
        </div>
        {reminder.prefs.enabled && reminder.supported && reminder.permission !== "denied" && (
          <div className="mt-3">
            <label className="text-xs text-text-muted" htmlFor="reminder-time">
              Remind me at
            </label>
            <Input
              id="reminder-time"
              type="time"
              value={reminder.prefs.time}
              onChange={(e) => reminder.save({ ...reminder.prefs, time: e.target.value || "20:00" })}
              className="mt-1 w-32"
            />
          </div>
        )}
      </Card>

      <Card id="profile-parents" className="p-4 scroll-mt-20">
        <p className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <UserPlus size={15} /> Parents &amp; mentors
        </p>
        <p className="mb-3 text-xs text-text-secondary">
          Add an email to share a read-only snapshot of progress. They sign in with their own
          Google account — the link opens straight to them, and they can find every student
          they've been added to under Parents → My students.
        </p>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="parent@example.com"
            value={parentEmail}
            onChange={(e) => setParentEmail(e.target.value)}
          />
          <Button variant="secondary" onClick={handleAddParent} disabled={savingParent}>
            Add
          </Button>
        </div>
        {parents.length > 0 && (
          <div className="mt-3 space-y-2">
            {parents.map((email) => (
              <div key={email} className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2 text-sm">
                <span>{email}</span>
                <button
                  onClick={() =>
                    removeParent(user.uid, email).catch(() => toast.error("Couldn't remove that email."))
                  }
                  aria-label={`Remove ${email}`}
                  className="text-text-muted hover:text-danger"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <Button variant="secondary" className="w-full" onClick={copyShareLink}>
              <Copy size={15} /> Copy share link
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <Trees size={15} className="text-brand-600" aria-hidden /> Your Study Forest
        </p>
        <ForestStrip sessions={sessions} />
      </Card>

      <Card className="p-4">
        <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
          <Trophy size={15} className="text-achievement" aria-hidden /> Achievements
        </p>
        <AchievementsGrid earned={userDoc.badges} />
      </Card>

      {/* Appearance */}
      <Card id="profile-preferences" className="p-4 scroll-mt-20">
        <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
          <Palette size={15} className="text-brand-600" /> Appearance
          {savingPref && <span className="ml-auto text-[11px] font-normal text-text-muted">Saving…</span>}
        </p>
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-medium text-text-secondary">Theme</p>
          <div className="grid grid-cols-3 gap-1.5">
            {(["light", "dark", "system"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => changeAppearance({ mode: m })}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-xs font-medium capitalize transition-colors duration-micro",
                  mode === m
                    ? "border-brand-600 bg-brand-500/10 text-brand-600"
                    : "border-border bg-surface text-text-secondary hover:border-border-strong"
                )}
              >
                {m === "system" ? "Auto" : m}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-text-secondary">Color palette</p>
          <div className="grid grid-cols-3 gap-1.5">
            {PALETTES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => changeAppearance({ palette: p.id })}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors duration-micro",
                  palette === p.id
                    ? "border-brand-600 bg-brand-500/10 text-brand-600"
                    : "border-border bg-surface text-text-secondary hover:border-border-strong"
                )}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full border border-border-strong"
                  style={{ backgroundColor: isDark ? p.dark : p.light }}
                />
                {p.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-text-muted">
            Preview applies instantly and is synced across your devices.
          </p>
        </div>
      </Card>

      {/* Features */}
      <Card className="p-4">
        <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
          <SlidersHorizontal size={15} className="text-brand-600" /> Features
        </p>
        <p className="mb-3 text-xs text-text-muted">
          Hide things you don't use — your data is never deleted, and you can turn them back on anytime.
        </p>
        <div className="space-y-3">
          {FEATURE_META.map((f) => (
            <div key={f.key} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{f.label}</p>
                <p className="text-xs text-text-muted">{f.description}</p>
              </div>
              <Switch
                checked={features[f.key]}
                onCheckedChange={(on) => toggleFeature(f.key, on)}
                aria-label={`Enable ${f.label}`}
              />
            </div>
          ))}
        </div>
      </Card>

      <Card id="profile-settings" className="scroll-mt-20 border-danger/20 p-4">
        <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-danger">
          <RotateCcw size={15} /> Reset &amp; re-onboard
        </p>
        <p className="mb-3 text-xs text-text-secondary">
          Picked the wrong stream or exam during setup? Redo onboarding, or wipe everything
          and start fresh.
        </p>

        <div className="space-y-2">
          {resetAction === "redo" ? (
            <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
              <p className="mb-2 text-text-secondary">
                Re-run setup. Your tasks, notes and progress are kept — only exam goals and the
                syllabus are reset.
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void handleReset()} disabled={resetting}>
                  {resetting ? "Resetting…" : "Yes, redo setup"}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setResetAction(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" className="w-full" onClick={() => setResetAction("redo")}>
              <RotateCcw size={15} /> Redo onboarding
            </Button>
          )}

          {resetAction === "delete" ? (
            <div className="rounded-lg border border-danger/30 bg-surface-2 p-3 text-sm">
              <p className="mb-2 flex items-start gap-1.5 text-text-secondary">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-danger" />
                This permanently deletes your tasks, notes, forest, XP and every other piece of
                data, then returns you to onboarding. Type{" "}
                <span className="font-mono font-semibold text-danger">DELETE</span> to confirm.
              </p>
              <Input
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                placeholder="Type DELETE"
                className="mb-2"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="danger"
                  disabled={resetting || deleteText.trim().toUpperCase() !== "DELETE"}
                  onClick={() => void handleReset()}
                >
                  {resetting ? "Deleting…" : "Delete everything"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setResetAction(null);
                    setDeleteText("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="secondary"
              className="w-full border-danger/30 text-danger hover:border-danger hover:bg-danger/5"
              onClick={() => setResetAction("delete")}
            >
              <Trash2 size={15} /> Delete all my data
            </Button>
          )}
        </div>
      </Card>

      <Button
        variant="secondary"
        className="w-full"
        onClick={() => signOutUser().catch(() => toast.error("Couldn't sign out. Try again."))}
      >
        <LogOut size={16} /> Sign out
      </Button>
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
