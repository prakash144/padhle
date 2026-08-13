import { SessionTree } from "@/components/ForestTree";
import type { FocusSessionDoc } from "@/lib/schema";

export function ForestStrip({
  sessions,
  emptyHint = "Complete a focus session to plant your first tree.",
}: {
  sessions: (FocusSessionDoc & { id: string })[];
  emptyHint?: string;
}) {
  if (sessions.length === 0) {
    return <p className="text-sm text-text-secondary">{emptyHint}</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {sessions.map((s, i) => (
        <SessionTree key={s.id} session={s} delay={Math.min(i, 20) * 0.02} />
      ))}
    </div>
  );
}
