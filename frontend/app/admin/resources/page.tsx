'use client';

import { useEffect, useState } from 'react';
import CategoryBadge from '@/components/common/CategoryBadge';
import { InlineConfirm, ActionFeedback } from '@/components/ui/ActionFeedback';
import PhotoGallery from '@/components/common/PhotoGallery';
import { Card } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Input';
import { PageHeader, refreshAdminCounts, useRequireAdmin } from '@/components/admin/shared';
import { communityApi, type Resource } from '@/lib/community-api';
import { useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';

function ReviewCard({ resource, onReviewed }: { resource: Resource; onReviewed: () => void }) {
  const t = useTranslation(useStore(state => state.language));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  async function review(decision: 'approved' | 'rejected') {
    setBusy(true);
    try {
      await communityApi.reviewResource(resource.id, decision, reason.trim());
      onReviewed();
    } finally {
      setBusy(false);
    }
  }

  return <Card className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="text-xl font-semibold">{resource.name}</h2>
      <CategoryBadge category={resource.category} />
    </div>
    <p>{resource.city}{resource.address ? ` · ${resource.address}` : ''}</p>
    {resource.description && <p className="whitespace-pre-wrap break-words">{resource.description}</p>}
    <a className="text-primary underline" target="_blank" rel="noreferrer"
      href={`https://www.openstreetmap.org/?mlat=${resource.latitude}&mlon=${resource.longitude}#map=17/${resource.latitude}/${resource.longitude}`}>
      {t('resources.inspectMap')}
    </a>
    {!!resource.photos?.length && <PhotoGallery className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      thumbClassName="h-32 w-full rounded border object-contain"
      photos={resource.photos.map(photo => ({ src: photo, alt: t('resources.photo') }))} />}
    <Textarea id={`resource-reason-${resource.id}`} label={t('admin.moderation.reason')} rows={2}
      maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} />
    <div className="flex flex-wrap items-start gap-2">
      <InlineConfirm disabled={busy} prompt={t('resources.approvePrompt')} onConfirm={() => review('approved')}>
        {t('admin.moderation.approve')}
      </InlineConfirm>
      <InlineConfirm danger disabled={busy || !reason.trim()} prompt={t('resources.rejectPrompt')} onConfirm={() => review('rejected')}>
        {t('admin.moderation.reject')}
      </InlineConfirm>
    </div>
  </Card>;
}

export default function AdminResourcesPage() {
  const { language } = useStore();
  const ready = useRequireAdmin();
  const t = useTranslation(language);
  const [queue, setQueue] = useState<Resource[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    communityApi.resourceReviewQueue().then(rows => { if (active) setQueue(rows); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [ready]);
  if (!ready) return null;
  return <div className="space-y-4">
    <PageHeader title={t('resources.moderation')} />
    {error ? <ActionFeedback message={t('resources.loadError')} error /> : queue === null
      ? <p role="status">{t('ui.loading')}</p>
      : queue.length === 0 ? <Card><p>{t('resources.emptyQueue')}</p></Card>
      : queue.map(resource => <ReviewCard key={resource.id} resource={resource}
        onReviewed={() => {
          refreshAdminCounts();
          setQueue(rows => rows?.filter(item => item.id !== resource.id) ?? []);
        }} />)}
  </div>;
}
