'use client';

import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';

type Toast = { id?: string; title: string; message?: string; tone?: 'info' | 'error'; durationMs?: number; onClick?: () => void };
type ActiveToast = Toast & { id: string };
const ToastContext = createContext<{
  show: (toast: Toast) => void;
  dismiss: (id: string) => void;
} | null>(null);

export function useToast() { return useContext(ToastContext); }

function ToastItem({ toast, dismiss }: { toast: ActiveToast; dismiss: (id: string) => void }) {
  const t = useTranslation(useStore(state => state.language));
  const [paused, setPaused] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (paused || closing) return;
    const timer = window.setTimeout(() => setClosing(true), toast.durationMs ?? 5000);
    return () => window.clearTimeout(timer);
  }, [closing, paused, toast.durationMs]);

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => dismiss(toast.id), 150);
    return () => window.clearTimeout(timer);
  }, [closing, dismiss, toast.id]);

  return <div className={`pointer-events-auto flex gap-2 rounded-xl border bg-white p-3 shadow-sm transition-opacity motion-reduce:transition-none ${closing ? 'opacity-0' : 'opacity-100'}`}
    onMouseEnter={() => setPaused(true)} onMouseLeave={event => setPaused(event.currentTarget.contains(document.activeElement))}
    onFocus={() => setPaused(true)} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setPaused(event.currentTarget.matches(':hover'));
    }}>
    <button type="button" className="min-w-0 flex-1 rounded-md text-left focus-visible:ring-2 focus-visible:ring-primary"
      onClick={() => { setClosing(true); toast.onClick?.(); }}>
      <span className={`block break-words font-semibold ${toast.tone === 'error' ? 'text-danger-dark' : ''}`}>{toast.title}</span>
      {toast.message && <span className="block break-words text-sm text-gray-600">{toast.message}</span>}
    </button>
    <button type="button" className="self-start rounded-md p-2 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={t('ui.close')} onClick={() => setClosing(true)}><X aria-hidden="true" className="h-4 w-4" /></button>
  </div>;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);
  const nextId = useRef(0);
  const show = useCallback((toast: Toast) => {
    const id = toast.id ?? `toast-${++nextId.current}`;
    setToasts(current => current.some(item => item.id === id) ? current : [...current, { ...toast, id }]);
  }, []);
  const dismiss = useCallback((id: string) => setToasts(current => current.filter(toast => toast.id !== id)), []);
  return <ToastContext.Provider value={{ show, dismiss }}>
    {children}
    <div role="region" aria-live="polite" className="pointer-events-none fixed right-4 top-4 z-[2100] grid w-[calc(100%-2rem)] max-w-sm gap-2">
      {toasts.map(toast => <ToastItem key={toast.id} toast={toast} dismiss={dismiss} />)}
    </div>
  </ToastContext.Provider>;
}
