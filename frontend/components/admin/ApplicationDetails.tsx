'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ExternalLink, Mail, MapPin, Phone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiClient, type Application } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { mapTiles } from '@/lib/mapTiles';
import { useStore } from '@/lib/store';

const MapContainer = dynamic(() => import('@/components/common/LeafletMap'), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const LeafletIconFix = dynamic(() => import('@/components/common/LeafletIconFix'), { ssr: false });

const CREATED_VIA: Record<string, string> = { web: 'Сайт', telegram: 'Telegram', sos: 'SOS' };

function osmUrl(latitude: number, longitude: number) {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

/** Expanded moderation card: everything the request page shows, loaded when the card opens. */
export default function ApplicationDetails({ application, authorEmail }: { application: Application; authorEmail?: string }) {
  const t = useTranslation(useStore(state => state.language));
  const ref = application.public_id || application.id;
  const [details, setDetails] = useState<Application | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    apiClient.getApplication(ref)
      .then(result => { if (active) setDetails(result); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [ref]);

  const item = details ?? application;
  const position: [number, number] = [item.latitude, item.longitude];
  const responses = details?.responses ?? [];

  return <div className="mt-4 space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
    {error && <p role="alert" className="text-red-700">Не удалось загрузить подробности заявки. Показаны данные из списка.</p>}

    {item.needed_help && <section>
      <h3 className="mb-1 font-semibold text-gray-900">Что нужно</h3>
      <p className="whitespace-pre-wrap break-words">{item.needed_help}</p>
    </section>}

    <div className="grid gap-4 md:grid-cols-2">
      <section className="space-y-2">
        <h3 className="font-semibold text-gray-900">Место</h3>
        <p className="flex items-start gap-1 break-words"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {item.address || item.city || 'Точка на карте'}</p>
        <div className="relative isolate h-56 overflow-hidden rounded-lg border border-gray-200">
          <MapContainer center={position} zoom={15} className="h-full w-full">
            <LeafletIconFix />
            <TileLayer {...mapTiles} />
            <Marker position={position} />
          </MapContainer>
        </div>
        <a className="inline-flex items-center gap-1 text-blue-700 hover:underline" href={osmUrl(...position)} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />Открыть на OpenStreetMap
        </a>
        {item.delivery_details && <div className="space-y-2 pt-1">
          <h4 className="font-medium text-gray-900">Маршрут доставки</h4>
          {(['pickup', 'dropoff'] as const).map(key => {
            const point = item.delivery_details![key];
            return <p key={key} className="break-words">
              <span className="font-medium">{key === 'pickup' ? 'Забрать' : 'Доставить'}:</span> {point.address}
              {point.entrance && <> · подъезд {point.entrance}</>}
            </p>;
          })}
        </div>}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="mb-1 font-semibold text-gray-900">Автор</h3>
          {item.creator || authorEmail ? <div className="space-y-1">
            {item.creator && <Link href={`/admin/users/${item.creator.id}`} className="text-blue-700 hover:underline">
              {item.creator.first_name} {item.creator.last_name || ''}
            </Link>}
            {authorEmail && <p className="flex items-center gap-1"><Mail className="h-4 w-4" aria-hidden="true" />
              <a className="text-blue-700 hover:underline" href={'mailto:' + authorEmail}>{authorEmail}</a></p>}
            {item.author_contact?.phone && <p className="flex items-center gap-1"><Phone className="h-4 w-4" aria-hidden="true" />
              <a className="text-blue-700 hover:underline" href={'tel:' + item.author_contact.phone.replace(/[^+\d]/g, '')}>{item.author_contact.phone}</a></p>}
          </div> : <p>—</p>}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-gray-500">Создана</dt><dd>{formatDate(item.date)}</dd>
          <dt className="text-gray-500">Активна до</dt><dd>{formatDate(item.expires_at)}{item.duration_days ? ` (${item.duration_days} дн.)` : ''}</dd>
          {details?.created_via && <><dt className="text-gray-500">Источник</dt><dd>{CREATED_VIA[details.created_via] || details.created_via}</dd></>}
          <dt className="text-gray-500">Координаты</dt><dd>{item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}</dd>
        </dl>
        {item.rejection_reason && <div className="rounded-md bg-red-50 p-3 text-red-900">
          <p className="font-medium">Причина отклонения</p>
          <p className="whitespace-pre-wrap break-words">{item.rejection_reason}</p>
        </div>}
      </section>
    </div>

    <section>
      <h3 className="mb-1 font-semibold text-gray-900">Отклики волонтёров</h3>
      {!details && !error ? <p className="text-gray-500">Загрузка…</p> : responses.length === 0 ? <p className="text-gray-500">Откликов пока нет.</p> :
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
          {responses.map(response => <li key={response.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <Link href={`/admin/users/${response.responder_id}`} className="text-blue-700 hover:underline">
              {response.responder ? `${response.responder.first_name} ${response.responder.last_name || ''}` : `Волонтёр #${response.responder_id}`}
            </Link>
            <span className="text-gray-600">{t(`response.status.${response.status}`)} · {formatDate(response.created_at)}</span>
          </li>)}
        </ul>}
    </section>
  </div>;
}
