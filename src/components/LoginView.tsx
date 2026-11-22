import React, { useEffect, useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { Eye, EyeOff, Lock, User, Moon, Sun, ArrowRight, ShieldCheck } from 'lucide-react';
import { auth, googleAuthProvider } from '../lib/firebase';
import { apiFetch, setAuthToken } from '../lib/api';
import type { AuthUser, UserRole } from '../shared/types';

interface LoginViewProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onAuthenticated: (user: AuthUser, token: string, provider: 'local' | 'firebase') => void;
}

const PORTALS: Array<{ role: UserRole; label: string; demoUser: string; demoPass: string; note: string }> = [
  { role: 'admin', label: 'Administrator', demoUser: 'admin', demoPass: 'Admin@2026', note: 'Full ERP & Grading Control' },
  { role: 'teacher', label: 'Teacher', demoUser: 'teacher', demoPass: 'Teacher@2026', note: 'Marks Entry & Subject Analytics' },
  { role: 'student', label: 'Student', demoUser: 'student', demoPass: 'Student@2026', note: 'Personal Results & PDF Marksheet' },
  { role: 'hod', label: 'HOD', demoUser: 'hod', demoPass: 'Hod@2026', note: 'Department Analytics & Toppers' },
];

export function LoginView({ darkMode, onToggleDarkMode, onAuthenticated }: LoginViewProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collegeName, setCollegeName] = useState('Meridian Institute of Engineering & Technology');
  const [academicYear, setAcademicYear] = useState('2026-2027');

  useEffect(() => {
    const rememberedUser = localStorage.getItem('meridian_remembered_user');
    const rememberedRole = localStorage.getItem('meridian_remembered_role') as UserRole | null;
    if (rememberedUser) setUsername(rememberedUser);
    if (rememberedRole && ['admin', 'teacher', 'student', 'hod'].includes(rememberedRole)) {
      setSelectedRole(rememberedRole);
    }

    fetch('/api/public/college')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.collegeName) setCollegeName(d.collegeName);
        if (d?.currentAcademicYear) setAcademicYear(d.currentAcademicYear);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim(),
          password,
          role: selectedRole,
        }),
      });
      if (rememberMe) {
        localStorage.setItem('meridian_remembered_user', username.trim());
        localStorage.setItem('meridian_remembered_role', selectedRole);
      } else {
        localStorage.removeItem('meridian_remembered_user');
        localStorage.removeItem('meridian_remembered_role');
      }
      setAuthToken(res.token);
      onAuthenticated(res.user, res.token, 'local');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const credential = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await credential.user.getIdToken();
      setAuthToken(idToken);
      const res = await apiFetch<{ user: AuthUser }>('/api/auth/firebase', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      onAuthenticated(res.user, idToken, 'firebase');
    } catch (err: unknown) {
      setAuthToken(null);
      setError(err instanceof Error ? err.message : 'Google sign-in was cancelled or failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const fillDemoCredentials = (portal: (typeof PORTALS)[number]) => {
    setSelectedRole(portal.role);
    setUsername(portal.demoUser);
    setPassword(portal.demoPass);
    setError(null);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-slate-50 dark:bg-[#080F1E]">
      {/* Left Architectural Editorial Column */}
      <div className="relative hidden lg:flex lg:col-span-5 flex-col justify-between overflow-hidden bg-[#0B1933] p-10 text-white">
        <img
          src="/src/assets/images/campus_login_backdrop_1795351457468.jpg"
          alt="Meridian Institute campus atrium"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060E1F] via-[#0B1933]/75 to-[#0B1933]/65" />

        <div className="relative z-10 flex items-center gap-3.5">
          <img
            src="/src/assets/images/college_crest_emblem_1795351453872.jpg"
            alt="Meridian Institute crest"
            referrerPolicy="no-referrer"
            className="h-11 w-11 rounded-lg border border-white/20 bg-white object-cover p-0.5"
          />
          <div>
            <p className="font-display text-base font-bold tracking-tight text-white">
              Meridian Academic ERP
            </p>
            <p className="text-xs text-slate-300">Academic Year {academicYear}</p>
          </div>
        </div>

        <div className="relative z-10 max-w-md space-y-5">
          <h1 className="font-display text-3xl font-bold leading-tight text-white">
            Student Marks & Examination Management
          </h1>
          <p className="text-sm leading-relaxed text-slate-200">
            Unified academic records, automated GPA and grade computation, department analytics, and official PDF transcripts across every faculty and cohort.
          </p>
          <div className="grid grid-cols-3 gap-4 border-t border-white/15 pt-5 text-xs">
            <div>
              <p className="font-mono text-lg font-semibold text-white tabular-nums">4</p>
              <p className="text-slate-300">Role Portals</p>
            </div>
            <div>
              <p className="font-mono text-lg font-semibold text-white tabular-nums">SQL</p>
              <p className="text-slate-300">Live Database</p>
            </div>
            <div>
              <p className="font-mono text-lg font-semibold text-white tabular-nums">PDF / XLS</p>
              <p className="text-slate-300">Official Reports</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-slate-300">
          <span>{collegeName}</span>
        </div>
      </div>

      {/* Right Authentication Form Column */}
      <div className="lg:col-span-7 flex flex-col justify-between px-6 py-8 sm:px-12 lg:px-16">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 lg:hidden">
            <img
              src="/src/assets/images/college_crest_emblem_1795351453872.jpg"
              alt="Meridian Institute crest"
              referrerPolicy="no-referrer"
              className="h-9 w-9 rounded-lg border border-slate-200 bg-white object-cover"
            />
            <span className="font-display text-base font-bold text-slate-900 dark:text-white">
              Meridian Academic ERP
            </span>
          </div>
          <span className="hidden lg:inline text-xs font-medium text-slate-500 dark:text-slate-400">
            Institutional Portal Sign-In · {academicYear}
          </span>
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-[#1E2E4A] dark:bg-[#0F1B30] dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>

        <div className="mx-auto my-8 w-full max-w-md">
          <div className="mb-6">
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              Sign in to your portal
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              Select your institutional role and authenticate with your college credentials or Google SSO.
            </p>
          </div>

          {/* 4-Portal Role Selector */}
          <div className="mb-6 grid grid-cols-4 gap-1 rounded-lg bg-slate-200/70 p-1 dark:bg-[#0F1B30] dark:border dark:border-[#1E2E4A]">
            {PORTALS.map((p) => (
              <button
                key={p.role}
                type="button"
                onClick={() => {
                  setSelectedRole(p.role);
                  setError(null);
                }}
                className={`rounded-md px-2 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedRole === p.role
                    ? 'bg-white text-blue-700 shadow-sm dark:bg-blue-600 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="login-username"
                className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Username or Institutional Email
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin, teacher, student, hod"
                  autoComplete="username"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-[#1E2E4A] dark:bg-[#0F1B30] dark:text-white"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-[#1E2E4A] dark:bg-[#0F1B30] dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
                Remember username & portal
              </label>
              <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                Role-verified session
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60"
            >
              {loading ? 'Signing in...' : `Sign in as ${PORTALS.find((p) => p.role === selectedRole)?.label}`}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200 dark:bg-[#1E2E4A]" />
            <span className="text-xs text-slate-400">or continue with SSO</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-[#1E2E4A]" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-[#1E2E4A] dark:bg-[#0F1B30] dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {googleLoading ? 'Connecting Google Account...' : 'Sign in with Google'}
          </button>

          {/* Evaluation / Demo Access Panel */}
          <div className="mt-7 rounded-xl border border-slate-200 bg-white p-4 dark:border-[#1E2E4A] dark:bg-[#0F1B30]">
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                Demonstration Accounts
              </p>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Click a role to autofill
              </span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-[#1E2E4A]">
              {PORTALS.map((portal) => (
                <button
                  key={portal.role}
                  type="button"
                  onClick={() => fillDemoCredentials(portal)}
                  className="flex w-full items-center justify-between py-2 text-left text-xs transition-colors hover:text-blue-700 dark:hover:text-blue-400"
                >
                  <div>
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {portal.label}
                    </span>
                    <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
                    <span className="text-slate-500 dark:text-slate-400">{portal.note}</span>
                  </div>
                  <span className="font-mono text-[11px] text-blue-700 dark:text-blue-400 whitespace-nowrap">
                    {portal.demoUser} / {portal.demoPass}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          {collegeName} · Academic Examination Office
        </p>
      </div>
    </div>
  );
}
