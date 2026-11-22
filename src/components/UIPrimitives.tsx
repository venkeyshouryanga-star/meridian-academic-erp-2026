import React from 'react';
import { X, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  text: string;
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}) {
  if (!toasts.length) return null;
  return (
    <div className="no-print fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg transition-all ${
            t.type === 'success'
              ? 'border-emerald-200 bg-white text-slate-900 dark:border-emerald-900/60 dark:bg-[#0F1B30] dark:text-slate-100'
              : t.type === 'error'
                ? 'border-red-200 bg-white text-slate-900 dark:border-red-900/60 dark:bg-[#0F1B30] dark:text-slate-100'
                : 'border-blue-200 bg-white text-slate-900 dark:border-blue-900/60 dark:bg-[#0F1B30] dark:text-slate-100'
          }`}
        >
          {t.type === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
          {t.type === 'error' && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />}
          {t.type === 'info' && <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />}
          <span className="flex-1 leading-snug">{t.text}</span>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss notification"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  maxWidth = 'max-w-xl',
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
      <div
        className={`w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-[#1E2E4A] dark:bg-[#0F1B30]`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-[#1E2E4A]">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm Delete',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-[#1E2E4A] dark:bg-[#0F1B30]">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 whitespace-nowrap"
          >
            {busy ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function KpiMetric({
  label,
  value,
  meta,
  accent = 'default',
}: {
  label: string;
  value: string | number;
  meta?: string;
  accent?: 'default' | 'royal' | 'emerald' | 'indigo' | 'crimson';
}) {
  const valueTone =
    accent === 'royal'
      ? 'text-blue-700 dark:text-blue-400'
      : accent === 'emerald'
        ? 'text-emerald-700 dark:text-emerald-400'
        : accent === 'indigo'
          ? 'text-indigo-700 dark:text-indigo-400'
          : accent === 'crimson'
            ? 'text-red-700 dark:text-red-400'
            : 'text-slate-900 dark:text-white';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-[#1E2E4A] dark:bg-[#0F1B30]">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight ${valueTone}`}>
        {value}
      </p>
      {meta && (
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{meta}</p>
      )}
    </div>
  );
}

export function StatusText({ status }: { status: 'Pass' | 'Fail' | string }) {
  const isPass = status === 'Pass' || status === 'Published';
  const isFail = status === 'Fail';
  const color = isPass
    ? 'text-emerald-700 dark:text-emerald-400'
    : isFail
      ? 'text-red-700 dark:text-red-400'
      : 'text-amber-700 dark:text-amber-400';

  return (
    <span className={`font-medium text-xs ${color}`}>
      {status}
    </span>
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-slate-200 dark:divide-[#1E2E4A]">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-4 px-4 py-3.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((__, c) => (
            <div
              key={c}
              className="h-4 animate-pulse rounded bg-slate-200/80 dark:bg-slate-800"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
