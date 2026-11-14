'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface ToastInput {
  message: string;
  action?: { label: string; onAction: () => void };
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<{ show: (toast: ToastInput) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback(
    (id: number) => setItems((all) => all.filter((t) => t.id !== id)),
    [],
  );

  const show = useCallback(
    (toast: ToastInput) => {
      const id = ++counter.current;
      setItems((all) => [...all.slice(-2), { ...toast, id }]);
      setTimeout(() => dismiss(id), toast.duration ?? 5000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 md:right-6 md:left-auto md:items-end"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="pointer-events-auto flex w-full max-w-105 animate-[toast-in_200ms_var(--ease-out)] items-center gap-4 rounded-ui bg-ink px-4 py-3 text-body font-medium text-bg"
          >
            <span className="min-w-0 flex-1">{item.message}</span>
            {item.action ? (
              <button
                type="button"
                className="font-semibold underline underline-offset-2"
                onClick={() => {
                  item.action?.onAction();
                  dismiss(item.id);
                }}
              >
                {item.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
