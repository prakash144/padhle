import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { setPrimaryExam } from "@/lib/examGoals";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import type { BacklogDoc, ChapterDoc, ErrorBookDoc, ExamGoalDoc, ExamType, FocusSessionDoc, MockTestDoc, SubjectDoc, TaskDoc } from "@/lib/schema";

export const ACADEMIC_CONTEXTS: { value: ExamType; label: string; shortLabel: string; group: "Boards" | "Competitive" }[] = [
  { value: "class10", label: "Class 10", shortLabel: "Class 10", group: "Boards" },
  { value: "class12", label: "Class 12", shortLabel: "Class 12", group: "Boards" },
  { value: "jeeMain", label: "JEE Main", shortLabel: "JEE Main", group: "Competitive" },
  { value: "jeeAdvanced", label: "JEE Advanced", shortLabel: "JEE Adv", group: "Competitive" },
  { value: "neet", label: "NEET", shortLabel: "NEET", group: "Competitive" },
];

export const EXAM_LABEL: Record<ExamType, string> = {
  class10: "Class 10",
  class12: "Class 12",
  jeeMain: "JEE Main",
  jeeAdvanced: "JEE Advanced",
  neet: "NEET",
};

export const EXAM_ACCENT_ATTR: Record<ExamType, string> = {
  class10: "boards",
  class12: "boards",
  jeeMain: "jee",
  jeeAdvanced: "jee",
  neet: "neet",
};

export function useAcademicContext() {
  const { user, userDoc } = useAuth();
  const [exams, setExams] = useState<(ExamGoalDoc & { id: string })[]>([]);

  useEffect(() => {
    if (!user) {
      setExams([]);
      return;
    }
    return onSnapshot(collection(db, "users", user.uid, "examGoals"), (snap) => {
      setExams(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ExamGoalDoc) })));
    });
  }, [user]);

  const primaryExam = exams.find((exam) => exam.isPrimary) ?? exams.find((exam) => exam.id === userDoc?.primaryExamId) ?? exams[0] ?? null;
  const selectedType = (userDoc?.activeStudyContext ?? primaryExam?.examType ?? userDoc?.stream ?? "jeeMain") as ExamType;
  const selected = ACADEMIC_CONTEXTS.find((item) => item.value === selectedType) ?? ACADEMIC_CONTEXTS[2];
  const activeExam = exams.find((exam) => exam.examType === selected.value) ?? null;

  useEffect(() => {
    document.documentElement.setAttribute("data-exam", EXAM_ACCENT_ATTR[selected.value] ?? "boards");
  }, [selected.value]);

  const switchContext = useCallback(async (next: ExamType) => {
    if (!user) return;
    const matchingExam = exams.find((exam) => exam.examType === next);
    await setDoc(doc(db, "users", user.uid), { activeStudyContext: next }, { merge: true });
    if (matchingExam) {
      await setPrimaryExam(user.uid, exams, matchingExam.id);
      return;
    }
    await setDoc(doc(db, "users", user.uid), { stream: next }, { merge: true });
  }, [user, exams]);

  return useMemo(
    () => ({ selected, selectedType: selected.value, exams, primaryExam, activeExam, switchContext }),
    [selected, exams, primaryExam, activeExam, switchContext]
  );
}

export function filterSubjectsByContext<T extends SubjectDoc & { id: string }>(subjects: T[], examType: ExamType): T[] {
  return subjects.filter((subject) => subject.examType === examType);
}

export function filterChaptersByContext<T extends ChapterDoc & { id: string }>(chapters: T[], examType: ExamType): T[] {
  return chapters.filter((chapter) => chapter.examType === examType);
}

export function filterTestsByContext<T extends MockTestDoc & { id: string }>(tests: T[], examType: ExamType): T[] {
  return tests.filter((test) => test.examType === examType);
}

export function filterSessionsByContext<T extends FocusSessionDoc & { id?: string }>(
  sessions: T[],
  subjects: (SubjectDoc & { id: string })[],
  examType: ExamType
): T[] {
  const allowed = new Set(filterSubjectsByContext(subjects, examType).map((subject) => subject.id));
  return sessions.filter((session) => !session.subjectId || allowed.has(session.subjectId));
}

export function filterTasksByContext<T extends TaskDoc & { id: string }>(
  tasks: T[],
  subjects: (SubjectDoc & { id: string })[],
  examType: ExamType
): T[] {
  const allowed = new Set(filterSubjectsByContext(subjects, examType).map((subject) => subject.id));
  return tasks.filter((task) => !task.subjectId || allowed.has(task.subjectId));
}

export function filterErrorsByContext<T extends ErrorBookDoc & { id: string }>(
  errors: T[],
  subjects: (SubjectDoc & { id: string })[],
  examType: ExamType
): T[] {
  const allowed = new Set(filterSubjectsByContext(subjects, examType).map((subject) => subject.id));
  return errors.filter((error) => allowed.has(error.subjectId));
}

export function filterBacklogByContext<T extends BacklogDoc & { id: string }>(
  items: T[],
  subjects: (SubjectDoc & { id: string })[],
  examType: ExamType
): T[] {
  const allowed = new Set(filterSubjectsByContext(subjects, examType).map((subject) => subject.id));
  return items.filter((item) => !item.subjectId || allowed.has(item.subjectId));
}
