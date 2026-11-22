import { useMemo } from 'react';
import {
  UserPlus,
  ClipboardEdit,
  BookOpen,
  FileDown,
  ArrowUpRight,
  AlertCircle,
  Award,
} from 'lucide-react';
import { ChartCanvas } from './ChartCanvas';
import { KpiMetric, StatusText } from './UIPrimitives';
import type {
  ActivityItem,
  AnalyticsPayload,
  AuthUser,
  ExaminationRecord,
  StudentRecord,
  SubjectRecord,
} from '../shared/types';

interface OverviewViewProps {
  user: AuthUser;
  analytics: AnalyticsPayload | null;
  students: StudentRecord[];
  subjects: SubjectRecord[];
  examinations: ExaminationRecord[];
  activities: ActivityItem[];
  selectedExamId: number | '';
  onSelectExamId: (id: number | '') => void;
  darkMode: boolean;
  onNavigate: (tab: string) => void;
  onExportQuickReport: () => void;
}

export function OverviewView({
  user,
  analytics,
  students,
  subjects,
  examinations,
  activities,
  selectedExamId,
  onSelectExamId,
  darkMode,
  onNavigate,
  onExportQuickReport,
}: OverviewViewProps) {
  const summary = analytics?.summary;

  const studentBarData = useMemo(() => {
    const items = analytics?.studentPerformance.slice(0, 8) || [];
    return {
      labels: items.map((s) => s.rollNumber),
      datasets: [
        {
          label: 'Percentage (%)',
          data: items.map((s) => s.percentage),
          backgroundColor: items.map((s) =>
            s.status === 'Pass' ? '#1D4ED8' : '#DC2626'
          ),
          borderRadius: 4,
          maxBarThickness: 32,
        },
      ],
    };
  }, [analytics]);

  const subjectBarData = useMemo(() => {
    const items = analytics?.subjectPerformance.slice(0, 8) || [];
    return {
      labels: items.map((s) => s.subjectCode),
      datasets: [
        {
          label: 'Mean Score (%)',
          data: items.map((s) => s.averagePercentage),
          backgroundColor: '#5B4FCF',
          borderRadius: 4,
          maxBarThickness: 28,
        },
        {
          label: 'Pass Rate (%)',
          data: items.map((s) => s.passRate),
          backgroundColor: '#1D4ED8',
          borderRadius: 4,
          maxBarThickness: 28,
        },
      ],
    };
  }, [analytics]);

  const passFailData = useMemo(
    () => ({
      labels: ['Passed', 'Failed'],
      datasets: [
        {
          data: [summary?.passedCount ?? 0, summary?.failedCount ?? 0],
          backgroundColor: ['#15803D', '#DC2626'],
          borderWidth: 0,
        },
      ],
    }),
    [summary]
  );

  const trendData = useMemo(() => {
    const items = analytics?.examTrend || [];
    return {
      labels: items.map((e) => e.examinationName),
      datasets: [
        {
          label: 'Mean Score (%)',
          data: items.map((e) => e.averagePercentage),
          borderColor: '#1D4ED8',
          backgroundColor: 'rgba(29, 78, 216, 0.12)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
        },
        {
          label: 'Pass Rate (%)',
          data: items.map((e) => e.passRate),
          borderColor: '#5B4FCF',
          backgroundColor: 'transparent',
          tension: 0.3,
          pointRadius: 4,
        },
      ],
    };
  }, [analytics]);

  const deptBarData = useMemo(() => {
    const items = analytics?.departmentPerformance || [];
    return {
      labels: items.map((d) => d.departmentCode),
      datasets: [
        {
          label: 'Average (%)',
          data: items.map((d) => d.averagePercentage),
          backgroundColor: '#1D4ED8',
          borderRadius: 4,
          maxBarThickness: 34,
        },
        {
          label: 'Pass Rate (%)',
          data: items.map((d) => d.passRate),
          backgroundColor: '#5B4FCF',
          borderRadius: 4,
          maxBarThickness: 34,
        },
      ],
    };
  }, [analytics]);

  const assignedSubjects = useMemo(
    () =>
      user.role === 'teacher'
        ? subjects.filter((s) => s.teacherId === user.id)
        : subjects,
    [subjects, user]
  );

  return (
    <div className="space-y-6">
      {/* Contextual Header + Exam Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {user.role === 'admin'
              ? 'Administration Overview'
              : user.role === 'hod'
                ? 'HOD Academic Oversight'
                : 'Faculty Teaching Workspace'}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {user.fullName} · {user.designation || user.role.toUpperCase()}
            {user.departmentName ? ` · ${user.departmentName}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Filter dashboard by examination"
            value={selectedExamId}
            onChange={(e) =>
              onSelectExamId(e.target.value ? Number(e.target.value) : '')
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none dark:border-[#1E2E4A] dark:bg-[#0F1B30] dark:text-slate-200"
          >
            <option value="">Latest Final Examination</option>
            {examinations.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name} ({ex.academicYear})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onExportQuickReport}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
          >
            <FileDown className="h-3.5 w-3.5" />
            Export PDF Summary
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiMetric
          label={user.role === 'teacher' ? 'Assigned Students' : 'Total Students'}
          value={summary?.totalStudents ?? 0}
          meta="Active enrolled"
        />
        <KpiMetric
          label="Faculty & HODs"
          value={summary?.totalTeachers ?? 0}
          meta="Academic staff"
        />
        <KpiMetric
          label={user.role === 'teacher' ? 'My Subjects' : 'Total Subjects'}
          value={summary?.totalSubjects ?? 0}
          meta="Credit courses"
          accent="indigo"
        />
        <KpiMetric
          label="Examinations"
          value={summary?.totalExaminations ?? 0}
          meta="Current session"
        />
        <KpiMetric
          label="Marks Entries"
          value={summary?.totalMarksEntries ?? 0}
          meta="Verified records"
          accent="royal"
        />
        <KpiMetric
          label="Overall Pass Rate"
          value={`${(summary?.overallPassPercentage ?? 0).toFixed(1)}%`}
          meta={`Mean ${(summary?.averagePercentage ?? 0).toFixed(1)}%`}
          accent={
            (summary?.overallPassPercentage ?? 0) >= 75 ? 'emerald' : 'crimson'
          }
        />
      </div>

      {/* Quick Actions Strip */}
      <div className="flex flex-wrap items-center gap-2.5 border-y border-slate-200 py-3.5 dark:border-[#1E2E4A]">
        <span className="mr-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          Quick Actions
        </span>
        {user.role === 'admin' && (
          <button
            type="button"
            onClick={() => onNavigate('students')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:border-blue-600 hover:text-blue-700 dark:border-[#1E2E4A] dark:bg-[#0F1B30] dark:text-slate-200 whitespace-nowrap"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Manage Students
          </button>
        )}
        {(user.role === 'admin' || user.role === 'teacher') && (
          <button
            type="button"
            onClick={() => onNavigate('marks')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:border-blue-600 hover:text-blue-700 dark:border-[#1E2E4A] dark:bg-[#0F1B30] dark:text-slate-200 whitespace-nowrap"
          >
            <ClipboardEdit className="h-3.5 w-3.5" />
            Enter / Update Marks
          </button>
        )}
        {user.role === 'admin' && (
          <button
            type="button"
            onClick={() => onNavigate('academics')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:border-blue-600 hover:text-blue-700 dark:border-[#1E2E4A] dark:bg-[#0F1B30] dark:text-slate-200 whitespace-nowrap"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Subjects & Grading Scale
          </button>
        )}
        <button
          type="button"
          onClick={() => onNavigate('results')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:border-blue-600 hover:text-blue-700 dark:border-[#1E2E4A] dark:bg-[#0F1B30] dark:text-slate-200 whitespace-nowrap"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
          Results & Reports
        </button>
        <button
          type="button"
          onClick={() => onNavigate('analytics')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:border-blue-600 hover:text-blue-700 dark:border-[#1E2E4A] dark:bg-[#0F1B30] dark:text-slate-200 whitespace-nowrap"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
          Full Analytics
        </button>
      </div>

      {/* Primary Charts Row */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-[#1E2E4A] dark:bg-[#0F1B30] lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {user.role === 'hod'
                  ? 'Department-wise Academic Performance'
                  : 'Student Performance Distribution'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Computed live from verified examination marks
              </p>
            </div>
          </div>
          <ChartCanvas
            type="bar"
            data={user.role === 'hod' ? deptBarData : studentBarData}
            darkMode={darkMode}
            height={250}
            options={{ scales: { y: { max: 100 } } }}
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-[#1E2E4A] dark:bg-[#0F1B30] lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Pass vs. Fail Ratio
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {summary?.passedCount ?? 0} Passed · {summary?.failedCount ?? 0} Failed
              </p>
            </div>
          </div>
          <ChartCanvas
            type="doughnut"
            data={passFailData}
            darkMode={darkMode}
            height={250}
          />
        </div>
      </div>

      {/* Secondary Charts Row */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-[#1E2E4A] dark:bg-[#0F1B30] lg:col-span-7">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Subject-wise Performance & Pass Rate
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Mean score percentage vs. pass percentage across courses
            </p>
          </div>
          <ChartCanvas
            type="bar"
            data={subjectBarData}
            darkMode={darkMode}
            height={240}
            options={{ scales: { y: { max: 100 } } }}
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-[#1E2E4A] dark:bg-[#0F1B30] lg:col-span-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Examination Progression Trend
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Longitudinal mean percentage across scheduled exams
            </p>
          </div>
          <ChartCanvas
            type="line"
            data={trendData}
            darkMode={darkMode}
            height={240}
            options={{ scales: { y: { max: 100 } } }}
          />
        </div>
      </div>

      {/* Role-Specific Bottom Grid */}
      {user.role === 'hod' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Performing Students */}
          <div className="rounded-xl border border-slate-200 bg-white dark:border-[#1E2E4A] dark:bg-[#0F1B30]">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-[#1E2E4A]">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Top-Performing Scholars
                </h2>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">Merit Rank</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-[#1E2E4A] dark:bg-slate-900/40 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Roll No</th>
                    <th className="px-4 py-2.5 font-medium">Student</th>
                    <th className="px-4 py-2.5 font-medium">Dept</th>
                    <th className="px-4 py-2.5 text-right font-medium">Score</th>
                    <th className="px-4 py-2.5 text-right font-medium">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1E2E4A]">
                  {(analytics?.toppers || []).map((t) => (
                    <tr key={t.studentId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-2.5 font-mono text-slate-600 dark:text-slate-300">
                        {t.rollNumber}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                        {t.studentName}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                        {t.departmentCode}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-blue-700 dark:text-blue-400">
                        {t.percentage.toFixed(1)}%
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                        {t.grade}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Academic Improvement List */}
          <div className="rounded-xl border border-slate-200 bg-white dark:border-[#1E2E4A] dark:bg-[#0F1B30]">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-[#1E2E4A]">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Students Requiring Academic Improvement
                </h2>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">Below 65% or Fail</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-[#1E2E4A] dark:bg-slate-900/40 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Roll No</th>
                    <th className="px-4 py-2.5 font-medium">Student</th>
                    <th className="px-4 py-2.5 font-medium">Class</th>
                    <th className="px-4 py-2.5 text-right font-medium">%</th>
                    <th className="px-4 py-2.5 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1E2E4A]">
                  {(analytics?.needsImprovement || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                        All evaluated students are performing above the intervention threshold.
                      </td>
                    </tr>
                  ) : (
                    (analytics?.needsImprovement || []).map((s) => (
                      <tr key={s.studentId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-2.5 font-mono text-slate-600 dark:text-slate-300">
                          {s.rollNumber}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                          {s.studentName}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                          {s.className}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-red-700 dark:text-red-400">
                          {s.percentage.toFixed(1)}%
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <StatusText status={s.resultStatus} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Recent Student Records or Assigned Subjects */}
          <div className="rounded-xl border border-slate-200 bg-white dark:border-[#1E2E4A] dark:bg-[#0F1B30] lg:col-span-7">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-[#1E2E4A]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {user.role === 'teacher' ? 'Assigned Subjects' : 'Recent Student Records'}
              </h2>
              <button
                type="button"
                onClick={() => onNavigate(user.role === 'teacher' ? 'marks' : 'students')}
                className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
              >
                {user.role === 'teacher' ? 'Enter Marks' : 'View Directory'}
              </button>
            </div>
            <div className="overflow-x-auto">
              {user.role === 'teacher' ? (
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-[#1E2E4A] dark:bg-slate-900/40 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Code</th>
                      <th className="px-4 py-2.5 font-medium">Subject</th>
                      <th className="px-4 py-2.5 font-medium">Class</th>
                      <th className="px-4 py-2.5 text-right font-medium">Max / Pass</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1E2E4A]">
                    {assignedSubjects.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-2.5 font-mono font-semibold text-blue-700 dark:text-blue-400">
                          {sub.code}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                          {sub.name}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                          {sub.className}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                          {sub.maxMarks} / {sub.passingMarks}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-[#1E2E4A] dark:bg-slate-900/40 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Roll No</th>
                      <th className="px-4 py-2.5 font-medium">Student Name</th>
                      <th className="px-4 py-2.5 font-medium">Department</th>
                      <th className="px-4 py-2.5 font-medium">Class</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1E2E4A]">
                    {students.slice(0, 7).map((stu) => (
                      <tr key={stu.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-2.5 font-mono text-slate-600 dark:text-slate-300">
                          {stu.rollNumber}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                          {stu.fullName}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                          {stu.departmentCode}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                          {stu.className}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Recent Activities */}
          <div className="rounded-xl border border-slate-200 bg-white dark:border-[#1E2E4A] dark:bg-[#0F1B30] lg:col-span-5">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-[#1E2E4A]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Recent Academic Activities
              </h2>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-[#1E2E4A]">
              {activities.slice(0, 6).map((act) => (
                <div key={act.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {act.action}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      {new Date(act.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    {act.details}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {act.actorName} · {act.actorRole}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
