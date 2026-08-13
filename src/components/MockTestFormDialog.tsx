import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createMockTest } from "@/lib/mockTests";
import { dayKey } from "@/lib/dates";
import { useToast } from "@/lib/useToast";
import type { ExamType, SubjectDoc } from "@/lib/schema";

interface SubjectRow {
  subjectId: string;
  subjectName: string;
  marks: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  timeMinutes: number;
}

export function MockTestFormDialog({
  open,
  onOpenChange,
  uid,
  examType,
  subjects,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uid: string;
  examType: ExamType;
  subjects: (SubjectDoc & { id: string })[];
  onCreated?: () => void;
}) {
  const [name, setName] = useState("");
  const [date, setDate] = useState(dayKey(new Date()));
  const [totalMarks, setTotalMarks] = useState(0);
  const [maxMarks, setMaxMarks] = useState(300);
  const [percentile, setPercentile] = useState<number | "">("");
  const [attempted, setAttempted] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [incorrect, setIncorrect] = useState(0);
  const [unattempted, setUnattempted] = useState(0);
  const [timeSpentMinutes, setTimeSpentMinutes] = useState(180);
  const [marksLostWrong, setMarksLostWrong] = useState(0);
  const [marksLostUnattempted, setMarksLostUnattempted] = useState(0);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const relevantSubjects = useMemo(
    () => subjects.filter((s) => s.examType === examType),
    [subjects, examType]
  );
  const [rows, setRows] = useState<SubjectRow[]>([]);

  const rowFor = (subjectId: string, subjectName: string): SubjectRow =>
    rows.find((r) => r.subjectId === subjectId) ?? {
      subjectId,
      subjectName,
      marks: 0,
      correct: 0,
      incorrect: 0,
      unattempted: 0,
      timeMinutes: 0,
    };

  const updateRow = (subjectId: string, subjectName: string, patch: Partial<SubjectRow>) => {
    setRows((prev) => {
      const existing = rowFor(subjectId, subjectName);
      const next = { ...existing, ...patch };
      const others = prev.filter((r) => r.subjectId !== subjectId);
      return [...others, next];
    });
  };

  const reset = () => {
    setName("");
    setTotalMarks(0);
    setPercentile("");
    setAttempted(0);
    setCorrect(0);
    setIncorrect(0);
    setUnattempted(0);
    setMarksLostWrong(0);
    setMarksLostUnattempted(0);
    setRows([]);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createMockTest(uid, {
        name: name.trim(),
        examType,
        date,
        totalMarks,
        maxMarks,
        percentile: percentile === "" ? undefined : Number(percentile),
        attempted,
        correct,
        incorrect,
        unattempted,
        timeSpentMinutes,
        marksLostWrong,
        marksLostUnattempted,
        subjectBreakdown: rows,
      });
      reset();
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save the test. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogTitle className="mb-4 font-display text-lg font-bold">Log a mock test</DialogTitle>
        <div className="space-y-3">
          <Input placeholder="e.g. JEE Main Mock 4" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-text-muted">
              Date
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
            </label>
            <OptionalNumberField label="Percentile (optional)" value={percentile} onChange={setPercentile} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Marks scored" value={totalMarks} onChange={setTotalMarks} />
            <NumberField label="Max marks" value={maxMarks} onChange={setMaxMarks} />
          </div>

          <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Overall
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Attempted" value={attempted} onChange={setAttempted} />
            <NumberField label="Correct" value={correct} onChange={setCorrect} />
            <NumberField label="Incorrect" value={incorrect} onChange={setIncorrect} />
            <NumberField label="Unattempted" value={unattempted} onChange={setUnattempted} />
            <NumberField label="Time spent (min)" value={timeSpentMinutes} onChange={setTimeSpentMinutes} />
            <NumberField label="Marks lost — wrong" value={marksLostWrong} onChange={setMarksLostWrong} />
            <NumberField label="Marks lost — unattempted" value={marksLostUnattempted} onChange={setMarksLostUnattempted} />
          </div>

          {relevantSubjects.length > 0 && (
            <>
              <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Subject-wise (optional)
              </p>
              <div className="space-y-3">
                {relevantSubjects.map((s) => {
                  const row = rowFor(s.id, s.name);
                  return (
                    <div key={s.id} className="rounded-lg border border-border p-2.5">
                      <p className="mb-2 text-sm font-medium">{s.name}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <MiniNumberField
                          label="Marks"
                          value={row.marks}
                          onChange={(v) => updateRow(s.id, s.name, { marks: v })}
                        />
                        <MiniNumberField
                          label="Time (min)"
                          value={row.timeMinutes}
                          onChange={(v) => updateRow(s.id, s.name, { timeMinutes: v })}
                        />
                        <MiniNumberField
                          label="Correct"
                          value={row.correct}
                          onChange={(v) => updateRow(s.id, s.name, { correct: v })}
                        />
                        <MiniNumberField
                          label="Incorrect"
                          value={row.incorrect}
                          onChange={(v) => updateRow(s.id, s.name, { incorrect: v })}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <Button onClick={handleSubmit} disabled={saving || !name.trim()} className="w-full">
            {saving ? "Saving..." : "Save test"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="text-xs text-text-muted">
      {label}
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1"
      />
    </label>
  );
}

function OptionalNumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
}) {
  return (
    <label className="text-xs text-text-muted">
      {label}
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        className="mt-1"
      />
    </label>
  );
}

function MiniNumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="text-[11px] text-text-muted">
      {label}
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-0.5 h-9"
      />
    </label>
  );
}
