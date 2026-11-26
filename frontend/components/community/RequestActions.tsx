'use client';

import type { Application } from '@/lib/api';
import { apiClient } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { InlineConfirm } from '@/components/ui/ActionFeedback';
import { Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useState } from 'react';
import { refreshAdminCounts } from '@/components/admin/shared';

export function RequestActions({ request, refresh }: { request: Application; refresh: () => Promise<void> }) {
  const t = useTranslation(useStore(state => state.language));
  const [reason, setReason] = useState('');
  const [priority, setPriority] = useState(String(request.priority));
  const status = request.moderation_status || request.status;
  const reviewable = status === 'pending' || (request.is_sos && status === 'approved' && !request.moderated_at);
  async function perform(action: () => Promise<unknown>) {
    await action();
    refreshAdminCounts();
    await refresh();
  }
  return <>
    {reviewable && <Textarea id={`reason-${request.id}`} label={t('admin.moderation.reason')} rows={2}
      maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} />}
    <div className="flex flex-wrap items-start gap-2">
      {reviewable && <>
        <InlineConfirm prompt={t('admin.moderation.approvePrompt')} success={t('status.approved')}
          onConfirm={() => perform(() => apiClient.approveApplication(request.public_id || request.id))}>{t('admin.moderation.approve')}</InlineConfirm>
        <InlineConfirm prompt={t('admin.moderation.rejectPrompt')} success={t('status.rejected')} danger disabled={!reason.trim()}
          onConfirm={() => perform(() => apiClient.rejectApplication(request.public_id || request.id, reason.trim()))}>{t('admin.moderation.reject')}</InlineConfirm>
      </>}
      {status === 'approved' && !request.is_false_call && <InlineConfirm prompt={t('admin.moderation.falsePrompt')}
        success={t('status.false_call')} danger onConfirm={() => perform(() => apiClient.markFalseApplication(request.public_id || request.id))}>
        {t('status.false_call')}
      </InlineConfirm>}
    </div>
    {status !== 'rejected' && <div className="grid max-w-sm gap-2 sm:grid-cols-2 sm:items-end">
      <Select label={t('application.priority')} value={priority} onChange={setPriority}
        options={[0, 1, 2, 3, 4, 5].map(value => ({ value: String(value), label: String(value) }))} />
      <InlineConfirm prompt={t('admin.moderation.priorityPrompt')} disabled={Number(priority) === request.priority}
        onConfirm={() => perform(() => apiClient.setApplicationPriority(request.public_id || request.id, Number(priority)))}>
        {t('admin.moderation.priority')}
      </InlineConfirm>
    </div>}
  </>;
}
