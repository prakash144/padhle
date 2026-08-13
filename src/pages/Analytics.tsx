import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, TrendingDown, TrendingUp, Timer } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { useAppearance } from "@/lib/appearance";
import { cssColor } from "@/lib/color";
import {
  byActivity,
  bySubject,
  buildAnalyticsInsights,
  currentFilter,
  pctDelta,
  previousPeriod,
  sessionQueryWindow,
  sessionsInPeriod,
  topSlice,
  trendSeries,
  type Slice,
  type TimePeriod,
} from "@/lib/analytics";
import { dayKey } from "@/lib/dates";
import { useChapters, useErrors, useFocusSessionsInRange, useMockTests, useSubjects } from "@/lib/hooks";

const PERIOD_LABEL: Record<TimePeriod, string> = {
  day: "vs yesterday",
  week: "vs last week",
  month: "vs last month",
  year: "vs previous year",
  custom: "vs previous period",
};

export function Analytics() {
  const subjects = useSubjects();
  const chapters = useChapters();
  const errors = useErrors();
  const tests = useMockTests(20);
  // Re-render on theme changes so recharts re-resolves the CSS-variable fills.
  useAppearance();
  const [kind, setKind] = useState<TimePeriod>("week");
  const [year, setYear] = useState(new Date().getFullYear());
  const [customStart, setCustomStart] = useState(() => dayKey(new Date(Date.now() - 29 * 86400000)));
  const [customEnd, setCustomEnd] = useState(() => dayKey(new Date()));

  const filter = useMemo(
    () => currentFilter(kind, year, customStart, customEnd),
    [kind, year, customStart, customEnd]
  );
  // Bounded server query: only the current period + the comparison period.
  const window = useMemo(() => sessionQueryWindow(filter), [filter]);
  const sessions = useFocusSessionsInRange(window.start, window.end);
  const period = useMemo(() => sessionsInPeriod(sessions, filter), [sessions, filter]);
  const subjectSlices = useMemo(() => bySubject(sessions, filter), [sessions, filter]);
  const activitySlices = useMemo(() => byActivity(sessions, filter), [sessions, filter]);
  const trend = useMemo(() => trendSeries(sessions, filter), [sessions, filter]);
  const prevFilter = useMemo(() => previousPeriod(filter), [filter]);
  const prevMinutes = useMemo(() => sessionsInPeriod(sessions, prevFilter).totalMinutes, [sessions, prevFilter]);
  const insights = useMemo(
    () => buildAnalyticsInsights({ sessions, filter, subjects, chapters, errors, tests }),
    [sessions, filter, subjects, chapters, errors, tests]
  );

  const totalHours = period.totalMinutes / 60;
  const prevHours = prevMinutes / 60;
  const delta = pctDelta(period.totalMinutes, prevMinutes);
  const dominant = topSlice(subjectSlices);
  const dominantPct = dominant && period.totalMinutes > 0 ? Math.round((dominant.value / period.totalMinutes) * 100) : 0;
  const hours = (n: number) => (n >= 100 ? `${Math.round(n)}h` : `${n.toFixed(1)}h`);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 4 + i);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-xl font-bold">Analytics</h1>
        <Segmented
          value={kind}
          onChange={(v) => setKind(v as TimePeriod)}
          options={[
            { value: "day", label: "Day" },
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
            { value: "year", label: "Year" },
            { value: "custom", label: "Custom" },
          ]}
        />
      </div>

      {kind === "year" && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-text-muted" htmlFor="analytic-year">
            Year
          </label>
          <Select
            id="analytic-year"
            value={String(year)}
            onChange={(v) => setYear(Number(v))}
            options={years.map((y) => ({ value: String(y), label: String(y) }))}
            className="w-28"
          />
        </div>
      )}

      {kind === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-text-muted" htmlFor="analytic-start">
            From
          </label>
          <Input
            id="analytic-start"
            type="date"
            value={customStart}
            max={customEnd}
            onChange={(e) => e.target.value && setCustomStart(e.target.value)}
            className="w-40"
          />
          <label className="text-xs font-medium text-text-muted" htmlFor="analytic-end">
            To
          </label>
          <Input
            id="analytic-end"
            type="date"
            value={customEnd}
            min={customStart}
            max={dayKey(new Date())}
            onChange={(e) => e.target.value && setCustomEnd(e.target.value)}
            className="w-40"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          label="Focus time"
          value={totalHours}
          format={(n) => hours(n)}
          unit="hours"
        />
        <Kpi label="Sessions" value={period.sessionCount} unit="runs" />
        <Kpi label="Active days" value={period.activeDays} unit="days" />
        <Kpi
          label="Avg / session"
          value={period.sessionCount > 0 ? period.totalMinutes / period.sessionCount : 0}
          format={(n) => String(Math.round(n))}
          unit="min"
        />
      </div>

      <DeltaCard delta={delta} label={PERIOD_LABEL[kind]} prevHours={prevHours} />

      {insights.length > 0 && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Actionable insights</p>
              <p className="text-xs text-text-secondary">Why performance moved, and the next useful action.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {insights.map((insight) => (
              <Link
                key={insight.id}
                to={insight.actionHref}
                className={`rounded-lg border p-3 transition-colors hover:border-brand-600 ${
                  insight.tone === "warning"
                    ? "border-warning/40 bg-warning/5"
                    : insight.tone === "success"
                      ? "border-success/40 bg-success/5"
                      : "border-border bg-surface-2/60"
                }`}
              >
                <p className="text-sm font-semibold">{insight.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary">{insight.detail}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600">
                  {insight.actionLabel} <ArrowRight size={13} />
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {period.totalMinutes === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-10 text-center">
          <Timer size={28} className="text-text-muted" />
          <p className="text-sm font-medium">No focus time in this period yet</p>
          <p className="text-xs text-text-secondary">Run a focus session and it shows up here automatically.</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DonutCard title="Time by subject" slices={subjectSlices} total={period.totalMinutes} />
            <DonutCard title="Time by activity" slices={activitySlices} total={period.totalMinutes} />
          </div>

          <Card className="p-4">
            <p className="mb-3 text-sm font-semibold">Daily focus trend</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fill: cssColor("--text-secondary"), fontSize: 11 }}
                    interval="preserveStartEnd"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fill: cssColor("--text-secondary"), fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--surface-2)", opacity: 0.6 }}
                    contentStyle={tooltipStyle}
                    labelStyle={tooltipTextStyle}
                    itemStyle={tooltipTextStyle}
                    formatter={(value) => [`${Math.round(Number(value))} min`, "Focus"]}
                  />
                  <Bar dataKey="minutes" fill={cssColor("--brand-500")} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {dominant && (
            <Card className="p-4">
              <p className="text-sm">
                <span className="font-semibold">{dominant.name}</span>{" "}
                <span className="text-text-secondary">
                  is your most-studied subject this period at {dominantPct}% of focus time.
                </span>
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--text-primary)",
} as const;

const tooltipTextStyle = {
  color: "var(--text-primary)",
} as const;

function Kpi({
  label,
  value,
  format,
  unit,
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
  unit: string;
}) {
  return (
    <Card className="p-3 text-center">
      <AnimatedNumber
        value={value}
        format={format}
        className="tabular font-numeric block text-xl font-semibold"
      />
      <p className="text-[11px] text-text-muted">
        {label} · {unit}
      </p>
    </Card>
  );
}

function DeltaCard({ delta, label, prevHours }: { delta: number | null; label: string; prevHours: number }) {
  if (delta === null) {
    return (
      <Card className="flex items-center gap-3 py-3 text-sm text-text-secondary">
        <TrendingUp size={16} className="text-text-muted" />
        No comparable previous period yet — this is your baseline.
      </Card>
    );
  }
  const up = delta >= 0;
  return (
    <Card
      className={`flex items-center justify-between px-4 py-3 ${
        up ? "border-success" : "border-warning"
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        {up ? (
          <TrendingUp size={16} className="text-success" />
        ) : (
          <TrendingDown size={16} className="text-warning" />
        )}
        <span className={up ? "text-success" : "text-warning"}>
          {up ? "+" : ""}
          {Math.round(delta)}%
        </span>
        <span className="text-xs font-normal text-text-secondary">{label}</span>
      </div>
      <span className="tabular text-xs text-text-muted">
        {hoursLabel(prevHours)} before
      </span>
    </Card>
  );
}

function DonutCard({ title, slices, total }: { title: string; slices: Slice[]; total: number }) {
  return (
    <Card className="p-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <span className="tabular text-sm font-medium text-text-secondary">
          {hoursLabel(total / 60)} total
        </span>
      </div>
      {slices.length === 0 ? (
        <p className="py-10 text-center text-sm text-text-secondary">No data yet.</p>
      ) : (
        <>
          <div className="relative h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="88%"
                  paddingAngle={2}
                  cornerRadius={5}
                  stroke="none"
                >
                  {slices.map((s, i) => (
                    <Cell key={i} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipTextStyle}
                  itemStyle={tooltipTextStyle}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="tabular font-numeric text-xl font-semibold">{hoursLabel(total / 60)}</span>
              <span className="text-[10px] uppercase tracking-wide text-text-muted">focused</span>
            </div>
          </div>
          <ul className="mt-3 space-y-1.5">
            {slices.map((s) => (
              <li key={s.name} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="flex-1 truncate text-text-secondary">{s.name}</span>
                <span className="tabular font-medium">{hoursLabel(s.value / 60)}</span>
                <span className="tabular w-10 text-right text-xs text-text-muted">
                  {total > 0 ? `${Math.round((s.value / total) * 100)}%` : ""}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function hoursLabel(h: number): string {
  return h >= 100 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`;
}
