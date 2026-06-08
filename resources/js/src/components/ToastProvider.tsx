import React, { createContext, useContext, useState } from 'react';
import { CheckCircleIcon, XCircleIcon, InformationCircleIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';

type Variant = 'created' | 'updated' | 'info' | 'success' | 'error' | 'warning';

interface Toast {
  id: string;
  title: string;
  message: string;
  variant?: Variant;
}

interface ToastContextValue {
  pushToast: (title: string, message: string, variant?: Variant, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

const getVariantStyles = (variant: Variant) => {
  switch (variant) {
    case 'success':
    case 'created':
      return {
        bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
        icon: 'text-green-500 dark:text-green-400',
        title: 'text-green-800 dark:text-green-300',
        message: 'text-green-700 dark:text-green-400',
        IconComponent: CheckCircleIcon,
      };
    case 'error':
      return {
        bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
        icon: 'text-red-500 dark:text-red-400',
        title: 'text-red-800 dark:text-red-300',
        message: 'text-red-700 dark:text-red-400',
        IconComponent: XCircleIcon,
      };
    case 'warning':
    case 'updated':
      return {
        bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
        icon: 'text-amber-500 dark:text-amber-400',
        title: 'text-amber-800 dark:text-amber-300',
        message: 'text-amber-700 dark:text-amber-400',
        IconComponent: ExclamationTriangleIcon,
      };
    case 'info':
    default:
      return {
        bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
        icon: 'text-blue-500 dark:text-blue-400',
        title: 'text-blue-800 dark:text-blue-300',
        message: 'text-blue-700 dark:text-blue-400',
        IconComponent: InformationCircleIcon,
      };
  }
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = (title: string, message: string, variant: Variant = 'info', duration = 5000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const t: Toast = { id, title, message, variant };
    setToasts((s) => [...s, t]);
    setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), duration);
  };

  const removeToast = (id: string) => {
    setToasts((s) => s.filter((x) => x.id !== id));
  };

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[70] flex flex-col gap-3 pointer-events-none max-w-sm w-full">
        {toasts.map((t) => {
          const styles = getVariantStyles(t.variant || 'info');
          const IconComponent = styles.IconComponent;
          return (
            <div
              key={t.id}
              className={`w-full shadow-lg rounded-xl border p-4 pointer-events-auto transform transition-all duration-300 animate-in slide-in-from-right fade-in ${styles.bg}`}
            >
              <div className="flex items-start gap-3">
                <IconComponent className={`w-5 h-5 flex-shrink-0 mt-0.5 ${styles.icon}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${styles.title}`}>{t.title}</p>
                  <p className={`text-sm mt-0.5 ${styles.message}`}>{t.message}</p>
                </div>
                <button
                  onClick={() => removeToast(t.id)}
                  className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                  <XMarkIcon className={`w-4 h-4 ${styles.icon}`} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
