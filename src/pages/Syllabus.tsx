import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { ChapterMasteryRow } from "@/components/ChapterMasteryRow";
import { useAuth } from "@/contexts/AuthContext";
import { useChapters, useErrors, useSubjects } from "@/lib/hooks";
import { createBacklogItem } from "@/lib/backlog";
import { addChapter, deleteChapter, nextMasteryStage, renameChapter, setChapterMastery } from "@/lib/chapters";
import { addSubject, deleteSubject, renameSubject } from "@/lib/subjects";
import { summarizeSubjectMastery, calculateMastery } from "@/lib/studyWorkflow";
import { dayKey } from "@/lib/dates";
import { useToast } from "@/lib/useToast";
import { cn } from "@/lib/utils";
import type { ChapterDoc } from "@/lib/schema";
import { filterChaptersByContext, filterErrorsByContext, filterSubjectsByContext, useAcademicContext } from "@/lib/academicContext";

type Filter = "all" | "attention" | "not_started" | "mastered";

const ACTION_LABEL: Record<ReturnType<typeof calculateMastery>["action"], string> = {
  start: "Start",
  continue: "Continue",
  practice: "Practice",
  revise: "Revise",
};

export function Syllabus() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const allSubjects = useSubjects();
  const allChapters = useChapters();
  const allOpenErrors = useErrors("open");
  const { selected } = useAcademicContext();
  const subjects = useMemo(() => filterSubjectsByContext(allSubjects, selected.value), [allSubjects, selected.value]);
  const chapters = useMemo(() => filterChaptersByContext(allChapters, selected.value), [allChapters, selected.value]);
  const openErrors = useMemo(() => filterErrorsByContext(allOpenErrors, allSubjects, selected.value), [allOpenErrors, allSubjects, selected.value]);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [queueingId, setQueueingId] = useState<string | null>(null);
  const [addingChapter, setAddingChapter] = useState(false);
  const [newChapterName, setNewChapterName] = useState("");
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editChapterName, setEditChapterName] = useState("");
  const [deletingChapterId, setDeletingChapterId] = useState<string | null>(null);
  const [busyChapterId, setBusyChapterId] = useState<string | null>(null);

  const activeSubjectId = subjectId ?? subjects[0]?.id ?? null;
  const activeSubject = subjects.find((s) => s.id === activeSubjectId);
  const todayKey = dayKey(new Date());

  const subjectChapters = useMemo(
    () => chapters.filter((c) => c.subjectId === activeSubjectId),
    [chapters, activeSubjectId]
  );

  const chapterStates = useMemo(
    () =>
      new Map(
        subjectChapters.map((chapter) => [
          chapter.id,
          calculateMastery(chapter, {
            todayKey,
            openMistakes: openErrors.filter((error) => error.chapterId === chapter.id).length,
            dueMistakes: openErrors.filter(
              (error) => error.chapterId === chapter.id && error.reviewDate <= todayKey
            ).length,
          }),
        ])
      ),
    [subjectChapters, openErrors, todayKey]
  );

  const filteredChapters = useMemo(() => {
    return subjectChapters.filter((chapter) => {
      const state = chapterStates.get(chapter.id);
      if (!state) return true;
      switch (filter) {
        case "attention":
          return state.state === "weak" || state.state === "needs_revision";
        case "not_started":
          return state.state === "not_started";
        case "mastered":
          return state.state === "mastered";
        default:
          return true;
      }
    });
  }, [subjectChapters, chapterStates, filter]);

  const summary = useMemo(() => {
    if (!activeSubject) return null;
    return summarizeSubjectMastery(activeSubject, subjectChapters, openErrors, todayKey);
  }, [activeSubject, subjectChapters, openErrors, todayKey]);

  if (!user) return null;

  if (subjects.length === 0) {
    return (
      <Card className="mx-auto max-w-2xl py-10 text-center text-sm text-text-secondary">
        Your syllabus is still being set up. If this doesn&apos;t change in a minute, revisit onboarding
        from your profile.
      </Card>
    );
  }

  const handleAdd = async () => {
    if (!newName.trim() || saving) return;
    setSaving(true);
    try {
      await addSubject(user.uid, newName);
      setNewName("");
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim() || busyId) return;
    setBusyId(id);
    try {
      await renameSubject(user.uid, id, editName);
      setEditingId(null);
      setEditName("");
    } catch {
      toast.error("Couldn't rename that subject.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await deleteSubject(user.uid, id);
      if (subjectId === id) setSubjectId(null);
      setDeletingId(null);
      toast.success("Subject removed.");
    } catch {
      toast.error("Couldn't delete that subject.");
    } finally {
      setBusyId(null);
    }
  };

  const queueChapter = async (chapterId: string) => {
    if (queueingId) return;
    const chapter = subjectChapters.find((item) => item.id === chapterId);
    const state = chapterStates.get(chapterId);
    if (!chapter || !state) return;
    setQueueingId(chapterId);
    try {
      await createBacklogItem(user.uid, {
        title:
          state.action === "revise"
            ? `Revise ${chapter.name}`
            : `${state.action === "start" ? "Start" : "Practice"} ${chapter.name}`,
        subjectId: chapter.subjectId,
        subjectName: chapter.subjectName,
        chapterId: chapter.id,
        chapterName: chapter.name,
        category: state.action === "revise" ? "revision" : chapter.examType.startsWith("class") ? "board" : "jee",
        estimatedMinutes: state.action === "revise" ? 25 : 40,
        priority: state.state === "weak" || state.state === "needs_revision" ? "high" : "med",
        origin: "adaptive",
      });
      toast.success("Added to backlog.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't add that topic to backlog.");
    } finally {
      setQueueingId(null);
    }
  };

  const handleAddChapter = async () => {
    if (!activeSubject || !newChapterName.trim() || busyChapterId) return;
    setBusyChapterId(activeSubject.id);
    try {
      await addChapter(user.uid, activeSubject, newChapterName);
      setNewChapterName("");
      setAddingChapter(false);
      toast.success("Topic added.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't add that topic.");
    } finally {
      setBusyChapterId(null);
    }
  };

  const handleRenameChapter = async (id: string) => {
    if (!editChapterName.trim() || busyChapterId) return;
    setBusyChapterId(id);
    try {
      await renameChapter(user.uid, id, editChapterName);
      setEditingChapterId(null);
      setEditChapterName("");
      toast.success("Topic renamed.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't rename that topic.");
    } finally {
      setBusyChapterId(null);
    }
  };

  const handleDeleteChapter = async (chapter: ChapterDoc & { id: string }) => {
    if (busyChapterId) return;
    setBusyChapterId(chapter.id);
    try {
      await deleteChapter(user.uid, chapter);
      setDeletingChapterId(null);
      toast.success("Topic removed.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't delete that topic.");
    } finally {
      setBusyChapterId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Syllabus</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Coverage tracks what you&apos;ve started. Mastery tracks how strong it actually is.
          </p>
        </div>
        <Link to="/backlog" className="text-xs font-medium text-text-secondary hover:text-brand-600">
          Open backlog →
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {subjects.map((s) => {
          const isActive = s.id === activeSubjectId;
          if (editingId === s.id) {
            return (
              <span
                key={s.id}
                className="flex items-center gap-1.5 rounded-full border border-brand-600 bg-surface px-1.5 py-1"
              >
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleRename(s.id);
                    if (e.key === "Escape") {
                      setEditingId(null);
                      setEditName("");
                    }
                  }}
                  placeholder="Subject name"
                  className="w-32 bg-transparent px-2 text-sm text-text-primary outline-none placeholder:text-text-muted"
                />
                <Button
                  size="sm"
                  className="h-7 px-2.5"
                  disabled={busyId === s.id || !editName.trim()}
                  onClick={() => void handleRename(s.id)}
                >
                  {busyId === s.id ? "…" : "Save"}
                </Button>
                <button
                  onClick={() => {
                    setEditingId(null);
                    setEditName("");
                  }}
                  className="rounded-full p-1 text-text-muted transition-colors hover:text-text-primary"
                  aria-label="Cancel rename"
                >
                  <X size={14} />
                </button>
              </span>
            );
          }
          if (deletingId === s.id) {
            return (
              <span
                key={s.id}
                className="flex items-center gap-2 rounded-full border border-danger/40 bg-surface px-3 py-1.5 text-sm"
              >
                <span className="text-danger">
                  Delete <span className="font-medium">{s.name}</span> + its chapters?
                </span>
                <button
                  onClick={() => void handleDelete(s.id)}
                  disabled={busyId === s.id}
                  aria-label={`Confirm delete ${s.name}`}
                  className="rounded-full bg-danger px-2.5 py-0.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {busyId === s.id ? "…" : "Delete"}
                </button>
                <button
                  onClick={() => setDeletingId(null)}
                  aria-label="Cancel delete"
                  className="rounded-full p-0.5 text-text-muted transition-colors hover:text-text-primary"
                >
                  <X size={14} />
                </button>
              </span>
            );
          }
          return (
            <span key={s.id} className="flex items-center gap-1">
              <button
                onClick={() => setSubjectId(s.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-micro active:scale-95",
                  isActive
                    ? "border-brand-600 bg-brand-500/10 text-brand-600 dark:text-brand-500"
                    : "border-border bg-surface text-text-secondary hover:border-border-strong hover:bg-surface-2"
                )}
              >
                {s.name}
              </button>
              {isActive && (
                <span className="flex items-center gap-0.5 pl-0.5">
                  <button
                    onClick={() => {
                      setEditingId(s.id);
                      setEditName(s.name);
                    }}
                    aria-label={`Rename ${s.name}`}
                    title="Rename"
                    className="rounded-full p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setDeletingId(s.id)}
                    aria-label={`Delete ${s.name}`}
                    title="Delete"
                    className="rounded-full p-1.5 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              )}
            </span>
          );
        })}

        {adding ? (
          <span className="flex items-center gap-1.5 rounded-full border border-brand-600 bg-surface px-1.5 py-1">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAdd();
                if (e.key === "Escape") {
                  setAdding(false);
                  setNewName("");
                }
              }}
              placeholder="Subject name"
              className="w-32 bg-transparent px-2 text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
            <Button size="sm" className="h-7 px-2.5" disabled={saving || !newName.trim()} onClick={() => void handleAdd()}>
              {saving ? "…" : "Add"}
            </Button>
            <button
              onClick={() => {
                setAdding(false);
                setNewName("");
              }}
              className="rounded-full p-1 text-text-muted transition-colors hover:text-text-primary"
              aria-label="Cancel"
            >
              <X size={14} />
            </button>
          </span>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 rounded-full border border-dashed border-border-strong px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors duration-micro hover:border-brand-600 hover:text-brand-600 dark:hover:text-brand-500"
          >
            <Plus size={14} /> Add subject
          </button>
        )}
      </div>

      {activeSubject && summary && (
        <Card className="p-4">
          <div className="grid gap-4 md:grid-cols-[repeat(3,minmax(0,1fr))_1.2fr]">
            <SyllabusStat label="Coverage" value={`${summary.coveragePct}%`} hint="Chapters started" />
            <SyllabusStat label="Mastery" value={`${summary.masteryPct}%`} hint="Strength, not just activity" />
            <SyllabusStat
              label="Attention"
              value={`${summary.weakCount + summary.needsRevisionCount}`}
              hint="Weak or revision-due chapters"
            />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Next topic</p>
              {summary.nextTopic ? (
                <>
                  <p className="mt-1 text-sm font-medium">{summary.nextTopic.chapterName}</p>
                  <p className="mt-1 text-xs text-text-secondary">{summary.nextTopic.reason}</p>
                </>
              ) : (
                <p className="mt-1 text-sm text-text-secondary">No chapters yet in this subject.</p>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "attention", label: "Attention" },
            { value: "not_started", label: "Not started" },
            { value: "mastered", label: "Mastered" },
          ]}
        />
        {addingChapter ? (
          <span className="flex items-center gap-1.5 rounded-lg border border-brand-600 bg-surface px-1.5 py-1">
            <input
              autoFocus
              value={newChapterName}
              onChange={(e) => setNewChapterName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAddChapter();
                if (e.key === "Escape") {
                  setAddingChapter(false);
                  setNewChapterName("");
                }
              }}
              placeholder="Topic name"
              className="w-40 bg-transparent px-2 text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
            <Button
              size="sm"
              className="h-7 px-2.5"
              disabled={busyChapterId === activeSubjectId || !newChapterName.trim()}
              onClick={() => void handleAddChapter()}
            >
              {busyChapterId === activeSubjectId ? "…" : "Add"}
            </Button>
            <button
              onClick={() => {
                setAddingChapter(false);
                setNewChapterName("");
              }}
              className="rounded-full p-1 text-text-muted transition-colors hover:text-text-primary"
              aria-label="Cancel add topic"
            >
              <X size={14} />
            </button>
          </span>
        ) : (
          <button
            onClick={() => setAddingChapter(true)}
            className="flex items-center gap-1 rounded-lg border border-dashed border-border-strong px-3 py-2 text-sm font-medium text-text-secondary transition-colors duration-micro hover:border-brand-600 hover:text-brand-600 dark:hover:text-brand-500"
          >
            <Plus size={14} /> Add topic
          </button>
        )}
      </div>

      <div className="space-y-2">
        {subjectChapters.length === 0 ? (
          <Card className="py-8 text-center text-sm text-text-secondary">
            No topics yet in this subject. Add your first chapter or topic above.
          </Card>
        ) : filteredChapters.length === 0 ? (
          <Card className="py-8 text-center text-sm text-text-secondary">
            Nothing in this filter right now.
          </Card>
        ) : (
          filteredChapters.map((chapter) => {
            const state = chapterStates.get(chapter.id);
            if (!state) return null;
            const activity = state.action === "revise" ? "revision" : "practice";

            if (editingChapterId === chapter.id) {
              return (
                <Card key={chapter.id} className="flex items-center gap-2 p-3">
                  <input
                    autoFocus
                    value={editChapterName}
                    onChange={(e) => setEditChapterName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleRenameChapter(chapter.id);
                      if (e.key === "Escape") {
                        setEditingChapterId(null);
                        setEditChapterName("");
                      }
                    }}
                    placeholder="Topic name"
                    className="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-text-primary outline-none focus-visible:border-brand-600"
                  />
                  <Button
                    size="sm"
                    className="h-9 px-2.5"
                    disabled={busyChapterId === chapter.id || !editChapterName.trim()}
                    onClick={() => void handleRenameChapter(chapter.id)}
                  >
                    {busyChapterId === chapter.id ? "…" : "Save"}
                  </Button>
                  <button
                    onClick={() => {
                      setEditingChapterId(null);
                      setEditChapterName("");
                    }}
                    aria-label="Cancel rename"
                    className="rounded-full p-1.5 text-text-muted transition-colors hover:text-text-primary"
                  >
                    <X size={14} />
                  </button>
                </Card>
              );
            }

            if (deletingChapterId === chapter.id) {
              return (
                <Card key={chapter.id} className="flex flex-wrap items-center gap-2 p-3">
                  <span className="flex-1 text-sm text-danger">
                    Delete <span className="font-medium">{chapter.name}</span>? Its mastery and
                    study history will be removed.
                  </span>
                  <button
                    onClick={() => void handleDeleteChapter(chapter)}
                    disabled={busyChapterId === chapter.id}
                    aria-label={`Confirm delete ${chapter.name}`}
                    className="rounded-md bg-danger px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {busyChapterId === chapter.id ? "…" : "Delete"}
                  </button>
                  <button
                    onClick={() => setDeletingChapterId(null)}
                    aria-label="Cancel delete"
                    className="rounded-full p-1 text-text-muted transition-colors hover:text-text-primary"
                  >
                    <X size={14} />
                  </button>
                </Card>
              );
            }

            return (
              <ChapterMasteryRow
                key={chapter.id}
                chapter={chapter}
                stateLabel={state.stateLabel}
                summary={state.reason}
                masteryPct={state.masteryPct}
                actionLabel={ACTION_LABEL[state.action]}
                onAction={() =>
                  navigate(
                    `/focus?subjectId=${chapter.subjectId}&chapterId=${chapter.id}&activity=${activity}`
                  )
                }
                onQueue={() => void queueChapter(chapter.id)}
                onAdvance={() =>
                  setChapterMastery(user.uid, chapter, nextMasteryStage(chapter.masteryStage))
                }
                onRename={() => {
                  setEditingChapterId(chapter.id);
                  setEditChapterName(chapter.name);
                }}
                onDelete={() => setDeletingChapterId(chapter.id)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function SyllabusStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 font-numeric text-2xl font-semibold tabular">{value}</p>
      <p className="mt-1 text-xs text-text-secondary">{hint}</p>
    </div>
  );
}
