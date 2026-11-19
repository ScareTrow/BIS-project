'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { AdminModerationQueue } from '@/components/community/AdminModerationQueue';
import { Card } from '@/components/ui/Card';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { buttonClassName } from '@/components/ui/Button';

const metrics = ['total_applications', 'pending_applications', 'approved_applications', 'rejected_applications',
  'total_responses', 'volunteers_count', 'false_calls_count'] as const;

export default function AdminPage() {
  const { user, language } = useStore();
  const t = useTranslation(language);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof apiClient.getAdminStats>> | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!user?.isAdmin) return;
    let active = true;
    apiClient.getAdminStats().then(data => { if (active) setStats(data); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [user?.isAdmin]);
  if (!user?.isAdmin) return null;
  const maximum = Math.max(1, ...(stats?.category_stats ?? []).map(item => item.count));
  return <PageContainer>
    <PageHeader title={t('admin.title')} />
    <Card className="space-y-3">
      <SectionTitle>{t('admin.quickActions')}</SectionTitle>
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/applications?status=pending" className={buttonClassName({ variant: 'secondary' })}>{t('admin.moderation.title')}</Link>
        <Link href="/admin/resources" className={buttonClassName({ variant: 'secondary' })}>{t('resources.moderation')}</Link>
        <Link href="/admin/users" className={buttonClassName({ variant: 'secondary' })}>{t('admin.users.title')}</Link>
        <Link href="/admin/news" className={buttonClassName({ variant: 'secondary' })}>{t('nav.news')}</Link>
      </div>
    </Card>
    <section className="space-y-4">
      <SectionTitle>{t('admin.moderation.title')}</SectionTitle>
      <AdminModerationQueue compact />
    </section>
    {error && <p role="alert" className="text-danger-dark">{t('ui.action.error')}</p>}
    {stats && <>
      <section className="space-y-4">
        <SectionTitle>{t('admin.stats.title')}</SectionTitle>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map(key => <Card key={key}>
            <dt className="text-sm text-gray-600">{t(`admin.metric.${key}`)}</dt>
            <dd className={`mt-1 text-2xl font-semibold ${key === 'false_calls_count' ? 'text-danger-dark' : 'text-gray-900'}`}>{stats[key]}</dd>
          </Card>)}
        </dl>
      </section>
      {stats.category_stats.length > 0 && <Card className="space-y-4">
        <SectionTitle>{t('admin.categoryStats')}</SectionTitle>
        <ul className="space-y-3">
          {stats.category_stats.map(({ category, count }) => {
            const key = `category.${category.toLowerCase()}`;
            const label = t(key);
            return <li key={category} className="space-y-1">
              <div className="flex justify-between gap-2 text-sm"><span>{label === key ? t('category.unknown') : label}</span><span>{count}</span></div>
              <div className="h-2 rounded-full bg-gray-100" aria-hidden="true">
                <div className="h-full rounded-full bg-primary" style={{ width: `${100 * count / maximum}%` }} />
              </div>
            </li>;
          })}
        </ul>
      </Card>}
    </>}
  </PageContainer>;
}
