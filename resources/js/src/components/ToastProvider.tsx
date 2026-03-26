import React, { createContext, useContext, useState } from 'react';

type Variant = 'created' | 'updated' | 'info' | 'success' | 'error';

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

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = (title: string, message: string, variant: Variant = 'info', duration = 5000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const t: Toast = { id, title, message, variant };
    setToasts((s) => [...s, t]);
    setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), duration);
  };

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const cls = t.variant === 'created' ? 'bg-green-mid text-black' : t.variant === 'updated' ? 'bg-green-dark text-white' : 'bg-white text-slate-900';
          return (
            <div key={t.id} className={`max-w-sm w-full shadow-lg rounded-md border p-3 pointer-events-auto ${cls} border-border-clr`}>
              <div className="font-semibold">{t.title}</div>
              <div className="text-sm mt-1 truncate">{t.message}</div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
