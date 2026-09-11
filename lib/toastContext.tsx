'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface ToastContextType {
  showToast: (message: string, durationMs?: number) => void;
  message: string | null;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);

  const showToast = useCallback(
    (msg: string, durationMs: number = 2000) => {
      if (timer) clearTimeout(timer);
      setMessage(msg);
      const t = setTimeout(() => setMessage(null), durationMs);
      setTimer(t);
    },
    [timer]
  );

  return (
    <ToastContext.Provider value={{ showToast, message }}>
      {children}
      {message && (
        <div
          data-testid="toast"
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 bg-slate-surface text-paper-ledger px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 z-50 border border-slate-700"
        >
          <span className="text-trip-official">✓</span>
          <span className="text-sm font-medium">{message}</span>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback for isolated tests without provider: no-op toast
    return { showToast: () => {}, message: null } as ToastContextType;
  }
  return ctx;
}
