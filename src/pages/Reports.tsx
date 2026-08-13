import { useEffect, useMemo, useState, type ReactNode } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { CalendarRange, Download, FileText, Printer, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { ProgressRing } from "@/components/ProgressRing";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { PersonalBests } from "@/components/PersonalBests";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  useChapters,
  useDayCounter,
  useErrors,
  useFocusSessionsInRange,
  useMockTests,
  useWeekCounter,
  useMonthCounter,
  usePrevWeekCounter,
  useLastNDaysCounter,
  useSubjects,
  useTasksForRange,
} from "@/lib/hooks";
import { buildPeriodSummary, computeFocusScore, suggestionFor, type FocusScoreComponents } from "@/lib/reports";
import { sessionQueryWindow } from "@/lib/analytics";
import {
  EXPORT_DATA_LABEL,
  buildReportData,
  csvFilename,
  periodToAnalyticsFilter,
  reportPeriod,
  serializeReportCsv,
  type ExportDataKey,
  type ExportFormat,
  type ReportData,
  type ReportPreset,
  type ReportRange,
} from "@/lib/reportExport";
import { dayKey, daysBetween } from "@/lib/dates";
import { emptyCounter } from "@/lib/schema";
import type { CounterDoc, ExamGoalDoc } from "@/lib/schema";

type Range = "week" | "month" | "30d";
const EXPORT_PREF_KEY = "padhle:report-export-prefs";
const DEFAULT_EXPORT_KEYS: ExportDataKey[] = ["summary", "focus", "questions", "tests", "syllabus", "mistakes", "revision", "tasks"];

const COMPONENT_LABEL: Record<keyof FocusScoreComponents, string> = {
  taskCompletion: "Task completion",
  focusMinutes: "Focus time",
  practice: "Practice",
  revision: "Revision",
  planning: "Planning",
};

const EXAM_LABEL: Record<string, string> = {
  class10: "Class 10 Boards",
  class12: "Class 12 Boards",
  jeeMain: "JEE Main",
  jeeAdvanced: "JEE Advanced",
  neet: "NEET",
};

