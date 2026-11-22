import { useMemo, useState } from 'react';
import {
  Search,
  FileDown,
  FileSpreadsheet,
  Printer,
  Eye,
  GraduationCap,
} from 'lucide-react';
import { ChartCanvas } from './ChartCanvas';
import { KpiMetric, Modal, StatusText } from './UIPrimitives';
import {
  exportClassReportPDF,
  exportMarksExcel,
  exportStudentResultPDF,
  exportSubjectReportPDF,
} from '../lib/reports';
import type {
  AuthUser,
  ClassGroup,
  CollegeSettings,
  Department,
  ExaminationRecord,
  MarkEntry,
  StudentResultSummary,
  SubjectRecord,
} from '../shared/types';

interface ResultsReportsViewProps {
  user: AuthUser;
  results: StudentResultSummary[];
  marks: MarkEntry[];
  departments: Department[];
  classes: ClassGroup[];
  subjects: SubjectRecord[];
  examinations: ExaminationRecord[];
  collegeSettings: CollegeSettings | null;
  darkMode: boolean;
  onToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

export function ResultsReportsView({
  user,
  results,
  marks,
  departments,
  classes,
  subjects,
  examinations,
  collegeSettings,
  darkMode,
  onToast,
}: ResultsReportsViewProps) {
  const isStudent = user.role === 'student';

  const [viewMode, setViewMode] = useState<'results' | 'ledger'>('results');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [examFilter, setExamFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [inspectResult, setInspectResult] = useState<StudentResultSummary | null>(null);

  // Student-only dedicated portal
  const studentResultsSorted = useMemo(() => {
    if (!isStudent) return [];
    return [...results].sort((a, b) => (b.examinationId ?? 0) - (a.examinationId ?? 0));
  }, [isStudent, results]);

  const activeStudentResult = useMemo(() => {
    if (!isStudent) return null;
    if (examFilter) {
      return studentResultsSorted.find((r) => r.examinationId === Number(examFilter)) || null;
    }
    return studentResultsSorted[0] || null;
  }, [isStudent, studentResultsSorted, examFilter]);

  const studentSubjectChart = useMemo(() => {
    if (!activeStudentResult) return null;
    return {
      labels: activeStudentResult.subjects.map((s) => s.subjectCode),
      datasets: [
        {
          label: 'Marks Obtained',
          data: activeStudentResult.subjects.map((s) => s.marksObtained),
          backgroundColor: activeStudentResult.subjects.map((s) =>
            s.status === 'Pass' ? '#1D4ED8' : '#DC2626'
          ),
          borderRadius: 4,
          maxBarThickness: 36,
        },
      ],
    };
  }, [activeStudentResult]);

  const studentProgressChart = useMemo(() => {
    if (!isStudent) return null;
    const chronological = [...studentResultsSorted].reverse();
    return {
      labels: chronological.map((r) => r.examinationName),
      datasets: [
        {
          label: 'Percentage (%)',
          data: chronological.map((r) => r.percentage),
          borderColor: '#1D4ED8',
          backgroundColor: 'rgba(29, 78, 216, 0.12)',
          fill: true,
          tension: 0.3,
          pointRadius: 5,
        },
      ],
    };
  }, [isStudent, studentResultsSorted]);

  // Staff filtering (Admin / Teacher / HOD)
  const filteredResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    return results.filter((r) => {
      if (deptFilter && r.departmentId !== Number(deptFilter)) return false;
      if (classFilter && r.classId !== Number(classFilter)) return false;
      if (examFilter && r.examinationId !== Number(examFilter)) return false;
      if (statusFilter && r.resultStatus !== statusFilter) return false;
      if (subjectFilter && !r.subjects.some((s) => s.subjectId === Number(subjectFilter))) {
        return false;
      }
      if (q) {
        return (
          r.studentName.toLowerCase().includes(q) ||
          r.rollNumber.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [results, search, deptFilter, classFilter, subjectFilter, examFilter, statusFilter]);

  const filteredMarks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return marks.filter((m) => {
      if (deptFilter && m.departmentId !== Number(deptFilter)) return false;
      if (classFilter && m.classId !== Number(classFilter)) return false;
      if (subjectFilter && m.subjectId !== Number(subjectFilter)) return false;
      if (examFilter && m.examinationId !== Number(examFilter)) return false;
      if (statusFilter && m.status !== statusFilter) return false;
      if (q) {
        return (
          m.studentName.toLowerCase().includes(q) ||
          m.rollNumber.toLowerCase().includes(q) ||
          m.subjectCode.toLowerCase().includes(q) ||
          m.subjectName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [marks, search, deptFilter, classFilter, subjectFilter, examFilter, statusFilter]);

  // =========================================================================
  // STUDENT PORTAL VIEW (STRICTLY PERSONAL RESULTS)
  // =========================================================================
  if (isStudent) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              My Academic Results
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {user.fullName} · Roll No <span className="font-mono font-semibold">{user.rollNumber || 'N/A'}</span>
              {activeStudentResult ? ` · ${activeStudentResult.departmentName} · ${activeStudentResult.className}` : ''}
            </p>
          </div>

          <div className="no-print flex flex-wrap items-center gap-2">
            <select
              value={examFilter}
              onChange={(e) => setExamFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 dark:border-[#1E2E4A] dark:bg-[#0F1B30] dark:text-slate-200"
            >
              {studentResultsSorted.map((r) => (
                <option key={r.examinationId ?? r.examinationName} value={r.examinationId ?? ''}>
                  {r.examinationName} ({r.academicYear})
                </option>
              ))}
            </select>

            {activeStudentResult && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    exportStudentResultPDF(activeStudentResult, collegeSettings);
                    onToast('success', 'Official PDF result marksheet downloaded.');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Download Result PDF
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#1E2E4A] dark:bg-[#0F1B30] dark:text-slate-200 whitespace-nowrap"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print Sheet
                </button>
              </>
            )}
          </div>
        </div>

        {!activeStudentResult ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center dark:border-[#1E2E4A] dark:bg-[#0F1B30]">
            <GraduationCap className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 text-sm font-medium text-slate-900 dark:text-white">
              No examination marks have been published for your roll number yet.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <KpiMetric
                label="Total Marks"
                value={`${activeStudentResult.totalObtained} / ${activeStudentResult.totalMax}`}
                meta={`${activeStudentResult.subjectsCount} subjects evaluated`}
              />
              <KpiMetric
                label="Percentage"
                value={`${activeStudentResult.percentage.toFixed(2)}%`}
                meta={activeStudentResult.examinationName}
                accent="royal"
              />
              <KpiMetric
                label="Overall Grade"
                value={activeStudentResult.grade}
                meta={`Grade Point ${activeStudentResult.gradePoint.toFixed(1)} / 10`}
                accent="indigo"
              />
              <KpiMetric
                label="Result Status"
                value={activeStudentResult.resultStatus}
                meta={
                  activeStudentResult.failedSubjectsCount === 0
                    ? 'Cleared all subjects'
                    : `${activeStudentResult.failedSubjectsCount} subject(s) below passing`
                }
                accent={activeStudentResult.resultStatus === 'Pass' ? 'emerald' : 'crimson'}
              />
            </div>

            {/* Subject-wise Breakdown Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[#1E2E4A] dark:bg-[#0F1B30]">
              <div className="border-b border-slate-200 px-5 py-4 dark:border-[#1E2E4A]">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Subject-wise Statement of Marks — {activeStudentResult.examinationName}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500 dark:border-[#1E2E4A] dark:bg-slate-900/40 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Code</th>
                      <th className="px-4 py-3 font-medium">Subject</th>
                      <th className="px-4 py-3 text-right font-medium">Max</th>
                      <th className="px-4 py-3 text-right font-medium">Min Pass</th>
                      <th className="px-4 py-3 text-right font-medium">Obtained</th>
                      <th className="px-4 py-3 text-right font-medium">%</th>
                      <th className="px-4 py-3 text-center font-medium">Grade</th>
                      <th className="px-4 py-3 text-right font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1E2E4A]">
                    {activeStudentResult.subjects.map((sub) => (
                      <tr key={sub.markId}>
                        <td className="px-4 py-3 font-mono font-semibold text-blue-700 dark:text-blue-400">
                          {sub.subjectCode}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                          {sub.subjectName}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">{sub.maxMarks}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-500">
                          {sub.passingMarks}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                          {sub.marksObtained}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {sub.percentage.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-semibold">
                          {sub.grade}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <StatusText status={sub.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Student Performance Charts */}
            <div className="no-print grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-[#1E2E4A] dark:bg-[#0F1B30]">
                <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                  Subject-wise Score Breakdown
                </h2>
                {studentSubjectChart && (
                  <ChartCanvas
                    type="bar"
                    data={studentSubjectChart}
                    darkMode={darkMode}
                    height={230}
                    options={{ scales: { y: { max: 100 } } }}
                  />
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-[#1E2E4A] dark:bg-[#0F1B30]">
                <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                  Academic Progress Across Examinations
                </h2>
                {studentProgressChart && (
                  <ChartCanvas
                    type="line"
                    data={studentProgressChart}
                    darkMode={darkMode}
                    height={230}
                    options={{ scales: { y: { max: 100 } } }}
                  />
                )}
              </div>
            </div>

            {/* Examination History */}
            <div className="rounded-xl border border-slate-200 bg-white dark:border-[#1E2E4A] dark:bg-[#0F1B30]">
              <div className="border-b border-slate-200 px-5 py-4 dark:border-[#1E2E4A]">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Examination History
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500 dark:border-[#1E2E4A] dark:bg-slate-900/40 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Examination</th>
                      <th className="px-4 py-3 font-medium">Academic Year</th>
                      <th className="px-4 py-3 text-right font-medium">Total</th>
                      <th className="px-4 py-3 text-right font-medium">%</th>
                      <th className="px-4 py-3 text-center font-medium">Grade</th>
                      <th className="px-4 py-3 text-right font-medium">Status</th>
                      <th className="no-print px-4 py-3 text-right font-medium">PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1E2E4A]">
                    {studentResultsSorted.map((r) => (
                      <tr key={r.examinationId ?? r.examinationName}>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                          {r.examinationName}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500">{r.academicYear}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {r.totalObtained} / {r.totalMax}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-blue-700 dark:text-blue-400">
                          {r.percentage.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-semibold">{r.grade}</td>
                        <td className="px-4 py-3 text-right">
                          <StatusText status={r.resultStatus} />
                        </td>
                        <td className="no-print px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => exportStudentResultPDF(r, collegeSettings)}
                            className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
                          >
                            Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // =========================================================================
  // STAFF (ADMIN / TEACHER / HOD) RESULTS & REPORTS CENTER
  // =========================================================================
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Results & Report Generation
          </h1>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Search, filter, and export official student marksheets, class reports, and subject sheets.
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              exportClassReportPDF('Consolidated Academic Result Report', filteredResults, collegeSettings);
              onToast('success', 'Class / consolidated PDF report downloaded.');
            }}
            disabled={filteredResults.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap"
          >
            <FileDown className="h-3.5 w-3.5" />
            Class Report PDF
          </button>
          <button
            type="button"
            onClick={() => {
              exportSubjectReportPDF('Subject-wise Marks Ledger Report', filteredMarks, collegeSettings);
              onToast('success', 'Subject marks PDF report downloaded.');
            }}
            disabled={filteredMarks.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-[#1E2E4A] dark:bg-[#0F1B30] dark:text-slate-200 whitespace-nowrap"
          >
            <FileDown className="h-3.5 w-3.5" />
            Subject PDF
          </button>
          <button
            type="button"
            onClick={() => {
              exportMarksExcel(
                'College_Marks_Export',
                filteredMarks.map((m) => ({
                  RollNumber: m.rollNumber,
                  StudentName: m.studentName,
                  Department: m.departmentCode,
                  Class: m.className,
                  SubjectCode: m.subjectCode,
                  SubjectName: m.subjectName,
                  Examination: m.examinationName,
                  MarksObtained: m.marksObtained,
                  MaxMarks: m.maxMarks,
                  Percentage: m.percentage,
                  Grade: m.grade,
                  Status: m.status,
                }))
              );
              onToast('success', `Exported ${filteredMarks.length} mark entries to Excel.`);
            }}
            disabled={filteredMarks.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-[#1E2E4A] dark:bg-[#0F1B30] dark:text-slate-200 whitespace-nowrap"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#1E2E4A] dark:bg-[#0F1B30] dark:text-slate-200 whitespace-nowrap"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
        </div>
      </div>

      {/* Comprehensive Search & Filter Panel */}
      <div className="no-print grid gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-[#1E2E4A] dark:bg-[#0F1B30] sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, roll no, subject..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => {
            setDeptFilter(e.target.value);
            setClassFilter('');
          }}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-slate-200"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.code} — {d.name}
            </option>
          ))}
        </select>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-slate-200"
        >
          <option value="">All Classes</option>
          {classes
            .filter((c) => !deptFilter || c.departmentId === Number(deptFilter))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
        <select
          value={examFilter}
          onChange={(e) => setExamFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-slate-200"
        >
          <option value="">All Examinations</option>
          {examinations.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="w-1/2 rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-slate-200"
          >
            <option value="">Subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-1/2 rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-slate-200"
          >
            <option value="">Status</option>
            <option value="Pass">Pass</option>
            <option value="Fail">Fail</option>
          </select>
        </div>
      </div>

      {/* View Mode Segmented Switch */}
      <div className="no-print flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1 dark:bg-[#0F1B30] dark:border dark:border-[#1E2E4A]">
          <button
            type="button"
            onClick={() => setViewMode('results')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              viewMode === 'results'
                ? 'bg-white text-blue-700 shadow-sm dark:bg-blue-600 dark:text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Student Result Cards ({filteredResults.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('ledger')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              viewMode === 'ledger'
                ? 'bg-white text-blue-700 shadow-sm dark:bg-blue-600 dark:text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Subject Marks Ledger ({filteredMarks.length})
          </button>
        </div>
      </div>

      {/* Consolidated Student Results Table */}
      {viewMode === 'results' ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[#1E2E4A] dark:bg-[#0F1B30]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500 dark:border-[#1E2E4A] dark:bg-slate-900/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Roll No</th>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Dept / Class</th>
                  <th className="px-4 py-3 font-medium">Examination</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-right font-medium">%</th>
                  <th className="px-4 py-3 text-center font-medium">Grade</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="no-print px-4 py-3 text-right font-medium">Marksheet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1E2E4A]">
                {filteredResults.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                      No results found matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredResults.map((r) => (
                    <tr
                      key={`${r.studentId}-${r.examinationId}`}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-blue-700 dark:text-blue-400">
                        {r.rollNumber}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        {r.studentName}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {r.departmentCode} · {r.className}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {r.examinationName}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {r.totalObtained} / {r.totalMax}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-blue-700 dark:text-blue-400">
                        {r.percentage.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                        {r.grade}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusText status={r.resultStatus} />
                      </td>
                      <td className="no-print px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setInspectResult(r)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-400"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              exportStudentResultPDF(r, collegeSettings);
                              onToast('success', `Downloaded PDF marksheet for ${r.rollNumber}.`);
                            }}
                            className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
                          >
                            PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[#1E2E4A] dark:bg-[#0F1B30]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500 dark:border-[#1E2E4A] dark:bg-slate-900/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Roll No</th>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">Examination</th>
                  <th className="px-4 py-3 text-right font-medium">Marks</th>
                  <th className="px-4 py-3 text-right font-medium">%</th>
                  <th className="px-4 py-3 text-center font-medium">Grade</th>
                  <th className="px-4 py-3 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1E2E4A]">
                {filteredMarks.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono text-blue-700 dark:text-blue-400">
                      {m.rollNumber}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {m.studentName}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <span className="font-mono font-semibold">{m.subjectCode}</span> · {m.subjectName}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {m.examinationName}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {m.marksObtained} / {m.maxMarks}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {m.percentage.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-semibold">{m.grade}</td>
                    <td className="px-4 py-3 text-right">
                      <StatusText status={m.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detailed Student Marksheet Inspection Modal */}
      <Modal
        open={!!inspectResult}
        onClose={() => setInspectResult(null)}
        title={inspectResult ? `Statement of Marks — ${inspectResult.studentName}` : ''}
        subtitle={
          inspectResult
            ? `${inspectResult.rollNumber} · ${inspectResult.departmentName} · ${inspectResult.examinationName}`
            : ''
        }
        maxWidth="max-w-2xl"
      >
        {inspectResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3 border-b border-slate-200 pb-4 dark:border-[#1E2E4A]">
              <div>
                <p className="text-[11px] text-slate-500">Total Marks</p>
                <p className="font-mono text-base font-bold tabular-nums">
                  {inspectResult.totalObtained}/{inspectResult.totalMax}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Percentage</p>
                <p className="font-mono text-base font-bold tabular-nums text-blue-700 dark:text-blue-400">
                  {inspectResult.percentage.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Grade / GP</p>
                <p className="font-mono text-base font-bold">
                  {inspectResult.grade} ({inspectResult.gradePoint.toFixed(1)})
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Result</p>
                <p className="mt-1">
                  <StatusText status={inspectResult.resultStatus} />
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 text-slate-500 dark:border-[#1E2E4A]">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Code</th>
                    <th className="py-2 pr-3 font-medium">Subject</th>
                    <th className="py-2 pr-3 text-right font-medium">Score</th>
                    <th className="py-2 pr-3 text-right font-medium">%</th>
                    <th className="py-2 pr-3 text-center font-medium">Grade</th>
                    <th className="py-2 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1E2E4A]">
                  {inspectResult.subjects.map((s) => (
                    <tr key={s.markId}>
                      <td className="py-2.5 pr-3 font-mono font-semibold text-blue-700 dark:text-blue-400">
                        {s.subjectCode}
                      </td>
                      <td className="py-2.5 pr-3 font-medium text-slate-900 dark:text-white">
                        {s.subjectName}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono tabular-nums">
                        {s.marksObtained}/{s.maxMarks}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono tabular-nums">
                        {s.percentage.toFixed(1)}%
                      </td>
                      <td className="py-2.5 pr-3 text-center font-mono font-semibold">{s.grade}</td>
                      <td className="py-2.5 text-right">
                        <StatusText status={s.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => exportStudentResultPDF(inspectResult, collegeSettings)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
              >
                <FileDown className="h-3.5 w-3.5" />
                Download Official PDF
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
