/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { signOut } from 'firebase/auth';
import {
  LayoutDashboard,
  Users,
  ClipboardEdit,
  FileSpreadsheet,
  BarChart3,
  BookOpen,
  UserCircle,
  LogOut,
  Moon,
  Sun,
  Bell,
  Menu,
  X,
  RefreshCw,
} from 'lucide-react';
import { auth } from './lib/firebase';
import { apiFetch, setAuthToken } from './lib/api';
import { exportClassReportPDF } from './lib/reports';
import { LoginView } from './components/LoginView';
import { OverviewView } from './components/OverviewView';
import { StudentsDirectoryView } from './components/StudentsDirectoryView';
import { AcademicsConfigView } from './components/AcademicsConfigView';
import { MarksEntryView } from './components/MarksEntryView';
import { ResultsReportsView } from './components/ResultsReportsView';
import { AnalyticsView } from './components/AnalyticsView';
import { ProfileNotificationsView } from './components/ProfileNotificationsView';
import { TableSkeleton, ToastMessage, ToastStack } from './components/UIPrimitives';
import type {
  ActivityItem,
  AnalyticsPayload,
  AuthUser,
  ClassGroup,
  CollegeSettings,
  Department,
  ExaminationRecord,
  GradeBoundary,
  MarkEntry,
  NotificationItem,
  StudentRecord,
  StudentResultSummary,
  SubjectRecord,
} from './shared/types';

