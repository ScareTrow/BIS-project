'use client';

import MapView from '@/components/home/MapView';
import SOSDialog from '@/components/home/SOSDialog';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClassName } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Select } from '@/components/ui/Select';
import { apiClient, Application, ApplicationStatus } from '@/lib/api';
import { communityApi } from '@/lib/community-api';
import { useTranslation } from '@/lib/i18n';
import { getCityByName, kazakhstanCities } from '@/lib/kazakhstanCities';
import { useStore } from '@/lib/store';
import { AlertCircle, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const defaultCity = 'Алматы';
const statuses: ApplicationStatus[] = ['active', 'open', 'in_progress'];

export default function HomePage() {
  const { user, authLoading, language, shouldRefreshApplications, setShouldRefreshApplications } = useStore();
  const t = useTranslation(language);
  const [showSOS, setShowSOS] = useState(false);
  const [status, setStatus] = useState<ApplicationStatus>('active');
  const [matching, setMatching] = useState(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guestCity, setGuestCity] = useState(defaultCity);
  const [sosCenter, setSosCenter] = useState<[number, number] | null>(null);
  const [revision, setRevision] = useState(0);
  const city = (user?.city && (getCityByName(user.city)?.name || user.city)) || guestCity;
  const cityPoint = getCityByName(city);
  const center = sosCenter || (cityPoint ? [cityPoint.lat, cityPoint.lng] as [number, number] : undefined);
  const onlyMatches = matching && !!user?.is_authenticated;

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    let latest = 0;
    async function load(refresh = false) {
      const request = ++latest;
      setLoading(true);
      setError('');
      try {
        const [points, matches] = await Promise.all([
          apiClient.getApplications(refresh, city, status),
          onlyMatches ? communityApi.matching() : Promise.resolve(null),
        ]);
        if (!active || request !== latest) return;
        const matchIds = matches && new Set(matches.map(item => item.id));
        setApplications(matchIds ? points.filter(point => matchIds.has(point.id) && point.status !== 'pending') : points);
      } catch {
        if (active && request === latest) setError('home.loadError');
      } finally {
        if (active && request === latest) setLoading(false);
      }
    }
    const refresh = () => { if (!document.hidden) void load(true); };
    void load();
    window.addEventListener('focus', refresh);
    window.addEventListener('applications-updated', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      window.removeEventListener('focus', refresh);
      window.removeEventListener('applications-updated', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [authLoading, city, status, onlyMatches, revision]);

  useEffect(() => {
    if (shouldRefreshApplications) {
      setRevision(current => current + 1);
      setShouldRefreshApplications(false);
      sessionStorage.removeItem('shouldRefreshApplications');
      sessionStorage.removeItem('lastApplicationId');
    }
  }, [shouldRefreshApplications, setShouldRefreshApplications]);

  function openSOS() {
    setShowSOS(true);
  }
  const sosAction = user?.is_authenticated
    ? <Button variant="danger" onClick={openSOS}><AlertCircle aria-hidden="true" className="h-4 w-4" />SOS</Button>
    : <Link href="/login" className={buttonClassName({ variant: 'danger' })}>SOS</Link>;

  return <PageContainer>
    <PageHeader title={t('home.hero.title')} description={t('home.hero.subtitle')} />
    <div className="flex flex-wrap gap-3">
      <Link href={user?.is_authenticated ? '/applications/new' : '/login?next=%2Fapplications%2Fnew'} className={buttonClassName()}>{t('home.hero.createApplication')}</Link>
      <a href="#request-map" className={buttonClassName({ variant: 'secondary' })}>{t('home.helpOthers')}</a>
      {sosAction}
    </div>
    {showSOS && <SOSDialog onClose={() => setShowSOS(false)} onCreated={(_id, point) => {
      setShowSOS(false);
      setSosCenter(point);
      setMatching(false);
      setStatus('open');
      setRevision(current => current + 1);
    }} />}
    <section id="request-map" aria-labelledby="request-map-title" className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle id="request-map-title">{t('home.requestMap')}</SectionTitle>
        <Badge tone="info"><MapPin aria-hidden="true" className="h-4 w-4" />{city}</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {!user?.city && <Select label={t('home.city')} value={guestCity} onChange={value => { setSosCenter(null); setGuestCity(value); }}
          options={kazakhstanCities.map(item => ({ value: item.name, label: item.name }))} />}
        <Select label={t('ui.status')} value={status} onChange={setStatus}
          options={statuses.map(value => ({ value, label: t(`status.${value}`) }))} />
        {user?.is_authenticated && <Select label={t('home.requestFilter')} value={onlyMatches ? 'matching' : 'all'}
          onChange={value => setMatching(value === 'matching')}
          options={[{ value: 'all', label: t('home.allRequests') }, { value: 'matching', label: t('home.matchingRequests') }]} />}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/applications" className="text-primary underline">{t('home.hero.viewAll')}</Link>
        {user?.is_authenticated && <Button size="sm" variant="ghost" onClick={openSOS}>{t('home.mapSOS')}</Button>}
      </div>
      {error && <p role="alert" className="text-danger-dark">{t(error)} <button type="button" className="underline" onClick={() => setRevision(current => current + 1)}>{t('home.retry')}</button></p>}
      {loading && <p role="status" className="text-gray-600">{t('home.mapLoading')}</p>}
      {!loading && !error && applications.length === 0 && <p className="text-gray-600">
        {t(onlyMatches ? 'home.noMatches' : 'home.noApplications')}{onlyMatches && <> <Link href="/profile/edit" className="text-primary underline">{t('home.preferences')}</Link></>}
      </p>}
      <MapView applications={applications} center={center} city={city} />
    </section>
  </PageContainer>;
}
