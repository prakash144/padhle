import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, doc, serverTimestamp, Timestamp, writeBatch } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { seedSyllabusForExams } from "@/lib/syllabusSeed";
import { EXAM_GROUP_LABEL, EXAM_OPTIONS, type ExamOption } from "./examOptions";

type Step = "welcome" | "exams" | "dates" | "syllabus";

const accentClass: Record<ExamOption["accent"], string> = {
  jee: "border-exam-jee data-[selected=true]:bg-exam-jee/10 data-[selected=true]:border-exam-jee",
  neet: "border-exam-neet data-[selected=true]:bg-exam-neet/10 data-[selected=true]:border-exam-neet",
  boards: "border-exam-boards data-[selected=true]:bg-exam-boards/10 data-[selected=true]:border-exam-boards",
};

export function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("welcome");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dates, setDates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const selectedExams = useMemo(
    () => EXAM_OPTIONS.filter((e) => selected.has(e.key)),
    [selected]
  );

  // The school group is single-select (only one class range). Competitive
  // exams stay multi-select so Boards + JEE/NEET can be prepped together.
  const toggleExam = (key: string, group: ExamOption["group"]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        return next;
      }
      if (group === "school") {
        EXAM_OPTIONS.forEach((e) => {
          if (e.group === "school") next.delete(e.key);
        });
      }
      next.add(key);
      return next;
    });
  };

  const goToDates = () => {
    const defaults: Record<string, string> = {};
    selectedExams.forEach((e) => (defaults[e.type] = dates[e.type] ?? e.defaultDate));
    setDates(defaults);
    setStep("dates");
  };

  const finishOnboarding = async () => {
    if (!user || selectedExams.length === 0) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      let firstId: string | null = null;
      selectedExams.forEach((exam, i) => {
        const ref = doc(collection(db, "users", user.uid, "examGoals"));
        if (i === 0) firstId = ref.id;
        batch.set(ref, {
          name: exam.label,
          examType: exam.type,
          examDate: Timestamp.fromDate(new Date(dates[exam.type])),
          isPrimary: i === 0,
          createdAt: serverTimestamp(),
        });
      });
      const level = selectedExams[0]?.level;
      batch.set(
        doc(db, "users", user.uid),
        {
          stream: selectedExams[0].type,
          primaryExamId: firstId,
          onboardedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          ...(level ? { academic: { level } } : {}),
        },
        { merge: true }
      );
      await batch.commit();
      // Primary/middle-school students skip the exam-specific syllabus seed —
      // a Class 4 student shouldn't see Class 10 chapters. Their planner,
      // notes and sprints work straight away.
      const shouldSeed = selectedExams.some((e) => e.level === "senior" || !e.level);
      if (shouldSeed) {
        setStep("syllabus");
        await seedSyllabusForExams(
          user.uid,
          selectedExams.map((e) => e.type)
        );
      }
      // userDoc is a live listener (AuthContext), so it already reflects
      // onboardedAt from the batch write above by the time we navigate.
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Onboarding failed", err);
      // Return to the date step so the user can retry instead of being
      // stranded on the "Setting up…" spinner after a partial failure.
      setStep("dates");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-lg">
        <AnimatePresence mode="wait">
          {step === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="text-center"
            >
              <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary font-display text-3xl font-bold text-primary-foreground shadow-e2">
                प
              </span>
              <h1 className="mb-2 font-display text-2xl font-bold">Welcome to पdhle</h1>
              <p className="mb-8 text-text-secondary">
                Don't worry about everything you need to do. We'll show you what to study next.
              </p>
              <Button onClick={() => setStep("exams")} className="mx-auto">
                Get started <ArrowRight size={16} />
              </Button>
            </motion.div>
          )}

          {step === "exams" && (
            <motion.div
              key="exams"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <h2 className="mb-1 text-center font-display text-xl font-bold">
                What are you preparing for?
              </h2>
              <p className="mb-6 text-center text-sm text-text-secondary">
                Pick one or more — you can prep for Boards and JEE/NEET together.
              </p>
              {(["school", "competitive"] as const).map((group) => (
                <div key={group} className="mb-5 last:mb-0">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                    {EXAM_GROUP_LABEL[group]}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {EXAM_OPTIONS.filter((e) => e.group === group).map((exam) => {
                      const isSelected = selected.has(exam.key);
                      return (
                        <button
                          key={`${group}-${exam.key}`}
                          data-selected={isSelected}
                          onClick={() => toggleExam(exam.key, group)}
                          aria-pressed={isSelected}
                          className={cn(
                            "relative rounded-xl border-2 bg-surface p-4 text-left shadow-e1 transition-all duration-standard",
                            "hover:shadow-e2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                            isSelected ? "scale-[1.02]" : "hover:scale-[1.01]",
                            accentClass[exam.accent]
                          )}
                        >
                          {isSelected && (
                            <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check size={12} strokeWidth={3} />
                            </span>
                          )}
                          <p className="font-display font-semibold">{exam.label}</p>
                          <p className="text-xs text-text-muted">{exam.sublabel}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <Button
                onClick={goToDates}
                disabled={selected.size === 0}
                className="mx-auto mt-8 flex"
              >
                Continue <ArrowRight size={16} />
              </Button>
            </motion.div>
          )}

          {step === "dates" && (
            <motion.div
              key="dates"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <h2 className="mb-1 text-center font-display text-xl font-bold">
                When's the big day?
              </h2>
              <p className="mb-6 text-center text-sm text-text-secondary">
                We'll count down for you and pace your sprints accordingly.
              </p>
              <div className="space-y-3">
                {selectedExams.map((exam) => (
                  <div
                    key={exam.type}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface p-3"
                  >
                    <span className="font-medium">{exam.label}</span>
                    <Input
                      type="date"
                      id={`exam-date-${exam.type}`}
                      aria-label={`${exam.label} exam date`}
                      value={dates[exam.type] ?? exam.defaultDate}
                      onChange={(e) =>
                        setDates((prev) => ({ ...prev, [exam.type]: e.target.value }))
                      }
                      className="w-40"
                    />
                  </div>
                ))}
              </div>
              <Button onClick={finishOnboarding} disabled={saving} className="mx-auto mt-8 flex">
                {saving ? "Setting up..." : "Start studying"} <ArrowRight size={16} />
              </Button>
            </motion.div>
          )}

          {step === "syllabus" && (
            <motion.div
              key="syllabus"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.32 }}
              className="text-center"
            >
              <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
              <p className="font-display font-semibold">
                Setting up {selectedExams.map((e) => e.label).join(" & ")}…
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Loading your subjects and chapters.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