type NavTab =
  | 'overview'
  | 'students'
  | 'marks'
  | 'results'
  | 'analytics'
  | 'academics'
  | 'profile';

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('meridian_theme') === 'dark';
  });

  const [user, setUser] = useState<AuthUser | null>(null);
  const [authProvider, setAuthProvider] = useState<'local' | 'firebase' | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Core relational datasets from Cloud SQL
  const [loadingData, setLoadingData] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [examinations, setExaminations] = useState<ExaminationRecord[]>([]);
  const [marks, setMarks] = useState<MarkEntry[]>([]);
  const [results, setResults] = useState<StudentResultSummary[]>([]);
  const [gradeBoundaries, setGradeBoundaries] = useState<GradeBoundary[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [collegeSettings, setCollegeSettings] = useState<CollegeSettings | null>(null);

  // Global academic selectors
  const [selectedExamId, setSelectedExamId] = useState<number | ''>('');
  const [selectedDeptId, setSelectedDeptId] = useState<number | ''>('');
  const [selectedYear, setSelectedYear] = useState<string>('2026-2027');

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev.slice(-3), { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('meridian_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('meridian_theme', 'light');
    }
  }, [darkMode]);

  const loadWorkspaceData = useCallback(
    async (currentUser: AuthUser, examId?: number | '', deptId?: number | '') => {
      setLoadingData(true);
      try {
        const analyticsParams = new URLSearchParams();
        if (examId) analyticsParams.set('examinationId', String(examId));
        if (deptId) analyticsParams.set('departmentId', String(deptId));
        if (selectedYear) analyticsParams.set('academicYear', selectedYear);

        const [
          meRes,
          analyticsRes,
          deptsRes,
          classesRes,
          studentsRes,
          subjectsRes,
          examsRes,
          marksRes,
          activitiesRes,
          notificationsRes,
          settingsRes,
        ] = await Promise.all([
          apiFetch<{ user: AuthUser }>('/api/auth/me'),
          apiFetch<{ analytics: AnalyticsPayload }>(
            `/api/analytics?${analyticsParams.toString()}`
          ),
          apiFetch<{ departments: Department[] }>('/api/departments'),
          apiFetch<{ classes: ClassGroup[] }>('/api/classes'),
          apiFetch<{ students: StudentRecord[] }>('/api/students'),
          apiFetch<{ subjects: SubjectRecord[] }>('/api/subjects'),
          apiFetch<{ examinations: ExaminationRecord[] }>('/api/examinations'),
          apiFetch<{
            marks: MarkEntry[];
            results: StudentResultSummary[];
            gradeBoundaries: GradeBoundary[];
          }>('/api/marks'),
          apiFetch<{ activities: ActivityItem[] }>('/api/activities'),
          apiFetch<{ notifications: NotificationItem[] }>('/api/notifications'),
          apiFetch<{ settings: CollegeSettings }>('/api/settings'),
        ]);

        if (meRes.user) setUser(meRes.user);
        setAnalytics(analyticsRes.analytics);
        setDepartments(deptsRes.departments);
        setClasses(classesRes.classes);
        setStudents(studentsRes.students);
        setSubjects(subjectsRes.subjects);
        setExaminations(examsRes.examinations);
        setMarks(marksRes.marks);
        setResults(marksRes.results);
        setGradeBoundaries(marksRes.gradeBoundaries);
        setActivities(activitiesRes.activities);
        setNotifications(notificationsRes.notifications);
        if (settingsRes.settings) {
          setCollegeSettings(settingsRes.settings);
        }
      } catch (err: unknown) {
        pushToast(
          'error',
          err instanceof Error ? err.message : 'Failed to synchronize academic records.'
        );
      } finally {
        setLoadingData(false);
      }
    },
    [pushToast, selectedYear]
  );

  const handleAuthenticated = useCallback(
    (authUser: AuthUser, token: string, provider: 'local' | 'firebase') => {
      setAuthToken(token);
      setUser(authUser);
      setAuthProvider(provider);
      setActiveTab(authUser.role === 'student' ? 'results' : 'overview');
      loadWorkspaceData(authUser, '', '');
    },
    [loadWorkspaceData]
  );

  useEffect(() => {
    if (user) {
      loadWorkspaceData(user, selectedExamId, selectedDeptId);
    }
  }, [selectedExamId, selectedDeptId, selectedYear]);

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      if (authProvider === 'firebase') {
        await signOut(auth).catch(() => {});
      }
    } finally {
      setAuthToken(null);
      setUser(null);
      setAuthProvider(null);
      setSelectedExamId('');
      setSelectedDeptId('');
      setMobileMenuOpen(false);
    }
  };

  const navItems = useMemo(() => {
    if (!user) return [];
    if (user.role === 'student') {
      return [
        { id: 'results' as NavTab, label: 'My Results', icon: FileSpreadsheet },
        { id: 'profile' as NavTab, label: 'Profile & Notices', icon: UserCircle },
      ];
    }
    if (user.role === 'teacher') {
      return [
        { id: 'overview' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
        { id: 'marks' as NavTab, label: 'Marks Entry', icon: ClipboardEdit },
        { id: 'students' as NavTab, label: 'Students', icon: Users },
        { id: 'results' as NavTab, label: 'Results & Reports', icon: FileSpreadsheet },
        { id: 'analytics' as NavTab, label: 'Analytics', icon: BarChart3 },
        { id: 'academics' as NavTab, label: 'Subjects & Exams', icon: BookOpen },
        { id: 'profile' as NavTab, label: 'Profile & Notices', icon: UserCircle },
      ];
    }
    if (user.role === 'hod') {
      return [
        { id: 'overview' as NavTab, label: 'HOD Dashboard', icon: LayoutDashboard },
        { id: 'analytics' as NavTab, label: 'Dept Analytics', icon: BarChart3 },
        { id: 'results' as NavTab, label: 'Results & Reports', icon: FileSpreadsheet },
        { id: 'students' as NavTab, label: 'Students', icon: Users },
        { id: 'academics' as NavTab, label: 'Courses & Exams', icon: BookOpen },
        { id: 'profile' as NavTab, label: 'Profile & Notices', icon: UserCircle },
      ];
    }
    return [
      { id: 'overview' as NavTab, label: 'Admin Dashboard', icon: LayoutDashboard },
      { id: 'students' as NavTab, label: 'Students', icon: Users },
      { id: 'marks' as NavTab, label: 'Marks Entry', icon: ClipboardEdit },
      { id: 'results' as NavTab, label: 'Results & Reports', icon: FileSpreadsheet },
      { id: 'analytics' as NavTab, label: 'Analytics', icon: BarChart3 },
      { id: 'academics' as NavTab, label: 'Academics & Scale', icon: BookOpen },
      { id: 'profile' as NavTab, label: 'Profile & Notices', icon: UserCircle },
    ];
  }, [user]);

  const unreadNotifications = notifications.filter((n) => !n.isRead).length;

  if (!user) {
    return (
      <>
        <LoginView
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((d) => !d)}
          onAuthenticated={handleAuthenticated}
        />
        <ToastStack
          toasts={toasts}
          onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))}
        />
      </>
    );
  }

  const currentNavLabel =
    navItems.find((item) => item.id === activeTab)?.label || 'Workspace';

  const fallbackAvatar =
    user.role === 'student'
      ? '/src/assets/images/avatar_student_scholar_1795351453031.jpg'
      : user.role === 'teacher'
        ? '/src/assets/images/avatar_faculty_prof_1795351454135.jpg'
        : '/src/assets/images/avatar_admin_dean_1795351455226.jpg';

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 dark:bg-[#080F1E] dark:text-slate-100">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden"
        />
      )}

      {/* Institutional Navy Sidebar */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#0B1933] text-slate-200 transition-transform duration-200 lg:static lg:translate-x-0 dark:bg-[#060C18] dark:border-r dark:border-[#1E2E4A] ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/src/assets/images/college_crest_emblem_1795351453872.jpg"
              alt="Meridian Institute crest"
              referrerPolicy="no-referrer"
              className="h-9 w-9 shrink-0 rounded-lg bg-white object-cover p-0.5"
            />
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-bold text-white">
                Meridian ERP
              </p>
              <p className="truncate text-[11px] text-slate-400">
                {user.role.toUpperCase()} Portal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
            className="rounded p-1 text-slate-400 hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <img
              src={user.avatarUrl || fallbackAvatar}
              alt={user.fullName}
              referrerPolicy="no-referrer"
              className="h-9 w-9 shrink-0 rounded-lg object-cover border border-white/15"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{user.fullName}</p>
              <p className="truncate text-[11px] text-slate-400">@{user.username}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Viewport */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 dark:border-[#1E2E4A] dark:bg-[#0B1528]/95">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 truncate text-xs">
              <span className="hidden sm:inline font-medium text-slate-400">
                {collegeSettings?.collegeCode || 'MIET-2026'}
              </span>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-600">/</span>
              <span className="font-semibold text-slate-900 dark:text-white truncate">
                {currentNavLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <select
              aria-label="Select academic year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="hidden sm:block rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-700 focus:border-blue-600 focus:outline-none dark:border-[#1E2E4A] dark:bg-[#0F1B30] dark:text-slate-200"
            >
              <option value="2026-2027">AY 2026-2027</option>
              <option value="2025-2026">AY 2025-2026</option>
            </select>

            <button
              type="button"
              onClick={() => loadWorkspaceData(user, selectedExamId, selectedDeptId)}
              aria-label="Refresh database records"
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-[#1E2E4A] dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              aria-label="View notifications"
              className="relative rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-[#1E2E4A] dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Bell className="h-3.5 w-3.5" />
              {unreadNotifications > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 font-mono text-[10px] font-semibold text-white">
                  {unreadNotifications}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label="Toggle color theme"
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-[#1E2E4A] dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
          </div>
        </header>

        {/* Main Content Canvas */}
        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 sm:p-6 lg:p-8">
          {loadingData && !analytics ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-[#1E2E4A] dark:bg-[#0F1B30]">
              <TableSkeleton rows={6} cols={5} />
            </div>
          ) : (
            <>
              {activeTab === 'overview' && user.role !== 'student' && (
                <OverviewView
                  user={user}
                  analytics={analytics}
                  students={students}
                  subjects={subjects}
                  examinations={examinations}
                  activities={activities}
                  selectedExamId={selectedExamId}
                  onSelectExamId={setSelectedExamId}
                  darkMode={darkMode}
                  onNavigate={(t) => setActiveTab(t as NavTab)}
                  onExportQuickReport={() => {
                    exportClassReportPDF(
                      'Institutional Academic Result Summary',
                      results,
                      collegeSettings
                    );
                    pushToast('success', 'Institutional PDF report downloaded.');
                  }}
                />
              )}

              {activeTab === 'students' && user.role !== 'student' && (
                <StudentsDirectoryView
                  user={user}
                  students={students}
                  departments={departments}
                  classes={classes}
                  onRefresh={() => loadWorkspaceData(user, selectedExamId, selectedDeptId)}
                  onToast={pushToast}
                />
              )}

              {activeTab === 'marks' && (user.role === 'admin' || user.role === 'teacher') && (
                <MarksEntryView
                  user={user}
                  students={students}
                  subjects={subjects}
                  examinations={examinations}
                  marks={marks}
                  gradeBoundaries={gradeBoundaries}
                  collegeSettings={collegeSettings}
                  onRefresh={() => loadWorkspaceData(user, selectedExamId, selectedDeptId)}
                  onToast={pushToast}
                />
              )}

              {activeTab === 'results' && (
                <ResultsReportsView
                  user={user}
                  results={results}
                  marks={marks}
                  departments={departments}
                  classes={classes}
                  subjects={subjects}
                  examinations={examinations}
                  collegeSettings={collegeSettings}
                  darkMode={darkMode}
                  onToast={pushToast}
                />
              )}

              {activeTab === 'analytics' && user.role !== 'student' && (
                <AnalyticsView
                  analytics={analytics}
                  departments={departments}
                  examinations={examinations}
                  results={results}
                  selectedExamId={selectedExamId}
                  selectedDeptId={selectedDeptId}
                  onSelectExamId={setSelectedExamId}
                  onSelectDeptId={setSelectedDeptId}
                  darkMode={darkMode}
                />
              )}

              {activeTab === 'academics' && user.role !== 'student' && (
                <AcademicsConfigView
                  user={user}
                  departments={departments}
                  classes={classes}
                  subjects={subjects}
                  examinations={examinations}
                  gradeBoundaries={gradeBoundaries}
                  collegeSettings={collegeSettings}
                  onRefresh={() => loadWorkspaceData(user, selectedExamId, selectedDeptId)}
                  onToast={pushToast}
                />
              )}

              {activeTab === 'profile' && (
                <ProfileNotificationsView
                  user={user}
                  notifications={notifications}
                  onRefresh={() => loadWorkspaceData(user, selectedExamId, selectedDeptId)}
                  onToast={pushToast}
                />
              )}
            </>
          )}
        </main>
      </div>

      <ToastStack
        toasts={toasts}
        onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))}
      />
    </div>
  );
}
