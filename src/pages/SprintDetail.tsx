import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ProgressRing";
import { Confetti } from "@/components/Confetti";
import { SprintBoard } from "@/components/SprintBoard";
import { SprintRetro } from "@/components/SprintRetro";
import { useAuth } from "@/contexts/AuthContext";
import { useSprint, useSprintTasks } from "@/lib/hooks";
import { setSprintStatus, sprintCompletionPct, sprintDayProgress } from "@/lib/sprints";
import { useToast } from "@/lib/useToast";
import { cn } from "@/lib/utils";

export function SprintDetail() {
  const { sprintId } = useParams<{ sprintId: string }>();
  const { user } = useAuth();
  const sprint = useSprint(sprintId);
  const sprintTasks = useSprintTasks(sprintId);
  const navigate = useNavigate();
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const toast = useToast();

  if (!user) return null;
  if (!sprint) {
    return <p className="text-center text-sm text-text-secondary">Loading sprint...</p>;
  }

  const { currentDay, totalDays } = sprintDayProgress(sprint);
  const pct = sprintCompletionPct(sprint);
  const expectedPct = totalDays > 0 ? (currentDay / totalDays) * 100 : 0;
  const aheadPct = pct - expectedPct;
  const health =
    aheadPct >= 5 ? { label: "Ahead of schedule", cls: "text-success", emoji: "🚀" }
    : aheadPct >= -15 ? { label: "On track", cls: "text-brand-600", emoji: "🎯" }
    : { label: "Behind schedule", cls: "text-warning", emoji: "⏳" };

  const rows = [
    { label: "Questions", done: sprint.progress.questions, target: sprint.goals.targetQuestions },
    { label: "PYQs", done: sprint.progress.pyqs, target: sprint.goals.targetPyqs },
    { label: "Mock tests", done: sprint.progress.mocks, target: sprint.goals.targetMocks },
    {
      label: "Focus hours",
      done: Math.round((sprint.progress.focusMinutes / 60) * 10) / 10,
      target: sprint.goals.targetFocusHours,
    },
  ];
  const plannedMinutes = sprintTasks.reduce((sum, task) => sum + (task.estimatedMinutes || 0), 0);
  const actualMinutes = sprintTasks.reduce((sum, task) => sum + (task.actualMinutes || 0), 0);
  const taskDonePct =
    sprintTasks.length > 0
      ? Math.round((sprintTasks.filter((task) => task.status === "done").length / sprintTasks.length) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link to="/sprints" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft size={16} /> Sprints
      </Link>

      <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-2">
        <Card className="p-6 text-center">
          <p className="font-display text-lg font-bold">{sprint.name}</p>
          <div className="mx-auto my-4">
            <ProgressRing size={140} strokeWidth={12} progress={pct / 100} gradient>
              <span className="font-numeric text-2xl font-semibold tabular">{pct}%</span>
            </ProgressRing>
          </div>
          <p className="text-sm text-text-secondary">
            Day {currentDay} of {totalDays}
          </p>
          <p className={cn("mt-2 inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium", health.cls)}>
            {health.emoji} {health.label}
          </p>
        </Card>

        <Card className="p-4">
          <p className="mb-3 text-sm font-semibold">Breakdown</p>
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between text-xs text-text-secondary">
                  <span>{row.label}</span>
                  <span className="tabular">
                    {row.done}/{row.target}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-brand-600 transition-[width] duration-500 ease-out"
                    style={{ width: `${Math.min(100, (row.done / (row.target || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <p className="mb-3 text-sm font-semibold">Mission effort</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <EffortStat label="Tasks completed" value={`${taskDonePct}%`} hint={`${sprintTasks.filter((task) => task.status === "done").length}/${sprintTasks.length} cards`} />
          <EffortStat label="Planned effort" value={`${plannedMinutes}m`} hint="From sprint cards" />
          <EffortStat label="Actual effort" value={`${actualMinutes || sprint.progress.focusMinutes}m`} hint="From completed tasks/focus" />
        </div>
      </Card>

      <div className="flex gap-1">
        {Array.from({ length: totalDays }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-2 flex-1 rounded-full",
              i + 1 < currentDay && "bg-brand-600",
              i + 1 === currentDay && "bg-brand-600 ring-2 ring-brand-600/30 ring-offset-1 ring-offset-bg",
              i + 1 > currentDay && "bg-border"
            )}
          />
        ))}
      </div>

      <Card className="p-4">
        <SprintBoard uid={user.uid} sprintId={sprint.id} />
      </Card>

      {sprint.status !== "active" && <SprintRetro sprint={sprint} />}

      <Link to={`/focus?sprintId=${sprint.id}`}>
        <Button className="w-full">Continue sprint → Focus Timer</Button>
      </Link>

      {sprint.status === "active" && (
        <>
          <Button
            variant="secondary"
            className="w-full"
            onClick={async () => {
              setConfettiTrigger((t) => t + 1);
              try {
                await setSprintStatus(user.uid, sprint.id, "completed");
                setTimeout(() => navigate(`/sprints/${sprint.id}`), 900);
              } catch (err) {
                console.error(err);
                toast.error("Couldn't complete the sprint. Try again.");
              }
            }}
          >
            Mark sprint complete 🎉
          </Button>
          <button
            onClick={async () => {
              try {
                await setSprintStatus(user.uid, sprint.id, "abandoned");
                navigate(`/sprints/${sprint.id}`);
              } catch (err) {
                console.error(err);
                toast.error("Couldn't abandon the sprint. Try again.");
              }
            }}
            className="w-full text-center text-xs text-text-muted hover:text-danger"
          >
            Abandon sprint
          </button>
        </>
      )}

      <Confetti trigger={confettiTrigger} />
    </div>
  );
}

function EffortStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 font-numeric text-xl font-semibold tabular">{value}</p>
      <p className="mt-1 text-xs text-text-secondary">{hint}</p>
    </div>
  );
}