export function Reports() {
  const { user, userDoc } = useAuth();
  const navigate = useNavigate();
  const [range, setRange] = useState<Range>("week");
  const [exportRange, setExportRange] = useState<ReportRange>("week");
  const [exportPreset, setExportPreset] = useState<ReportPreset>("weekly");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [customStart, setCustomStart] = useState(() => dayKey(new Date()));
  const [customEnd, setCustomEnd] = useState(() => dayKey(new Date()));
  const [includeKeys, setIncludeKeys] = useState<Set<ExportDataKey>>(() => new Set(DEFAULT_EXPORT_KEYS));
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const today = dayKey(new Date());
  const dayCounter = useDayCounter(today);
  const weekCounter = useWeekCounter(today);
  const monthCounter = useMonthCounter(today);
  const prevWeekCounter = usePrevWeekCounter(today);
  const last30 = useLastNDaysCounter(30);
  const subjects = useSubjects();
  const chapters = useChapters();
  const period = useMemo(() => reportPeriod(exportRange, customStart, customEnd), [exportRange, customStart, customEnd]);
  const sessionWindow = useMemo(() => sessionQueryWindow(periodToAnalyticsFilter(period)), [period]);
  const sessions = useFocusSessionsInRange(sessionWindow.start, sessionWindow.end);
  const tests = useMockTests(100);
  const errors = useErrors();
  const tasksForExport = useTasksForRange(period.start, period.end);
  const [exams, setExams] = useState<(ExamGoalDoc & { id: string })[]>([]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "users", user.uid, "examGoals"), (snap) => {
      setExams(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ExamGoalDoc) })));
    });
  }, [user]);

  const counter =
    range === "week" ? weekCounter : range === "month" ? monthCounter : last30;
  const isRange = range === "week" ? "This week" : range === "month" ? "This month" : "Last 30 days";
  const { score, components } = computeFocusScore(
    range === "30d" ? emptyCounter() : counter
  );
  const summary = buildPeriodSummary(counter, range === "week" ? prevWeekCounter : undefined);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(EXPORT_PREF_KEY);
      if (!raw) return;
      const pref = JSON.parse(raw) as {
        range?: ReportRange;
        preset?: ReportPreset;
        format?: ExportFormat;
        include?: ExportDataKey[];
      };
      if (pref.range) setExportRange(pref.range);
      if (pref.preset) setExportPreset(pref.preset);
      if (pref.format) setExportFormat(pref.format);
      if (pref.include?.length) setIncludeKeys(new Set(pref.include));
    } catch {
      // Ignore corrupt local preferences; export defaults stay usable.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      EXPORT_PREF_KEY,
      JSON.stringify({ range: exportRange, preset: exportPreset, format: exportFormat, include: [...includeKeys] })
    );
  }, [exportRange, exportPreset, exportFormat, includeKeys]);

  const reportData = useMemo<ReportData | null>(() => {
    if (!userDoc) return null;
    return buildReportData({
      userDoc,
      period,
      preset: exportPreset,
      counter: exportCounter(exportRange, dayCounter, weekCounter, monthCounter),
      previousCounter: exportRange === "week" ? prevWeekCounter : undefined,
      subjects,
      chapters,
      sessions,
      tasks: tasksForExport,
      tests,
      errors,
      exams,
    });
  }, [userDoc, period, exportPreset, exportRange, dayCounter, weekCounter, monthCounter, prevWeekCounter, subjects, chapters, sessions, tasksForExport, tests, errors, exams]);

  const downloadCsv = (report: ReportData) => {
    const csv = serializeReportCsv(report, includeKeys);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = csvFilename(report);
    a.click();
    URL.revokeObjectURL(url);
    setExportStatus("CSV exported.");
  };

  const printReport = () => {
    requestAnimationFrame(() => {
      window.print();
      setExportStatus("PDF print view opened.");
    });
  };

  const handleExport = () => {
    if (!reportData) {
      setExportStatus("Report data is still loading.");
      return;
    }
    try {
      if (exportFormat === "csv") downloadCsv(reportData);
      else printReport();
    } catch {
      setExportStatus("Export failed. Try again.");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-xl font-bold">Reports</h1>
        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
            { value: "30d", label: "30 days" },
          ]}
        />
      </div>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate("/review")}
        >
          <CalendarRange size={14} /> Weekly review
        </Button>
        <Button variant="secondary" size="sm" onClick={() => reportData && downloadCsv(reportData)} className="ml-auto">
          <Download size={14} /> Quick CSV
        </Button>
        <Button variant="secondary" size="sm" onClick={printReport}>
          <Printer size={14} /> Quick PDF
        </Button>
      </div>

      <Card className="overflow-hidden border-brand-600/20">
        <div className="border-b border-border bg-gradient-to-r from-brand-500/10 via-surface to-surface px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <FileText size={16} className="text-brand-600" /> Export professional report
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                Padhle-branded PDF for sharing or a clean CSV for analysis.
              </p>
            </div>
            <Button size="sm" onClick={handleExport} disabled={!reportData || includeKeys.size === 0}>
              {exportFormat === "pdf" ? <Printer size={14} /> : <Download size={14} />}
              Export Report
            </Button>
          </div>
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FieldLabel label="Report">
                <Select
                  value={exportRange}
                  onChange={(v) => setExportRange(v as ReportRange)}
                  options={[
                    { value: "day", label: "Daily" },
                    { value: "week", label: "Weekly" },
                    { value: "month", label: "Monthly" },
                    { value: "year", label: "Yearly" },
                    { value: "custom", label: "Custom" },
                  ]}
                />
              </FieldLabel>
              <FieldLabel label="Type">
                <Select
                  value={exportPreset}
                  onChange={(v) => setExportPreset(v as ReportPreset)}
                  options={[
                    { value: "weekly", label: "Weekly Study" },
                    { value: "monthly", label: "Monthly Progress" },
                    { value: "exam", label: "Exam Prep" },
                    { value: "parent", label: "Parent/Mentor" },
                  ]}
                />
              </FieldLabel>
              <FieldLabel label="Format">
                <Segmented
                  value={exportFormat}
                  onChange={(v) => setExportFormat(v as ExportFormat)}
                  options={[
                    { value: "pdf", label: "PDF" },
                    { value: "csv", label: "CSV" },
                  ]}
                />
              </FieldLabel>
            </div>

            {exportRange === "custom" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FieldLabel label="From">
                  <Input type="date" value={customStart} max={customEnd} onChange={(e) => e.target.value && setCustomStart(e.target.value)} />
                </FieldLabel>
                <FieldLabel label="To">
                  <Input type="date" value={customEnd} min={customStart} max={today} onChange={(e) => e.target.value && setCustomEnd(e.target.value)} />
                </FieldLabel>
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-medium text-text-secondary">Data</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {DEFAULT_EXPORT_KEYS.map((key) => (
                  <label key={key} className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/60 px-3 py-2 text-xs font-medium">
                    <Checkbox
                      checked={includeKeys.has(key)}
                      onCheckedChange={(checked) =>
                        setIncludeKeys((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(key);
                          else next.delete(key);
                          return next;
                        })
                      }
                      className="h-4 w-4"
                    />
                    <span className="min-w-0 truncate">{EXPORT_DATA_LABEL[key]}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface-2/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Export preview</p>
            <p className="mt-2 font-display text-lg font-bold">{reportData?.title ?? "Preparing report"}</p>
            <p className="mt-1 text-sm text-text-secondary">{reportData?.period.label ?? "Loading period"}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <MiniPreview label="Focus" value={reportData ? minutesLabel(reportData.kpis.focusMinutes) : "—"} />
              <MiniPreview label="Questions" value={String(reportData?.kpis.questions ?? "—")} />
              <MiniPreview label="Coverage" value={`${reportData?.syllabus.coveragePct ?? 0}%`} />
              <MiniPreview label="Mastery" value={`${reportData?.syllabus.masteryPct ?? 0}%`} />
            </div>
            {exportStatus && <p className="mt-3 text-xs font-medium text-brand-600">{exportStatus}</p>}
          </div>
        </div>
      </Card>

      {range === "week" && <WeeklyNudge week={weekCounter} prev={prevWeekCounter} />}

      <PersonalBests />

      {range === "30d" ? (
        <>
          <RetroCard counter={last30} exams={exams} />
        </>
      ) : (
        <>
          <Card className="flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Focus Score · {isRange}
            </p>
            <ProgressRing size={120} strokeWidth={10} progress={score / 100} gradient>
              <AnimatedNumber
                value={score}
                className="font-numeric text-3xl font-semibold tabular"
              />
            </ProgressRing>
            <p className="max-w-xs text-sm text-text-secondary">{suggestionFor(components)}</p>
          </Card>

          <Card className="p-4">
            <p className="mb-3 text-sm font-semibold">Breakdown</p>
            <div className="space-y-3">
              {(Object.keys(components) as (keyof FocusScoreComponents)[]).map((key) => (
                <div key={key}>
                  <div className="mb-1 flex items-center justify-between text-xs text-text-secondary">
                    <span>{COMPONENT_LABEL[key]}</span>
                    <span className="tabular">{Math.round(components[key] * 100)}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-brand-600 transition-[width] duration-500 ease-out"
                      style={{ width: `${components[key] * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Focus Time" value={`${Math.round(counter.focusMinutes / 60)}h`} />
            <StatCard label="Tasks" value={`${counter.completedTasks}/${counter.plannedTasks}`} />
            <StatCard label="Questions" value={`${counter.questionsDone}`} />
            <StatCard label="Mocks" value={`${counter.mockCount}`} />
          </div>

          <Card className="p-4">
            <p className="mb-3 text-sm font-semibold">Period summary</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SummaryBlock
                label="Planned vs actual"
                value={`${summary.completionPct}%`}
                hint={`${counter.completedTasks}/${counter.plannedTasks} tasks completed`}
              />
              <SummaryBlock
                label="What went well"
                value={summary.wentWell}
                hint={summary.focusDeltaPct === null ? "No comparison yet" : `${summary.focusDeltaPct >= 0 ? "+" : ""}${summary.focusDeltaPct}% focus vs previous`}
              />
              <SummaryBlock label="Next change" value={summary.nextChange} hint={summary.slipped} />
            </div>
          </Card>
        </>
      )}

      {/* Only visible when printing (index.css @media print), so "Save as PDF"
          captures just the report. */}
      <div className="print-report hidden">
        {reportData && <PrintLayout report={reportData} includeKeys={includeKeys} />}
      </div>
    </div>
  );
}

function WeeklyNudge({ week, prev }: { week: CounterDoc; prev: CounterDoc }) {
  if (week.focusMinutes === 0 && prev.focusMinutes === 0) return null;
  const diff = week.focusMinutes - prev.focusMinutes;
  const beaten = diff > 0;
  return (
    <Card className={`flex items-start gap-3 p-4 ${beaten ? "border-success bg-surface" : "bg-surface"}`}>
      <span className={`mt-0.5 ${beaten ? "text-success" : "text-warning"}`}>
        <Sparkles size={18} />
      </span>
      <div>
        <p className="text-sm font-medium">
          {beaten
            ? `You're beating last week — ${Math.round(diff / 60)}h more focused.`
            : diff === 0
              ? `Even pace with last week (${Math.round(week.focusMinutes / 60)}h).`
              : `You're ${Math.round(Math.abs(diff) / 60)}h behind last week's focus. A strong weekend closes it.`}
        </p>
        <p className="mt-0.5 text-xs text-text-secondary">
          {prev.focusMinutes > 0
            ? `Last week: ${Math.round(prev.focusMinutes / 60)}h · This week: ${Math.round(week.focusMinutes / 60)}h`
            : `First tracked week — every minute counts.`}
        </p>
      </div>
    </Card>
  );
}

function RetroCard({ counter, exams }: { counter: CounterDoc; exams: (ExamGoalDoc & { id: string })[] }) {
  const hours = counter.focusMinutes / 60;
  const activeDays = counter.checkinDone || Math.min(30, Math.floor(counter.focusMinutes / 25));
  const perDay = activeDays > 0 ? hours / activeDays : 0;
  const paceHoursPerWeek = perDay * 7;
  const primaryExam = exams.find((e) => e.isPrimary) ?? exams[0];
  const daysLeft = primaryExam ? Math.max(0, daysBetween(new Date(), primaryExam.examDate.toDate())) : null;

  return (
    <>
      <Card className="p-4">
        <p className="mb-1 text-sm font-semibold">Last 30 days, at a glance</p>
        <p className="mb-3 text-xs text-text-secondary">
          Rolled up from your daily counters — no guesses, just what you actually did.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Focus time" value={`${Math.round(hours)}h`} />
          <StatCard label="Questions" value={String(counter.questionsDone)} />
          <StatCard label="Revisions" value={String(counter.revisionsDone)} />
          <StatCard label="Tasks done" value={String(counter.completedTasks)} />
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <PaceStat label="Average per study day" value={`${perDay.toFixed(1)}h/day`} />
          <PaceStat label="Projected weekly pace" value={`${paceHoursPerWeek.toFixed(1)}h/week`} />
          <PaceStat label="Practice volume" value={`${counter.questionsDone} questions`} />
        </div>
      </Card>

      <Card className="border-brand-600/20 bg-brand-500/[0.07] p-4">
        <p className="text-sm font-semibold text-brand-700 dark:text-brand-500">Retro plan</p>
        {daysLeft !== null ? (
          <ul className="mt-2 space-y-1.5 text-sm text-text-secondary">
            <li>
              <span className="font-medium text-text-primary">{daysLeft} days</span> to{" "}
              {EXAM_LABEL[primaryExam!.examType] ?? primaryExam!.name}.
            </li>
            <li>
              {paceHoursPerWeek >= 10
                ? `You're cruising at ${paceHoursPerWeek.toFixed(1)}h/week — keep this pace and you arrive ready.`
                : `At ${paceHoursPerWeek.toFixed(1)}h/week you'll be under target. Add ~${Math.max(0, 10 - paceHoursPerWeek).toFixed(1)}h/week (≈${Math.max(
                    1,
                    Math.round((10 - paceHoursPerWeek) / 1.5)
                  )} focus sessions) to hit the recommended 10h/week.`}
            </li>
            <li>
              {counter.questionsDone >= 240
                ? "Practice volume is healthy — keep pushing PYQs."
                : "Shift some sessions toward practice questions to balance volume."}
            </li>
          </ul>
        ) : (
          <p className="mt-2 text-sm text-text-secondary">
            Add an exam in your profile to unlock a days-left plan. For now: {paceHoursPerWeek.toFixed(1)}h/week pace,
            {counter.questionsDone >= 240 ? " healthy volume. Keep it up." : " practice volume needs a boost."}
          </p>
        )}
      </Card>
    </>
  );
}

function PaceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-secondary">{label}</span>
      <span className="tabular font-medium">{value}</span>
    </div>
  );
}

function PrintLayout({ report, includeKeys }: { report: ReportData; includeKeys: Set<ExportDataKey> }) {
  return (
    <article className="mx-auto max-w-[190mm] bg-white font-sans text-[#17231c]">
      <PrintHeader report={report} />

      <section className="print-section">
        <PrintSectionTitle>Executive Summary</PrintSectionTitle>
        <div className="grid grid-cols-4 gap-2">
          <PrintKpi label="Focus Time" value={minutesLabel(report.kpis.focusMinutes)} />
          <PrintKpi label="Questions" value={String(report.kpis.questions)} />
          <PrintKpi label="Tests" value={String(report.kpis.tests)} />
          <PrintKpi label="Revision" value={minutesLabel(report.kpis.revisionMinutes)} />
          <PrintKpi label="Tasks Completed" value={`${report.kpis.tasksCompleted}/${report.kpis.tasksPlanned}`} />
          <PrintKpi label="Trees Grown" value={String(report.kpis.trees)} />
          <PrintKpi label="Streak" value={`${report.kpis.streak} days`} />
          <PrintKpi label="Focus Change" value={report.kpis.focusDeltaPct === null ? "Baseline" : `${report.kpis.focusDeltaPct >= 0 ? "+" : ""}${report.kpis.focusDeltaPct}%`} />
        </div>
      </section>

      {includeKeys.has("focus") && (
        <section className="print-section">
          <PrintSectionTitle>Study Performance</PrintSectionTitle>
          <div className="grid grid-cols-[1.4fr_0.8fr] gap-4">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#52645a]">Focus Time Trend</p>
              <PrintBars rows={report.daily.slice(-14)} value={(row) => row.focusMinutes} />
            </div>
            <div className="rounded-lg border border-[#d6e2db] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#52645a]">Planned vs Actual</p>
              <p className="mt-2 text-2xl font-bold">{report.kpis.plannedMinutes > 0 ? Math.round((report.kpis.focusMinutes / report.kpis.plannedMinutes) * 100) : 0}%</p>
              <p className="mt-1 text-xs text-[#52645a]">
                {minutesLabel(report.kpis.focusMinutes)} focused of {minutesLabel(report.kpis.plannedMinutes)} planned.
              </p>
            </div>
          </div>
        </section>
      )}

      {includeKeys.has("syllabus") && (
        <section className="print-section">
          <PrintSectionTitle>Subject Performance</PrintSectionTitle>
          {report.subjects.length === 0 ? (
            <p className="text-sm text-[#52645a]">No subjects available for this period yet.</p>
          ) : (
            <table className="w-full table-fixed border-collapse text-xs">
              <thead>
                <tr className="bg-[#edf7f0] text-left">
                  <PrintTh>Subject</PrintTh>
                  <PrintTh>Focus</PrintTh>
                  <PrintTh>Questions</PrintTh>
                  <PrintTh>Accuracy</PrintTh>
                  <PrintTh>Mastery</PrintTh>
                </tr>
              </thead>
              <tbody>
                {report.subjects.slice(0, 10).map((subject, index) => (
                  <tr key={`${subject.subject}-${index}`} className="border-b border-[#d6e2db]">
                    <PrintTd>{subject.subject}</PrintTd>
                    <PrintTd>{minutesLabel(subject.focusMinutes)}</PrintTd>
                    <PrintTd>{subject.questions}</PrintTd>
                    <PrintTd>{subject.accuracyPct === null ? "—" : `${subject.accuracyPct}%`}</PrintTd>
                    <PrintTd>{subject.masteryPct}%</PrintTd>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {includeKeys.has("syllabus") && (
        <section className="print-section">
          <PrintSectionTitle>Syllabus Progress</PrintSectionTitle>
          <div className="grid grid-cols-2 gap-4">
            <PrintProgress label="Coverage" value={report.syllabus.coveragePct} hint={`${report.syllabus.covered}/${report.syllabus.total} chapters started`} />
            <PrintProgress label="Mastery" value={report.syllabus.masteryPct} hint="Weighted from learning, practice, tests, mistakes, and revision." />
          </div>
        </section>
      )}

      <section className="print-section break-inside-avoid">
        <div className="grid grid-cols-2 gap-4">
          <PrintList title="Strengths" marker="✓" items={report.strengths} />
          <PrintList title="Areas To Improve" marker="!" items={report.weaknesses} />
        </div>
      </section>

      <section className="print-section">
        <PrintSectionTitle>Weekly Insights</PrintSectionTitle>
        <div className="space-y-2">
          {report.insights.map((insight, index) => (
            <p key={index} className="rounded-lg bg-[#f4faf6] p-3 text-sm leading-relaxed text-[#31443a]">{insight}</p>
          ))}
        </div>
      </section>

      <section className="print-section break-inside-avoid">
        <PrintSectionTitle>Next Steps</PrintSectionTitle>
        <ol className="space-y-1.5 text-sm">
          {report.nextSteps.map((step, index) => (
            <li key={index} className="flex gap-2">
              <span className="font-bold text-[#176b4d]">{index + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-8 border-t border-[#d6e2db] pt-4 text-center text-xs text-[#52645a]">
        <p className="font-bold text-[#176b4d]">Padhle 🌳</p>
        <p>Plan → Focus → Practice → Review → Improve</p>
        <p className="mt-1">Generated by Padhle</p>
      </footer>
    </article>
  );
}

function PrintHeader({ report }: { report: ReportData }) {
  return (
    <header className="print-header mb-6 border-b-2 border-[#176b4d] pb-4">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-2xl font-black text-[#176b4d]">Padhle 🌳</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Personal Study Report</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#52645a]">{report.description}</p>
        </div>
        <div className="rounded-xl bg-[#edf7f0] px-4 py-3 text-right text-xs text-[#31443a]">
          <p className="font-bold">{report.title}</p>
          <p>{report.period.label}</p>
          <p>Generated {new Date(report.generatedAtIso).toLocaleString("en-IN")}</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
        <PrintMeta label="Student" value={report.student.name} />
        <PrintMeta label="Class" value={report.student.classLabel} />
        <PrintMeta label="Board" value={report.student.boardLabel} />
        <PrintMeta label="Exam" value={report.student.examLabel} />
        <PrintMeta label="Target" value={report.student.targetLabel} />
        <PrintMeta label="Period" value={report.period.label} />
      </div>
    </header>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3 text-center">
      <p className="font-numeric text-xl font-semibold tabular">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </Card>
  );
}

function SummaryBlock({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/60 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-text-secondary">{hint}</p>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

function MiniPreview({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <p className="text-[11px] text-text-muted">{label}</p>
      <p className="tabular font-semibold">{value}</p>
    </div>
  );
}

function PrintMeta({ label, value }: { label: string; value: string }) {
  return (
    <p className="min-w-0 truncate">
      <span className="font-bold text-[#52645a]">{label}: </span>
      {value}
    </p>
  );
}

function PrintSectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-[13px] font-black uppercase tracking-[0.16em] text-[#176b4d]">{children}</h2>;
}

function PrintKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="break-inside-avoid rounded-lg border border-[#d6e2db] bg-[#fbfefc] p-3">
      <p className="truncate text-[10px] font-bold uppercase tracking-wide text-[#52645a]">{label}</p>
      <p className="mt-1 truncate text-lg font-black text-[#17231c]">{value}</p>
    </div>
  );
}

function PrintBars({ rows, value }: { rows: ReportData["daily"]; value: (row: ReportData["daily"][number]) => number }) {
  const max = Math.max(1, ...rows.map(value));
  return (
    <div className="flex h-32 items-end gap-1 rounded-lg border border-[#d6e2db] bg-[#fbfefc] p-3">
      {rows.length === 0 ? (
        <p className="m-auto text-xs text-[#52645a]">No activity in this period.</p>
      ) : (
        rows.map((row) => (
          <div key={row.date} className="flex flex-1 flex-col items-center gap-1">
            <div className="w-full rounded-t bg-[#176b4d]" style={{ height: `${Math.max(4, (value(row) / max) * 86)}px` }} />
            <span className="text-[8px] text-[#52645a]">{row.date.slice(5)}</span>
          </div>
        ))
      )}
    </div>
  );
}

function PrintProgress({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-lg border border-[#d6e2db] p-3">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-bold">{label}</span>
        <span className="font-black text-[#176b4d]">{value}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-[#d6e2db]">
        <div className="h-full rounded-full bg-[#176b4d]" style={{ width: `${value}%` }} />
      </div>
      <p className="mt-2 text-xs text-[#52645a]">{hint}</p>
    </div>
  );
}

function PrintList({ title, marker, items }: { title: string; marker: string; items: string[] }) {
  return (
    <div>
      <PrintSectionTitle>{title}</PrintSectionTitle>
      <ul className="space-y-1.5 text-sm">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2">
            <span className="font-black text-[#176b4d]">{marker}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PrintTh({ children }: { children: ReactNode }) {
  return <th className="border border-[#d6e2db] px-2 py-2 font-bold">{children}</th>;
}

function PrintTd({ children }: { children: ReactNode }) {
  return <td className="truncate border border-[#d6e2db] px-2 py-2">{children}</td>;
}

function exportCounter(range: ReportRange, day: CounterDoc, week: CounterDoc, month: CounterDoc): CounterDoc | undefined {
  if (range === "day") return day;
  if (range === "week") return week;
  if (range === "month") return month;
  return undefined;
}

function minutesLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
