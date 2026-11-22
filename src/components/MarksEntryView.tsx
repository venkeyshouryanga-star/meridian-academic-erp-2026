import { useEffect, useMemo, useState } from 'react';
import { Save, FileDown, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { exportMarksExcel, exportSubjectReportPDF } from '../lib/reports';
import { StatusText } from './UIPrimitives';
import {
  AuthUser,
  CollegeSettings,
  ExaminationRecord,
  GradeBoundary,
  MarkEntry,
  StudentRecord,
  SubjectRecord,
  resolveGrade,
  round2,
} from '../shared/types';

interface MarksEntryViewProps {
  user: AuthUser;
  students: StudentRecord[];
  subjects: SubjectRecord[];
  examinations: ExaminationRecord[];
  marks: MarkEntry[];
  gradeBoundaries: GradeBoundary[];
  collegeSettings: CollegeSettings | null;
  onRefresh: () => Promise<void>;
  onToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

export function MarksEntryView({
  user,
  students,
  subjects,
  examinations,
  marks,
  gradeBoundaries,
  collegeSettings,
  onRefresh,
  onToast,
}: MarksEntryViewProps) {
  const editableSubjects = useMemo(() => {
    if (user.role === 'teacher') {
      return subjects.filter((s) => s.teacherId === user.id);
    }
    return subjects;
  }, [subjects, user]);

  const [selectedSubjectId, setSelectedSubjectId] = useState<number | ''>(
    editableSubjects[0]?.id ?? ''
  );
  const [selectedExamId, setSelectedExamId] = useState<number | ''>(
    examinations[0]?.id ?? ''
  );
  const [drafts, setDrafts] = useState<Record<number, { score: string; remarks: string }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedSubjectId && editableSubjects[0]) {
      setSelectedSubjectId(editableSubjects[0].id);
    }
  }, [editableSubjects, selectedSubjectId]);

  useEffect(() => {
    if (!selectedExamId && examinations[0]) {
      setSelectedExamId(examinations[0].id);
    }
  }, [examinations, selectedExamId]);

  const activeSubject = editableSubjects.find((s) => s.id === Number(selectedSubjectId));
  const activeExam = examinations.find((e) => e.id === Number(selectedExamId));

  const classStudents = useMemo(() => {
    if (!activeSubject) return [];
    return students.filter((s) => s.classId === activeSubject.classId);
  }, [students, activeSubject]);

  const existingSubjectEntries = useMemo(() => {
    if (!activeSubject || !activeExam) return [];
    return marks.filter(
      (m) => m.subjectId === activeSubject.id && m.examinationId === activeExam.id
    );
  }, [marks, activeSubject, activeExam]);

  useEffect(() => {
    const nextDrafts: Record<number, { score: string; remarks: string }> = {};
    for (const stu of classStudents) {
      const existing = existingSubjectEntries.find((m) => m.studentId === stu.id);
      nextDrafts[stu.id] = {
        score: existing !== undefined ? String(existing.marksObtained) : '',
        remarks: existing?.remarks || '',
      };
    }
    setDrafts(nextDrafts);
  }, [classStudents, existingSubjectEntries]);

  const validationErrors = useMemo(() => {
    if (!activeSubject) return {};
    const errs: Record<number, string> = {};
    for (const stu of classStudents) {
      const raw = drafts[stu.id]?.score?.trim();
      if (!raw) continue;
      const num = Number(raw);
      if (Number.isNaN(num)) {
        errs[stu.id] = 'Must be a valid number';
      } else if (num < 0) {
        errs[stu.id] = 'Cannot be negative';
      } else if (num > activeSubject.maxMarks) {
        errs[stu.id] = `Exceeds maximum (${activeSubject.maxMarks})`;
      }
    }
    return errs;
  }, [drafts, classStudents, activeSubject]);

  const hasErrors = Object.keys(validationErrors).length > 0;

  const handleSaveAll = async () => {
    if (!activeSubject || !activeExam) return;
    if (hasErrors) {
      onToast('error', 'Please fix highlighted marks that exceed subject maximum limits.');
      return;
    }

    const entries = classStudents
      .filter((stu) => drafts[stu.id]?.score?.trim() !== '')
      .map((stu) => ({
        studentId: stu.id,
        subjectId: activeSubject.id,
        examinationId: activeExam.id,
        marksObtained: Number(drafts[stu.id].score),
        remarks: drafts[stu.id].remarks || '',
      }));

    if (entries.length === 0) {
      onToast('info', 'Enter at least one student mark before saving.');
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch<{ savedCount: number }>('/api/marks', {
        method: 'POST',
        body: JSON.stringify({ entries }),
      });
      onToast(
        'success',
        `Saved ${res.savedCount} verified mark ${res.savedCount === 1 ? 'entry' : 'entries'} for ${activeSubject.code}.`
      );
      await onRefresh();
    } catch (err: unknown) {
      onToast('error', err instanceof Error ? err.message : 'Unable to save marks.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportSubjectPdf = () => {
    if (!activeSubject || !activeExam) return;
    exportSubjectReportPDF(
      `${activeSubject.code} ${activeSubject.name} — ${activeExam.name}`,
      existingSubjectEntries,
      collegeSettings
    );
    onToast('info', 'Subject PDF report downloaded.');
  };

  const handleExportSubjectExcel = () => {
    if (!activeSubject || !activeExam) return;
    exportMarksExcel(
      `${activeSubject.code}_${activeExam.name}`,
      existingSubjectEntries.map((e) => ({
        RollNumber: e.rollNumber,
        StudentName: e.studentName,
        SubjectCode: e.subjectCode,
        SubjectName: e.subjectName,
        Examination: e.examinationName,
        MarksObtained: e.marksObtained,
        MaxMarks: e.maxMarks,
        PassingMarks: e.passingMarks,
        Percentage: e.percentage,
        Grade: e.grade,
        Status: e.status,
        Remarks: e.remarks,
      }))
    );
    onToast('info', 'Subject marks exported to Excel.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Marks Entry & Evaluation Sheet
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Enter or moderate marks with automatic maximum-score validation, live percentage, and grade calculation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportSubjectPdf}
            disabled={existingSubjectEntries.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-[#1E2E4A] dark:bg-[#0F1B30] dark:text-slate-200 whitespace-nowrap"
          >
            <FileDown className="h-3.5 w-3.5" />
            Subject PDF
          </button>
          <button
            type="button"
            onClick={handleExportSubjectExcel}
            disabled={existingSubjectEntries.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-[#1E2E4A] dark:bg-[#0F1B30] dark:text-slate-200 whitespace-nowrap"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving || hasErrors || !activeSubject || !activeExam}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving Marks...' : 'Save All Marks'}
          </button>
        </div>
      </div>

      {/* Selector Bar */}
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-[#1E2E4A] dark:bg-[#0F1B30] md:grid-cols-12">
        <div className="md:col-span-5">
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Subject ({editableSubjects.length} available)
          </label>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
          >
            {editableSubjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.code} — {sub.name} ({sub.className})
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-4">
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Examination Type
          </label>
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
          >
            {examinations.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name} · {ex.examType} ({ex.academicYear})
              </option>
            ))}
          </select>
        </div>

        {activeSubject && (
          <div className="flex items-end justify-between border-t border-slate-100 pt-2 md:col-span-3 md:border-t-0 md:border-l md:pl-4 md:pt-0 dark:border-[#1E2E4A]">
            <div>
              <p className="text-[11px] text-slate-500">Maximum Marks</p>
              <p className="font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                {activeSubject.maxMarks}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Min Passing</p>
              <p className="font-mono text-lg font-bold tabular-nums text-blue-700 dark:text-blue-400">
                {activeSubject.passingMarks}
              </p>
            </div>
          </div>
        )}
      </div>

      {hasErrors && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          One or more entries exceed the maximum subject marks ({activeSubject?.maxMarks}) or contain invalid values.
        </div>
      )}

      {/* Evaluation Grid */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[#1E2E4A] dark:bg-[#0F1B30]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500 dark:border-[#1E2E4A] dark:bg-slate-900/40 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Roll Number</th>
                <th className="px-4 py-3 font-medium">Student Name</th>
                <th className="px-4 py-3 font-medium">Marks Obtained (Max {activeSubject?.maxMarks ?? 100})</th>
                <th className="px-4 py-3 text-right font-medium">%</th>
                <th className="px-4 py-3 text-center font-medium">Grade</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Faculty Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1E2E4A]">
              {classStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No students enrolled in this subject&apos;s assigned class.
                  </td>
                </tr>
              ) : (
                classStudents.map((stu) => {
                  const draft = drafts[stu.id] || { score: '', remarks: '' };
                  const err = validationErrors[stu.id];
                  const numericScore = draft.score.trim() === '' ? null : Number(draft.score);
                  const validScore =
                    numericScore !== null && !Number.isNaN(numericScore) && !err && activeSubject;
                  const pct =
                    validScore && activeSubject
                      ? round2((numericScore / activeSubject.maxMarks) * 100)
                      : null;
                  const gradeInfo =
                    pct !== null ? resolveGrade(pct, gradeBoundaries) : null;
                  const status =
                    validScore && activeSubject
                      ? numericScore >= activeSubject.passingMarks
                        ? 'Pass'
                        : 'Fail'
                      : null;

                  return (
                    <tr key={stu.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono font-semibold text-blue-700 dark:text-blue-400">
                        {stu.rollNumber}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        {stu.fullName}
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          min={0}
                          max={activeSubject?.maxMarks ?? 100}
                          step="0.5"
                          value={draft.score}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [stu.id]: { ...draft, score: e.target.value },
                            }))
                          }
                          placeholder={`0–${activeSubject?.maxMarks ?? 100}`}
                          className={`w-28 rounded-lg border px-3 py-1.5 font-mono text-xs tabular-nums focus:outline-none ${
                            err
                              ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                              : 'border-slate-300 bg-white text-slate-900 focus:border-blue-600 dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white'
                          }`}
                        />
                        {err && <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{err}</p>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {pct !== null ? `${pct.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-semibold text-slate-900 dark:text-white">
                        {gradeInfo ? gradeInfo.grade : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {status ? <StatusText status={status} /> : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={draft.remarks}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [stu.id]: { ...draft, remarks: e.target.value },
                            }))
                          }
                          placeholder="Optional evaluation note"
                          className="w-full min-w-[160px] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-slate-200"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
