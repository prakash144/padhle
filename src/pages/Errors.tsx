import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookX, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ErrorFormDialog } from "@/components/ErrorFormDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useChapters, useErrors, useOpenErrorCount, useSubjects } from "@/lib/hooks";
import { deleteError, generateMistakesSprint, setErrorStatus } from "@/lib/errors";
import { useToast } from "@/lib/useToast";
import type { ErrorStatus } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { filterChaptersByContext, filterErrorsByContext, filterSubjectsByContext, useAcademicContext } from "@/lib/academicContext";

const STATUS_OPTIONS: { value: ErrorStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "reviewed", label: "Reviewed" },
  { value: "resolved", label: "Resolved" },
];

const ERROR_TYPE_LABEL: Record<string, string> = {
  concept: "Concept",
  formula: "Formula",
  calc: "Calculation",
  silly: "Silly",
  guessed: "Guessed",
  time: "Time pressure",
};

export function Errors() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<ErrorStatus | "all">("open");
  const [visible, setVisible] = useState(20);
  const allErrors = useErrors(filter === "all" ? undefined : filter, visible);
  const openErrorCount = useOpenErrorCount();
  const allSubjects = useSubjects();
  const allChapters = useChapters();
  const { selected } = useAcademicContext();
  const subjects = useMemo(() => filterSubjectsByContext(allSubjects, selected.value), [allSubjects, selected.value]);
  const chapters = useMemo(() => filterChaptersByContext(allChapters, selected.value), [allChapters, selected.value]);
  const errors = useMemo(() => filterErrorsByContext(allErrors, allSubjects, selected.value), [allErrors, allSubjects, selected.value]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [subject, setSubject] = useState("all");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    setVisible(20);
  }, [filter, subject, search]);

  const subjectNames = useMemo(() => {
    const names = new Set<string>();
    errors.forEach((e) => e.subjectName && names.add(e.subjectName));
    subjects.forEach((s) => s.name && names.add(s.name));
    return [...names].sort();
  }, [errors, subjects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return errors.filter((e) => {
      if (subject !== "all" && e.subjectName !== subject) return false;
      if (!q) return true;
      return (
        e.subjectName?.toLowerCase().includes(q) ||
        e.chapterName?.toLowerCase().includes(q) ||
        e.whyWrong.toLowerCase().includes(q)
      );
    });
  }, [errors, subject, search]);

  if (!user) return null;

  const openCount = openErrorCount;

  const handleGenerateSprint = async () => {
    setGenerating(true);
    try {
      const sprintId = await generateMistakesSprint(user.uid);
      if (sprintId) navigate(`/sprints/${sprintId}`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't start the sprint. Check your connection and try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleResolve = async (errId: string) => {
    try {
      await setErrorStatus(user.uid, errId, "resolved");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't resolve that mistake. Try again.");
    }
  };

  const handleDelete = async (errId: string) => {
    try {
      await deleteError(user.uid, errId);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't delete that entry. Try again.");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-display text-xl font-bold">
            <BookX size={20} className="text-brand-600" /> Mistake Log
          </h1>
          <p className="mt-1.5 max-w-[26rem] text-sm leading-relaxed text-text-secondary">
            Every wrong answer you log becomes a lesson here — review them so they never repeat.
          </p>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => setDialogOpen(true)}>
          <Plus size={16} /> Log mistake
        </Button>
      </div>

      <Segmented value={filter} onChange={setFilter} options={STATUS_OPTIONS} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          value={subject}
          onChange={setSubject}
          aria-label="Filter by subject"
          className="w-full sm:w-48"
          options={[
            { value: "all", label: "All subjects" },
            ...subjectNames.map((n) => ({ value: n, label: n })),
          ]}
        />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search mistakes…"
          aria-label="Search mistakes"
          className="w-full sm:max-w-xs"
        />
      </div>

      {filter !== "resolved" && openCount > 0 && (
        <Card className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-brand-600" />
            <p className="text-sm">
              <span className="font-semibold">{openCount}</span> open mistake
              {openCount > 1 ? "s" : ""} ready to revise.
            </p>
          </div>
          <Button size="sm" onClick={handleGenerateSprint} disabled={generating}>
            {generating ? "Starting..." : "Start Mistakes Sprint"}
          </Button>
        </Card>
      )}

      {filtered.length === 0 ? (
        <Card className="py-10 text-center text-sm text-text-secondary">
          {search.trim() || subject !== "all"
            ? "No mistakes match your filters."
            : "Nothing here yet — every mock test or PYQ session mistake you log will show up in this list for focused revision."}
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, visible).map((err) => (
            <Card key={err.id} className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                  <span className="rounded-full bg-surface-2 px-2 py-0.5">
                    {ERROR_TYPE_LABEL[err.errorType]}
                  </span>
                  <span>{err.subjectName}</span>
                  {err.chapterName && <span>· {err.chapterName}</span>}
                </div>
                <p className="mt-1 text-sm">{err.whyWrong}</p>
                <p className="mt-1 text-xs text-text-muted">Review by {err.reviewDate}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {err.status !== "resolved" && (
                  <button
                    onClick={() => handleResolve(err.id)}
                    className={cn(
                      "rounded-md border border-border px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface-2"
                    )}
                  >
                    Resolve
                  </button>
                )}
                <button
                  onClick={() => handleDelete(err.id)}
                  className="rounded-md p-1.5 text-text-muted hover:bg-surface-2 hover:text-danger"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {visible < filtered.length && (
        <div className="text-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setVisible((v) => v + 20)}
          >
            Show more mistakes ({filtered.length - visible} remaining)
          </Button>
        </div>
      )}

      <ErrorFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        uid={user.uid}
        subjects={subjects}
        chapters={chapters}
      />
    </div>
  );
}
