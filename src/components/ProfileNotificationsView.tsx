import React, { useState } from 'react';
import { Bell, Check, Send, UserCheck } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { AuthUser, NotificationItem } from '../shared/types';

interface ProfileNotificationsViewProps {
  user: AuthUser;
  notifications: NotificationItem[];
  onRefresh: () => Promise<void>;
  onToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

export function ProfileNotificationsView({
  user,
  notifications,
  onRefresh,
  onToast,
}: ProfileNotificationsViewProps) {
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone || '');
  const [designation, setDesignation] = useState(user.designation || '');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeMsg, setNoticeMsg] = useState('');
  const [noticeRole, setNoticeRole] = useState('all');
  const [sendingNotice, setSendingNotice] = useState(false);

  const canBroadcast = user.role === 'admin' || user.role === 'hod';

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await apiFetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName,
          phone,
          designation,
          newPassword: newPassword.trim() || undefined,
        }),
      });
      setNewPassword('');
      onToast('success', 'Profile information updated.');
      await onRefresh();
    } catch (err: unknown) {
      onToast('error', err instanceof Error ? err.message : 'Unable to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const markRead = async (id: number) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      await onRefresh();
    } catch {
      onToast('error', 'Could not update notification status.');
    }
  };

  const publishNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingNotice(true);
    try {
      await apiFetch('/api/notifications', {
        method: 'POST',
        body: JSON.stringify({
          title: noticeTitle,
          message: noticeMsg,
          targetRole: noticeRole,
          category: 'academic',
        }),
      });
      setNoticeTitle('');
      setNoticeMsg('');
      onToast('success', 'Academic notice published.');
      await onRefresh();
    } catch (err: unknown) {
      onToast('error', err instanceof Error ? err.message : 'Could not send notice.');
    } finally {
      setSendingNotice(false);
    }
  };

  const fallbackAvatar =
    user.role === 'student'
      ? '/src/assets/images/avatar_student_scholar_1795351453031.jpg'
      : user.role === 'teacher'
        ? '/src/assets/images/avatar_faculty_prof_1795351454135.jpg'
        : '/src/assets/images/avatar_admin_dean_1795351455226.jpg';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Profile & Academic Notices
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Manage your institutional account profile, credentials, and official announcements.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Profile Form */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-[#1E2E4A] dark:bg-[#0F1B30] lg:col-span-5">
          <div className="mb-5 flex items-center gap-4 border-b border-slate-200 pb-5 dark:border-[#1E2E4A]">
            <img
              src={user.avatarUrl || fallbackAvatar}
              alt={user.fullName}
              referrerPolicy="no-referrer"
              className="h-14 w-14 rounded-xl border border-slate-200 object-cover dark:border-[#1E2E4A]"
            />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {user.fullName}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {user.role.toUpperCase()} · @{user.username}
                {user.rollNumber ? ` · ${user.rollNumber}` : ''}
              </p>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-3.5">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Full Name
              </label>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Phone Number
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
              />
            </div>

            {user.role !== 'student' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Designation
                </label>
                <input
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Update Password (leave blank to keep current)
              </label>
              <input
                type="password"
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              <UserCheck className="h-3.5 w-3.5" />
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </div>

        {/* Notifications & Broadcasts */}
        <div className="space-y-6 lg:col-span-7">
          <div className="rounded-xl border border-slate-200 bg-white dark:border-[#1E2E4A] dark:bg-[#0F1B30]">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-[#1E2E4A]">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Academic Notifications ({notifications.length})
                </h2>
              </div>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-[#1E2E4A]">
              {notifications.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs text-slate-500">
                  No notifications at this time.
                </p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start justify-between gap-4 px-5 py-3.5 ${
                      n.isRead ? 'opacity-70' : ''
                    }`}
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                        {n.message}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Audience: {n.targetRole} · {new Date(n.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={() => markRead(n.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 whitespace-nowrap"
                      >
                        <Check className="h-3 w-3" />
                        Mark read
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {canBroadcast && (
            <form
              onSubmit={publishNotice}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 dark:border-[#1E2E4A] dark:bg-[#0F1B30]"
            >
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Publish Academic Notice
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <input
                  required
                  placeholder="Notice Title"
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:col-span-2 dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
                />
                <select
                  value={noticeRole}
                  onChange={(e) => setNoticeRole(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
                >
                  <option value="all">All Portals</option>
                  <option value="student">Students Only</option>
                  <option value="teacher">Teachers Only</option>
                  <option value="hod">HODs Only</option>
                </select>
              </div>
              <textarea
                required
                rows={3}
                placeholder="Write announcement details for students or faculty..."
                value={noticeMsg}
                onChange={(e) => setNoticeMsg(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#1E2E4A] dark:bg-[#080F1E] dark:text-white"
              />
              <button
                type="submit"
                disabled={sendingNotice}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" />
                {sendingNotice ? 'Publishing...' : 'Publish Notice'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
