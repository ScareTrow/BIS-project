'use client';

import { useEffect, useRef, useState } from 'react';
import { ActionFeedback } from '@/components/ui/ActionFeedback';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { StarRating } from '@/components/ui/StarRating';
import type { ApplicationResponse, ResponseRating } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';

export default function ResolveDialog({ helpers, onResolve, onClose }: {
  helpers: ApplicationResponse[];
  onResolve: (ratings?: ResponseRating[]) => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslation(useStore(state => state.language));
  const [ratings, setRatings] = useState<Record<number, ResponseRating>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const ready = helpers.every(helper => ratings[helper.id]?.score > 0);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (element.showModal) element.showModal();
    else element.open = true;
    return () => {
      if (element.close) element.close();
      else element.open = false;
    };
  }, []);

  function update(responseId: number, fields: Partial<Pick<ResponseRating, 'score' | 'comment'>>) {
    setRatings(current => ({
      ...current,
      [responseId]: { response_id: responseId, score: current[responseId]?.score || 0,
        comment: current[responseId]?.comment || '', ...fields },
    }));
  }

  async function submit(withRatings: boolean) {
    setBusy(true);
    setError('');
    try {
      await onResolve(withRatings ? helpers.map(helper => ratings[helper.id]) : undefined);
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t('ui.action.error'));
      setBusy(false);
    }
  }

  return <dialog ref={dialog} aria-labelledby="resolve-title"
    className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg rounded-xl bg-white p-5 backdrop:bg-black/50"
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <form className="space-y-4" onSubmit={event => {
      event.preventDefault();
      if (ready && !busy) void submit(true);
    }}>
      <h2 id="resolve-title" className="text-xl font-semibold">{t('request.resolveConfirm')}</h2>
      {helpers.map(helper => <div key={helper.id} className="space-y-2 border-t pt-3">
        <p className="font-medium">
          {[helper.responder?.first_name, helper.responder?.last_name].filter(Boolean).join(' ') || t('review.helper')}
        </p>
        <StarRating value={ratings[helper.id]?.score || 0} label={t('ui.rating')}
          onChange={score => update(helper.id, { score })} />
        <Textarea id={'resolve-review-' + helper.id} label={t('review.comment')} rows={2} maxLength={1000}
          value={ratings[helper.id]?.comment || ''} onChange={event => update(helper.id, { comment: event.target.value })} />
      </div>)}
      <ActionFeedback message={error} error />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" busy={busy} disabled={!ready}>{t('request.closeApplication')}</Button>
        {helpers.length > 0 && <Button variant="secondary" disabled={busy} onClick={() => submit(false)}>
          {t('request.closeWithoutRating')}
        </Button>}
        <Button variant="ghost" disabled={busy} onClick={onClose}>{t('ui.cancel')}</Button>
      </div>
    </form>
  </dialog>;
}
