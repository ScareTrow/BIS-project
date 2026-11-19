'use client';

import type { Application } from '@/lib/api';
import { apiClient } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { ActionFeedback, InlineConfirm } from '@/components/ui/ActionFeedback';
import { Badge } from '@/components/ui/Badge';
import { buttonClassName } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import CategoryBadge from '@/components/common/CategoryBadge';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export type ModerationFilter = 'all' | 'pending' | 'approved' | 'rejected';
interface ModerationApplication extends Application {
  full_description?: string;
  moderated_at?: string;
  responses_count?: number;
  user?: { first_name: string; last_name?: string };
}

function RequestActions({ request, refresh }: { request: ModerationApplication; refresh: () => Promise<void> }) {
  const t = useTranslation(useStore(state => state.language));
  const [reason, setReason] = useState('');
  const [priority, setPriority] = useState(String(request.priority));
  const status = request.moderation_status || request.status;
  const reviewable = status === 'pending' || (request.is_sos && status === 'approved' && !request.moderated_at);
  async function perform(action: () => Promise<unknown>) {
    await action();
    await refresh();
  }
  return <>
    {reviewable && <Textarea id={`reason-${request.id}`} label={t('admin.moderation.reason')} rows={2}
      maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} />}
    <div className="flex flex-wrap items-start gap-2">
      <Link href={`/applications/${request.id}`} className={buttonClassName({ variant: 'ghost', size: 'sm' })}>{t('common.more')}</Link>
      {reviewable && <>
        <InlineConfirm prompt={t('admin.moderation.approvePrompt')} success={t('status.approved')}
          onConfirm={() => perform(() => apiClient.approveApplication(request.id))}>{t('admin.moderation.approve')}</InlineConfirm>
        <InlineConfirm prompt={t('admin.moderation.rejectPrompt')} success={t('status.rejected')} danger disabled={!reason.trim()}
          onConfirm={() => perform(() => apiClient.rejectApplication(request.id, reason.trim()))}>{t('admin.moderation.reject')}</InlineConfirm>
      </>}
      {status === 'approved' && !request.is_false_call && <InlineConfirm prompt={t('admin.moderation.falsePrompt')}
        success={t('status.false_call')} danger onConfirm={() => perform(() => apiClient.markFalseApplication(request.id))}>
        {t('status.false_call')}
      </InlineConfirm>}
    </div>
    {status !== 'rejected' && <div className="grid max-w-sm gap-2 sm:grid-cols-2 sm:items-end">
      <Select label={t('application.priority')} value={priority} onChange={setPriority}
        options={[0, 1, 2, 3, 4, 5].map(value => ({ value: String(value), label: String(value) }))} />
      <InlineConfirm prompt={t('admin.moderation.priorityPrompt')} disabled={Number(priority) === request.priority}
        onConfirm={() => perform(() => apiClient.setApplicationPriority(request.id, Number(priority)))}>
        {t('admin.moderation.priority')}
      </InlineConfirm>
    </div>}
  </>;
}

export function AdminModerationQueue({ initialFilter = 'pending', compact = false }: {
  initialFilter?: ModerationFilter; compact?: boolean;
}) {
  const { language } = useStore();
  const t = useTranslation(language);
  const [filter, setFilter] = useState<ModerationFilter>(initialFilter);
  const [applications, setApplications] = useState<ModerationApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => { setFilter(initialFilter); }, [initialFilter]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    apiClient.getAdminApplications(filter).then(items => {
      if (active) setApplications(items);
    }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filter, version]);
  const visible = compact ? applications.slice(0, 4) : applications;
  return <div className="space-y-4">
    {!compact && <Select label={t('ui.status')} value={filter} onChange={setFilter}
      options={(['all', 'pending', 'approved', 'rejected'] as const).map(value => ({ value, label: t(value === 'all' ? 'home.allRequests' : `status.${value}`) }))} />}
    {loading && <p role="status">{t('ui.loading')}</p>}
    <ActionFeedback message={error ? t('home.loadError') : undefined} error />
    {!loading && !error && visible.length === 0 && <p className="text-gray-600">{t('home.noApplications')}</p>}
    {!loading && !error && visible.map(request => <Card key={request.id} className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={request.is_false_call ? 'false_call' : request.moderation_status || request.status} />
        <CategoryBadge category={request.category} />
        {request.is_sos && <Badge tone="danger">SOS</Badge>}
        {request.is_sos && !request.moderated_at && <Badge tone="warning">{t('admin.moderation.sosReview')}</Badge>}
      </div>
      <p className="break-words">{request.full_description || request.description}</p>
      <div className="flex flex-wrap gap-3 text-sm text-gray-600">
        {request.user && <span>{request.user.first_name} {request.user.last_name}</span>}
        {request.city && <span>{request.city}</span>}
        {request.date && <time dateTime={request.date}>{new Date(request.date).toLocaleDateString(language)}</time>}
        {request.responses_count !== undefined && <span>{t('admin.responsesCount', { count: request.responses_count })}</span>}
      </div>
      <RequestActions request={request} refresh={async () => setVersion(current => current + 1)} />
    </Card>)}
  </div>;
}
