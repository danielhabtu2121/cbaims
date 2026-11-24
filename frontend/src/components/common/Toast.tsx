import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

export const ToastItem: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(toast.id);
      }, duration);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [toast, onDismiss]);

  const typeConfig = {
    success: {
      bg: 'bg-emerald-50 border-emerald-300 text-emerald-950',
      iconColor: 'text-emerald-600',
      Icon: CheckCircle2,
      badge: 'Success',
      badgeClass: 'bg-emerald-600 text-white',
    },
    error: {
      bg: 'bg-rose-50 border-rose-300 text-rose-950',
      iconColor: 'text-rose-600',
      Icon: AlertCircle,
      badge: 'Error',
      badgeClass: 'bg-rose-600 text-white',
    },
    warning: {
      bg: 'bg-amber-50 border-amber-300 text-amber-950',
      iconColor: 'text-amber-600',
      Icon: AlertTriangle,
      badge: 'Warning',
      badgeClass: 'bg-amber-600 text-white',
    },
    info: {
      bg: 'bg-blue-50 border-blue-300 text-blue-950',
      iconColor: 'text-[#00205B]',
      Icon: Info,
      badge: 'Notice',
      badgeClass: 'bg-[#00205B] text-white',
    },
  }[toast.type];

  const { Icon, bg, iconColor, badge, badgeClass } = typeConfig;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-3.5 rounded-lg border shadow-lg max-w-md w-full transition-all duration-300 transform translate-y-0 opacity-100 ${bg}`}
    >
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${badgeClass}`}>
            {toast.title || badge}
          </span>
        </div>
        <p className="text-xs font-medium leading-relaxed whitespace-pre-line break-words text-slate-800">
          {toast.message}
        </p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-slate-400 hover:text-slate-700 transition p-1 -mr-1 -mt-1 rounded"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 pointer-events-none"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
};
