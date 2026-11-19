'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminModerationQueue, type ModerationFilter } from '@/components/community/AdminModerationQueue';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { useStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import Link from 'next/link';

function Applications() {
  const { user, language } = useStore();
  const t = useTranslation(language);
  const requested = useSearchParams().get('status');
  const filter: ModerationFilter = requested === 'approved' || requested === 'rejected' || requested === 'all' ? requested : 'pending';
  if (!user?.isAdmin) return null;
  return <PageContainer>
    <Link className="text-primary underline" href="/admin">{t('admin.title')}</Link>
    <PageHeader title={t('admin.moderation.title')} />
    <AdminModerationQueue initialFilter={filter} />
  </PageContainer>;
}

export default function AdminApplicationsPage() {
  return <Suspense><Applications /></Suspense>;
}
