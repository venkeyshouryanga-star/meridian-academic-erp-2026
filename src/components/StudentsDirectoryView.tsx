import React, { useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2, FileSpreadsheet } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { exportMarksExcel } from '../lib/reports';
import { ConfirmDialog, Modal } from './UIPrimitives';
import type {
  AuthUser,
  ClassGroup,
  Department,
  StudentRecord,
} from '../shared/types';

interface StudentsDirectoryViewProps {
  user: AuthUser;
  students: StudentRecord[];
  departments: Department[];
  classes: ClassGroup[];
  onRefresh: () => Promise<void>;
  onToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

const emptyForm = {
  rollNumber: '',
  fullName: '',
  email: '',
  phone: '',
  gender: 'Female',
  dateOfBirth: '2005-05-15',
  admissionYear: 2024,
  departmentId: '',
  classId: '',
  guardianName: '',
  address: '',
  portalPassword: '',
};

export function StudentsDirectoryView({
  user,
  students,
  departments,
  classes,
  onRefresh,
  onToast,
}: StudentsDirectoryViewProps) {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StudentRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudentRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = user.role === 'admin';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (deptFilter && s.departmentId !== Number(deptFilter)) return false;
      if (classFilter && s.classId !== Number(classFilter)) return false;
      if (q) {
        return (
          s.fullName.toLowerCase().includes(q) ||
          s.rollNumber.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [students, search, deptFilter, classFilter]);

  const formClasses = useMemo(() => {
    if (!form.departmentId) return classes;
    return classes.filter((c) => c.departmentId === Number(form.departmentId));
  }, [classes, form.departmentId]);

  const openCreate = () => {
    setEditing(null);
    const firstDept = departments[0];
    const firstClass = classes.find((c) => c.departmentId === firstDept?.id) || classes[0];
    setForm({
      ...emptyForm,
      departmentId: firstDept ? String(firstDept.id) : '',
      classId: firstClass ? String(firstClass.id) : '',
    });
    setModalOpen(true);
  };

  const openEdit = (stu: StudentRecord) => {
    setEditing(stu);
    setForm({
      rollNumber: stu.rollNumber,
      fullName: stu.fullName,
      email: stu.email,
      phone: stu.phone,
      gender: stu.gender,
      dateOfBirth: stu.dateOfBirth,
      admissionYear: stu.admissionYear,
      departmentId: String(stu.departmentId),
      classId: String(stu.classId),
      guardianName: stu.guardianName,
      address: stu.address,
      portalPassword: '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        departmentId: Number(form.departmentId),
        classId: Number(form.classId),
        admissionYear: Number(form.admissionYear),
      };
      if (editing) {
        await apiFetch(`/api/students/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        onToast('success', `Updated student record for ${form.fullName}.`);
      } else {
        await apiFetch('/api/students', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onToast('success', `Enrolled ${form.fullName} (${form.rollNumber.toUpperCase()}).`);
      }
      setModalOpen(false);
      await onRefresh();
    } catch (err: unknown) {
      onToast('error', err instanceof Error ? err.message : 'Unable to save student.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/students/${deleteTarget.id}`, { method: 'DELETE' });
      onToast('success', `Removed ${deleteTarget.fullName} (${deleteTarget.rollNumber}).`);
      setDeleteTarget(null);
      await onRefresh();
    } catch (err: unknown) {
      onToast('error', err instanceof Error ? err.message : 'Unable to delete student.');
    } finally {
      setDeleting(false);
    }
  };

  const handleExportExcel = () => {
    exportMarksExcel(
      'Student_Directory',
      filtered.map((s) => ({
        RollNumber: s.rollNumber,
        StudentName: s.fullName,
        Email: s.email,
        Department: s.departmentName || '',
        Class: s.className || '',
        AdmissionYear: s.admissionYear,
        Guardian: s.guardianName,
        Phone: s.phone,
      }))
    );
    onToast('info', `Exported ${filtered.length} student records to Excel.`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Student Directory
          </h1>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            {filtered.length} of {students.length} enrolled students across departments
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#1E2E4A] dark:bg-[#0F1B30] dark:text-slate-200 whitespace-nowrap"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export Excel
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Student
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-[#1E2E4A] dark:bg-[#0F1B30] md:grid-cols-12">
        <div className="relative md:col-span-5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student name, roll number, or email..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => {
            setDeptFilter(e.target.value);
            setClassFilter('');
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 focus:border-blue-600 focus:outline-none dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-slate-200 md:col-span-3"
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
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 focus:border-blue-600 focus:outline-none dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-slate-200 md:col-span-4"
        >
          <option value="">All Classes</option>
          {classes
            .filter((c) => !deptFilter || c.departmentId === Number(deptFilter))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.academicYear})
              </option>
            ))}
        </select>
      </div>

      {/* Students Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[#1E2E4A] dark:bg-[#0F1B30]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500 dark:border-[#1E2E4A] dark:bg-slate-900/40 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Roll Number</th>
                <th className="px-4 py-3 font-medium">Student Name</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Class</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Portal Login</th>
                {isAdmin && <th className="px-4 py-3 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1E2E4A]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="px-4 py-10 text-center text-slate-500">
                    No students match the current search or filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((stu) => (
                  <tr
                    key={stu.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-blue-700 dark:text-blue-400">
                      {stu.rollNumber}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 dark:text-white">{stu.fullName}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Batch {stu.admissionYear} · {stu.gender}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {stu.departmentCode} · {stu.departmentName}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {stu.className}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <p>{stu.email}</p>
                      {stu.phone && <p className="text-[11px] text-slate-400">{stu.phone}</p>}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {stu.username || '—'}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(stu)}
                            aria-label={`Edit ${stu.fullName}`}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-700 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(stu)}
                            aria-label={`Delete ${stu.fullName}`}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Student Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Student Details' : 'Enroll New Student'}
        subtitle={
          editing
            ? `Updating roll number ${editing.rollNumber}`
            : 'Creates student record and provisions Student Portal login credentials.'
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Roll Number *
              </label>
              <input
                required
                value={form.rollNumber}
                onChange={(e) => setForm({ ...form, rollNumber: e.target.value })}
                placeholder="e.g. CSE24015"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Full Name *
              </label>
              <input
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Student full name"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Institutional Email *
              </label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="student@meridian.edu"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Phone Number
              </label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 98450 00000"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Department *
              </label>
              <select
                required
                value={form.departmentId}
                onChange={(e) => {
                  const deptId = e.target.value;
                  const matchingClass = classes.find((c) => c.departmentId === Number(deptId));
                  setForm({
                    ...form,
                    departmentId: deptId,
                    classId: matchingClass ? String(matchingClass.id) : '',
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
                value={form.classId}
                onChange={(e) => setForm({ ...form, classId: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
              >
                <option value="">Select Class</option>
                {formClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Gender
              </label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Admission Year
              </label>
              <input
                type="number"
                value={form.admissionYear}
                onChange={(e) => setForm({ ...form, admissionYear: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Guardian Name
              </label>
              <input
                value={form.guardianName}
                onChange={(e) => setForm({ ...form, guardianName: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
              />
            </div>
            {!editing && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Initial Portal Password (optional)
                </label>
                <input
                  type="password"
                  value={form.portalPassword}
                  onChange={(e) => setForm({ ...form, portalPassword: e.target.value })}
                  placeholder="Defaults to Student@2026"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2.5 border-t border-slate-200 pt-4 dark:border-[#1E2E4A]">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Enroll Student'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Student Record"
        message={`Remove ${deleteTarget?.fullName} (${deleteTarget?.rollNumber})? All associated marks entries and student portal login access will be permanently deleted.`}
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
