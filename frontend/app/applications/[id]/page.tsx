'use client';

import { isAxiosError } from 'axios';
import { MapPin, User } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import CategoryBadge from '@/components/common/CategoryBadge';
import RequestAid from '@/components/community/RequestAid';
import ResolveDialog from '@/components/community/ResolveDialog';
import { RequestActions } from '@/components/community/RequestActions';
import { ActionFeedback, InlineConfirm } from '@/components/ui/ActionFeedback';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClassName } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageContainer } from '@/components/ui/PageContainer';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { apiClient, type Application } from '@/lib/api';
import { CATEGORY_META } from '@/lib/categories';
import { useTranslation } from '@/lib/i18n';
import { mapTiles } from '@/lib/mapTiles';
import { useStore } from '@/lib/store';

const MapContainer = dynamic(() => import('@/components/common/LeafletMap'), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const LeafletIconFix = dynamic(() => import('@/components/common/LeafletIconFix'), { ssr: false });

function mapUrl(latitude: number, longitude: number) {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, language, authLoading } = useStore();
  const t = useTranslation(language);
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<'not-found' | 'failed' | null>(null);
  const [revision, setRevision] = useState(0);

  const loadApplication = useCallback(async (refresh = false, signal?: AbortSignal) => {
    if (!refresh) setLoading(true);
    setLoadError(null);
    try {
      const data = await apiClient.getApplication(id);
      if (signal?.aborted) return;
      setApplication(data);
      setRevision(current => current + 1);
    } catch (error) {
      if (signal?.aborted) return;
      setApplication(null);
      setLoadError(isAxiosError(error) && error.response?.status === 404 ? 'not-found' : 'failed');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (authLoading) return;
    const controller = new AbortController();
    void loadApplication(false, controller.signal);
    return () => controller.abort();
  }, [authLoading, loadApplication]);

  if (loading) return <PageContainer><p role="status">{t('ui.loading')}</p></PageContainer>;
  if (!application) return <PageContainer>
    <EmptyState title={t(loadError === 'not-found' ? 'request.notFound' : 'request.loadError')}
      actions={loadError === 'failed' && <Button onClick={() => loadApplication()}>{t('home.retry')}</Button>} />
  </PageContainer>;

  const isAuthor = !!user && user.id === application.user_id;
  const responses = application.responses || [];
  const creator = application.creator;
  const heading = [t((CATEGORY_META[application.category] || CATEGORY_META.food).labelKey), application.city].filter(Boolean).join(' · ');
  const position: [number, number] = [application.latitude, application.longitude];
  const media = application.media_files || [];
  const refresh = () => loadApplication(true);
  const aid = <RequestAid applicationId={application.public_id || application.id} isAuthor={isAuthor}
    responses={responses} revision={revision} onChange={refresh} showRatings={application.is_resolved && !application.is_false_call} />;
  const date = (value: string) => new Date(value).toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' });

  return <PageContainer>
    <Button variant="ghost" size="sm" className="self-start" onClick={() => router.back()}>← {t('request.back')}</Button>
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <CategoryBadge category={application.category} />
        {application.is_sos && <Badge tone="danger">SOS</Badge>}
        {(application.is_false_call || application.status === 'rejected') &&
          <StatusBadge status={application.is_false_call ? 'false_call' : 'rejected'} />}
      </div>
      <h1 className="break-words text-2xl font-bold sm:text-3xl">{heading}</h1>
      {application.rejection_reason && <p role="alert" className="rounded-md bg-red-50 p-3 text-danger-dark">
        {t('request.rejectedBecause', { reason: application.rejection_reason })}
      </p>}
    </div>
    <ApplicationActions key={id} application={application} onChange={refresh} />
    {isAuthor && application.is_resolved && !application.is_false_call && aid}

    <section className="card space-y-4">
      <h2 className="text-xl font-semibold">{t('request.detailsDescription')}</h2>
      <p className="whitespace-pre-wrap break-words text-gray-800">{application.description}</p>
      {application.needed_help && <p className="whitespace-pre-wrap break-words text-gray-700">{application.needed_help}</p>}
      {media.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {media.map((file, index) => <a key={file.id} href={'/api/uploads/' + encodeURIComponent(file.file_path)}
          target="_blank" rel="noopener noreferrer" className="rounded-lg focus-visible:ring-2 focus-visible:ring-primary">
          {file.file_type?.startsWith('image/') ? (
            <img src={'/api/uploads/' + encodeURIComponent(file.file_path)}
              alt={t('request.photoLabel', { number: index + 1, title: heading })}
              className="h-32 w-full rounded-lg object-cover sm:h-48" />
          ) : <span className="block break-all rounded-lg bg-gray-100 p-3">{file.file_path}</span>}
        </a>)}
      </div>}
    </section>
    {!(isAuthor && application.is_resolved && !application.is_false_call) && aid}
    <section className="card space-y-3">
      <h2 className="text-xl font-semibold">{t('application.location')}</h2>
      <p className="flex items-center gap-2 break-words text-gray-700">
        <MapPin aria-hidden="true" className="h-5 w-5 shrink-0" />{application.address || t('request.mapLocation')}
      </p>
      <a className="inline-block text-primary underline" href={mapUrl(...position)} target="_blank" rel="noopener noreferrer">{t('request.openMap')}</a>
      <div className="relative isolate h-[300px] overflow-hidden rounded-lg">
        <MapContainer key={id} center={position} zoom={15} className="h-full w-full">
          <LeafletIconFix />
          <TileLayer {...mapTiles} />
          <Marker position={position} />
        </MapContainer>
      </div>
      {application.delivery_details && <div className="space-y-3 pt-2">
        <h3 className="font-semibold">{t('request.deliveryRoute')}</h3>
        {(['pickup', 'dropoff'] as const).map(key => {
          const point = application.delivery_details![key];
          return <div key={key}>
            <p className="font-medium">{t(`request.delivery.${key}`)}</p>
            <p className="break-words">{point.address}</p>
            {point.entrance && <p>{t('request.entrance')}: {point.entrance}</p>}
            <a href={mapUrl(point.latitude, point.longitude)} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">{t('request.openMap')}</a>
          </div>;
        })}
      </div>}
    </section>
    {!application.is_false_call && application.status !== 'rejected' &&
      <ol aria-label={t('request.progress')} className="flex flex-wrap gap-2">
        {['pending', 'open', 'in_progress', 'completed'].filter(status => status !== 'pending' || !application.is_sos).map(status =>
          <li key={status} aria-current={status === application.status ? 'step' : undefined}
            className={'rounded-md border px-2 py-1 text-xs ' + (status === application.status ? 'border-primary font-medium text-primary' : 'text-gray-600')}>
            {t(`status.${status}`)}
          </li>)}
      </ol>}
    {application.author_contact && <section className="card flex flex-wrap items-center gap-2">
      <h2 className="font-semibold">{t('request.authorContact')}</h2>
      {application.author_contact.phone
        ? <a className="text-primary underline" href={'tel:' + application.author_contact.phone.replace(/[^+\d]/g, '')}>{application.author_contact.phone}</a>
        : <span>{t('request.noContact')}</span>}
    </section>}
    <details className="card">
      <summary className="cursor-pointer font-semibold">{t('request.details')}</summary>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {creator && <>
          <dt>{t('request.author')}</dt>
          <dd>{user?.isAdmin ? <Link className="text-primary underline" href={'/admin/users/' + creator.id}>
            {creator.first_name} {creator.last_name}
          </Link> : [creator.first_name, creator.last_name].filter(Boolean).join(' ')}</dd>
        </>}
        <dt>{t('request.created')}</dt><dd>{date(application.date)}</dd>
        {application.expires_at && <><dt>{t('request.expires')}</dt><dd>{date(application.expires_at)}</dd></>}
      </dl>
    </details>
  </PageContainer>;
}

function ApplicationActions({ application, onChange }: { application: Application; onChange: () => Promise<void> }) {
  const { user, language } = useStore();
  const t = useTranslation(language);
  const [feedback, setFeedback] = useState<{ message?: string; error?: boolean }>({});
  const [busy, setBusy] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const requestId = application.public_id || application.id;
  const isAuthor = !!user && user.id === application.user_id;
  const active = application.moderation_status === 'approved' && !application.is_resolved && !application.is_false_call;
  const canRespond = active && application.status === 'open' &&
    (!application.expires_at || Date.parse(application.expires_at) > Date.now());
  const response = application.user_response;
  const responses = application.responses || [];

  async function respond() {
    setFeedback({});
    setBusy(true);
    try {
      await apiClient.respondToApplication(requestId);
      setFeedback({ message: t('alerts.respondSuccess') });
      await onChange();
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : t('alerts.respondError'), error: true });
    } finally {
      setBusy(false);
    }
  }

  return <>
    {user?.isAdmin && <section className="card space-y-3">
      <h2 className="text-xl font-semibold">{t('request.moderation')}</h2>
      {application.is_sos && application.moderation_status === 'approved' && !application.moderated_at &&
        <Badge tone="warning">{t('admin.moderation.sosReview')}</Badge>}
      <RequestActions request={application} refresh={onChange} />
    </section>}
    {isAuthor && active && <div>
      <Button onClick={() => setShowResolve(true)}>{t('application.resolve')}</Button>
      {showResolve && <ResolveDialog helpers={responses.filter(item => item.status === 'accepted')}
        onClose={() => setShowResolve(false)} onResolve={async ratings => {
          await apiClient.resolveApplication(requestId, ratings);
          window.dispatchEvent(new Event('applications-updated'));
          await onChange();
        }} />}
    </div>}
    {!isAuthor && response && <p aria-live="polite" className="rounded-md bg-blue-50 px-3 py-2 text-sm">
      {t('response.alreadyResponded', { status: t(`response.status.${response.status}`) })}
    </p>}
    {!isAuthor && !response && (canRespond || application.status === 'pending') && <div>
      {canRespond && !user?.is_authenticated
        ? <Link href={'/login?next=' + encodeURIComponent('/applications/' + requestId)} className={buttonClassName()}>{t('request.respond')}</Link>
        : <Button disabled={!canRespond} busy={busy} onClick={respond}>{t('request.respond')}</Button>}
      <ActionFeedback {...feedback} />
    </div>}
    {(isAuthor || user?.isAdmin) && responses.length > 0 && <section className="card space-y-3">
      <h2 className="text-xl font-semibold">{t('request.responses')}</h2>
      <ul className="space-y-2">
        {responses.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 p-3">
          <div className="flex items-center gap-2">
            <User aria-hidden="true" className="h-5 w-5 text-gray-500" />
            <div>
              <Link href={'/users/' + item.responder_id} className="font-medium text-primary hover:underline">
                {item.responder?.first_name || t('review.helper')} {item.responder?.last_name}
              </Link>
              <p className="text-sm text-gray-600">{t(`response.status.${item.status}`)}</p>
            </div>
          </div>
          {active && isAuthor && item.status === 'pending' && <div className="flex flex-wrap gap-2">
            <InlineConfirm prompt={t('response.acceptPrompt')} onConfirm={async () => {
              await apiClient.acceptResponse(requestId, item.id);
              await onChange();
            }}>{t('response.accept')}</InlineConfirm>
            <InlineConfirm danger prompt={t('response.rejectPrompt')} onConfirm={async () => {
              await apiClient.rejectResponse(requestId, item.id);
              await onChange();
            }}>{t('response.reject')}</InlineConfirm>
          </div>}
        </li>)}
      </ul>
    </section>}
  </>;
}
