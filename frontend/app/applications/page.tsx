'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ListView from '@/components/home/ListView';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClassName } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { PageContainer } from '@/components/ui/PageContainer';
import { Select } from '@/components/ui/Select';
import { apiClient, type Application, type ApplicationCategory, type ApplicationStatus } from '@/lib/api';
import { ALL_CATEGORIES, CATEGORY_META } from '@/lib/categories';
import { getCityByName } from '@/lib/kazakhstanCities';
import { useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';

const PAGE_SIZE = 20;

export default function ApplicationsPage() {
  const { user, authLoading, language } = useStore();
  const t = useTranslation(language);
  const city = user?.city ? getCityByName(user.city)?.name || user.city : undefined;
  const [applications, setApplications] = useState<Application[]>([]);
  const [status, setStatus] = useState<ApplicationStatus>('active');
  const [category, setCategory] = useState<ApplicationCategory | 'all'>('all');
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const requestVersion = useRef(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setQuery(text.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [text]);

  useEffect(() => {
    if (authLoading) return;
    const request = ++requestVersion.current;
    setLoading(true);
    setLoadingMore(false);
    setError(false);
    setApplications([]);
    const refresh = () => setRevision(current => current + 1);
    apiClient.getApplicationsList({
      city, status, q: query, category: category === 'all' ? undefined : category, limit: PAGE_SIZE + 1, offset: 0,
    }).then(items => {
      if (request !== requestVersion.current) return;
      setApplications(items.slice(0, PAGE_SIZE));
      setHasMore(items.length > PAGE_SIZE);
    }).catch(() => {
      if (request === requestVersion.current) setError(true);
    }).finally(() => {
      if (request === requestVersion.current) setLoading(false);
    });
    window.addEventListener('focus', refresh);
    window.addEventListener('applications-updated', refresh);
    return () => {
      requestVersion.current++;
      window.removeEventListener('focus', refresh);
      window.removeEventListener('applications-updated', refresh);
    };
  }, [authLoading, city, status, category, query, revision]);

  async function loadMore() {
    const request = ++requestVersion.current;
    setLoadingMore(true);
    setError(false);
    try {
      const items = await apiClient.getApplicationsList({
        city, status, q: query, category: category === 'all' ? undefined : category,
        limit: PAGE_SIZE + 1, offset: applications.length,
      });
      if (request !== requestVersion.current) return;
      setApplications(current => [...current, ...items.slice(0, PAGE_SIZE)]);
      setHasMore(items.length > PAGE_SIZE);
    } catch {
      if (request === requestVersion.current) setError(true);
    } finally {
      if (request === requestVersion.current) setLoadingMore(false);
    }
  }

  function reset() {
    setText('');
    setQuery('');
    setCategory('all');
    setStatus('active');
  }

  const filtered = Boolean(text || status !== 'active' || category !== 'all');
  const resetAction = <Button variant="ghost" size="sm" onClick={reset}>{t('home.resetFilters')}</Button>;
  return <PageContainer>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-3xl font-bold">{t('applications.title')}</h1>
        {city && <Badge tone="info" className="mt-2">{city}</Badge>}
      </div>
      <Link href={user?.is_authenticated ? '/applications/new' : '/login?next=%2Fapplications%2Fnew'} className={buttonClassName()}>
        {t('home.hero.createApplication')}
      </Link>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <Input id="request-search" label={t('applications.search')} type="search" maxLength={1000}
        value={text} onChange={event => setText(event.target.value)} />
      <Select label={t('application.form.category')} value={category} onChange={setCategory}
        options={[{ value: 'all', label: t('home.allRequests') }, ...ALL_CATEGORIES.map(value => ({ value, label: t(CATEGORY_META[value].labelKey) }))]} />
      <Select label={t('ui.status')} value={status} onChange={setStatus}
        options={(['active', 'open', 'in_progress', 'completed'] as const).map(value => ({ value, label: t(`status.${value}`) }))} />
    </div>
    {filtered && (loading || error || applications.length > 0) && resetAction}
    {error && <div role="alert" className="flex items-center gap-3 text-danger-dark">{t('home.loadError')}
      <Button size="sm" variant="secondary" onClick={applications.length > 0 ? loadMore : () => setRevision(current => current + 1)}>{t('home.retry')}</Button>
    </div>}
    {loading ? <p role="status">{t('home.mapLoading')}</p>
      : applications.length ? <ListView applications={applications} />
      : !error && <EmptyState title={t('home.noApplications')} actions={filtered && resetAction} />}
    {!loading && !error && hasMore && <Button variant="secondary" busy={loadingMore}
      onClick={loadMore}>{t('common.loadMore')}</Button>}
  </PageContainer>;
}
