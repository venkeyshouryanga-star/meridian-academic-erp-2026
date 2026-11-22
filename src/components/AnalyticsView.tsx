import { useMemo, useState } from 'react';
import { ChartCanvas } from './ChartCanvas';
import { KpiMetric, StatusText } from './UIPrimitives';
import type {
  AnalyticsPayload,
  Department,
  ExaminationRecord,
  StudentResultSummary,
} from '../shared/types';

interface AnalyticsViewProps {
  analytics: AnalyticsPayload | null;
  departments: Department[];
  examinations: ExaminationRecord[];
  results: StudentResultSummary[];
  selectedExamId: number | '';
  selectedDeptId: number | '';
  onSelectExamId: (id: number | '') => void;
  onSelectDeptId: (id: number | '') => void;
  darkMode: boolean;
}

export function AnalyticsView({
  analytics,
  departments,
  examinations,
  results,
  selectedExamId,
  selectedDeptId,
  onSelectExamId,
  onSelectDeptId,
  darkMode,
}: AnalyticsViewProps) {
  const uniqueStudents = useMemo(() => {
    const map = new Map<number, StudentResultSummary>();
    for (const r of results) {
      if (!map.has(r.studentId)) map.set(r.studentId, r);
    }
    return Array.from(map.values());
  }, [results]);

  const [compareA, setCompareA] = useState<string>('');
  const [compareB, setCompareB] = useState<string>('');

  const studentA = uniqueStudents.find((s) => String(s.studentId) === compareA) || uniqueStudents[0];
  const studentB = uniqueStudents.find((s) => String(s.studentId) === compareB) || uniqueStudents[1];

  const comparisonChart = useMemo(() => {
    if (!studentA || !studentB) return null;
    const codes = Array.from(
      new Set([
        ...studentA.subjects.map((s) => s.subjectCode),
        ...studentB.subjects.map((s) => s.subjectCode),
      ])
    );
    return {
      labels: codes,
      datasets: [
        {
          label: `${studentA.studentName} (${studentA.rollNumber})`,
          data: codes.map(
            (c) => studentA.subjects.find((s) => s.subjectCode === c)?.percentage ?? 0
          ),
          backgroundColor: '#1D4ED8',
          borderRadius: 4,
          maxBarThickness: 28,
        },
        {
          label: `${studentB.studentName} (${studentB.rollNumber})`,
          data: codes.map(
            (c) => studentB.subjects.find((s) => s.subjectCode === c)?.percentage ?? 0
          ),
          backgroundColor: '#5B4FCF',
          borderRadius: 4,
          maxBarThickness: 28,
        },
      ],
    };
  }, [studentA, studentB]);

  const classChartData = useMemo(
    () => ({
      labels: (analytics?.classPerformance || []).map((c) => c.className),
      datasets: [
        {
          label: 'Class Average (%)',
          data: (analytics?.classPerformance || []).map((c) => c.averagePercentage),
          backgroundColor: '#1D4ED8',
          borderRadius: 4,
          maxBarThickness: 34,
        },
        {
          label: 'Pass Rate (%)',
          data: (analytics?.classPerformance || []).map((c) => c.passRate),
          backgroundColor: '#5B4FCF',
          borderRadius: 4,
          maxBarThickness: 34,
        },
      ],
    }),
    [analytics]
  );

  const topperChartData = useMemo(
    () => ({
      labels: (analytics?.toppers || []).map((t) => `${t.studentName.split(' ')[0]} (${t.rollNumber})`),
      datasets: [
        {
          label: 'Aggregate Percentage (%)',
          data: (analytics?.toppers || []).map((t) => t.percentage),
          backgroundColor: '#1D4ED8',
          borderRadius: 4,
          maxBarThickness: 32,
        },
      ],
    }),
    [analytics]
  );

  const gradeChartData = useMemo(
    () => ({
      labels: (analytics?.gradeDistribution || []).map((g) => `Grade ${g.grade}`),
      datasets: [
        {
          label: 'Students',
          data: (analytics?.gradeDistribution || []).map((g) => g.count),
          backgroundColor: ['#1D4ED8', '#2563EB', '#5B4FCF', '#6366F1', '#D97706', '#DC2626'],
          borderRadius: 4,
          maxBarThickness: 36,
        },
      ],
    }),
    [analytics]
  );

  const passFailChart = useMemo(
    () => ({
      labels: ['Passed', 'Failed'],
      datasets: [
        {
          data: [analytics?.summary.passedCount ?? 0, analytics?.summary.failedCount ?? 0],
          backgroundColor: ['#15803D', '#DC2626'],
          borderWidth: 0,
        },
      ],
    }),
    [analytics]
  );

  const trendChart = useMemo(
    () => ({
      labels: (analytics?.examTrend || []).map((e) => e.examinationName),
      datasets: [
        {
          label: 'Mean Score (%)',
          data: (analytics?.examTrend || []).map((e) => e.averagePercentage),
          borderColor: '#1D4ED8',
          backgroundColor: 'rgba(29, 78, 216, 0.12)',
          fill: true,
          tension: 0.3,
        },
        {
          label: 'Pass Rate (%)',
          data: (analytics?.examTrend || []).map((e) => e.passRate),
          borderColor: '#5B4FCF',
          tension: 0.3,
        },
      ],
    }),
    [analytics]
  );

  const failRate =
    analytics && analytics.summary.passedCount + analytics.summary.failedCount > 0
      ? (
          (analytics.summary.failedCount /
            (analytics.summary.passedCount + analytics.summary.failedCount)) *
          100
        ).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Academic Analytics & Performance Intelligence
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Real-time departmental, class-wise, subject-wise, and topper analytics powered by PostgreSQL.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedDeptId}
            onChange={(e) => onSelectDeptId(e.target.value ? Number(e.target.value) : '')}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 dark:border-[#1E2E4A] dark:bg-[#0F1B30] dark:text-slate-200"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} — {d.name}
              </option>
            ))}
          </select>
          <select
            value={selectedExamId}
            onChange={(e) => onSelectExamId(e.target.value ? Number(e.target.value) : '')}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 dark:border-[#1E2E4A] dark:bg-[#0F1B30] dark:text-slate-200"
          >
            <option value="">Latest Final Exam</option>
            {examinations.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name} ({ex.academicYear})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Key Analytical Metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiMetric
          label="Mean Cohort Percentage"
          value={`${(analytics?.summary.averagePercentage ?? 0).toFixed(2)}%`}
          meta="Across selected scope"
          accent="royal"
        />
        <KpiMetric
          label="Pass Percentage"
          value={`${(analytics?.summary.overallPassPercentage ?? 0).toFixed(1)}%`}
          meta={`${analytics?.summary.passedCount ?? 0} students passed`}
          accent="emerald"
        />
        <KpiMetric
          label="Failure Statistics"
          value={`${failRate}%`}
          meta={`${analytics?.summary.failedCount ?? 0} students failed`}
          accent="crimson"
        />
        <KpiMetric
          label="Academic Intervention"
          value={analytics?.needsImprovement.length ?? 0}
          meta="Students below 65% or failed"
          accent="indigo"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-[#1E2E4A] dark:bg-[#0F1B30]">
          <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">
            Class-wise Performance & Pass Rate
          </h2>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            Comparison of section averages and pass percentages
          </p>
          <ChartCanvas
            type="bar"
            data={classChartData}
            darkMode={darkMode}
            height={250}
            options={{ scales: { y: { max: 100 } } }}
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-[#1E2E4A] dark:bg-[#0F1B30]">
          <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">
            Topper Performance Chart
          </h2>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            Highest aggregate percentages in the selected examination
          </p>
          <ChartCanvas
            type="bar"
            data={topperChartData}
            darkMode={darkMode}
            height={250}
            options={{ indexAxis: 'y', scales: { x: { max: 100 } } }}
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-[#1E2E4A] dark:bg-[#0F1B30]">
          <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">
            Grade Distribution
          </h2>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            Student headcount per configured grade band (A+ to E)
          </p>
          <ChartCanvas type="bar" data={gradeChartData} darkMode={darkMode} height={240} />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-[#1E2E4A] dark:bg-[#0F1B30]">
            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
              Pass / Fail Split
            </h2>
            <ChartCanvas type="pie" data={passFailChart} darkMode={darkMode} height={220} />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-[#1E2E4A] dark:bg-[#0F1B30]">
            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
              Academic Progress
            </h2>
            <ChartCanvas
              type="line"
              data={trendChart}
              darkMode={darkMode}
              height={220}
              options={{ scales: { y: { max: 100 } } }}
            />
          </div>
        </div>
      </div>

      {/* Interactive Student Performance Comparison */}
      {uniqueStudents.length >= 2 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-[#1E2E4A] dark:bg-[#0F1B30]">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Student Performance Comparison
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Compare subject-wise percentages between two students side-by-side
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={studentA?.studentId ?? ''}
                onChange={(e) => setCompareA(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
              >
                {uniqueStudents.map((s) => (
                  <option key={s.studentId} value={s.studentId}>
                    {s.rollNumber} · {s.studentName}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-400">vs.</span>
              <select
                value={studentB?.studentId ?? ''}
                onChange={(e) => setCompareB(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
              >
                {uniqueStudents.map((s) => (
                  <option key={s.studentId} value={s.studentId}>
                    {s.rollNumber} · {s.studentName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {comparisonChart && (
            <ChartCanvas
              type="bar"
              data={comparisonChart}
              darkMode={darkMode}
              height={240}
              options={{ scales: { y: { max: 100 } } }}
            />
          )}
        </div>
      )}

      {/* Department-wise Statistical Breakdown Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[#1E2E4A] dark:bg-[#0F1B30]">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-[#1E2E4A]">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Department-wise Academic Breakdown
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500 dark:border-[#1E2E4A] dark:bg-slate-900/40 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 text-right font-medium">Evaluated</th>
                <th className="px-4 py-3 text-right font-medium">Mean %</th>
                <th className="px-4 py-3 text-right font-medium">Pass Rate</th>
                <th className="px-4 py-3 text-right font-medium">Failures</th>
                <th className="px-4 py-3 text-right font-medium">Standing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1E2E4A]">
              {(analytics?.departmentPerformance || []).map((d) => (
                <tr key={d.departmentId}>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                    <span className="font-mono text-blue-700 dark:text-blue-400">{d.departmentCode}</span> · {d.departmentName}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{d.studentCount}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                    {d.averagePercentage.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                    {d.passRate.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-red-700 dark:text-red-400">
                    {d.failCount}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <StatusText status={d.passRate >= 75 ? 'Pass' : 'Fail'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
