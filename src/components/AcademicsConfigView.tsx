import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, Save } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { ConfirmDialog, Modal, StatusText } from './UIPrimitives';
import type {
  AuthUser,
  ClassGroup,
  CollegeSettings,
  Department,
  ExaminationRecord,
  GradeBoundary,
  SubjectRecord,
} from '../shared/types';

interface StaffRow {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  departmentId: number | null;
  departmentCode?: string | null;
  designation: string;
  phone: string;
}

interface AcademicsConfigViewProps {
  user: AuthUser;
  departments: Department[];
  classes: ClassGroup[];
  subjects: SubjectRecord[];
  examinations: ExaminationRecord[];
  gradeBoundaries: GradeBoundary[];
  collegeSettings: CollegeSettings | null;
  onRefresh: () => Promise<void>;
  onToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

export function AcademicsConfigView({
  user,
  departments,
  classes,
  subjects,
  examinations,
  gradeBoundaries,
  collegeSettings,
  onRefresh,
  onToast,
}: AcademicsConfigViewProps) {
  const isAdmin = user.role === 'admin';
  const [subTab, setSubTab] = useState<'subjects' | 'departments' | 'exams' | 'faculty' | 'grading'>('subjects');
  const [staff, setStaff] = useState<StaffRow[]>([]);

  // Forms & modals
  const [subjectModal, setSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectRecord | null>(null);
  const [subjectForm, setSubjectForm] = useState({
    code: '',
    name: '',
    departmentId: '',
    classId: '',
    teacherId: '',
    maxMarks: 100,
    passingMarks: 40,
    credits: 4,
  });

  const [deptForm, setDeptForm] = useState({ name: '', code: '', hodName: '', description: '' });
  const [classForm, setClassForm] = useState({
    name: '',
    semester: 5,
    section: 'A',
    academicYear: '2026-2027',
    departmentId: '',
  });
  const [examForm, setExamForm] = useState({
    name: '',
    examType: 'Mid-Term',
    academicYear: '2026-2027',
    semester: 5,
    startDate: '2026-12-01',
    endDate: '2026-12-10',
    status: 'Scheduled',
  });
  const [staffForm, setStaffForm] = useState({
    username: '',
    fullName: '',
    email: '',
    password: '',
    role: 'teacher',
    departmentId: '',
    designation: '',
  });

  const [boundariesDraft, setBoundariesDraft] = useState<GradeBoundary[]>(gradeBoundaries);
  const [collegeDraft, setCollegeDraft] = useState<CollegeSettings | null>(collegeSettings);
  const [confirmDelete, setConfirmDelete] = useState<{ label: string; endpoint: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBoundariesDraft(gradeBoundaries);
  }, [gradeBoundaries]);

  useEffect(() => {
    setCollegeDraft(collegeSettings);
  }, [collegeSettings]);

  useEffect(() => {
    if (isAdmin || user.role === 'hod') {
      apiFetch<{ users: StaffRow[] }>('/api/users')
        .then((d) => setStaff(d.users.filter((u) => u.role !== 'student')))
        .catch(() => {});
    }
  }, [isAdmin, user.role, subjects]);

  const teachersList = staff.filter((s) => s.role === 'teacher' || s.role === 'hod');

  const openSubjectCreate = () => {
    setEditingSubject(null);
    const d0 = departments[0];
    const c0 = classes.find((c) => c.departmentId === d0?.id) || classes[0];
    setSubjectForm({
      code: '',
      name: '',
      departmentId: d0 ? String(d0.id) : '',
      classId: c0 ? String(c0.id) : '',
      teacherId: teachersList[0] ? String(teachersList[0].id) : '',
      maxMarks: 100,
      passingMarks: 40,
      credits: 4,
    });
    setSubjectModal(true);
  };

  const openSubjectEdit = (sub: SubjectRecord) => {
    setEditingSubject(sub);
    setSubjectForm({
      code: sub.code,
      name: sub.name,
      departmentId: String(sub.departmentId),
      classId: String(sub.classId),
      teacherId: sub.teacherId ? String(sub.teacherId) : '',
      maxMarks: sub.maxMarks,
      passingMarks: sub.passingMarks,
      credits: sub.credits,
    });
    setSubjectModal(true);
  };

  const saveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...subjectForm,
        departmentId: Number(subjectForm.departmentId),
        classId: Number(subjectForm.classId),
        teacherId: subjectForm.teacherId ? Number(subjectForm.teacherId) : null,
        maxMarks: Number(subjectForm.maxMarks),
        passingMarks: Number(subjectForm.passingMarks),
        credits: Number(subjectForm.credits),
      };
      if (editingSubject) {
        await apiFetch(`/api/subjects/${editingSubject.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        onToast('success', `Updated subject ${subjectForm.code.toUpperCase()}.`);
      } else {
        await apiFetch('/api/subjects', { method: 'POST', body: JSON.stringify(payload) });
        onToast('success', `Added subject ${subjectForm.code.toUpperCase()}.`);
      }
      setSubjectModal(false);
      await onRefresh();
    } catch (err: unknown) {
      onToast('error', err instanceof Error ? err.message : 'Unable to save subject.');
    } finally {
      setBusy(false);
    }
  };

  const createDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch('/api/departments', { method: 'POST', body: JSON.stringify(deptForm) });
      setDeptForm({ name: '', code: '', hodName: '', description: '' });
      onToast('success', 'Department added.');
      await onRefresh();
    } catch (err: unknown) {
      onToast('error', err instanceof Error ? err.message : 'Could not add department.');
    } finally {
      setBusy(false);
    }
  };

  const createClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch('/api/classes', {
        method: 'POST',
        body: JSON.stringify({
          ...classForm,
          departmentId: Number(classForm.departmentId),
          semester: Number(classForm.semester),
        }),
      });
      setClassForm({ ...classForm, name: '' });
      onToast('success', 'Class section added.');
      await onRefresh();
    } catch (err: unknown) {
      onToast('error', err instanceof Error ? err.message : 'Could not add class.');
    } finally {
      setBusy(false);
    }
  };

  const createExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch('/api/examinations', {
        method: 'POST',
        body: JSON.stringify({ ...examForm, semester: Number(examForm.semester) }),
      });
      setExamForm({ ...examForm, name: '' });
      onToast('success', 'Examination scheduled and notification published.');
      await onRefresh();
    } catch (err: unknown) {
      onToast('error', err instanceof Error ? err.message : 'Could not create examination.');
    } finally {
      setBusy(false);
    }
  };

  const toggleExamStatus = async (ex: ExaminationRecord) => {
    const nextStatus =
      ex.status === 'Scheduled' ? 'Ongoing' : ex.status === 'Ongoing' ? 'Published' : 'Scheduled';
    try {
      await apiFetch(`/api/examinations/${ex.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...ex, status: nextStatus }),
      });
      onToast('success', `${ex.name} marked as ${nextStatus}.`);
      await onRefresh();
    } catch (err: unknown) {
      onToast('error', err instanceof Error ? err.message : 'Could not update exam status.');
    }
  };

  const createStaffAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          ...staffForm,
          departmentId: staffForm.departmentId ? Number(staffForm.departmentId) : null,
        }),
      });
      setStaffForm({
        username: '',
        fullName: '',
        email: '',
        password: '',
        role: 'teacher',
        departmentId: '',
        designation: '',
      });
      onToast('success', 'Staff portal account created.');
      const res = await apiFetch<{ users: StaffRow[] }>('/api/users');
      setStaff(res.users.filter((u) => u.role !== 'student'));
      await onRefresh();
    } catch (err: unknown) {
      onToast('error', err instanceof Error ? err.message : 'Could not create staff account.');
    } finally {
      setBusy(false);
    }
  };

  const saveGradeBoundaries = async () => {
    setBusy(true);
    try {
      await apiFetch('/api/grade-boundaries', {
        method: 'PUT',
        body: JSON.stringify({ boundaries: boundariesDraft }),
      });
      onToast('success', 'Configurable grading scale updated across all results.');
      await onRefresh();
    } catch (err: unknown) {
      onToast('error', err instanceof Error ? err.message : 'Could not save grade boundaries.');
    } finally {
      setBusy(false);
    }
  };

  const saveCollegeSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collegeDraft) return;
    setBusy(true);
    try {
      await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(collegeDraft),
      });
      onToast('success', 'College institution details saved.');
      await onRefresh();
    } catch (err: unknown) {
      onToast('error', err instanceof Error ? err.message : 'Could not save college settings.');
    } finally {
      setBusy(false);
    }
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await apiFetch(confirmDelete.endpoint, { method: 'DELETE' });
      onToast('success', `Deleted ${confirmDelete.label}.`);
      setConfirmDelete(null);
      if (isAdmin) {
        const res = await apiFetch<{ users: StaffRow[] }>('/api/users');
        setStaff(res.users.filter((u) => u.role !== 'student'));
      }
      await onRefresh();
    } catch (err: unknown) {
      onToast('error', err instanceof Error ? err.message : 'Delete operation failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Academic Structure & Configuration
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Manage subjects, departments, classes, examinations, faculty accounts, and configurable grade boundaries.
        </p>
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-200/70 p-1 dark:bg-[#0F1B30] dark:border dark:border-[#1E2E4A] w-fit">
        {[
          { id: 'subjects', label: 'Subjects' },
          { id: 'departments', label: 'Departments & Classes' },
          { id: 'exams', label: 'Examinations' },
          ...(isAdmin
            ? [
                { id: 'faculty', label: 'Faculty Accounts' },
                { id: 'grading', label: 'Grading & College' },
              ]
            : []),
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id as typeof subTab)}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              subTab === tab.id
                ? 'bg-white text-blue-700 shadow-sm dark:bg-blue-600 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: SUBJECTS */}
      {subTab === 'subjects' && (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-[#1E2E4A] dark:bg-[#0F1B30]">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-[#1E2E4A]">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Course Subjects ({subjects.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Maximum marks and minimum passing thresholds are enforced during marks entry
              </p>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={openSubjectCreate}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Subject
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500 dark:border-[#1E2E4A] dark:bg-slate-900/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Subject Title</th>
                  <th className="px-4 py-3 font-medium">Department / Class</th>
                  <th className="px-4 py-3 font-medium">Assigned Faculty</th>
                  <th className="px-4 py-3 text-right font-medium">Max</th>
                  <th className="px-4 py-3 text-right font-medium">Pass</th>
                  <th className="px-4 py-3 text-right font-medium">Credits</th>
                  {isAdmin && <th className="px-4 py-3 text-right font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1E2E4A]">
                {subjects.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono font-semibold text-blue-700 dark:text-blue-400">
                      {sub.code}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {sub.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {sub.departmentCode} · {sub.className}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {sub.teacherName || 'Unassigned'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{sub.maxMarks}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{sub.passingMarks}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{sub.credits}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openSubjectEdit(sub)}
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-700 dark:hover:bg-slate-800"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDelete({
                                label: `${sub.code} (${sub.name})`,
                                endpoint: `/api/subjects/${sub.id}`,
                              })
                            }
                            className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: DEPARTMENTS & CLASSES */}
      {subTab === 'departments' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white dark:border-[#1E2E4A] dark:bg-[#0F1B30]">
              <div className="border-b border-slate-200 px-5 py-4 dark:border-[#1E2E4A]">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Departments ({departments.length})
                </h2>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-[#1E2E4A]">
                {departments.map((d) => (
                  <div key={d.id} className="flex items-start justify-between gap-3 px-5 py-3.5">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        <span className="font-mono text-blue-700 dark:text-blue-400">{d.code}</span> · {d.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        HOD: {d.hodName || 'Assigned via Academic Council'} · {d.studentCount ?? 0} students · {d.subjectCount ?? 0} subjects
                      </p>
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDelete({ label: d.name, endpoint: `/api/departments/${d.id}` })
                        }
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {isAdmin && (
              <form
                onSubmit={createDepartment}
                className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 dark:border-[#1E2E4A] dark:bg-[#0F1B30]"
              >
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white">Add Department</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    required
                    placeholder="Code (e.g. CIVIL)"
                    value={deptForm.code}
                    onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
                  />
                  <input
                    required
                    placeholder="Department Name"
                    value={deptForm.name}
                    onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
                  />
                  <input
                    placeholder="Head of Department Name"
                    value={deptForm.hodName}
                    onChange={(e) => setDeptForm({ ...deptForm, hodName: e.target.value })}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:col-span-2 dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                >
                  Create Department
                </button>
              </form>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white dark:border-[#1E2E4A] dark:bg-[#0F1B30]">
              <div className="border-b border-slate-200 px-5 py-4 dark:border-[#1E2E4A]">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Classes & Semesters ({classes.length})
                </h2>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-[#1E2E4A]">
                {classes.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">{c.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {c.departmentCode} · Sem {c.semester} · Sec {c.section} · {c.academicYear} · {c.studentCount ?? 0} students
                      </p>
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDelete({ label: c.name, endpoint: `/api/classes/${c.id}` })
                        }
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {isAdmin && (
              <form
                onSubmit={createClass}
                className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 dark:border-[#1E2E4A] dark:bg-[#0F1B30]"
              >
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white">Add Class Section</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    required
                    value={classForm.departmentId}
                    onChange={(e) => setClassForm({ ...classForm, departmentId: e.target.value })}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </option>
                    ))}
                  </select>
                  <input
                    required
                    placeholder="Class Name (e.g. CSE Sem 7 - A)"
                    value={classForm.name}
                    onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
                  />
                  <input
                    type="number"
                    min={1}
                    max={8}
                    placeholder="Semester"
                    value={classForm.semester}
                    onChange={(e) => setClassForm({ ...classForm, semester: Number(e.target.value) })}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
                  />
                  <input
                    placeholder="Academic Year (2026-2027)"
                    value={classForm.academicYear}
                    onChange={(e) => setClassForm({ ...classForm, academicYear: e.target.value })}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                >
                  Create Class
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: EXAMINATIONS */}
      {subTab === 'exams' && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-slate-200 bg-white dark:border-[#1E2E4A] dark:bg-[#0F1B30] lg:col-span-8">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-[#1E2E4A]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Scheduled Examinations ({examinations.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500 dark:border-[#1E2E4A] dark:bg-slate-900/40 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Examination</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Window</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    {isAdmin && <th className="px-4 py-3 text-right font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1E2E4A]">
                  {examinations.map((ex) => (
                    <tr key={ex.id}>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        {ex.name}
                        <p className="text-[11px] text-slate-400">{ex.academicYear} · Sem {ex.semester}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{ex.examType}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {ex.startDate} to {ex.endDate}
                      </td>
                      <td className="px-4 py-3">
                        <StatusText status={ex.status} />
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleExamStatus(ex)}
                              className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400 whitespace-nowrap"
                            >
                              Cycle Status
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDelete({
                                  label: ex.name,
                                  endpoint: `/api/examinations/${ex.id}`,
                                })
                              }
                              className="rounded p-1 text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {isAdmin && (
            <form
              onSubmit={createExam}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 dark:border-[#1E2E4A] dark:bg-[#0F1B30] lg:col-span-4 h-fit"
            >
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Schedule Examination
              </h3>
              <input
                required
                placeholder="Exam Title (e.g. Supplementary Exam)"
                value={examForm.name}
                onChange={(e) => setExamForm({ ...examForm, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={examForm.examType}
                  onChange={(e) => setExamForm({ ...examForm, examType: e.target.value })}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
                >
                  <option value="Internal">Internal</option>
                  <option value="Mid-Term">Mid-Term</option>
                  <option value="Final">Final</option>
                  <option value="Practical">Practical</option>
                </select>
                <input
                  value={examForm.academicYear}
                  onChange={(e) => setExamForm({ ...examForm, academicYear: e.target.value })}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] text-slate-500">Start Date</label>
                  <input
                    type="date"
                    required
                    value={examForm.startDate}
                    onChange={(e) => setExamForm({ ...examForm, startDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-500">End Date</label>
                  <input
                    type="date"
                    required
                    value={examForm.endDate}
                    onChange={(e) => setExamForm({ ...examForm, endDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
              >
                Create Examination
              </button>
            </form>
          )}
        </div>
      )}

      {/* TAB 4: FACULTY ACCOUNTS */}
      {subTab === 'faculty' && isAdmin && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-slate-200 bg-white dark:border-[#1E2E4A] dark:bg-[#0F1B30] lg:col-span-8">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-[#1E2E4A]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Faculty, HOD & Administrator Accounts ({staff.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500 dark:border-[#1E2E4A] dark:bg-slate-900/40 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Username</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Department</th>
                    <th className="px-4 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1E2E4A]">
                  {staff.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 dark:text-white">{u.fullName}</p>
                        <p className="text-[11px] text-slate-400">{u.email}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">
                        {u.username}
                      </td>
                      <td className="px-4 py-3 font-medium uppercase text-blue-700 dark:text-blue-400">
                        {u.role}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {u.departmentCode || 'Institution-wide'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {u.id !== user.id && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDelete({
                                label: u.fullName,
                                endpoint: `/api/users/${u.id}`,
                              })
                            }
                            className="rounded p-1.5 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <form
            onSubmit={createStaffAccount}
            className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 dark:border-[#1E2E4A] dark:bg-[#0F1B30] lg:col-span-4 h-fit"
          >
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Add Faculty / HOD Account
            </h3>
            <input
              required
              placeholder="Full Name"
              value={staffForm.fullName}
              onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                required
                placeholder="Username"
                value={staffForm.username}
                onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
              />
              <select
                value={staffForm.role}
                onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
              >
                <option value="teacher">Teacher</option>
                <option value="hod">HOD</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <input
              required
              type="email"
              placeholder="Institutional Email"
              value={staffForm.email}
              onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
            />
            <input
              required
              type="password"
              placeholder="Account Password (scrypt hashed)"
              value={staffForm.password}
              onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
            />
            <select
              value={staffForm.departmentId}
              onChange={(e) => setStaffForm({ ...staffForm, departmentId: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
            >
              Provision Account
            </button>
          </form>
        </div>
      )}

      {/* TAB 5: CONFIGURABLE GRADE BOUNDARIES & COLLEGE SETTINGS */}
      {subTab === 'grading' && isAdmin && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-[#1E2E4A] dark:bg-[#0F1B30] lg:col-span-7">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Configurable Grading Boundaries
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Changes apply immediately to all automatic result & GPA calculations
                </p>
              </div>
              <button
                type="button"
                onClick={saveGradeBoundaries}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
              >
                <Save className="h-3.5 w-3.5" />
                Save Scale
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 text-slate-500 dark:border-[#1E2E4A]">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Grade</th>
                    <th className="py-2 pr-3 font-medium">Min %</th>
                    <th className="py-2 pr-3 font-medium">Max %</th>
                    <th className="py-2 pr-3 font-medium">Points</th>
                    <th className="py-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1E2E4A]">
                  {boundariesDraft.map((b, idx) => (
                    <tr key={b.id}>
                      <td className="py-2.5 pr-3 font-mono font-bold text-blue-700 dark:text-blue-400">
                        {b.grade}
                      </td>
                      <td className="py-2.5 pr-3">
                        <input
                          type="number"
                          step="0.01"
                          value={b.minPercentage}
                          onChange={(e) => {
                            const next = [...boundariesDraft];
                            next[idx] = { ...b, minPercentage: Number(e.target.value) };
                            setBoundariesDraft(next);
                          }}
                          className="w-20 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E]"
                        />
                      </td>
                      <td className="py-2.5 pr-3">
                        <input
                          type="number"
                          step="0.01"
                          value={b.maxPercentage}
                          onChange={(e) => {
                            const next = [...boundariesDraft];
                            next[idx] = { ...b, maxPercentage: Number(e.target.value) };
                            setBoundariesDraft(next);
                          }}
                          className="w-20 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E]"
                        />
                      </td>
                      <td className="py-2.5 pr-3">
                        <input
                          type="number"
                          step="0.5"
                          value={b.gradePoint}
                          onChange={(e) => {
                            const next = [...boundariesDraft];
                            next[idx] = { ...b, gradePoint: Number(e.target.value) };
                            setBoundariesDraft(next);
                          }}
                          className="w-16 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E]"
                        />
                      </td>
                      <td className="py-2.5">
                        <input
                          value={b.description}
                          onChange={(e) => {
                            const next = [...boundariesDraft];
                            next[idx] = { ...b, description: e.target.value };
                            setBoundariesDraft(next);
                          }}
                          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {collegeDraft && (
            <form
              onSubmit={saveCollegeSettings}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 dark:border-[#1E2E4A] dark:bg-[#0F1B30] lg:col-span-5"
            >
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                College Information (PDF Header)
              </h2>
              <div>
                <label className="mb-1 block text-xs text-slate-500">College Name</label>
                <input
                  value={collegeDraft.collegeName}
                  onChange={(e) =>
                    setCollegeDraft({ ...collegeDraft, collegeName: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Institution Code</label>
                  <input
                    value={collegeDraft.collegeCode}
                    onChange={(e) =>
                      setCollegeDraft({ ...collegeDraft, collegeCode: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Academic Year</label>
                  <input
                    value={collegeDraft.currentAcademicYear}
                    onChange={(e) =>
                      setCollegeDraft({ ...collegeDraft, currentAcademicYear: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Affiliation & Accreditation</label>
                <input
                  value={collegeDraft.affiliation}
                  onChange={(e) =>
                    setCollegeDraft({ ...collegeDraft, affiliation: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Campus Address</label>
                <input
                  value={collegeDraft.address}
                  onChange={(e) =>
                    setCollegeDraft({ ...collegeDraft, address: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
              >
                Save Institution Settings
              </button>
            </form>
          )}
        </div>
      )}

      {/* Subject Create/Edit Modal */}
      <Modal
        open={subjectModal}
        onClose={() => setSubjectModal(false)}
        title={editingSubject ? 'Edit Subject' : 'Add New Subject'}
      >
        <form onSubmit={saveSubject} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Subject Code *
              </label>
              <input
                required
                value={subjectForm.code}
                onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                placeholder="e.g. CS508"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Subject Name *
              </label>
              <input
                required
                value={subjectForm.name}
                onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                placeholder="Cloud Computing Architecture"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Department *
              </label>
              <select
                required
                value={subjectForm.departmentId}
                onChange={(e) => {
                  const deptId = e.target.value;
                  const c0 = classes.find((c) => c.departmentId === Number(deptId));
                  setSubjectForm({
                    ...subjectForm,
                    departmentId: deptId,
                    classId: c0 ? String(c0.id) : '',
                  });
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Class *
              </label>
              <select
                required
                value={subjectForm.classId}
                onChange={(e) => setSubjectForm({ ...subjectForm, classId: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
              >
                <option value="">Select Class</option>
                {classes
                  .filter(
                    (c) =>
                      !subjectForm.departmentId ||
                      c.departmentId === Number(subjectForm.departmentId)
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Assigned Faculty
              </label>
              <select
                value={subjectForm.teacherId}
                onChange={(e) => setSubjectForm({ ...subjectForm, teacherId: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
              >
                <option value="">Unassigned</option>
                {teachersList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName} ({t.role.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Max</label>
                <input
                  type="number"
                  min={10}
                  max={500}
                  required
                  value={subjectForm.maxMarks}
                  onChange={(e) =>
                    setSubjectForm({ ...subjectForm, maxMarks: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Pass</label>
                <input
                  type="number"
                  min={1}
                  max={subjectForm.maxMarks}
                  required
                  value={subjectForm.passingMarks}
                  onChange={(e) =>
                    setSubjectForm({ ...subjectForm, passingMarks: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Credits</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  required
                  value={subjectForm.credits}
                  onChange={(e) =>
                    setSubjectForm({ ...subjectForm, credits: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2.5 border-t border-slate-200 pt-4 dark:border-[#1E2E4A]">
            <button
              type="button"
              onClick={() => setSubjectModal(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
            >
              {busy ? 'Saving...' : editingSubject ? 'Save Subject' : 'Create Subject'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Confirm Removal"
        message={`Permanently delete ${confirmDelete?.label}? Related records may be affected.`}
        busy={busy}
        onConfirm={executeDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
