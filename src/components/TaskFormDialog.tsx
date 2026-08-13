import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, type SelectOption } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { createTask } from "@/lib/tasks";
import { useToast } from "@/lib/useToast";
import type { ChapterDoc, SubjectDoc, TaskCategory, Difficulty, Priority } from "@/lib/schema";

const CATEGORIES: { value: TaskCategory; label: string }[] = [
  { value: "jee", label: "JEE" },
  { value: "board", label: "Board" },
  { value: "school", label: "School" },
  { value: "pyq", label: "PYQ" },
  { value: "revision", label: "Revision" },
  { value: "mock", label: "Mock" },
];

const PRIORITIES: SelectOption[] = [
  { value: "low", label: "Low · P3", dot: "bg-text-muted" },
  { value: "med", label: "Medium · P2", dot: "bg-warning" },
  { value: "high", label: "High · P1", dot: "bg-danger" },
];

const DIFFICULTIES: SelectOption[] = [
  { value: "easy", label: "Easy", dot: "bg-success" },
  { value: "med", label: "Medium", dot: "bg-warning" },
  { value: "hard", label: "Hard", dot: "bg-danger" },
];

export function TaskFormDialog({
  open,
  onOpenChange,
  uid,
  scheduledDate,
  subjects,
  chapters,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uid: string;
  scheduledDate: string;
  subjects: (SubjectDoc & { id: string })[];
  chapters: (ChapterDoc & { id: string })[];
  onCreated?: () => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TaskCategory>("jee");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [priority, setPriority] = useState<Priority>("med");
  const [difficulty, setDifficulty] = useState<Difficulty>("med");
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | "">(30);
  const [targetQuestions, setTargetQuestions] = useState<number | "">("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const chapterOptions = useMemo(
    () => chapters.filter((c) => c.subjectId === subjectId),
    [chapters, subjectId]
  );

  const reset = () => {
    setTitle("");
    setCategory("jee");
    setSubjectId("");
    setChapterId("");
    setPriority("med");
    setDifficulty("med");
    setEstimatedMinutes(30);
    setTargetQuestions("");
    setDeadline("");
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const subject = subjects.find((s) => s.id === subjectId);
      const chapter = chapterOptions.find((c) => c.id === chapterId);
      await createTask(uid, {
        title: title.trim(),
        category,
        subjectId: subject?.id,
        subjectName: subject?.name,
        chapterId: chapter?.id,
        chapterName: chapter?.name,
        priority,
        difficulty,
        estimatedMinutes: Math.max(5, estimatedMinutes === "" ? 30 : Number(estimatedMinutes)),
        targetQuestions: targetQuestions === "" ? undefined : Number(targetQuestions),
        deadline: deadline ? new Date(`${deadline}T12:00:00`) : undefined,
        scheduledDate,
      });
      reset();
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save your task. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle className="mb-4 font-display text-lg font-bold">Add task</DialogTitle>
        <div className="space-y-3">
          <Field label="Task">
            <Input
              placeholder="What are you doing? e.g. Solve 40 PYQs"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select
                value={category}
                onChange={(v) => setCategory(v as TaskCategory)}
                options={CATEGORIES}
              />
            </Field>
            <Field label="Subject">
              <Select
                value={subjectId}
                onChange={(v) => {
                  setSubjectId(v);
                  setChapterId("");
                }}
                options={[
                  { value: "", label: "No subject" },
                  ...subjects.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
            </Field>
          </div>

          {subjectId && (
            <Field label="Chapter">
              <Select
                value={chapterId}
                onChange={(v) => setChapterId(v)}
                placeholder="Chapter (optional)"
                options={[
                  { value: "", label: "No chapter" },
                  ...chapterOptions.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <Select
                value={priority}
                onChange={(v) => setPriority(v as Priority)}
                options={PRIORITIES}
              />
            </Field>
            <Field label="Difficulty" hint="Easy ≈ quick · Hard = deep work">
              <Select
                value={difficulty}
                onChange={(v) => setDifficulty(v as Difficulty)}
                options={DIFFICULTIES}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Estimated minutes">
              <Input
                type="number"
                min={5}
                value={estimatedMinutes}
                onChange={(e) =>
                  setEstimatedMinutes(e.target.value === "" ? "" : Number(e.target.value))
                }
              />
            </Field>
            <Field label="Target questions">
              <Input
                type="number"
                min={0}
                value={targetQuestions}
                onChange={(e) =>
                  setTargetQuestions(e.target.value === "" ? "" : Number(e.target.value))
                }
              />
            </Field>
          </div>

          <Field label="Deadline" hint="Optional">
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>

          <Button onClick={handleSubmit} disabled={saving || !title.trim()} className="w-full">
            {saving ? "Adding..." : "Add task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
