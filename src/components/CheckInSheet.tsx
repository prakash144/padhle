import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveMorningCheckinWithOptions } from "@/lib/checkins";
import { useToast } from "@/lib/useToast";

export function CheckInSheet({
  open,
  onOpenChange,
  uid,
  date,
  initialGoals,
  initialDailyTargetMinutes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uid: string;
  date: string;
  initialGoals?: string[];
  initialDailyTargetMinutes?: number;
}) {
  const [goals, setGoals] = useState(() => {
    const next = ["", "", ""];
    initialGoals?.slice(0, 3).forEach((goal, i) => {
      next[i] = goal;
    });
    return next;
  });
  const [dailyTargetMinutes, setDailyTargetMinutes] = useState<number | "">(
    initialDailyTargetMinutes ?? 180
  );
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const next = ["", "", ""];
    initialGoals?.slice(0, 3).forEach((goal, i) => {
      next[i] = goal;
    });
    setGoals(next);
    setDailyTargetMinutes(initialDailyTargetMinutes ?? 180);
  }, [initialGoals, initialDailyTargetMinutes, open]);

  const handleSubmit = async () => {
    const top3 = goals.map((g) => g.trim()).filter(Boolean);
    if (top3.length === 0) return;
    setSaving(true);
    try {
      await saveMorningCheckinWithOptions(uid, date, {
        top3,
        dailyTargetMinutes:
          dailyTargetMinutes === "" ? undefined : Math.max(30, Number(dailyTargetMinutes)),
      });
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save your goals. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle className="font-display text-lg font-bold">
          Set up today
        </DialogTitle>
        <p className="mb-4 mt-1 text-sm text-text-secondary">
          Keep it small. One clear win beats a long list.
        </p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Daily target (minutes)
            </label>
            <Input
              type="number"
              min={30}
              step={15}
              value={dailyTargetMinutes}
              onChange={(e) =>
                setDailyTargetMinutes(e.target.value === "" ? "" : Number(e.target.value))
              }
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-text-secondary">Top priorities</p>
            <p className="mb-2 text-xs text-text-muted">
              These drive Today&apos;s next action and auto-planning.
            </p>
          </div>
          {goals.map((goal, i) => (
            <Input
              key={i}
              placeholder={`Priority ${i + 1}${i === 0 ? "" : " (optional)"}`}
              value={goal}
              onChange={(e) => {
                const next = [...goals];
                next[i] = e.target.value;
                setGoals(next);
              }}
              autoFocus={i === 0}
            />
          ))}
        </div>
        <Button
          onClick={handleSubmit}
          disabled={saving || !goals.some((g) => g.trim())}
          className="mt-4 w-full"
        >
          {saving ? "Saving..." : "Start the day"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
