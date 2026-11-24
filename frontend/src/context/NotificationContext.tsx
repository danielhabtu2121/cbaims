import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { ToastContainer, ToastMessage, ToastType } from '../components/common/Toast';
import { AlertCircle, HelpCircle, Check, X } from 'lucide-react';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
}

interface NotificationContextType {
  showToast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

// Global event bus so non-React files or legacy callbacks can trigger in-app notifications
export const IN_APP_TOAST_EVENT = 'cbaims:in-app-toast';
export const IN_APP_CONFIRM_EVENT = 'cbaims:in-app-confirm';

export function dispatchInAppToast(message: string, type: ToastType = 'info', title?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(IN_APP_TOAST_EVENT, {
        detail: { message, type, title },
      })
    );
  }
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (val: boolean) => void;
  } | null>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', title?: string, duration: number = 5000) => {
      const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
      const newToast: ToastMessage = {
        id,
        type,
        title,
        message,
        duration,
      };
      setToasts((prev) => [...prev.slice(-4), newToast]);
    },
    []
  );

  const showSuccess = useCallback((message: string, title?: string) => {
    showToast(message, 'success', title || 'Success');
  }, [showToast]);

  const showError = useCallback((message: string, title?: string) => {
    showToast(message, 'error', title || 'Error', 7000);
  }, [showToast]);

  const showWarning = useCallback((message: string, title?: string) => {
    showToast(message, 'warning', title || 'Notice', 6000);
  }, [showToast]);

  const showInfo = useCallback((message: string, title?: string) => {
    showToast(message, 'info', title || 'Information');
  }, [showToast]);

  const showConfirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmModal({
        isOpen: true,
        options,
        resolve,
      });
    });
  }, []);

  // Listen to window events from event bus
  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const custom = e as CustomEvent<{ message: string; type?: ToastType; title?: string }>;
      if (custom.detail) {
        showToast(custom.detail.message, custom.detail.type || 'info', custom.detail.title);
      }
    };
    window.addEventListener(IN_APP_TOAST_EVENT, handleToastEvent);
    return () => window.removeEventListener(IN_APP_TOAST_EVENT, handleToastEvent);
  }, [showToast]);

  // Install a safe in-app polyfill for window.alert so that ANY remaining alert() calls
  // render in-app notifications with Dashen styling instead of browser popups ("localhost says: ...")
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const originalAlert = window.alert;
      (window as any).__originalAlert = originalAlert;
      window.alert = (msg?: any) => {
        const text = String(msg ?? '');
        const lower = text.toLowerCase();
        let type: ToastType = 'info';
        let title = 'CBAIMS Notification';
        if (lower.includes('error') || lower.includes('fail') || lower.includes('cannot') || lower.includes('mandatory')) {
          type = 'error';
          title = 'Validation Notice';
        } else if (lower.includes('success') || lower.includes('saved') || lower.includes('created') || lower.includes('approved')) {
          type = 'success';
          title = 'Action Successful';
        } else if (lower.includes('warning') || lower.includes('alert') || lower.includes('notice')) {
          type = 'warning';
          title = 'Important Notice';
        }
        showToast(text, type, title, 6000);
      };

      return () => {
        window.alert = originalAlert;
      };
    }
    return undefined;
  }, [showToast]);

  const handleConfirmClose = (result: boolean) => {
    if (confirmModal) {
      confirmModal.resolve(result);
      setConfirmModal(null);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        showConfirm,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* In-App Confirmation Modal */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-full ${confirmModal.options.isDestructive
                    ? 'bg-rose-100 text-rose-600'
                    : 'bg-blue-100 text-[#00205B]'
                  }`}
              >
                {confirmModal.options.isDestructive ? (
                  <AlertCircle className="w-6 h-6" />
                ) : (
                  <HelpCircle className="w-6 h-6" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-[#101828]">
                  {confirmModal.options.title || 'Confirm Action'}
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed whitespace-pre-line">
                  {confirmModal.options.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleConfirmClose(false)}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
              >
                {confirmModal.options.cancelLabel || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmClose(true)}
                className={`px-4 py-2 text-xs font-bold rounded-lg text-white shadow-sm transition ${confirmModal.options.isDestructive
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-[#00205B] hover:bg-[#173F63]'
                  }`}
              >
                {confirmModal.options.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

export function useInAppNotification(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      showToast: (msg, type, title) => dispatchInAppToast(msg, type, title),
      showSuccess: (msg, title) => dispatchInAppToast(msg, 'success', title),
      showError: (msg, title) => dispatchInAppToast(msg, 'error', title),
      showWarning: (msg, title) => dispatchInAppToast(msg, 'warning', title),
      showInfo: (msg, title) => dispatchInAppToast(msg, 'info', title),
      showConfirm: (opts) => Promise.resolve(window.confirm(opts.message)),
    };
  }
  return context;
}
