import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAppearance } from "@/lib/appearance";
import { cssColor } from "@/lib/color";
import { parseDayKey } from "@/lib/dates";
import type { MockTestDoc } from "@/lib/schema";

export function MockTrendChart({ tests }: { tests: (MockTestDoc & { id: string })[] }) {
  // Re-render on theme changes so recharts re-resolves the CSS-variable fills.
  useAppearance();
  const data = tests.map((t) => ({
    name: t.name,
    date: parseDayKey(t.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
    marks: t.totalMarks,
  }));

  const line = cssColor("--brand-500");

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="marksGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={line} stopOpacity={0.35} />
              <stop offset="100%" stopColor={line} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: cssColor("--text-secondary") }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: cssColor("--text-secondary") }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            formatter={(value: number) => [value, "Marks"]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ""}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--surface))",
              fontSize: 12,
              color: "hsl(var(--text-primary))",
            }}
            labelStyle={{ color: "hsl(var(--text-primary))" }}
            itemStyle={{ color: "hsl(var(--text-primary))" }}
          />
          <Area
            type="monotone"
            dataKey="marks"
            stroke={line}
            strokeWidth={2}
            fill="url(#marksGradient)"
            dot={{ r: 3, fill: line }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
