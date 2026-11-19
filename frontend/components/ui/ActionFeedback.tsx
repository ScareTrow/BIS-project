'use client';

import { useState, type ReactNode } from 'react';
import { Button } from './Button';
import { useStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';

export function ActionFeedback({ message, error = false }: { message?: string; error?: boolean }) {
  return message ? <p role={error ? 'alert' : 'status'} className={`mt-2 text-sm ${error ? 'text-danger-dark' : 'text-success'}`}>{message}</p> : null;
}

export function InlineConfirm({ children, prompt, onConfirm, success, danger = false, secondPrompt, disabled }: {
  children: ReactNode;
  prompt: string;
  onConfirm: () => Promise<unknown>;
  success?: string;
  danger?: boolean;
  secondPrompt?: string;
  disabled?: boolean;
}) {
  const t = useTranslation(useStore(state => state.language));
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ message?: string; error?: boolean }>({});
  async function confirm() {
    if (step === 1 && secondPrompt) { setStep(2); return; }
    setBusy(true);
    setFeedback({});
    try {
      await onConfirm();
      setFeedback({ message: success });
      setStep(0);
    } catch (error) {
      setFeedback({ error: true, message: error instanceof Error ? error.message : t('ui.action.error') });
    } finally {
      setBusy(false);
    }
  }
  return <div className="min-w-0">
    {!step ? <Button size="sm" variant={danger ? 'danger' : 'secondary'} disabled={disabled}
      onClick={() => { setFeedback({}); setStep(1); }}>{children}</Button> :
      <div className="space-y-2">
        <p className="text-sm text-gray-700">{step === 2 ? secondPrompt : prompt}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={danger ? 'danger' : 'primary'} busy={busy} onClick={confirm}>{t('ui.confirm')}</Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setStep(0); setFeedback({}); }}>{t('ui.cancel')}</Button>
        </div>
      </div>}
    <ActionFeedback {...feedback} />
  </div>;
}
