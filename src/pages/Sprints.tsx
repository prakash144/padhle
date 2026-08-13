import { useState } from "react";
import { Archive, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { SprintCard } from "@/components/SprintCard";
import { SprintFormDialog } from "@/components/SprintFormDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useSprints } from "@/lib/hooks";

export function Sprints() {
  const { user } = useAuth();
  const sprints = useSprints();
  const [tab, setTab] = useState<"active" | "archive">("active");
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!user) return null;

  const active = sprints.filter((s) => s.status === "active");
  const archived = sprints.filter((s) => s.status !== "active");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold">Study Sprints</h1>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus size={16} /> New sprint
        </Button>
      </div>

      <Segmented
        value={tab}
        onChange={(v) => setTab(v as "active" | "archive")}
        options={[
          { value: "active", label: "Active" },
          { value: "archive", label: "Archive" },
        ]}
      />

      {tab === "active" ? (
        active.length === 0 ? (
          <Card className="py-10 text-center text-sm text-text-secondary">
            No active sprint. Start a 7/14/30-day sprint to give yourself a short, visible
            target. Open one, add tasks on its board, and drag them to Done as you go.
          </Card>
        ) : (
          <div className="space-y-3">
            {active.map((sprint) => (
              <SprintCard key={sprint.id} sprint={sprint} />
            ))}
          </div>
        )
      ) : (
        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-xs text-text-muted">
            <Archive size={13} /> Finished sprints live here — tap one to look back at the board.
          </p>
          {archived.length === 0 ? (
            <Card className="py-10 text-center text-sm text-text-secondary">
              Nothing archived yet. Complete or abandon a sprint and it moves here.
            </Card>
          ) : (
            archived.map((sprint) => (
              <SprintCard key={sprint.id} sprint={sprint} compact />
            ))
          )}
        </div>
      )}

      <SprintFormDialog open={dialogOpen} onOpenChange={setDialogOpen} uid={user.uid} />
    </div>
  );
}