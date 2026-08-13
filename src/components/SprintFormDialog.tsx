import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { createSprint } from "@/lib/sprints";
import { dayKey } from "@/lib/dates";
import { useToast } from "@/lib/useToast";
import type { SprintType } from "@/lib/schema";

export function SprintFormDialog({
  open,
  onOpenChange,
  uid,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uid: string;
  onCreated?: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<SprintType>("7");
  const [targetQuestions, setTargetQuestions] = useState(200);
  const [targetPyqs, setTargetPyqs] = useState(50);
  const [targetMocks, setTargetMocks] = useState(1);
  const [targetFocusHours, setTargetFocusHours] = useState(10);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createSprint(uid, {
        name: name.trim(),
        type,
        startDate: dayKey(new Date()),
        goals: { targetQuestions, targetPyqs, targetMocks, targetFocusHours },
      });
      setName("");
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't start the sprint. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle className="mb-4 font-display text-lg font-bold">New sprint</DialogTitle>
        <div className="space-y-3">
          <Input
            placeholder="e.g. JEE Physics — Electrostatics"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <Segmented
            value={type}
            onChange={setType}
            options={[
              { value: "7", label: "7 days" },
              { value: "14", label: "14 days" },
              { value: "30", label: "30 days" },
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Target questions" value={targetQuestions} onChange={setTargetQuestions} />
            <NumberField label="Target PYQs" value={targetPyqs} onChange={setTargetPyqs} />
            <NumberField label="Mock tests" value={targetMocks} onChange={setTargetMocks} />
            <NumberField label="Focus hours" value={targetFocusHours} onChange={setTargetFocusHours} />
          </div>
          <Button onClick={handleSubmit} disabled={saving || !name.trim()} className="w-full">
            {saving ? "Creating..." : "Start sprint"}
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
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1"
      />
    </label>
  );
}
