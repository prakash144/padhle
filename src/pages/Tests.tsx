import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MockTrendChart } from "@/components/MockTrendChart";
import { MockTestFormDialog } from "@/components/MockTestFormDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useMockTests, useSubjects } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { filterSubjectsByContext, filterTestsByContext, useAcademicContext } from "@/lib/academicContext";

export function Tests() {
  const { user, userDoc } = useAuth();
  const allTests = useMockTests(20);
  const allSubjects = useSubjects();
  const { selected: academicContext } = useAcademicContext();
  const tests = filterTestsByContext(allTests, academicContext.value);
  const subjects = filterSubjectsByContext(allSubjects, academicContext.value);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!user) return null;

  const latest = tests[tests.length - 1];
  const selected = tests.find((t) => t.id === selectedId) ?? latest;
  const examType = academicContext.value ?? userDoc?.stream ?? subjects[0]?.examType ?? "jeeMain";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold">Tests & PYQs</h1>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus size={16} /> Log test
        </Button>
      </div>

      {tests.length === 0 ? (
        <Card className="py-10 text-center text-sm text-text-secondary">
          No mock tests logged yet. Add your first one to start tracking trends.
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Latest score" value={`${latest.totalMarks}/${latest.maxMarks}`} />
            <StatCard label="Percentile" value={latest.percentile ? `${latest.percentile}` : "—"} />
            <StatCard label="Accuracy" value={`${latest.accuracy}%`} />
            <StatCard
              label="Time/Q"
              value={
                latest.attempted > 0
                  ? `${Math.round((latest.timeSpentMinutes / latest.attempted) * 10) / 10}m`
                  : "—"
              }
            />
          </div>

          <Card className="p-4">
            <p className="mb-2 text-sm font-semibold">Score trend</p>
            <MockTrendChart tests={tests} />
          </Card>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {tests
              .slice()
              .reverse()
              .map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-micro",
                    "hover:border-border-strong active:scale-95",
                    (selected?.id ?? latest.id) === t.id
                      ? "border-brand-600 bg-brand-500/10 text-brand-600"
                      : "border-border bg-surface text-text-secondary"
                  )}
                >
                  {t.name}
                </button>
              ))}
          </div>

          {selected && (
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">{selected.name}</p>
                <span className="text-xs text-text-muted">
                  {selected.correct}✓ · {selected.incorrect}✗ · {selected.unattempted} skipped
                </span>
              </div>

              {selected.subjectBreakdown.length > 0 && (
                <div className="space-y-2">
                  {selected.subjectBreakdown.map((row) => (
                    <div key={row.subjectId}>
                      <div className="mb-1 flex justify-between text-xs text-text-secondary">
                        <span>{row.subjectName}</span>
                        <span className="tabular">{row.marks} marks</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-brand-600"
                          style={{
                            width: `${Math.min(
                              100,
                              (row.correct / Math.max(1, row.correct + row.incorrect + row.unattempted)) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-text-secondary">
                <p>
                  Marks lost to wrong answers: <span className="font-medium text-danger">{selected.marksLostWrong}</span>
                </p>
                <p>
                  Marks lost to skipped: <span className="font-medium text-warning">{selected.marksLostUnattempted}</span>
                </p>
              </div>

              <Link to="/errors" className="mt-3 block">
                <Button variant="secondary" className="w-full">
                  Review mistakes in Mistake Log
                </Button>
              </Link>
            </Card>
          )}
        </>
      )}

      <MockTestFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        uid={user.uid}
        examType={examType}
        subjects={subjects}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3 text-center">
      <p className="font-numeric text-lg font-semibold tabular">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </Card>
  );
}
