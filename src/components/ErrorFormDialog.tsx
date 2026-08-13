import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { createError } from "@/lib/errors";
import { addDays, dayKey } from "@/lib/dates";
import { useToast } from "@/lib/useToast";
import type { ChapterDoc, ErrorType, SubjectDoc } from "@/lib/schema";

const ERROR_TYPES: { value: ErrorType; label: string }[] = [
  { value: "concept", label: "Concept mistake" },
  { value: "formula", label: "Formula forgotten" },
  { value: "calc", label: "Calculation error" },
  { value: "silly", label: "Silly mistake" },
  { value: "guessed", label: "Guessed" },
  { value: "time", label: "Time pressure" },
];

export function ErrorFormDialog({
  open,
  onOpenChange,
  uid,
  subjects,
  chapters,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uid: string;
  subjects: (SubjectDoc & { id: string })[];
  chapters: (ChapterDoc & { id: string })[];
  onCreated?: () => void;
}) {
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [errorType, setErrorType] = useState<ErrorType>("concept");
  const [whyWrong, setWhyWrong] = useState("");
  const [reviewDate, setReviewDate] = useState(dayKey(addDays(new Date(), 3)));
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const chapterOptions = useMemo(
    () => chapters.filter((c) => c.subjectId === subjectId),
    [chapters, subjectId]
  );

  const handleSubmit = async () => {
    const subject = subjects.find((s) => s.id === subjectId);
    if (!subject || !whyWrong.trim()) return;
    setSaving(true);
    try {
      const chapter = chapterOptions.find((c) => c.id === chapterId);
      await createError(uid, {
        subjectId: subject.id,
        subjectName: subject.name,
        chapterId: chapter?.id,
        chapterName: chapter?.name,
        errorType,
        whyWrong: whyWrong.trim(),
        reviewDate,
      });
      setSubjectId("");
      setChapterId("");
      setWhyWrong("");
      setErrorType("concept");
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save the mistake. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle className="mb-4 font-display text-lg font-bold">Log a mistake</DialogTitle>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Subject">
              <Select
                value={subjectId}
                onChange={(v) => {
                  setSubjectId(v);
                  setChapterId("");
                }}
                placeholder="Subject"
                options={subjects.map((s) => ({ value: s.id, label: s.name }))}
              />
            </Field>
            <Field label="Chapter">
              <Select
                value={chapterId}
                onChange={(v) => setChapterId(v)}
                placeholder="Chapter (optional)"
                disabled={!subjectId}
                options={[
                  { value: "", label: "No chapter" },
                  ...chapterOptions.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </Field>
          </div>

          <Field
            label="What kind of mistake?"
            hint="Be honest — the Mistake Log only helps when it's accurate."
          >
            <Select
              value={errorType}
              onChange={(v) => setErrorType(v as ErrorType)}
              options={ERROR_TYPES}
            />
          </Field>

          <Field label="Why did you get it wrong?">
            <Input
              placeholder="I rushed, misread the question, forgot the formula…"
              value={whyWrong}
              onChange={(e) => setWhyWrong(e.target.value)}
            />
          </Field>

          <Field label="Review by">
            <Input
              type="date"
              value={reviewDate}
              onChange={(e) => setReviewDate(e.target.value)}
            />
          </Field>

          <Button onClick={handleSubmit} disabled={saving || !subjectId || !whyWrong.trim()} className="w-full">
            {saving ? "Saving..." : "Save to Mistake Log"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
